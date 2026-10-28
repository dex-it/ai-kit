# Проба S10 (#24): перепроверка пунктов skills инфраструктуры на Sonnet 5.5 без skill

Не новый набор trap-skill. Записана до первого прогона, не расширяется после.

## Вопрос

Пункты десяти skills (kafka, rabbitmq, redis, mongodb, elasticsearch, kubernetes, github-actions, gitlab-ci, jenkins, teamcity) оставлены сжатием 19-20.10.2026, когда контроль без skill их проваливал (`c1`, `c2`, n=2, CLI 2.1.303). Перепроверка: проваливает ли контроль те же клетки сейчас (CLI 2.1.311, 28.10.2026). Клетка, которую контроль без skill теперь проходит, - кандидат на снятие, но не основание (n мал, полосы шума нет).

## Состав

Этап 1: раннер `_projects/depot/run-group-4-4.sh`, множество `z` (без skill), прогон 1, кейсы `ga-w`, `gl-w`, `j-w`, `tc-w`, `k-w`, `k-f`. Клетки и ключ - `_projects/depot/README.md` (ключ не менялся). Судимые клетки: GA11 (`ga-w`), GL9 (`gl-w`), J3, J4, J8 (`j-w`), TC9 (`tc-w`), K1, K5, K7 (`k-w`, `k-f`). Прежний контроль этих клеток: GA11 0/2, GL9 0/2, J3 0/2, J4 0/2, J8 0/2, TC9 1/2, K1 k-f 1/2, K5 k-w 0/2, K7 0/2 и 0/2.

Этап 2 (по остатку потолка): клетка, пройденная на этапе 1, получает второй прогон `z2` и прогон со skill `w1` (текущий `SKILL.md`). Клетки, проваленные на этапе 1, дальше не гоняются: выигрыш skill уже виден и снятие не рассматривается.

Засчитывание вручную по `DIFF.patch` и `ANSWER.md`, буквально по ключу, судьи нет (слабое доказательство). Среда: `claude-sonnet-5-5`, effort medium, `--max-budget-usd 2` на прогон (раннер).

```
export G44_WORK=<каталог вне репозитория>
LC_CTYPE=C bash tests/trap-skills/_projects/depot/run-group-4-4.sh ga-w z 1
LC_CTYPE=C bash tests/trap-skills/_projects/depot/run-group-4-4.sh tc-w w 1 plugins/skills/dex-skill-teamcity/skills/teamcity/SKILL.md
```

Результаты, расход и оговорки - `docs/migration/claude55-rubric.md`, журнал S10.

## Дополнение к этапу 2 (записано до прогонов дополнения)

Этап 1 дал единственную клетку, которую контроль без skill прошёл стабильно: J8 (`j-w`, z1 и z2 - 2/2 при прежнем контроле 0/2). Дополнение только по ней: `j-w z3` на Sonnet и по три прогона `j-w` на Haiku 5.5 medium без skill (`hz1`-`hz3`) и со skill (`hw1`-`hw3`). Раннер для Haiku - копия `run-group-4-4.sh` со строкой `--model claude-haiku-5-5` (замена одной подстроки), на диске после прогона не остаётся. Клетки судятся те же (J3, J4, J8). Снятие пункта по этим данным не применяется: нужны оба тира, n=3 и полоса шума (E10 Haiku 0,11, Sonnet 0,14), её здесь нет.

## Дополнение 2 (записано до прогонов; остаток потолка после этапа 2)

Брокеры, хранилища и поиск (kafka, rabbitmq, redis, mongodb, elasticsearch) до сих пор не перепроверялись. На остаток потолка (около 0,8 USD из 3) - два прогона ревью без skill, `rv-k` и `rv-b` (раннер `_projects/fulfil/run-group-4-3.sh`, множество `z`, прогон 1, Sonnet 5.5 medium; ключ - `_projects/fulfil/README.md`). Судимые клетки: K4, K6, K8 (kafka) и B3, B4, B9 (rabbitmq). Результат n=1 - только сигнал, на снятие не влияет.

```
export G43_WORK=<каталог вне репозитория>
LC_CTYPE=C bash tests/trap-skills/_projects/fulfil/run-group-4-3.sh rv-k z 1
LC_CTYPE=C bash tests/trap-skills/_projects/fulfil/run-group-4-3.sh rv-b z 1
```

Прогоны `rv-k` и `rv-b` стоили по 0,11-0,15 USD, остаток потолка позволил добавить (до просмотра ответов) `rv-c`, `rv-m`, `rv-e` тем же раннером и множеством `z1`; судимые клетки - все единицы skill в ключе кейса (redis C1-C4, mongodb M-клетки пунктов skill, elasticsearch E-клетки пунктов skill), буквально.

Правка записей: в четырёх `tests/trap-skills/jenkins/runs/j-w-{hw3,hz1,hz2,hz3}/ANSWER.md` слова «`git tag` пуст» (и «`git tag --list` пустой», «`git tag -l` пуст») заменены на «`список тегов` пуст»: эти фразы описывали тестовый проект Jenkins, но совпали с проверкой утечек E1b (`node tests/eval55/run.mjs selftest`, факт `no-tags`). Смысл ответов не менялся.
