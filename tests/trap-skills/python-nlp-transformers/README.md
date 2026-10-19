# python-nlp-transformers: сжатие по свидетельству, группа 4.5

Скилл `dex-skill-python-nlp-transformers` 2.0.1 ([`inputs/`](inputs/): SKILL-2.0.1.md, SKILL-n1.md, SKILL-n2.md (итоговая)), эпик #291, группа 4.5 (#306). Исход - **сжат**: 2.0.1 -> 2.1.0.

**Заход группы 4.5.** Общий для семи скиллов: `python-project-hygiene`, `python-pytorch`, `python-tensorflow`,
`python-classical-ml`, `python-computer-vision`, `python-nlp-transformers`, `python-ml-optimization`. Вход -
мини-проект [`_projects/shelfwatch`](../_projects/shelfwatch/README.md) (Python 3.12, версии закреплены `==`),
ветки `branches/<имя>`. Ключ, коды единиц, приманки, дефекты вне скилла и допустимые решения записаны до первого
прогона (коммит `44692c54`); правка ключа после прогона одна - единица N6v K-NLP, записана коммитом до пары
`c3`, `c4` (`_projects/shelfwatch/README.md`, раздел K-NLP).

**Исполнитель.** `claude -p --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config
--no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3`, инструменты
`Read, Write, Edit, Glob, Grep, Bash`, разрешён только `Bash(git *)`. Скилл подан копией `SKILL.md` через
`--add-dir` и строкой промпта, `Skill` tool не вызывается. Раннер с промптами дословно -
[`_projects/shelfwatch/run-group-4-5.sh`](../_projects/shelfwatch/run-group-4-5.sh).

**Среда и порядок.** CLI 2.1.303 (поле `claude_code_version` в журналах всех прогонов), модель
`claude-sonnet-5-5` (поле `model`), effort medium флагом; каталог прогона - клон shelfwatch в каталоге вне репозитория,
раннер отказывается стартовать при `CLAUDE.md` на пути и при `~/.claude/CLAUDE.md` (проба пройдена, `~/.claude/CLAUDE.md`
нет), `skills` и `mcp_servers` в init-событии пусты у всех прогонов, выход за каталог прогона - пусто (`esc=[]`).
Окружения Python у исполнителя нет и сказано в промпте: код не запускался, `pytest`, `ruff`, `mypy` не гонялись; все
единицы судятся на уровне кода (ключ, «Среда прогона»). Версии библиотек сверены отдельно на установленном окружении
по `uv pip compile pyproject.toml` (Python 3.12, закреплённые версии: torch 2.14.1, keras 3.15.1, scikit-learn 1.9.1,
transformers 5.20.1, optuna 5.0.0, ruff 0.17.1). Даты прогонов - 2026-10-19: контроль `c1`-`c2` (25 прогонов), пара `c3`, `c4`
K-NLP, набор `n` (редакция `n1`, 24 прогона), набор `m` (итоговые редакции pytorch, nlp-transformers, classical-ml, 14 прогонов), набор `f`
(N0 и N0K на итоговых редакциях всех семи, 4 прогона). Расход
прогонов всей группы - $5.81 (`total_cost_usd`, 67 прогонов), активации - около $1.9, потолок $30. Кейсы лежат в `runs/` того скилла, чей
предмет они мерят; общие кейсы N0 и N0K - в `python-pytorch/runs/`, RV-DDP - там же.

Число прогонов - решение 2 эпика не принято: контроль дважды, снятие при 2/2 в каждом кейсе, где единица применима.

**Кейсы скилла:** ревью RV-NLP (`review-sentiment`, N1-N16), код K-NLP (`task-sentiment`), N0, N0K. Ключ - [`_projects/shelfwatch/README.md`](../_projects/shelfwatch/README.md#ключ), коммит `44692c54`.

## Потребители

Загрузка `[справочно]` в агенте `ml-experimenter` (ветка «Text data»); бандл `ml-engineer`; кейс активации `python-nlp-in`. Вызовов узлов dex-auto нет. Нижний тир - sonnet.

## Неточности текста

- `warmup_ratio=0.1` в пункте «Без warmup» в transformers 5.20.1 нет: поля удалены из `TrainingArguments`, `warmup_steps` принимает целое число шагов или долю из [0, 1) (проверено на установленной версии; по `src/transformers/training_args.py` на тегах поле есть в v5.0.0-v5.14.0 и снято в v5.15.0, сверено 19.10.2026 - отсюда граница версии в пункте). Пункт отправлял на версию, где аргумента нет; из четырёх прогонов K-NLP без скилла два написали `warmup_ratio` (код не запустится), два не писали прогрев вовсе.
- Контроль RV-NLP повторил то же заблуждение: находка «`warmup_steps=0.1` - 0.1 шага, нужен `warmup_ratio`» в `c2` и в `n1`, `n2` (приманка NB2); в итоговой редакции `m1`, `m2` её нет.
- «2-4 эпохи» и «r=16, `q_proj` и `v_proj`» - числа без источника; контроль ловил главное и без них (N7, N11 2/2), в пункты они не пишутся.

## Контроль и вердикт

Контроль - без скилла, `c1`, `c2` на кейс (K-NLP - ещё `c3`, `c4`); выходы - `runs/<кейс>-c<N>/`, у общих кейсов - в `python-pytorch/runs/`. Единица снята, если контроль 2/2 в каждом кейсе, где она применима. «Ступень» - лестница формы ([SKILL_FRAMEWORK.md](../../../docs/SKILL_FRAMEWORK.md#форма-пункта)); набор `n` - редакция `n1`, `m` и `f` - итоговая.

| Код | Единица | Кейс | Контроль | Исход |
|---|---|---|---|---|
| N1 | токенизация по одному вместо batch | RV-NLP | 0/2 | ступень 1: `n` RV 2/2, K 2/2; пункт-название |
| N2 | `max_length` без `truncation=True` | RV-NLP; K-NLP | 2/2; 4/4 | снята |
| N3 | `padding='max_length'` на инференсе | RV-NLP; K-NLP | 2/2; 4/4 | снята |
| N4 | токенайзер не сохранён с моделью | RV-NLP; K-NLP | 2/2; 4/4 | снята |
| N5 | LR 1e-3 | RV-NLP; K-NLP | 2/2; 4/4 | снята |
| N6 | нет warmup | RV-NLP; K-NLP | 0/2; 0/4 (`warmup_ratio` у двух недействителен) | ступень 1: `n1` RV 2/2, K 1/2 (`warmup_ratio`); ступень 2 (факт версии): `m` RV 2/2, K 2/2; пункт с фактом |
| N7 | слишком много эпох | RV-NLP (приманка NB1: `eval_strategy` и `load_best_model_at_end` есть); K-NLP | не поднята как дефект; 4/4 | снята |
| N8 | весь backbone заморожен | RV-NLP; K-NLP | 2/2; 4/4 | снята; конфликт с CV закрыт |
| N9 | subword label alignment | RV-NLP | 2/2 | снята |
| N10 | нет `is_split_into_words` | RV-NLP | 2/2 (blocker) | снята |
| N11 | LoRA `r=4` и только `q_proj` | RV-NLP; K-NLP | 2/2 (minor); 4/4 | снята |
| N12 | QLoRA без compute dtype | RV-NLP; K-NLP | 2/2; 4/4 | снята |
| N13 | LoRA merge забыт перед деплоем | RV-NLP; K-NLP | 2/2; 4/4 | снята |
| N14 | инференс по одному вместо batch | RV-NLP; K-NLP | 2/2; 4/4 | снята |
| N15 | полная точность на CPU при бюджете задержки | RV-NLP | 1/2 | ступень 1: `n1` 1/2; ступень 2 (`quantize_dynamic`): `m` 2/2; пункт с фактом |
| N16 | жадная генерация | RV-NLP; K-NLP | 0/2; 0/4 | ступень 1: `n1` RV 2/2, K 2/2; пункт-название |

**Итоговая редакция** - 4 пункта:

- Токенизация по одному тексту в цикле
- Дообучение без прогрева: с transformers 5.15 прогрев задаёт `warmup_steps` (целое число шагов или доля из [0, 1)), поля `warmup_ratio` в `TrainingArguments` нет
- Генерация жадным декодированием без ограничения повторов
- Модель в полной точности на CPU при заданном бюджете задержки: `torch.quantization.quantize_dynamic` квантует веса `nn.Linear` в int8

**Охват и приманки.** RV-NLP `m1`, `m2` (итоговая редакция): N1, N6, N15, N16 2/2, N2-N5, N8-N14 сохранены, X1 (токен HF) и X2 (загрузка на каждый вызов) - оба; приманка NB2 в итоговой редакции не поднята (в `c2`, `n1`, `n2` поднималась), NB1 - minor. K-NLP `m1`, `m2`: `warmup_steps=0.1` (комментарий «в transformers 5 поля warmup_ratio нет»), `quantize_dynamic`, `repetition_penalty`, слияние адаптера, токенайзер рядом с моделью. N0, N0K - как в `python-pytorch`.

## Дубли (шаг 0)

DDP (`python-pytorch` = `python-ml-optimization`), `no_grad` (тот же двойник), AMP (`python-pytorch`, `python-tensorflow`, `python-ml-optimization`) и GridSearch (`python-ml-optimization`; в `python-classical-ml` единицы нет, есть только слово в `description`) решены до кейсов: единица мерится в одном кейсе, двойник наследует вердикт. Все DDP-, `no_grad`- и AMP-единицы сняты контролем 2/2 (RV-PT, RV-DDP, RV-TF), GridSearch снят (RV-OPT). Заморозка backbone: V8 (`python-computer-vision`) и N8 (`python-nlp-transformers`) сняты контролем 2/2, поэтому противоречие без условия исчезло вместе с пунктами.

## Открыто

- Значения «10-100x быстрее» и «4x меньше, 2-4x быстрее» из прежнего текста в пункты не вошли (нет источника).
- N15: `quantize_dynamic` назван в пункте как факт API (torch 2.14.1, `torch.quantization.quantize_dynamic` есть); влияние на точность и p95 не мерилось - модели не загружались.
- N6 (факт версии) привязан к transformers 5.x: смена версии в манифесте делает его предметом правки.
- Сторона автора для NER (N9, N10) не мерилась: кодовый кейс - тональность и сводчик.
- Решение 2 эпика (число прогонов) не принято: контроль по 2 прогона, возможны ложные снятия; перепрогон - при его принятии.
- Рез `optimize-for-llm`: у исполнителя нет `Skill`, `dex-skill-optimize-for-llm:optimize-for-llm` не вызывался - `unverifiable`; редакция в десять строк, резать нечего.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `python-nlp-transformers/SKILL.md` | 5511 символов, 107 строк | 758 символов, 13 строк | 16 единиц (ловушки, чек-лист, таблицы) -> 4 пунктов |
| `description` | триггеры по ловушкам | предмет пунктов; кейс `python-nlp-in` 3/3 на `claude-sonnet-5-5` |

Норма письма (`dex-skill-norm-writing`): носитель меньше, чем до правки; пункт - одно утверждение без оговорок, называет ситуацию, решение выводит исполнитель; факт версии (где есть) назван с версией и источником. Числа без источника в пункты не вошли.

## Синхронизации

Версия скилла 2.0.1 -> 2.1.0 (`plugin.json`, `marketplace.json`). Витрина (`plugin.json` `description`) переписана по телу и разошлась в `marketplace.json` генератором. Агенты `ml-experimenter`, `model-debugger`, `model-trainer` (1.6.0 -> 1.6.1): скобки с перечнем снятых ловушек у ссылок на скиллы заменены предметом пунктов. Бандлы и каталог не меняются: состав плагинов прежний. Кейс активации - в `tests/activation/cases.json`.
