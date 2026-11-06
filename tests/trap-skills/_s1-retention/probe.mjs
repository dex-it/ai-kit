// Проба удержания S1 (#16): text-only, плечи old (origin/develop) / new (рабочее дерево) / none, регулярные грейдеры.
// Запуск из корня репозитория: node tests/trap-skills/_s1-retention/probe.mjs <модель> <плечи через запятую> <повторов> <потолок USD> <файл jsonl> [фильтр id или skill]
import { spawn, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const WT = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const HERE = join(tmpdir(), 's1-retention') + '/';
const [model, armsArg, repsArg, capArg, outFile, filter] = process.argv.slice(2);
const arms = armsArg.split(','), reps = +repsArg, cap = +capArg;
const SK = {
  stack: ['plugins/skills/dex-skill-stack-registry/skills/stack-registry'],
  compl: ['plugins/skills/dex-skill-completeness-mapping/skills/completeness-mapping'],
  layout: ['plugins/skills/dex-skill-docs-layout/skills/docs-layout', 'references/tree.md', 'references/identifiers.md'],
  baseline: ['plugins/skills/dex-skill-project-baseline/skills/project-baseline'],
  map: ['plugins/skills/dex-skill-project-docs-map/skills/project-docs-map'],
  rulebook: ['plugins/specialists/review/dex-rulebook-miner/skills/project-rulebook', 'references/taxonomy.md', 'references/sources-ledger.md'],
};
const git = (rev, p) => execSync(`git -C ${WT} show ${rev}:${p}`, { encoding: 'utf8', maxBuffer: 1 << 26 });
function text(skill, arm) {
  const [dir, ...refs] = SK[skill];
  const rd = (p) => arm === 'old' ? git('origin/develop', p) : readFileSync(join(WT, p), 'utf8');
  let s = rd(dir + '/SKILL.md');
  for (const r of refs) s += `\n\n<!-- ${r} -->\n` + rd(dir + '/' + r);
  return s;
}
import { ALL } from './cases.mjs';
const CASES = ALL.filter(c => !filter || filter.split(',').includes(c[0]) || filter.split(',').includes(c[1]));
const jobs = [];
for (const arm of arms) for (const [id, sk, q, must] of CASES) for (let r = 1; r <= reps; r++) jobs.push({ arm, id, sk, q, must, r });
mkdirSync(join(HERE, 'w'), { recursive: true });
const sysf = {};
function sysFile(sk, arm) { const k = sk + arm; if (!sysf[k]) { const f = join(HERE, 'w', `sys-${k}.md`); writeFileSync(f, text(sk, arm)); sysf[k] = f; } return sysf[k]; }
let spent = 0, stop = false, idx = 0;
function runJob(j) {
  return new Promise((res) => {
    const args = ['-p', j.q + ' Ответь по-русски, не длиннее 150 слов.', '--model', model, '--effort', 'medium', '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', '0.6', '--strict-mcp-config', '--restricted'];
    if (j.arm !== 'none') args.push('--append-system-prompt-file', sysFile(j.sk, j.arm));
    const p = spawn('claude', args, { cwd: join(HERE, 'w'), env: process.env });
    let out = '', err = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    const t = setTimeout(() => p.kill(), 300000);
    p.on('close', (code) => { clearTimeout(t); let d = null; try { d = JSON.parse(out); } catch {}
      const result = String(d?.result ?? ''); const cost = d?.total_cost_usd ?? 0; spent += cost;
      const checks = j.must.map(re => re.test(result));
      const row = { model, arm: j.arm, id: j.id, rep: j.r, pass: !!d && !d.is_error && checks.every(Boolean), checks, cost, models: Object.keys(d?.modelUsage ?? {}), err: d ? (d.is_error ? d.subtype : '') : `код ${code}: ${err.slice(0, 200)}`, result: result.slice(0, 1200) };
      appendFileSync(outFile, JSON.stringify(row) + '\n'); res(row); });
  });
}
async function worker() { while (!stop && idx < jobs.length) { const j = jobs[idx++]; await runJob(j); if (spent >= cap) { stop = true; console.error(`СТОП: потрачено ${spent.toFixed(3)} >= ${cap}`); } } }
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`готово: ${idx}/${jobs.length} ячеек, ${spent.toFixed(3)} USD`);
