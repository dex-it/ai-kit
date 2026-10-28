// Перепроверка сохранённых ответов текущими грейдерами: node tests/trap-skills/_s3-retention/regrade.mjs in.jsonl out.jsonl
import { readFileSync, writeFileSync } from 'node:fs';
import { ALL } from './cases.mjs';
const [inp, out] = process.argv.slice(2);
const must = Object.fromEntries(ALL.map(c => [c[0], c[3]]));
const rows = readFileSync(inp, 'utf8').trim().split('\n').map(JSON.parse).map(r => { const checks = must[r.id].map(re => re.test(r.result)); return { ...r, checks, pass: !r.err && checks.every(Boolean) }; });
writeFileSync(out, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
