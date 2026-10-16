#!/usr/bin/env python3
# Прогон кодом, а не моделью: верификатор-модель путал build_ok и счётчики; вход hex - кавычки команд не портятся в шелле модели.
import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET

USAGE = "usage: verify.py HEX | --wait OUT   (HEX - hex от JSON {build, test, known, snap, hash_path})"
AHEAD = 'git rev-list --count HEAD --not --exclude="$(git branch --show-current)" --branches'
BUILD = "<build>"
ABORTED = "<aborted>"
TAIL = 60
# Bash агента без поданного timeout обрывает команду на 2 минутах: ожидание короче, дальше --wait.
WAIT = int(os.environ.get("DEX_AUTO_VERIFY_WAIT", "100"))
LIMIT = int(os.environ.get("DEX_AUTO_VERIFY_LIMIT", "3600"))
# Нестабильность точечна: массовое красное повтором не лечится, а повтор полного набора удваивает прогон.
FLAKY_MAX = int(os.environ.get("DEX_AUTO_FLAKY_MAX", "3"))
START = time.monotonic()


class Overtime(Exception):
    pass


def die(message):
    sys.stderr.write(message + "\n")
    sys.exit(64)


def sh(cmd, env=None):
    # Своя группа процессов: по потолку гасятся и внуки команды, а не только её шелл.
    p = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env, preexec_fn=os.setpgrp)
    try:
        out, _ = p.communicate(timeout=max(1, LIMIT - (time.monotonic() - START)))
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, signal.SIGKILL)
        p.communicate()
        raise Overtime()
    return p.returncode, out.decode("utf-8", "replace")


def tail(text):
    return "\n".join(text.rstrip().splitlines()[-TAIL:])


def local(tag):
    return tag.rsplit("}", 1)[-1]


def parse_reports(root):
    # TRX - встроенный логгер dotnet test, JUnit XML - прочих раннеров; раннер без отчёта отдаёт только лог.
    passed, failed, seen = 0, [], False
    for base, _, files in os.walk(root):
        for f in files:
            if not f.endswith((".xml", ".trx")):
                continue
            try:
                tree = ET.parse(os.path.join(base, f))
            except (ET.ParseError, OSError):
                continue
            for el in tree.iter():
                kind = local(el.tag)
                if kind == "testcase":
                    seen = True
                    kids = {local(c.tag) for c in el}
                    name = ".".join(x for x in (el.get("classname"), el.get("name")) if x)
                    if kids & {"failure", "error"} or el.get("failure") is not None:
                        failed.append(name)
                    elif "skipped" not in kids:
                        passed += 1
                elif kind == "UnitTestResult":
                    seen = True
                    outcome = el.get("outcome", "")
                    if outcome == "Passed":
                        passed += 1
                    elif outcome in ("Failed", "Error", "Timeout", "Aborted"):
                        failed.append(el.get("testName", ""))
                elif kind == "RunInfo" and "test run was aborted" in "".join(el.itertext()):
                    # Тест-хост упал: его тесты в отчёт не попали, и падение без имени пряталось бы за унаследованными.
                    seen = True
                    failed.append(ABORTED)
    return (passed, failed) if seen else None


def run_tests(cmd):
    d = tempfile.mkdtemp(prefix="dex-auto-junit-")
    try:
        code, out = sh(cmd, dict(os.environ, DEX_AUTO_JUNIT_DIR=d))
        return code, out, parse_reports(d)
    finally:
        shutil.rmtree(d, ignore_errors=True)


def git_hash(path, write=False):
    p = subprocess.run(["git", "hash-object"] + (["-w"] if write else []) + ["--", path], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return p.stdout.decode().strip() if p.returncode == 0 else "missing"


def verify(spec):
    build, test = spec.get("build") or "", spec.get("test") or ""
    known = set(spec.get("known") or [])
    snap = spec.get("snap") or {}
    hash_path = spec.get("hash_path") or ""
    r = {"status": "complete", "build_exit": None, "test_exit": None, "build_ok": True, "pass_count": 0, "fail_count": 0,
         "failing": [], "flaky": [], "counts": "none", "build_tail": "", "test_tail": "", "missing": ""}
    # До прогона: артефакты сборки в неигнорируемых путях иначе читаются как правки дерева.
    r["dirty"] = bool(sh("git status --porcelain")[1].strip())
    if snap.get("blob") and snap.get("path"):
        p = subprocess.run(["git", "show", snap["blob"]], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if p.returncode == 0:
            with open(snap["path"], "wb") as fh:
                fh.write(p.stdout)
            r["snap_hash"] = git_hash(snap["path"])
        else:
            r["snap_hash"] = p.stderr.decode("utf-8", "replace").strip() or "git show упал"
    try:
        if build:
            r["build_exit"], out = sh(build)
            r["build_tail"] = tail(out)
            r["build_ok"] = r["build_exit"] == 0
        if not r["build_ok"]:
            r["failing"], r["counts"] = [BUILD], "skipped"
        elif test:
            code, out, rep = run_tests(test)
            fresh = [] if rep is None else sorted(set(rep[1]) - known)
            # Красное только в первом прогоне - нестабильный тест, а не дефект правки: один повтор, если новых красных не больше FLAKY_MAX.
            if 0 < len(fresh) <= FLAKY_MAX:
                first = set(rep[1])
                code, out, rep = run_tests(test)
                if rep is not None:
                    r["flaky"] = sorted(first - set(rep[1]) - known)
            r["test_exit"], r["test_tail"] = code, tail(out)
            if rep is None:
                r.update(pass_count=None, fail_count=None, counts=None)
            else:
                # Одно имя в нескольких отчётах (тест на каждый target framework) - одно падение, как в failing.
                r.update(pass_count=rep[0], fail_count=len(set(rep[1])), failing=sorted(set(rep[1])), counts="report")
    finally:
        if snap.get("blob") and snap.get("path"):
            subprocess.run(["git", "checkout", "--", snap["path"]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    r["exit_code"] = r["build_exit"] if not r["build_ok"] else (r["test_exit"] if r["test_exit"] is not None else 0)
    r["head"] = sh("git log --oneline -3")[1].strip()
    code, out = sh(AHEAD)
    r["ahead"] = int(out.strip()) if code == 0 and out.strip().isdigit() else 0
    if "hash_path" in spec:
        r["repro_test_hash"] = "" if not hash_path else git_hash(hash_path, write=True) if os.path.isfile(hash_path) else "missing"
    return r


def blocked(why):
    return {"status": "blocked", "missing": why}


def put(out, r):
    with open(out + ".part", "w", encoding="utf-8") as fh:
        json.dump(r, fh, ensure_ascii=False)
    os.replace(out + ".part", out)


def run(hexed, out):
    try:
        put(out, verify(json.loads(bytes.fromhex(hexed).decode("utf-8"))))
    except Overtime:
        put(out, blocked("прогон дольше %d с (DEX_AUTO_VERIFY_LIMIT): команда и её процессы убиты" % LIMIT))
    except Exception as e:
        put(out, blocked("verify.py упал: %r" % e))


def alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    # Зомби отвечает на kill(0), хотя прогона уже нет.
    try:
        with open("/proc/%d/stat" % pid) as fh:
            return fh.read().split(")")[-1].split()[0] != "Z"
    except OSError:
        return True


def wait(out):
    pid_file = os.path.join(os.path.dirname(out), "pid")
    deadline = time.monotonic() + WAIT
    while True:
        if os.path.exists(out):
            with open(out, encoding="utf-8") as fh:
                print(fh.read())
            d = os.path.dirname(os.path.abspath(out))
            if os.path.basename(d).startswith("dex-auto-verify-") and os.path.basename(out) == "out.json":
                shutil.rmtree(d, ignore_errors=True)
            return
        try:
            with open(pid_file) as fh:
                pid = int(fh.read())
        except (OSError, ValueError):
            pid = None
        if pid is None or not alive(pid):
            if os.path.exists(out):
                continue
            print(json.dumps(blocked("прогон verify.py оборван до отчёта"), ensure_ascii=False))
            return
        if time.monotonic() >= deadline:
            print(json.dumps({"status": "running", "out": out}, ensure_ascii=False))
            return
        time.sleep(2)


def main():
    a = sys.argv[1:]
    if len(a) == 3 and a[0] == "--run":
        return run(a[1], a[2])
    if len(a) == 2 and a[0] == "--wait":
        return wait(a[1])
    if len(a) != 1:
        die(USAGE)
    try:
        json.loads(bytes.fromhex(a[0]).decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as e:
        die("verify.py: вход не hex от JSON (%s)" % e)
    d = tempfile.mkdtemp(prefix="dex-auto-verify-")
    out = os.path.join(d, "out.json")
    child = subprocess.Popen([sys.executable, os.path.abspath(__file__), "--run", a[0], out],
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    with open(os.path.join(d, "pid"), "w") as fh:
        fh.write(str(child.pid))
    wait(out)


if __name__ == "__main__":
    main()
