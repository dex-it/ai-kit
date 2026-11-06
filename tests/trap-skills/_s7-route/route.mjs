// Проба различимости description S7 (#21): листинг 9 skills .NET-группы и ts-vitest-jest (пара с похожим описанием), реплика пользователя, ответ - имя skill.
// Это не E7 (рост библиотеки до 30/100 не проверяется). Реплики и ожидания зафиксированы до первого прогона.
// Запуск из корня: node tests/trap-skills/_s7-route/route.mjs <модель> <повторов> <потолок USD> <файл jsonl>
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const [model, repsArg, capArg, outFile] = process.argv.slice(2);
const reps = +repsArg, cap = +capArg;
const NAMES = ['dotnet-api-development','dotnet-async-patterns','dotnet-code-quality','dotnet-csproj-hygiene','dotnet-ef-core','dotnet-logging','dotnet-resilience','dotnet-testing-patterns','dotnet-validation','ts-vitest-jest'];
const listing = NAMES.map(n => {
  const f = readFileSync(join('plugins/skills', `dex-skill-${n}`, 'skills', n, 'SKILL.md'), 'utf8');
  return `- ${n}: ${f.match(/^description:\s*"?(.*?)"?\s*$/m)[1]}`;
}).join('\n');
const U = [
 ['Новый POST /orders в ASP.NET Core: какой код ответа вернуть и что положить в Location?','dotnet-api-development'],
 ['В Swagger у enum статусов заказа одни числа без описания, поправь.','dotnet-api-development'],
 ['Метод читает файл через Task.Run(() => File.ReadAllLines(path)). Нормально?','dotnet-async-patterns'],
 ['Зачем оборачивать синхронный вызов в Task.Run, если у него есть Async-версия?','dotnet-async-patterns'],
 ['Мы включили AnalysisMode=Recommended, а category-Security.severity в .editorconfig не срабатывает.','dotnet-code-quality'],
 ['NuGetAudit не ругается на транзитивные пакеты с уязвимостями, NU1903 нет.','dotnet-code-quality'],
 ['В новом csproj скопировал NullableAndImplicitUsings из Directory.Build.props, проверь.','dotnet-csproj-hygiene'],
 ['Две библиотеки ссылаются друг на друга через ProjectReference, сборка жалуется на цикл.','dotnet-csproj-hygiene'],
 ['Выборка для отчёта на EF Core читает 50 тысяч заказов с трекингом, как ускорить?','dotnet-ef-core'],
 ['DateTime в Npgsql пишется в timestamptz, а колонка timestamp without time zone, что делать?','dotnet-ef-core'],
 ['Логирую шаги внутри одной операции через LogInformation, логи шумят, какой уровень выбрать?','dotnet-logging'],
 ['Каждая строка лога повторяет OrderId вручную. Как передать контекст проще?','dotnet-logging'],
 ['Вызов внешнего HTTP-сервиса: как расставить retry, timeout и circuit breaker через Polly?','dotnet-resilience'],
 ['Одновременные промахи IMemoryCache идут в БД все сразу, как это остановить?','dotnet-resilience'],
 ['Тест на xunit и Moq проверяет только Verify вызовов мока, хрупкий при рефакторинге.','dotnet-testing-patterns'],
 ['В unit-тесте C# мок возвращает другой мок, это норма?','dotnet-testing-patterns'],
 ['Валидатор FluentValidation: у строки нет MaximumLength, у списка нет предела.','dotnet-validation'],
 ['Для подтипов DTO написал цепочки When(x is Subtype), есть способ лучше?','dotnet-validation'],
 ['В Vitest vi.mock поднимается выше импортов, и фабрика мока не видит переменную.','ts-vitest-jest'],
 ['Тест на Jest ломается при рефакторинге: проверяет toHaveBeenCalledWith, а не результат.','ts-vitest-jest'],
];
const HERE = join(tmpdir(), 's7-route'); mkdirSync(HERE, { recursive: true });
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
