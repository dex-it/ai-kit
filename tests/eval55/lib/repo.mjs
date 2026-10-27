// Репозиторий стенда и состав нормативного слоя на коммите прогона. Всё, что условия строят из репозитория (корневой AGENTS.md
// для E1 и E2, каталог skills для E7), читается из `--commit`, а не из рабочего дерева: песочница собирается из того же коммита (git archive).
// EVAL55_REPO подменяет корень (для офлайн-теста); по умолчанию - репозиторий, в котором лежит стенд.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = process.env.EVAL55_REPO ? resolve(process.env.EVAL55_REPO) : resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const GIT_ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_PAGER: 'cat' };
const git = (args, opt = {}) => spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 1 << 26, env: GIT_ENV, ...opt });

/** Полный хэш коммита; неизвестная ревизия - ошибка (иначе серия молча пошла бы на другом составе). */
export function resolveCommit(rev = 'HEAD') {
  const r = git(['rev-parse', '--verify', `${rev}^{commit}`]);
  if (r.status !== 0) throw new Error(`--commit ${rev}: нет такого коммита в ${ROOT}`);
  return r.stdout.trim();
}

/** Текст файла на коммите. */
export function showAt(commit, path) {
  const r = git(['show', `${commit}:${path}`]);
  if (r.status !== 0) throw new Error(`нет ${path} на коммите ${commit.slice(0, 8)}: ${r.stderr.trim()}`);
  return r.stdout;
}

/** Корневой файл норм на коммите (AGENTS.md; CLAUDE.md на нём - ссылка @AGENTS.md). */
export const rootNorm = (commit) => showAt(commit, 'AGENTS.md');

const trees = new Map();
/** Каталог с выгрузкой путей коммита (git archive); удаляется при выходе процесса. */
export function exportAt(commit, paths) {
  const k = `${commit}|${paths.join(',')}`;
  if (trees.has(k)) return trees.get(k);
  const dir = mkdtempSync(join(tmpdir(), 'eval55-tree-'));
  const a = git(['archive', commit, '--', ...paths], { encoding: 'buffer' });
  const t = a.status === 0 ? spawnSync('tar', ['-x', '-C', dir], { input: a.stdout }) : a;
  if (t.status !== 0) { rmSync(dir, { recursive: true, force: true }); throw new Error(`git archive ${commit.slice(0, 8)}: ${a.stderr}`); }
  trees.set(k, dir);
  return dir;
}
process.on('exit', () => { for (const d of trees.values()) rmSync(d, { recursive: true, force: true }); });
