// Тело прогона: промпт проектировщика собран, как в feature.js на шаге 2а (первый прогон, дерево зелёное до правок).
const A = args
const C = CASES[A.case]
const degraded = []
const TREE = `Рабочий каталог - ${A.cwd} на текущей ветке, процесс уже в нём; всё незакоммиченное в нём - от этой работы. Ветку не переключай. Push, деплой, миграции данных и удаление вне рабочего каталога не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`
const HEAD = `mode: autonomous\nцель (${C.task}): ${C.goal}\nкритерий «готово»: ${C.done}\nграница: ${C.boundary}\nфайл цели: нет\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
const PROMPT = `${HEAD}Шаг 2а: решение по требованиям до кода.\nТребования:\n${C.requirements.join('\n')}\nФайлы: ${C.files.join(', ')}. Тесты: ${C.test_cmd || 'нет'}. Сборка: ${C.build_cmd || 'нет'}. До правок трека сборка и тесты были зелёными: любое падение внесено правками трека.`
phase('Implement')
const r = await own('проектировщик', PROMPT, { label: `design:${A.node}:${A.case}`, phase: 'Implement', schema: DESIGN }, NODE.designer)
return { ...r, degraded }
