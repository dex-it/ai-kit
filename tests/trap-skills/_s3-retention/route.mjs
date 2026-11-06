// Проба различимости description S3 (#17): листинг 18 skills группы (без остальной библиотеки), реплика пользователя, ответ - имя skill.
// Это не E7 (рост библиотеки до 30/100 не проверяется) и не E13. Реплики и ожидания зафиксированы до первого прогона.
// Запуск из корня: node tests/trap-skills/_s3-retention/route.mjs <модель> <повторов> <потолок USD> <файл jsonl>
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const [model, repsArg, capArg, outFile] = process.argv.slice(2);
const reps = +repsArg, cap = +capArg;
const NAMES = ['business-analysis-29148','system-requirements-29148','functional-requirements','nfr','requirement-quality','requirement-set-quality','use-cases-cockburn','use-case-quality','user-stories','bdd-gherkin','idea-forming','opportunity-canvas','product-discovery','prioritization','epic-planning','implementation-plan','plan-quality','verification-planning-29119'];
const listing = NAMES.map(n => {
  const f = readFileSync(join('plugins/skills', `dex-skill-${n}`, 'skills', n, 'SKILL.md'), 'utf8');
  return `- ${n}: ${f.match(/^description:\s*"?(.*?)"?\s*$/m)[1]}`;
}).join('\n');
const U = [
 ['Проверь формулировку требования «система должна быстро отвечать»: измеримо ли оно, нет ли противоречия с другим требованием?','requirement-quality'],
 ['У FR-7 метод проверки не наблюдает результат. Оцени эту единицу.','requirement-quality'],
 ['Проверь весь набор требований фичи: охват, трассировка к источнику, непротиворечивость между единицами.','requirement-set-quality'],
 ['Можно ли отдавать комплект требований в разработку, достаточен ли он по полноте?','requirement-set-quality'],
 ['Выведи функциональные требования из шагов сценария оформления заказа, с основанием у каждого правила.','functional-requirements'],
 ['Как оформить правило системы из расширения сценария и привязать его к UC?','functional-requirements'],
 ['Составь SRS фичи по ISO 29148: состав разделов, метод верификации у каждого требования, целевая стадия.','system-requirements-29148'],
 ['Какой метод верификации и уровень указать у системного требования в SRS?','system-requirements-29148'],
 ['Проверь готовые сценарии использования: расширения без исхода, смешение уровней цели.','use-case-quality'],
 ['Судья на гейте проверяет сценарий использования после переработки автором.','use-case-quality'],
 ['Напиши use case по Cockburn: цель, основной ход, расширения, минимальные гарантии.','use-cases-cockburn'],
 ['Какой уровень цели у сценария и как записать шаги основного хода?','use-cases-cockburn'],
 ['Запиши идею в one-pager и реши, брать ли её.','opportunity-canvas'],
 ['У меня сырая мысль «сделаем бота». Помоги понять, стоит ли это делать и для кого.','idea-forming'],
 ['Составь BRD фичи: бизнес-требования, MOE, границы охвата.','business-analysis-29148'],
 ['Собери feature-файл Gherkin из критериев приёмки истории.','bdd-gherkin'],
 ['Проверь план реализации перед стартом: связь шагов с требованиями.','plan-quality'],
 ['Напиши план реализации по шагам и покажи, какие шаги параллельны.','implementation-plan'],
 ['Откуда взялось число p99 latency в NFR? Оцени.','nfr'],
 ['Нарежь фичу на user stories с критериями приёмки.','user-stories'],
];
const HERE = join(tmpdir(), 's3-route'); mkdirSync(HERE, { recursive: true });
const jobs = []; for (const [q, exp] of U) for (let r = 1; r <= reps; r++) jobs.push({ q, exp, r });
let spent = 0, stop = false, idx = 0;
const run = (j) => new Promise((res) => {
  const prompt = `Список skills (имя: описание):\n${listing}\n\nЗапрос пользователя: ${j.q}\n\nОтветь одним именем skill из списка - тем, который загрузишь первым. Без пояснений.`;
  const p = spawn('claude', ['-p', prompt, '--model', model, '--effort', 'medium', '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', '0.3', '--strict-mcp-config', '--restricted'], { cwd: HERE });
  let out = ''; p.stdout.on('data', d => out += d);
  const t = setTimeout(() => p.kill(), 120000);
  p.on('close', () => { clearTimeout(t); let d = null; try { d = JSON.parse(out); } catch {}
    const result = String(d?.result ?? ''); const cost = d?.total_cost_usd ?? 0; spent += cost;
    const named = NAMES.filter(n => result.includes(n));
    const row = { model, q: j.q, exp: j.exp, rep: j.r, got: named, pass: named.length === 1 && named[0] === j.exp, cost, err: d ? '' : 'нет ответа' };
    appendFileSync(outFile, JSON.stringify(row) + '\n'); res(); });
});
async function worker() { while (!stop && idx < jobs.length) { const j = jobs[idx++]; await run(j); if (spent >= cap) { stop = true; console.error(`СТОП ${spent}`); } } }
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`готово ${idx}/${jobs.length}, ${spent.toFixed(3)} USD`);
