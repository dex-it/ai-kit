"""Общее для скриптов по транскриптам Switchyard: источники сессии, признак хука, список доступных скилов, день по Киеву."""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import zoneinfo

TRACES = os.path.expanduser("~/.switchyard/traces")
KYIV = zoneinfo.ZoneInfo("Europe/Kyiv")
END_DAY = "2026-11-24"  # конец периода исследования по Киеву, включительно; сессии позже не берутся
HOOK_TEXT = "Перед любым другим действием пройди по списку доступных скилов"
LISTING_LINE = re.compile(r"^- (?P<short>\S+)(?: \((?P<full>[^)]+)\))?:", re.M)


def need_zstd():
    if not shutil.which("zstd"):
        sys.exit("нужен zstd (архивы транскриптов ~/.switchyard/traces/*.zst): установите пакет zstd")


def kiev_day(iso):
    return dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(KYIV).date().isoformat()


def sources_of(sources, agent=False):
    """Основные транскрипты сессии (agent=False) или сабагентов (agent=True)."""
    return [s for s in json.loads(sources or "[]") if s.get("kind") == ("agent" if agent else "main") and bool(s.get("agent")) == agent]


def raw(sid, src):
    """Текст транскрипта или None, если архива нет."""
    path = os.path.join(TRACES, sid, src.get("file") or "")
    if not os.path.isfile(path):
        return None
    return subprocess.run(["zstd", "-dc", path], capture_output=True).stdout.decode("utf-8", "replace")


def main_raws(sid, sources):
    """Тексты всех основных транскриптов сессии; None, если у сессии нет архива (или любого из файлов)."""
    srcs = sources_of(sources)
    texts = [raw(sid, s) for s in srcs]
    return None if not srcs or None in texts else texts


def attachments(text):
    for line in text.splitlines():
        if '"attachment"' not in line:
            continue
        try:
            attachment = json.loads(line).get("attachment")
        except ValueError:
            continue
        if isinstance(attachment, dict):
            yield attachment


class ListingStats:
    """Счётчики разбора skill_listing: имена из поля names без своей строки, посторонние строки "- ", сверка со skillCount, имена из скобок, строки скила без описания."""

    def __init__(self):
        self.listings = self.mismatch = self.from_paren = self.missing = self.foreign = self.no_description = 0
        self.examples, self.mismatches = [], []

    def report(self):
        print(f"разбор списков: списков {self.listings}, имён из names без разобранной строки {self.missing}, "
              f"расхождений со skillCount {self.mismatch}, имён из скобок {self.from_paren}, посторонних строк '- ' (описания) {self.foreign}, "
              f"строк скила без описания {self.no_description}")
        for line in self.examples:
            print(f"  посторонняя строка: {line[:90]}")
        for found, count in self.mismatches[:5]:
            print(f"  расхождение: разобрано {found}, skillCount {count}")


def listing_names(content, names=None, stats=None):
    """Имена скилов (без префикса плагина) из текста skill_listing. Формат строки: `- plugin:name: ...` или `- plugin:обрезанное (plugin:полное): ...`.
    names - поле names вложения (в нём имя как в строке до скобок): строки "- ..." из описаний скилов (там тоже бывают маркированные списки) отсеиваются по нему."""
    tokens, parenthesized, foreign, bare = [], 0, 0, 0
    for line in content.splitlines():
        if not line.startswith("- "):
            continue
        match = LISTING_LINE.match(line)
        if match is None or (names is not None and match.group("short") not in names):
            foreign += 1
            if stats is not None and len(stats.examples) < 5:
                stats.examples.append(line)
            continue
        parenthesized += bool(match.group("full"))
        bare += not line[match.end():].strip()
        tokens.append((match.group("short"), match.group("full") or match.group("short")))
    if stats is not None:
        stats.foreign += foreign
        stats.from_paren += parenthesized
        stats.no_description += bare
        stats.missing += len(set(names) - {short for short, _ in tokens}) if names is not None else 0
    return [full.split(":")[-1] for _, full in tokens]


def scan(text, stats=None):
    """(есть ли запись хука UserPromptSubmit с напоминанием, имена скилов из skill_listing без префикса плагина)."""
    hook, listed = False, set()
    for a in attachments(text):
        if a.get("type") == "hook_additional_context" and a.get("hookEvent") == "UserPromptSubmit":
            hook = hook or any(HOOK_TEXT in str(part) for part in a.get("content") or [])
        elif a.get("type") == "skill_listing":
            names = a.get("names")
            found = listing_names(a.get("content") or "", set(names) if names else None, stats)
            listed.update(found)
            if stats is not None:
                stats.listings += 1
                count = a.get("skillCount")
                if count is not None and count != len(found):
                    stats.mismatch += 1
                    stats.mismatches.append((len(found), count))
    return hook, listed


def opened_skills(text):
    """Имена скилов (без префикса плагина), которые транскрипт открыл вызовом Skill."""
    opened = set()
    for line in text.splitlines():
        if '"Skill"' not in line:
            continue
        try:
            message = json.loads(line).get("message")
        except ValueError:
            continue
        for part in (message.get("content") if isinstance(message, dict) else None) or []:
            if isinstance(part, dict) and part.get("type") == "tool_use" and part.get("name") == "Skill":
                opened.add(str((part.get("input") or {}).get("skill", "")).split(":")[-1])
    return opened


class Names:
    """Нормализация обрезанных имён в skill_listing: имя, которое является строгим префиксом ровно одного известного полного имени, заменяется на него.
    Известные полные имена - имена из всех списков и открытых Skill, не являющиеся префиксом другого имени, и открытые имена, у которых больше одного продолжения."""

    def __init__(self):
        self.listed, self.opened = set(), set()
        self.known = None
        self.pairs = {}  # обрезанное -> полное
        self.ambiguous = set()
        self.replaced = self.unclear = 0  # замен и неоднозначных имён по всем вызовам apply (на одну сущность списка)
        self.sessions = set()

    def add(self, listed, opened=()):
        self.listed |= listed
        self.opened |= set(opened)

    def build(self):
        union = self.listed | self.opened  # открытое имя тоже бывает обрезанным: модель берёт его из списка
        completions = {n: [o for o in union if o != n and o.startswith(n)] for n in union}
        # открытое имя с несколькими продолжениями (upcore при upcore-code, upcore-ef...) - настоящее, а не обрезанное
        self.known = {n for n in union if not completions[n] or (n in self.opened and len(completions[n]) > 1)}

    def full(self, name):
        """Полное имя для обрезанного (без учёта в счётчиках); остальное как есть."""
        full = [k for k in self.known if k.startswith(name)] if name not in self.known else []
        return full[0] if len(full) == 1 else name

    def apply(self, key, listed):
        """Список сессии (или транскрипта) key с заменой обрезанных имён."""
        result = set()
        for name in listed:
            if name in self.known:
                result.add(name)
                continue
            full = [k for k in self.known if k.startswith(name)]
            if len(full) == 1:
                self.pairs[name] = full[0]
                self.replaced += 1
                self.sessions.add(key)
                result.add(full[0])
            else:
                if len(full) > 1:
                    self.ambiguous.add(name)
                    self.unclear += 1
                    self.sessions.add(key)
                result.add(name)
        return result

    def report(self):
        print(f"обрезанных имён в списках: {len(self.sessions)} сессий, нормализовано {self.replaced}, неоднозначных {self.unclear}")
        for short, full in sorted(self.pairs.items()):
            print(f"  {short} -> {full}")
        for short in sorted(self.ambiguous):
            print(f"  {short} -> неоднозначно")
