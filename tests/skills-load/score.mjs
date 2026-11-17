#!/usr/bin/env node
// score.mjs <каталог прогонов>: по `<ветка>-<n>.jsonl` (stream-json одного `claude -p`) - сколько вызовов `Skill`, какие
// ожидаемые skills загружены и есть ли в итоговом тексте поле `skills-loaded`. Платных запусков не делает: читает файлы.
// Вызов `tools.Skill` внутри REPL в stream-json виден только как вызов REPL; такие прогоны счётчик не покрывает.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED = [
  'dex-skill-dotnet-testing-patterns:dotnet-testing-patterns',
  'dex-skill-test-coverage:test-coverage',
];

export function scoreStream(text) {
  const skills = [];
  let result = '';
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type === 'assistant') {
      for (const part of ev.message?.content ?? []) {
        if (part.type === 'tool_use' && part.name === 'Skill' && typeof part.input?.skill === 'string') skills.push(part.input.skill);
      }
    } else if (ev.type === 'result' && typeof ev.result === 'string') {
      result = ev.result;
    }
  }
  return {
    skillCalls: skills.length,
    expectedLoaded: EXPECTED.filter((s) => skills.includes(s)),
    hasField: /skills-loaded/.test(result),
  };
}

export function scoreDir(dir) {
  const arms = new Map();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
    const arm = f.replace(/-\d+\.jsonl$/, '');
    const s = scoreStream(readFileSync(join(dir, f), 'utf8'));
    const a = arms.get(arm) ?? { runs: 0, withSkillCall: 0, withAllExpected: 0, withField: 0 };
    a.runs += 1;
    if (s.skillCalls > 0) a.withSkillCall += 1;
    if (s.expectedLoaded.length === EXPECTED.length) a.withAllExpected += 1;
    if (s.hasField) a.withField += 1;
    arms.set(arm, a);
  }
  return arms;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: score.mjs <каталог прогонов>'); process.exit(2); }
  for (const [arm, a] of scoreDir(dir)) {
    console.log(`${arm}: прогонов ${a.runs}, с вызовом Skill ${a.withSkillCall}, с обоими ожидаемыми ${a.withAllExpected}, с полем skills-loaded ${a.withField}`);
  }
}
