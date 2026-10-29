// E1 - абляция разделов корневого файла: полный / пустой / без каждого раздела H2 / без обзорных единиц / минимальный / указатель вместо terminology.md.
// Гипотеза: обзорные разделы не влияют на решаемость, но стоят шагов и денег (R01, R03).
// Среда - копия репозитория на коммите прогона (git archive); корневой файл условий читается с него же; `.claude/rules/` остаются на месте. Дорогой эксперимент:
// одна ячейка - сессия с инструментами на крупном дереве. Кейсов 16: две правки по описанию (redis-keyword, redis-trap), правка команды с версией,
// семь починок засеянных нарушений и шесть кейсов сопровождения каталога (размещение скилла, rename агента, новый термин, ссылка из README,
// снятие плагина, ложная тревога). Проверка каждого - команда валидатора или синхронизации (`cmd`), файл или граница правок, а не текст ответа.
// Засев делает prepare в песочнице. Контроль без модели (`run.mjs controls E1`): нетронутая песочница не проходит проверки (`solve` отсутствует либо
// `control: 'idle-passes'` у кейса «менять нечего»), эталонное решение `solve` проходит их все.
import { readFileSync, writeFileSync, appendFileSync, rmSync, mkdtempSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootNorm, exportAt } from '../../lib/repo.mjs';

const SKILL = 'plugins/skills/dex-skill-redis/skills/redis/SKILL.md';
const REDIS_PJ = 'plugins/skills/dex-skill-redis/.claude-plugin/plugin.json';
const AGENT = 'plugins/specialists/delivery/dex-bug-fixer/agents/bug-fixer.md';
const CLI_CMD = 'plugins/utilities/dex-redis-cli/commands/redis-info.md';
const CLI_PJ = 'plugins/utilities/dex-redis-cli/.claude-plugin/plugin.json';
const BDD_DIR = 'plugins/specialists/product/dex-bdd-author';
const BDD_PJ = `${BDD_DIR}/.claude-plugin/plugin.json`;
const BDD_AGENT = `${BDD_DIR}/agents/bdd-author.md`;
const BDD_AGENT_NEW = `${BDD_DIR}/agents/gherkin-author.md`;
const BDD_CMD = `${BDD_DIR}/commands/bdd.md`;
const BUG_DIR = 'plugins/specialists/delivery/dex-bug-fixer';
const JIRA_README = 'plugins/utilities/dex-jira-cli/README.md';
const INSPECTOR = 'plugins/utilities/dex-mcp-inspector';
const CATALOG = '.claude-plugin/marketplace.json';
const DOMAIN = 'docs/domain/domain-model.md';
const VALIDATE_SKILLS = { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] };
const SYNC = { type: 'cmd', id: 'marketplace-in-sync', run: ['node', 'tools/sync-marketplace.js', '--check'] };
const KEPT = { type: 'file-matches', id: 'checklist-kept', path: SKILL, regex: 'Старт сервиса при недоступном Redis' };
// Засев нарушения в песочнице: подмена фрагмента с проверкой наличия (иначе кейс молча перестал бы сеять).
const sub = (path, from, to) => (dir) => {
  const p = join(dir, path); const t = readFileSync(p, 'utf8');
  if (!t.includes(from)) throw new Error(`prepare: нет фрагмента в ${path}: ${from}`);
  writeFileSync(p, t.replace(from, to));
};
const add = (path, text) => (dir) => appendFileSync(join(dir, path), text);
// Обратные действия засева (эталонное решение починки): вернуть фрагмент либо убрать добавленное.
const unsub = (path, from, to) => sub(path, to, from);
const unadd = (path, text) => (dir) => {
  const p = join(dir, path); const t = readFileSync(p, 'utf8');
  if (!t.endsWith(text)) throw new Error(`solve: хвост ${path} не совпал с засевом`);
  writeFileSync(p, t.slice(0, -text.length));
};
const sh = (dir, ...cmd) => { // команда эталонного решения в песочнице; ненулевой код - ошибка решения, а не кейса
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`solve: ${cmd.join(' ')}: ${(r.stdout + r.stderr).slice(0, 300)}`);
};
const syncCatalog = (dir) => sh(dir, 'node', 'tools/sync-marketplace.js');
const edit = (dir, path, fn) => { const p = join(dir, path); writeFileSync(p, fn(readFileSync(p, 'utf8'))); };
const replaceOnce = (t, from, to) => { if (!t.includes(from)) throw new Error(`solve: нет фрагмента: ${from}`); return t.replace(from, to); };

function sections(md) { // [{title, start, end}] по заголовкам H2; вне fence
  const lines = md.split('\n');
  const marks = [];
  let fence = false;
  lines.forEach((l, i) => { if (l.startsWith('```')) fence = !fence; if (!fence && /^## /.test(l)) marks.push(i); });
  return marks.map((s, k) => ({ title: lines[s].slice(3).trim(), start: s, end: k + 1 < marks.length ? marks[k + 1] : lines.length }));
}


// Составные условия: разделы и абзацы находятся по префиксу текста. Нет фрагмента на коммите - ошибка, а не молчаливо другой состав
// (переименованный раздел иначе превратил бы условие в `full`).
const dropSection = (lines, titlePrefix) => {
  const s = sections(lines.join('\n')).find((x) => x.title.startsWith(titlePrefix));
  if (!s) throw new Error(`E1: нет раздела H2 «${titlePrefix}» на коммите`);
  return [...lines.slice(0, s.start), ...lines.slice(s.end)];
};
const blockAt = (lines, prefix) => { // [i, j): сплошной блок непустых строк, начинающийся с prefix, и пустая строка за ним
  const i = lines.findIndex((l) => l.startsWith(prefix));
  if (i < 0) throw new Error(`E1: нет абзаца «${prefix}» на коммите`);
  let j = i; while (j < lines.length && lines[j].trim() !== '') j++;
  return [i, lines[j] === '' ? j + 1 : j];
};
const dropBlock = (lines, prefix) => { const [i, j] = blockAt(lines, prefix); return [...lines.slice(0, i), ...lines.slice(j)]; };

// Обзорные единицы: выводятся из дерева либо дублируют указатели (рубрика 5.5, категории О и Д). Абзацы, несущие невыводимое (тип skill, bundle.json,
// размещение скилла и команды, практические правила композиции), остаются: условие снимает обзор, а не раздел целиком.
const OVERVIEW_SECTIONS = ['Уровень продукта'];
const OVERVIEW_BLOCKS = ['Полный перечень плагинов', 'Все плагины: ', 'Проверено по официальной документации', '| Путь |'];
const noOverview = (md) => {
  let L = md.split('\n');
  for (const t of OVERVIEW_SECTIONS) L = dropSection(L, t);
  for (const b of OVERVIEW_BLOCKS) L = dropBlock(L, b);
  return L.join('\n');
};

// Минимальный корень: шапка, «Конвенции», практические правила композиции и пять единиц чек-листа, которых нет ни в валидаторе, ни в другом доме.
const MINIMAL_KEEP = ['- **Нормативная единица пишется', '- **Пунктуация в артефактах', '- **Имя артефакта в теле', '- **Документ каталога из тела', '- **Адрес документа каталога из README'];
const minimal = (md) => {
  const L = md.split('\n');
  const secs = sections(md);
  const get = (t) => { const s = secs.find((x) => x.title.startsWith(t)); if (!s) throw new Error(`E1: нет раздела H2 «${t}» на коммите`); return L.slice(s.start, s.end); };
  const trim = (a) => { while (a.length && a[a.length - 1].trim() === '') a = a.slice(0, -1); return a; };
  const comp = get('Механизмы композиции');
  const rules = comp.findIndex((l) => l.startsWith('**Практические правила:**'));
  if (rules < 0) throw new Error('E1: нет блока «Практические правила» в разделе композиции');
  const chk = get('Чек-лист');
  const h3 = chk.findIndex((l) => l.startsWith('### Принципы содержания'));
  if (h3 < 0) throw new Error('E1: нет «Принципы содержания» в чек-листе');
  const bullets = MINIMAL_KEEP.map((p) => { const b = chk.find((l) => l.startsWith(p)); if (!b) throw new Error(`E1: нет единицы «${p}» в чек-листе`); return b; });
  const out = [...trim(L.slice(0, secs[0].start)), '', ...trim(get('Конвенции')), '', comp[0], '', ...trim(comp.slice(rules)), '', chk[0], '', chk[h3], '', ...bullets, ''];
  return out.join('\n');
};

// Пара к `full` для перечня имён: `.claude/rules/terminology.md` (грузится каждую сессию, генерируется из словаря) заменён указателем.
// `sync-terminology --check` в такой песочнице красный по построению: кейсы, чьи проверки его зовут, условие искажают (в проверках E1 его нет).
const TERMINOLOGY_FILE = '.claude/rules/terminology.md';
const TERMINOLOGY_POINTER = '# Термины каталога\n\nСловарь имён корпуса - docs/domain/domain-model.md.\n';

const FIX_PROMPT = 'Валидация skills падает на skill redis. Найди причину и исправь, остальное в skill не трогай.';
const SEED_DOCS = '\nФорма пункта описана в docs/SKILL_FRAMEWORK.md.\n';
const SEED_ESCAPE = '\nСм. также [kafka](../../../dex-skill-kafka/skills/kafka/SKILL.md).\n';
const SEED_CLOSURE = '- Профилирование памяти разбирай через `dex-skill-perf-profiling:perf-profiling`\n';
const SEED_OUSTED = '- Проверку TTL повторяй на каждом раунде правок\n';
const TRAP_ITEM = '- Кэш-ключ без TTL: память растёт, пока Redis не начнёт вытеснять нужные ключи\n';
const TERM = 'прогрев кэша';
const TERM_ITEM = '- Прогрев кэша при старте сервиса: пока кэш пуст, первые запросы идут в источник все сразу\n';
const TERM_ROW = '| Прогрев кэша | заполнение кэша до первого запроса, чтобы источник не получил пик промахов | - | `dex-skill-redis:redis` | горячий ключ |';
const NEW_SKILL = `---
name: regression-test
description: Регрессионный тест при исправлении бага - фикс без теста, который краснеет на прежнем коде. Активируется при bug fix, регрессия, regression test, regression, исправление бага, red-green, фикс бага, тест на баг, follow-up MR, верификация фикса
---

# Регрессионный тест - чек-лист

Пункт называет ситуацию, которую исполнитель сам не заподозрит.

- Фикс без регрессионного теста: баг возвращается при следующей правке
`;
const REMOVED_ROW = '| `dex-mcp-inspector` | - | removed: the model holds the subject without the plugin |\n';

const cases = [
  { id: 'redis-keyword', prompt: 'Добавь ключевое слово Redlock в description skill redis (plugins/skills/dex-skill-redis) и доведи изменения до состояния, готового к коммиту.',
    graders: [
      { type: 'file-matches', id: 'keyword', path: SKILL, regex: 'Redlock' },
      { type: 'file-matches', id: 'version-bumped', path: 'plugins/skills/dex-skill-redis/.claude-plugin/plugin.json', regex: '"version":\\s*"1\\.2\\.2"' },
      { type: 'cmd', id: 'marketplace-in-sync', run: ['node', 'tools/sync-marketplace.js', '--check'] },
      { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] },
    ],
    solve(dir) {
      edit(dir, SKILL, (t) => replaceOnce(t, 'Активируется при redis,', 'Активируется при Redlock, redis,'));
      edit(dir, REDIS_PJ, (t) => replaceOnce(t, '"version": "1.2.1"', '"version": "1.2.2"'));
      syncCatalog(dir);
    } },
  { id: 'redis-trap', prompt: `В ${SKILL} добавь в конец чек-листа пункт про забытый TTL у кэш-ключей: ситуация и чем кончится, в формате остальных пунктов. Остальное не трогай.`,
    graders: [
      { type: 'file-matches', id: 'trap-added', path: SKILL, regex: '^- .*TTL', flags: 'mu' },
      { type: 'file-not-matches', id: 'ascii-punctuation', path: SKILL, regex: '[\\u2013\\u2014]' },
      { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] },
    ],
    solve: add(SKILL, TRAP_ITEM) },
  { id: 'fix-docs-link', seed: add(SKILL, SEED_DOCS), solve: unadd(SKILL, SEED_DOCS),
    prompt: FIX_PROMPT,
    graders: [VALIDATE_SKILLS, KEPT, { type: 'file-not-matches', id: 'link-gone', path: SKILL, regex: 'docs/' }] },
  { id: 'fix-link-escapes', seed: add(SKILL, SEED_ESCAPE), solve: unadd(SKILL, SEED_ESCAPE),
    prompt: FIX_PROMPT,
    graders: [VALIDATE_SKILLS, KEPT, { type: 'file-not-matches', id: 'link-gone', path: SKILL, regex: '\\.\\./' }] },
  { id: 'fix-keywords-field', seed: sub(SKILL, 'name: redis\n', 'name: redis\nkeywords: [ttl, lock]\n'), solve: unsub(SKILL, 'name: redis\n', 'name: redis\nkeywords: [ttl, lock]\n'),
    prompt: FIX_PROMPT,
    graders: [VALIDATE_SKILLS, KEPT, { type: 'file-matches', id: 'description-kept', path: SKILL, regex: '^description: .*Активируется при', flags: 'mu' }] },
  { id: 'fix-bundle-closure', seed: add(SKILL, SEED_CLOSURE), solve: unadd(SKILL, SEED_CLOSURE),
    prompt: 'Валидация бандлов падает: skill redis называет артефакт, которого нет в составе. Исправь, остальное не трогай.',
    graders: [{ type: 'cmd', id: 'bundles-valid', run: ['node', 'tools/validate-bundle.js', 'all'] }, KEPT] },
  { id: 'fix-agent-field', seed: sub(AGENT, 'model: opus\n', 'model: opus\nallowed-tools: Read, Grep\n'), solve: unsub(AGENT, 'model: opus\n', 'model: opus\nallowed-tools: Read, Grep\n'),
    prompt: 'Валидация агентов падает на bug-fixer. Найди причину и исправь, остальное в агенте не трогай.',
    graders: [{ type: 'cmd', id: 'agents-valid', run: ['node', 'tools/validate-agent.js', 'all'] }, { type: 'file-matches', id: 'tools-kept', path: AGENT, regex: '^tools: Read, Edit, Write, Bash', flags: 'mu' }] },
  { id: 'fix-ousted-name', seed: add(SKILL, SEED_OUSTED), solve: unadd(SKILL, SEED_OUSTED),
    prompt: 'Валидация терминологии падает на skill redis. Найди причину и исправь по правилам каталога.',
    graders: [{ type: 'cmd', id: 'terminology-valid', run: ['node', 'tools/validate-terminology.js'] }, KEPT, { type: 'file-matches', id: 'item-kept', path: SKILL, regex: 'TTL' }] },
  { id: 'sync-after-version', seed: sub(REDIS_PJ, '"version": "1.2.1"', '"version": "1.2.5"'), solve: syncCatalog,
    prompt: 'В plugin.json skill redis версия уже поднята вручную. Доведи каталог до согласованного состояния, остальное не трогай.',
    graders: [SYNC, { type: 'file-matches', id: 'version-kept', path: REDIS_PJ, regex: '"version":\\s*"1\\.2\\.5"' }] },
  { id: 'command-description', prompt: 'В команде redis-info замени description на «Состояние Redis-сервера через INFO, только чтение» и доведи изменения до состояния, готового к коммиту.',
    graders: [
      { type: 'file-matches', id: 'description-changed', path: CLI_CMD, regex: 'только чтение' },
      { type: 'file-matches', id: 'version-bumped', path: CLI_PJ, regex: '"version":\\s*"1\\.0\\.5"' },
      SYNC,
      { type: 'cmd', id: 'commands-valid', run: ['node', 'tools/validate-command.js', 'all'] },
    ],
    solve(dir) {
      edit(dir, CLI_CMD, (t) => replaceOnce(t, 'description: Состояние Redis-сервера через INFO\n', 'description: Состояние Redis-сервера через INFO, только чтение\n'));
      edit(dir, CLI_PJ, (t) => replaceOnce(t, '"version": "1.0.4"', '"version": "1.0.5"'));
      syncCatalog(dir);
    } },

  // Кейсы сопровождения каталога (#49). Проверка - команда валидатора, файл либо граница правок; имя результата кейс не подсказывает там, где решает конвенция.
  // Размещение скилла (раздел «Структура плагина»): норма нужна только агенту одного плагина, значит едет внутри него; отдельный `dex-skill-*` - нарушение.
  { id: 'skill-placement',
    prompt: 'Агенту bug-fixer (плагин dex-bug-fixer) нужна своя ловушка: «Фикс без регрессионного теста: баг возвращается при следующей правке». Оформи её как skill, который грузит только этот агент, и доведи изменения до состояния, готового к коммиту. В тело агента skill не подключай.',
    graders: [
      { type: 'cmd', id: 'skill-inside-owner', run: ['sh', '-c', `ls ${BUG_DIR}/skills/*/SKILL.md`] },
      { type: 'only-changed', id: 'no-separate-plugin', allowed: [BUG_DIR, CATALOG, 'tests/trap-skills'] },
      SYNC,
      VALIDATE_SKILLS,
    ],
    solve(dir) {
      mkdirSync(join(dir, BUG_DIR, 'skills/regression-test'), { recursive: true });
      writeFileSync(join(dir, BUG_DIR, 'skills/regression-test/SKILL.md'), NEW_SKILL);
      edit(dir, `${BUG_DIR}/.claude-plugin/plugin.json`, (t) => replaceOnce(t, '"version": "1.13.3"', '"version": "1.14.0"'));
      syncCatalog(dir);
    } },
  // Rename агента (раздел «Имя агента», правило в `.claude/rules/plugin-changes.md`): major плагина, директория и `name` плагина прежние, карта `ALLOWED_PRELOAD_SKILLS` правится.
  { id: 'agent-rename',
    prompt: 'Переименуй агента bdd-author (плагин dex-bdd-author) в gherkin-author и доведи изменения до состояния, готового к коммиту.',
    graders: [
      { type: 'file-matches', id: 'agent-renamed', path: BDD_AGENT_NEW, regex: '^name: gherkin-author$', flags: 'mu' },
      { type: 'file-not-matches', id: 'old-file-gone', path: BDD_AGENT, regex: '^name:', flags: 'mu' },
      { type: 'file-matches', id: 'command-delegates-to-new', path: BDD_CMD, regex: 'dex-bdd-author:gherkin-author' },
      { type: 'file-matches', id: 'major-bump', path: BDD_PJ, regex: '"version":\\s*"2\\.0\\.0"' },
      { type: 'file-matches', id: 'plugin-name-kept', path: BDD_PJ, regex: '"name":\\s*"dex-bdd-author"' },
      SYNC,
      { type: 'cmd', id: 'agents-valid', run: ['node', 'tools/validate-agent.js', 'all'] },
    ],
    solve(dir) {
      const text = readFileSync(join(dir, BDD_AGENT), 'utf8');
      writeFileSync(join(dir, BDD_AGENT_NEW), replaceOnce(text, '\nname: bdd-author\n', '\nname: gherkin-author\n'));
      rmSync(join(dir, BDD_AGENT));
      edit(dir, BDD_CMD, (t) => t.split('dex-bdd-author:bdd-author').join('dex-bdd-author:gherkin-author'));
      edit(dir, BDD_PJ, (t) => replaceOnce(t, t.match(/"version": "[^"]*"/)[0], '"version": "2.0.0"'));
      edit(dir, 'tools/validate-agent.js', (t) => replaceOnce(t, "new Set(['bdd-author'])", "new Set(['gherkin-author'])"));
      edit(dir, 'README.md', (t) => replaceOnce(t, '| dex-bdd-author | bdd-author |', '| dex-bdd-author | gherkin-author |'));
      syncCatalog(dir);
    } },
  // Новый термин в тексте нормы (пункт «Имя сущности корпуса берётся из словаря»; пара `terminology-pointer` проверяет, нужен ли перечень имён): строка словаря заводится тем же изменением.
  // `sync-terminology --check` среди проверок нет: в условии-указателе он красный по построению.
  { id: 'new-term',
    prompt: `В ${SKILL} добавь в конец чек-листа пункт про «${TERM}» при старте сервиса: ситуация и чем кончится, в формате остальных пунктов. Термин «${TERM}» в корпусе новый. Доведи изменения до состояния, готового к коммиту.`,
    graders: [
      { type: 'file-matches', id: 'item-added', path: SKILL, regex: '^- .*прогрев[а-яё]* кэш', flags: 'miu' },
      { type: 'file-matches', id: 'dictionary-row', path: DOMAIN, regex: '^\\| *прогрев[а-яё]* кэш[а-яё]* *\\|', flags: 'miu' },
      { type: 'cmd', id: 'terminology-valid', run: ['node', 'tools/validate-terminology.js'] },
      VALIDATE_SKILLS,
    ],
    solve(dir) {
      add(SKILL, TERM_ITEM)(dir);
      edit(dir, DOMAIN, (t) => replaceOnce(t, '\n| Плагин |', `\n${TERM_ROW}\n| Плагин |`));
    } },
  // Ссылка из README плагина на документ каталога (пункт «Адрес документа каталога из README плагина - абсолютный URL»): относительный путь в установленном плагине указывает в чужой проект.
  { id: 'readme-docs-link',
    prompt: 'В README плагина dex-jira-cli (plugins/utilities/dex-jira-cli) добавь в конец раздел «Дальше» со ссылкой на docs/CLI_UTILITIES.md (общий хаб по CLI-плагинам). Остальное в README не трогай.',
    graders: [
      { type: 'file-matches', id: 'link-absolute', path: JIRA_README, regex: '\\]\\(https://github\\.com/dex-it/ai-kit/blob/main/docs/CLI_UTILITIES\\.md(#[^)]*)?\\)' },
      { type: 'file-not-matches', id: 'no-relative-docs-link', path: JIRA_README, regex: '\\]\\((\\./|\\.\\./)*docs/' },
      { type: 'file-matches', id: 'readme-kept', path: JIRA_README, regex: '^## Установка плагина', flags: 'mu' },
      { type: 'cmd', id: 'readme-valid', run: ['node', 'tools/validate-readme.js', 'all'] },
    ],
    solve: add(JIRA_README, '\n## Дальше\n\n[Хаб CLI-плагинов](https://github.com/dex-it/ai-kit/blob/main/docs/CLI_UTILITIES.md) - матрица установки, CLI против MCP.\n') },
  // Снятие плагина (`.claude/rules/plugin-changes.md`): запись каталога, витрина README, строка таблицы снятых, minor каталога в двух носителях.
  { id: 'plugin-removal',
    prompt: 'Плагин dex-mcp-inspector больше не нужен. Сними его из каталога и доведи изменения до состояния, готового к коммиту.',
    graders: [
      { type: 'cmd', id: 'plugin-dir-gone', run: ['sh', '-c', `test ! -e ${INSPECTOR}`] },
      { type: 'file-not-matches', id: 'catalog-entry-gone', path: CATALOG, regex: '"name":\\s*"dex-mcp-inspector"' },
      { type: 'file-matches', id: 'removed-table-row', path: 'install-bundle/README.md', regex: '^\\| `dex-mcp-inspector` \\|', flags: 'mu' },
      { type: 'file-matches', id: 'catalog-minor-bumped', path: CATALOG, regex: '^  "version": "6\\.28\\.0"', flags: 'mu' },
      { type: 'cmd', id: 'readme-valid', run: ['node', 'tools/validate-readme.js', 'all'] },
      SYNC,
    ],
    solve(dir) {
      rmSync(join(dir, INSPECTOR), { recursive: true });
      edit(dir, CATALOG, (t) => {
        const d = JSON.parse(t);
        d.plugins = d.plugins.filter((x) => x.name !== 'dex-mcp-inspector');
        d.version = '6.28.0';
        return `${JSON.stringify(d, null, 2)}\n`;
      });
      edit(dir, 'README.md', (t) => replaceOnce(replaceOnce(t, '| dex-mcp-inspector | `/mcp-inspect` | MCP Inspector: тестирование и отладка MCP серверов |\n', ''), 'Version 6.27.0', 'Version 6.28.0'));
      edit(dir, 'install-bundle/README.md', (t) => replaceOnce(t, '| `dex-skill-agile` | - |', `${REMOVED_ROW}| \`dex-skill-agile\` | - |`));
    } },
  // Ложная тревога: падения нет, верный исход - ничего не менять (контроль на перекос к дельте). Нетронутая песочница проходит проверки; `solve` здесь - посторонняя правка, которую они обязаны поймать.
  { id: 'no-change-needed', control: 'idle-passes',
    prompt: FIX_PROMPT,
    graders: [{ type: 'nothing-changed', id: 'nothing-changed' }, VALIDATE_SKILLS],
    solve: add(SKILL, TRAP_ITEM) },
];

function buildConditions(md) {
  const secs = sections(md);
  const conds = [
    { id: 'full', prepare() {} },
    { id: 'empty', prepare(dir) { for (const f of ['AGENTS.md', 'CLAUDE.md']) rmSync(join(dir, f), { force: true }); } },
    ...secs.map((s, k) => ({
      id: `minus-s${String(k + 1).padStart(2, '0')}`,
      title: s.title,
      prepare(dir) { const L = md.split('\n'); writeFileSync(join(dir, 'AGENTS.md'), [...L.slice(0, s.start), ...L.slice(s.end)].join('\n')); },
    })),
    { id: 'no-overview', title: 'без обзорных единиц', prepare(dir) { writeFileSync(join(dir, 'AGENTS.md'), noOverview(md)); } },
    { id: 'minimal', title: 'минимальный корень', prepare(dir) { writeFileSync(join(dir, 'AGENTS.md'), minimal(md)); } },
    { id: 'terminology-pointer', title: 'terminology.md - указатель', prepare(dir) { writeFileSync(join(dir, TERMINOLOGY_FILE), TERMINOLOGY_POINTER); } },
  ];
  return { conds };
}

// Проверка условий без модели: каждое условие применяется к копии трёх файлов коммита (AGENTS.md, CLAUDE.md, terminology.md) и даёт ожидаемый состав.
function checkConditions(commit) {
  const problems = [];
  const src = exportAt(commit, ['AGENTS.md', 'CLAUDE.md', TERMINOLOGY_FILE]);
  const md = rootNorm(commit);
  const secs = sections(md);
  const { conds } = buildConditions(md);
  const size = (d, f = 'AGENTS.md') => (existsSync(join(d, f)) ? readFileSync(join(d, f), 'utf8') : null);
  const sizes = {};
  for (const c of conds) {
    const d = mkdtempSync(join(tmpdir(), 'eval55-e1-'));
    try {
      cpSync(src, d, { recursive: true });
      c.prepare(d);
      const t = size(d); sizes[c.id] = t;
      const m = /^minus-s(\d+)$/.exec(c.id);
      if (c.id === 'full' && t !== md) problems.push('full: AGENTS.md изменён');
      else if (c.id === 'empty' && (t !== null || size(d, 'CLAUDE.md') !== null)) problems.push('empty: корневые файлы на месте');
      else if (m) {
        const s = secs[Number(m[1]) - 1];
        if (t === null || t.includes(`## ${s.title}`) || t.length >= md.length) problems.push(`${c.id}: раздел «${s.title}» не снят`);
      } else if (c.id === 'terminology-pointer') {
        const p = size(d, TERMINOLOGY_FILE);
        if (p !== TERMINOLOGY_POINTER || t !== md) problems.push('terminology-pointer: указатель не записан либо тронут AGENTS.md');
      }
    } catch (e) { problems.push(`${c.id}: ${e.message}`); } finally { rmSync(d, { recursive: true, force: true }); }
  }
  const no = sizes['no-overview']; const mn = sizes.minimal;
  if (no && !(no.length < md.length && !no.includes('## Уровень продукта') && no.includes('## Конвенции') && no.includes('**Практические правила:**') && no.includes('**Скилл, потребители которого'))) problems.push('no-overview: состав не тот');
  if (mn && !(no && mn.length < no.length && mn.includes('## Конвенции') && !mn.includes('## Каталог плагинов') && MINIMAL_KEEP.every((p) => mn.includes(p)))) problems.push('minimal: состав не тот');
  return problems;
}

export default {
  id: 'E1',
  title: 'Абляция разделов корневого файла',
  kind: 'repo',
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  allow: ['Bash(node *)', 'Bash(npm run *)', 'Bash(git diff*)', 'Bash(git status*)'],
  baseline: 'full',
  // Состав корневого файла и разделов-условий берётся с коммита прогона (`commit`), тем же, из которого собрана песочница.
  build({ commit = 'HEAD' } = {}) {
    const { conds } = buildConditions(rootNorm(commit));
    return conds.flatMap((c) => cases.map((k) => ({
      cond: c.id, condTitle: c.title, case: k.id, fixture: 'repo', prompt: k.prompt, graders: k.graders, solve: k.solve, control: k.control,
      prepare(dir) { c.prepare(dir); k.seed?.(dir); },
    })));
  },
  audit: ({ commit }) => checkConditions(commit),
};
