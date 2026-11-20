import json, re, sys
kits = sys.argv[1]
D = {
 "content-ru": {
  "debugging": "Метод поиска причины бага: воспроизвести, гипотезы с опровержением, замер вместо рассуждения, разметка логами, лестница инструментов от чтения кода до отладчика, замеры скорости. Активируется при: баг, ошибка, падает тест, не работает, почему так, ожидалось одно - получилось другое, цифры не сошлись, расхождение, отладка, дебаг, регресс, медленно.",
  "code-writing": "Правила написания кода: что чаще всего замечают на ревью (лишние комментарии, нечитаемые имена, обёртки и дубли, изобретённое заново), лестница «нужно ли -> есть ли в репозитории -> в библиотеке -> своё», правки файла крупными Edit. Активируется при: написать код, добавить функцию, метод, класс, поправить, исправить баг, правка по ревью, тест, фикстура, рефакторинг.",
  "code-general": "Общие правила кода на любом языке: нейминг, бизнес-читаемость, упрощение, комментарии, лишний код. Активируется при: написание или правка кода, имя переменной или функции, читаемость, упрощение, комментарий в коде, дубли.",
  "definition-of-done": "Критерии готовности: сборка без новых предупреждений, матрица проверки поведения «сценарий / ожидание / факт», сверка с эталоном, кросс-валидация, риски на сдаче, ловушка «почти совпало». Активируется при: готово, сделано, сдача задачи, проверить, работает ли, покрыто ли, учтено ли, тест прошёл, приёмка, DoD.",
 },
 "content-en": {
  "debugging": "Root-cause method for bugs: reproduce, falsify hypotheses, measure instead of reasoning, log tracing, tool ladder from reading code to debugger, performance measurements. Use when: bug, error, failing test, doesn't work, why does it, expected X got Y, numbers don't match, discrepancy, debugging, regression, slow.",
  "code-writing": "Code writing rules: what reviewers flag most (extra comments, unreadable names, wrappers and duplicates, reinventing existing code), the ladder 'needed? -> exists in repo -> in library -> write own', editing files in large Edit blocks. Use when: writing code, adding a function, method or class, fixing a bug, review fix, test, fixture, refactoring.",
  "code-general": "General code rules for any language: naming, business readability, simplification, comments, dead code. Use when: writing or editing code, naming variables or functions, readability, simplification, code comments, duplicates.",
  "definition-of-done": "Definition of done: build without new warnings, behavior check matrix 'scenario / expected / actual', comparison with baseline, cross-validation, risks named at handoff, the 'almost matched' trap. Use when: done, finished, handing off a task, verify, does it work, is it covered, is it handled, test passes, acceptance, DoD.",
 },
}
for kit, descs in D.items():
    for skill, text in descs.items():
        p = f"{kits}/{kit}/skills/claude-rules-{skill}/SKILL.md"
        s = open(p, encoding="utf-8").read()
        s, n = re.subn(r"^description: .*$", "description: " + json.dumps(text, ensure_ascii=False), s, count=1, flags=re.M)
        assert n == 1, p
        open(p, "w", encoding="utf-8").write(s)
