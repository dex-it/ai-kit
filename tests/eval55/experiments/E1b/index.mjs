// E1b - банк памяти против дома факта: `none` (без `.memory-bank/` и указателя), `bank` (как слит в develop), `home` (те же факты
// одним абзацем в существующем доме, docs/guide/contributing/pull-requests.md, без банка).
// Гипотеза (PREREG): `home` не хуже `bank`; тогда банк остаётся индексом без роста. Условие `home` отделяет эффект механизма от эффекта самого факта.
// Кейсов 10: четыре зависят от фактов банка (`release.md`, `history.md`), шесть контрольных - задачи сопровождения, ответ на которые
// лежит в коде и нормах (правка по описанию, снятие плагина, переименование агента, новое правило валидатора, новый термин, вопрос по документации).
// Среда - копия репозитория на коммите прогона (git archive, без истории git): зависимые задачи измеряют наличие факта в тексте, а не умение
// искать его в git. Из песочницы всех условий убран `tests/eval55`: стенд хранит ответы (грейдеры, формулировки фактов).
// Факт зависимой задачи не должен читаться из других файлов, иначе условие `none` его решит и контроль перестанет различать:
// `audit` сверяет это по дереву коммита (запускается в `run.mjs selftest` и в офлайн-тесте).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, showAt } from '../../lib/repo.mjs';

const SKILL = 'plugins/skills/dex-skill-redis/skills/redis/SKILL.md';
const REDIS_PJ = 'plugins/skills/dex-skill-redis/.claude-plugin/plugin.json';
const HYGIENE = 'dex-skill-python-project-hygiene';
const BUNDLE_PJ = 'plugins/bundles/dex-bundle-ml-engineer/.claude-plugin/plugin.json';
const BDD_DIR = 'plugins/specialists/product/dex-bdd-author';
const VALIDATOR = 'tools/validate-readme.js';
const MARKETPLACE = '.claude-plugin/marketplace.json';
const DICTIONARY = 'docs/domain/domain-model.md';
const BANK = ['.memory-bank/INDEX.md', '.memory-bank/release.md', '.memory-bank/history.md'];
const HOME_FILE = 'docs/guide/contributing/pull-requests.md';
const HOME_ANCHOR = 'Изменения доходят до `main` отдельным слиянием.';
const POINTER = ' Выпуск и нумерация `#N` двух репозиториев - `.memory-bank/INDEX.md` (по требованию, без `@`).';

// Факты банка, от которых зависят задачи. `re` - формулировка, общая у банка и у `home` (аудит сверяет оба текста);
// `leak` - широкий образец: если он находит факт где-то ещё в песочнице `none`, задача различать условия не может.
const FACTS = {
  'merge-no-squash': { re: /обычным merge-коммитом, \*\*без squash\*\*/, leak: /без\s+squash|без\s+сквош/i },
  'develop-keep': { re: /`develop` не удалять/, leak: /develop[^\n]{0,40}не удал|не удал[^\n]{0,40}develop/i },
  'no-tags': { re: /Тегов и GitHub Releases нет/, leak: /тегов\s+и\s+(GitHub\s+)?Releases?\s+нет|нет\s+(ни\s+)?тегов,?\s+ни\s+(GitHub\s+)?Releases?|git\s+tag\W[^\n]{0,60}пуст/i },
  'all-merge-methods': { re: /включены все три способа слияния/, leak: /все\s+три\s+способа|allow_squash_merge|allow_merge_commit/i },
  'old-repo-until': { re: /До 2026-10-24 работа шла в `dex-it\/claude-code-marketplace`/, leak: /до\s+(2026-10-24|24\.10\.2026|24\s+октября)\s+работа|(переех|перенес|переимен)\S*[^\n]{0,80}(2026-10-24|24\.10\.2026|24\s+октября)|(2026-10-24|24\.10\.2026|24\s+октября)[^\n]{0,80}(переех|перенес|переимен)/i },
  'precedent-pr': { re: /Источник: тело PR #6 \(релиз 6\.27\.0\)/, leak: /(релиз|release)[^\n]{0,60}PR\s*#6\b|PR\s*#6\b[^\n]{0,60}(релиз|release)/i },
  'own-numbering': { re: /В `dex-it\/ai-kit` нумерация своя, с `#1`/, leak: /нумераци\S*\s+(своя|с\s+`?#1)/i },
};

// Те же факты одним абзацем в существующем доме. Формулировки совпадают с банком там, где их проверяет `audit`.
const HOME_TEXT = [
  'Релиз `develop` -> `main` - PR целиком. Сливается обычным merge-коммитом, **без squash**, чтобы история `develop` осталась в `main`; `develop` не удалять.',
  'PR фичи в `develop` сливается squash-ем.',
  'Настройка репозитория не защищает от ошибки: на 2026-10-26 включены все три способа слияния.',
  'Источник: тело PR #6 (релиз 6.27.0).',
  'Тегов и GitHub Releases нет; версия каталога - `version` в `.claude-plugin/marketplace.json`, `main` - канал поставки.',
  'До 2026-10-24 работа шла в `dex-it/claude-code-marketplace` (в архиве): `#N` в сообщениях коммитов и текстах до переезда - PR и issues того репозитория.',
  'В `dex-it/ai-kit` нумерация своя, с `#1`; диапазоны пересекаются, номер без репозитория неоднозначен.',
].join(' ');

const sub = (path, from, to) => (dir) => {
  const p = join(dir, path); const t = readFileSync(p, 'utf8');
  if (!t.includes(from)) throw new Error(`prepare: нет фрагмента в ${path}: ${from}`);
  writeFileSync(p, t.replace(from, to));
};
const seq = (...fs) => (dir) => fs.forEach((f) => f(dir));
const dropBank = seq((dir) => rmSync(join(dir, '.memory-bank'), { recursive: true, force: true }), sub('AGENTS.md', POINTER, ''));
const COND = {
  none: dropBank,
  bank: () => {},
  home: seq(dropBank, sub(HOME_FILE, HOME_ANCHOR, `${HOME_ANCHOR}\n\n${HOME_TEXT}`)),
};

const nextMinor = (v) => { const [a, b] = v.split('.').map(Number); return `${a}.${b + 1}.0`; };
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const versionOf = (commit, path, top) => {
  const t = showAt(commit, path);
  const m = top ? /^ {2}"version": "([^"]+)"/m.exec(t) : /"version":\s*"([^"]+)"/.exec(t);
  if (!m) throw new Error(`нет версии в ${path} на коммите ${commit.slice(0, 8)}`);
  return m[1];
};

const NOTE = ' Файлы не меняй. Если точного ответа в файлах нет, дай наиболее вероятный. Последней строкой ответа - JSON-объект ';
const answer = (fields) => ({ type: 'json-fields', id: 'answer', fields });
const CMD = (id, ...run) => ({ type: 'cmd', id, run });
const VALIDATE_SKILLS = CMD('skills-valid', 'node', 'tools/validate-skill.js', 'all');
const SYNC = CMD('marketplace-in-sync', 'node', 'tools/sync-marketplace.js', '--check');

function cases(commit) {
  const catalog = nextMinor(versionOf(commit, MARKETPLACE, true));
  const bundle = nextMinor(versionOf(commit, BUNDLE_PJ));
  return [
    // зависят от фактов банка
    { id: 'release-merge', facts: ['merge-no-squash', 'develop-keep', 'precedent-pr'],
      prompt: `Готовлю релиз: PR \`develop\` -> \`main\` с накопленными изменениями. Каким способом его слить на GitHub (merge, squash или rebase), что сделать с веткой \`develop\` после слияния (keep - оставить, delete - удалить) и в каком PR репозитория dex-it/ai-kit описан порядок прошлого релиза (номер)?${NOTE}{"merge_method": "merge|squash|rebase", "develop_after_merge": "keep|delete", "precedent_pr": число}`,
      graders: [answer({ merge_method: 'merge', develop_after_merge: 'keep', precedent_pr: 6 })] },
    { id: 'release-tag', facts: ['no-tags'],
      prompt: `Выпускаю очередную версию каталога. Нужно ли создавать git-тег и нужен ли GitHub Release?${NOTE}{"git_tag": true|false, "github_release": true|false}`,
      graders: [answer({ git_tag: false, github_release: false })] },
    { id: 'ref-repo-by-date', facts: ['old-repo-until', 'own-numbering'],
      prompt: `В истории проекта встретились два коммита, оба со ссылкой \`(#42)\` без указания репозитория: один от 2026-10-23, другой от 2026-10-25. В каком репозитории (формат владелец/имя) открыт номер #42 у каждого из них?${NOTE}{"2026-10-23": "владелец/имя", "2026-10-25": "владелец/имя"}`,
      graders: [answer({ '2026-10-23': 'dex-it/claude-code-marketplace', '2026-10-25': 'dex-it/ai-kit' })] },
    { id: 'merge-settings', facts: ['all-merge-methods'],
      prompt: `Ограничивают ли настройки репозитория GitHub способы слияния PR: отключён ли хотя бы один из способов merge, squash, rebase?${NOTE}{"some_method_disabled": true|false}`,
      graders: [answer({ some_method_disabled: false })] },
    // контрольные
    { id: 'redis-keyword', prompt: 'Добавь ключевое слово Redlock в description skill redis (plugins/skills/dex-skill-redis) и доведи изменения до состояния, готового к коммиту.',
      graders: [
        { type: 'file-matches', id: 'keyword', path: SKILL, regex: 'Redlock' },
        { type: 'file-matches', id: 'version-bumped', path: REDIS_PJ, regex: '"version":\\s*"1\\.2\\.2"' },
        SYNC, VALIDATE_SKILLS,
      ] },
    { id: 'remove-plugin', prompt: `Сними плагин ${HYGIENE} с каталога: предмет модель держит без skill (контрольные прогоны). Доведи изменения до состояния, готового к коммиту.`,
      graders: [
        { type: 'file-not-matches', id: 'plugin-removed', path: `plugins/skills/${HYGIENE}/.claude-plugin/plugin.json`, regex: '.' },
        { type: 'file-not-matches', id: 'not-in-catalog', path: MARKETPLACE, regex: HYGIENE },
        { type: 'file-matches', id: 'removed-row', path: 'install-bundle/README.md', regex: `^\\| \`${HYGIENE}\``, flags: 'mu' },
        { type: 'file-matches', id: 'catalog-version-bumped', path: MARKETPLACE, regex: `^ {2}"version": "${reEsc(catalog)}"`, flags: 'mu' },
        { type: 'file-matches', id: 'bundle-version-bumped', path: BUNDLE_PJ, regex: `"version":\\s*"${reEsc(bundle)}"` },
        VALIDATE_SKILLS, SYNC,
        CMD('bundles-valid', 'node', 'tools/validate-bundle.js', 'all'),
        CMD('readme-valid', 'node', 'tools/validate-readme.js', 'all'),
      ] },
    { id: 'rename-agent', prompt: `Переименуй агента bdd-author в bdd-writer: поле name и файл агента. Плагин dex-bdd-author не переименовывай. Доведи изменения до состояния, готового к коммиту.`,
      graders: [
        { type: 'file-exists', id: 'agent-file-renamed', path: `${BDD_DIR}/agents/bdd-writer.md` },
        { type: 'file-not-matches', id: 'old-file-gone', path: `${BDD_DIR}/agents/bdd-author.md`, regex: '.' },
        { type: 'file-matches', id: 'name-changed', path: `${BDD_DIR}/agents/bdd-writer.md`, regex: '^name: bdd-writer$', flags: 'mu' },
        { type: 'file-not-matches', id: 'command-ref', path: `${BDD_DIR}/commands/bdd.md`, regex: 'dex-bdd-author:bdd-author' },
        { type: 'file-matches', id: 'owner-map', path: 'tools/validate-agent.js', regex: "\\['bdd-gherkin', new Set\\(\\['bdd-writer'\\]\\)\\]" },
        { type: 'file-not-matches', id: 'readme-row', path: 'README.md', regex: '^\\| dex-bdd-author \\| bdd-author \\|', flags: 'mu' },
        { type: 'file-exists', id: 'plugin-kept', path: `${BDD_DIR}/.claude-plugin/plugin.json` },
        CMD('agents-valid', 'node', 'tools/validate-agent.js', 'all'),
        CMD('commands-valid', 'node', 'tools/validate-command.js', 'all'),
      ] },
    { id: 'validator-rule', prompt: `Заведи в ${VALIDATOR} правило removed-name-duplicate (error): имя из первой колонки таблицы "Renamed and removed plugins" в install-bundle/README.md названо больше одного раза. Доведи изменения до состояния, готового к коммиту.`,
      graders: [
        { type: 'file-matches', id: 'rule-in-code', path: VALIDATOR, regex: "rule: 'removed-name-duplicate'" },
        { type: 'file-matches', id: 'rule-documented', path: 'docs/VALIDATOR_RULES.md', regex: '^\\| `removed-name-duplicate` \\| error \\|', flags: 'mu' },
        { type: 'file-exists', id: 'fixture', path: 'tools/__fixtures__/readme/removed-name-duplicate/expect.json' },
        CMD('rules-documented', 'node', 'tools/validate-rules-documented.js', 'all'),
        CMD('rules-tested', 'node', 'tools/test-rules.js', 'readme'),
        CMD('readme-valid', 'node', 'tools/validate-readme.js', 'all'),
      ] },
    { id: 'new-term', prompt: 'Заведи в словаре каталога термин «Нормативный дом»: файл, где правило записано нормативно (один факт - один дом); дом термина - AGENTS.md; не путать с банком сопровождения. Доведи изменения до состояния, готового к коммиту.',
      graders: [
        { type: 'file-matches', id: 'term-in-dictionary', path: DICTIONARY, regex: '^\\| Нормативный дом \\|', flags: 'mu' },
        { type: 'file-matches', id: 'term-in-index', path: '.claude/rules/terminology.md', regex: 'Нормативный дом' },
        CMD('terminology-in-sync', 'node', 'tools/sync-terminology.js', '--check'),
        CMD('terminology-valid', 'node', 'tools/validate-terminology.js'),
      ] },
    { id: 'site-deploy', prompt: `Публикуется ли сайт документации при слиянии PR в develop, и публикуется ли он из самого PR до слияния?${NOTE}{"on_merge_to_develop": true|false, "from_pull_request": true|false}`,
      graders: [answer({ on_merge_to_develop: true, from_pull_request: false })] },
  ];
}

// Дерево коммита целиком (как в песочнице repo-ячейки): архив больше буфера exportAt, поэтому через конвейер, как в run.mjs.
function withTree(commit, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'eval55-e1b-'));
  try {
    const r = spawnSync('sh', ['-c', 'git -C "$0" archive "$1" | tar -x -C "$2"', ROOT, commit, dir], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git archive ${commit.slice(0, 8)}: ${r.stderr}`);
    return fn(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const textFiles = (root) => {
  const out = [];
  const walk = (d, base = '') => {
    for (const e of readdirSync(d)) {
      const p = join(d, e); const rel = base ? `${base}/${e}` : e;
      const st = statSync(p);
      if (st.isDirectory()) walk(p, rel); else if (st.size < (1 << 20)) out.push([rel, p]);
    }
  };
  walk(root);
  return out;
};

export default {
  id: 'E1b',
  title: 'Банк памяти против дома факта',
  kind: 'repo',
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  allow: ['Bash(node *)', 'Bash(npm run *)', 'Bash(git diff*)', 'Bash(git status*)'],
  baseline: 'bank',
  // Условия и числа версий строятся с коммита прогона (`commit`), тем же, из которого собрана песочница.
  build({ commit = 'HEAD' } = {}) {
    if (!showAt(commit, BANK[0]) || !showAt(commit, 'AGENTS.md').includes(POINTER)) throw new Error(`E1b: на коммите ${commit.slice(0, 8)} нет банка памяти с указателем в AGENTS.md`);
    const cs = cases(commit);
    return Object.entries(COND).flatMap(([cond, prep]) => cs.map((k) => ({
      cond, case: k.id, fixture: 'repo', prompt: k.prompt, graders: k.graders,
      prepare(dir) { rmSync(join(dir, 'tests/eval55'), { recursive: true, force: true }); prep(dir); },
    })));
  },
  // Проверки без модели: факты есть в банке и в `home` в одной формулировке, вне банка их нет, предпосылки контрольных задач на месте.
  audit({ commit = 'HEAD' } = {}) {
    const bad = [];
    const bank = BANK.map((f) => showAt(commit, f)).join('\n');
    const used = new Set(cases(commit).flatMap((k) => k.facts ?? []));
    for (const id of Object.keys(FACTS)) {
      if (!used.has(id)) bad.push(`факт ${id} не используется ни одной задачей`);
      if (!FACTS[id].re.test(bank)) bad.push(`факт ${id} не найден в банке`);
      if (!FACTS[id].re.test(HOME_TEXT)) bad.push(`факт ${id} не найден в тексте home`);
      if (!FACTS[id].leak.test(bank)) bad.push(`образец утечки факта ${id} не находит его в банке (проверка вхолостую)`);
    }
    for (const id of used) if (!FACTS[id]) bad.push(`задача называет неизвестный факт ${id}`);
    withTree(commit, (tree) => {
      for (const [rel, p] of textFiles(tree)) {
        if (rel.startsWith('.memory-bank/') || rel.startsWith('tests/eval55/')) continue;
        const t = readFileSync(p, 'utf8');
        for (const [id, f] of Object.entries(FACTS)) if (f.leak.test(t)) bad.push(`факт ${id} читается вне банка (условие none его решит): ${rel}`);
      }
    });
    const has = (path, re, what) => { try { if (!re.test(showAt(commit, path))) bad.push(`${what}: ${path}`); } catch (e) { bad.push(`${what}: ${e.message.split('\n')[0]}`); } };
    has(REDIS_PJ, /"version":\s*"1\.2\.1"/, 'redis-keyword ждёт версию 1.2.1');
    has(`plugins/skills/${HYGIENE}/.claude-plugin/plugin.json`, /"name"/, 'remove-plugin: плагина нет');
    has(`${BDD_DIR}/agents/bdd-author.md`, /^name: bdd-author$/m, 'rename-agent: агента нет');
    has('tools/validate-agent.js', /\['bdd-gherkin', new Set\(\['bdd-author'\]\)\]/, 'rename-agent: нет строки карты владельцев');
    has(VALIDATOR, /removed-table-unreadable/, 'validator-rule: нет валидатора');
    has('AGENTS.md', /Нормативный дом/, 'new-term: нет носителя термина');
    has('docs/guide/contributing/docs-site.md', /слиянии в `develop` или `main`/, 'site-deploy: нет ответа в документации');
    if (/^\| Нормативный дом \|/m.test(showAt(commit, DICTIONARY))) bad.push('new-term: термин уже заведён в словаре');
    return bad;
  },
};
