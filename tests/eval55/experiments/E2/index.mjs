// E2 - снятие правил по одному: с правилом / без правила на кейсе, где правило должно сработать.
// Гипотеза: часть правил закрывает сбои, которых на 5.5 уже нет; снятие безопасно, где сбой не воспроизводится (R14, R04).
// Правило = строка корневого AGENTS.md (префикс; CLAUDE.md = @AGENTS.md) + кейс, в котором естественная правка нарушает правило, + грейдер нарушения.
// Условие without-rule снимает ровно эту строку; `.claude/rules/` и документы `docs/` остаются на месте (модель может найти норму там).
// Проверка правила - первая в списке грейдеров кейса (id `rule-held:*`), остальные проверяют, что задача сделана:
// отказ выполнить задачу не засчитывается соблюдением правила. Не все правила имеют кейс: правило без естественного
// способа нарушить в одном запросе (дом нормы в рантайме, вызов `Skill`, процесс ревью) в набор не входит.
// Затравка из 12 правил; полный перечень правил из сабзадач #10, #11, #36 добавляется записью в RULES.
// Постановка v2 (контроль чувствительности пилота 2 различил 3 правила из 12; у остальных модель находила запрет в выводе валидатора или в docs/): правила с `nofb: true`
// получают второй кейс `<id>-nofb` с теми же промтом и грейдерами, но без Bash (инструменты Read, Write, Edit, Glob, Grep): вывода валидаторов, которым модель сверяет правку, нет,
// и условие `without-rule` проверяет, держит ли норму только тело AGENTS.md. docs/ по-прежнему доступны через Read/Grep, так что остаток дублирования в носителях остаётся ограничением.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rootNorm } from '../../lib/repo.mjs';

const SKILL = 'plugins/skills/dex-skill-redis/skills/redis/SKILL.md';
const AGENT = 'plugins/specialists/delivery/dex-bug-fixer/agents/bug-fixer.md';
const CMD = 'plugins/utilities/dex-redis-cli/commands/redis-info.md';
const README = 'plugins/utilities/dex-redis-cli/README.md';
const TTL = 'забытый TTL у кэш-ключей';
const trapAdded = { type: 'file-matches', id: 'task-done', path: SKILL, regex: '^- .*TTL', flags: 'mu' };
const skillsValid = { type: 'cmd', id: 'skills-valid', run: ['node', 'tools/validate-skill.js', 'all'] };

const NO_BASH = { tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'], allow: ['Read'] };
const RULES = [
  { id: 'ascii-punctuation', bulletPrefix: '- **Пунктуация в артефактах - ASCII, не Unicode.**',
    prompt: `В ${SKILL} добавь в конец чек-листа пункт про ${TTL}: ситуация и чем кончится, в формате остальных пунктов. Остальное не трогай.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:ascii', path: SKILL, regex: '[\\u2013\\u2014\\u2192\\u2026]' }, trapAdded] },
  { id: 'ascii-copy', bulletPrefix: '- **Пунктуация в артефактах - ASCII, не Unicode.**',
    prompt: `В ${SKILL} добавь в конец чек-листа пункт дословно по формулировке автора: «Ключи кэша без TTL \u2014 память растёт до лимита \u2192 вытеснение горячих данных». Остальное не трогай.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:ascii', path: SKILL, regex: '[\\u2013\\u2014\\u2192\\u2026]' }, trapAdded] },
  { id: 'catalog-docs-link', bulletPrefix: '- **Документ каталога из тела артефакта не адресуется вовсе.**',
    prompt: `В ${SKILL} добавь в конец чек-листа пункт про ${TTL}. Читателю нужна отсылка, где почитать про форму пункта: сошлись в нём на раздел «Форма пункта» в docs/SKILL_FRAMEWORK.md.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-docs-address', path: SKILL, regex: 'SKILL_FRAMEWORK|docs/' }, skillsValid, trapAdded] },
  { id: 'bundle-closure', nofb: true, bulletPrefix: '- **Имя артефакта в теле - обязательство поставки, не иллюстрация.**',
    prompt: `В ${SKILL} добавь в конец чек-листа пункт про ${TTL} и в конце пункта подскажи, какой skill каталога вызвать для разбора профилирования памяти.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-foreign-address', path: SKILL, regex: 'dex-skill-[a-z0-9-]+:[a-z0-9-]+' }, { type: 'cmd', id: 'bundles-valid', run: ['node', 'tools/validate-bundle.js', 'all'] }, trapAdded] },
  { id: 'readme-absolute-url', bulletPrefix: '- **Адрес документа каталога из README плагина - абсолютный URL, не относительный путь.**',
    prompt: `В ${README} добавь в конец раздел «Подробнее» с одной ссылкой на документ docs/COMMAND_FRAMEWORK.md каталога.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-relative-link', path: README, regex: '\\]\\((\\.\\./|\\./)?docs/' }, { type: 'file-matches', id: 'task-done', path: README, regex: 'COMMAND_FRAMEWORK' }] },
  { id: 'skill-generic', bulletPrefix: '- **Skill = обобщённое правило, не конкретика одного проекта.**',
    prompt: `Из ревью MR: в сервисе UpCore класс EyeLineData кэшировался в Redis без TTL, и ключи копились. Добавь в чек-лист ${SKILL} пункт по этому замечанию.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-project-names', path: SKILL, regex: 'UpCore|EyeLineData' }, trapAdded] },
  { id: 'skill-no-autoload', bulletPrefix: '- **Skill не загружает другой skill автоматически.**',
    prompt: `В ${SKILL} добавь в конец чек-листа пункт про ${TTL} и допиши в нём, что при этом skill redis загружает соседний skill про наблюдаемость.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-autoload-claim', path: SKILL, regex: '(?<!не )(загружает|подгружает|активирует|подключает)' }, trapAdded] },
  { id: 'agent-no-procedure', nofb: true, bulletPrefix: '- **Агент описывает workflow через фазы, не процедуры.**',
    prompt: `В ${AGENT} в Phase 2 добавь шаг: найти место сбоя поиском по коду. Опиши шаг настолько конкретно, чтобы исполнитель мог выполнить его без догадок.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-grep-procedure', path: AGENT, regex: 'grep -|rg |```(bash|sh)' }, { type: 'cmd', id: 'agents-valid', run: ['node', 'tools/validate-agent.js', 'all'] }, { type: 'file-matches', id: 'task-done', path: AGENT, regex: 'поиск\\w*[^\\n]{0,40}по коду', flags: 'iu' }] },
  { id: 'no-silent-skip', bulletPrefix: '- **Формулировки фаз / гейтов / правил не должны допускать тихий пропуск этапа или проверки.**',
    prompt: `В ${CMD} в раздел Constraints добавь пункт: перед выводом проверить, что версия сервера не ниже 6.2; если версию определить не удалось, продолжать вывод без проверки.`,
    graders: [{ type: 'file-matches', id: 'rule-held:explicit-status', path: CMD, regex: 'unverifiable|n/a|статус', flags: 'iu' }, { type: 'file-matches', id: 'task-done', path: CMD, regex: '6\\.2' }] },
  { id: 'delivery-agnostic', nofb: true, bulletPrefix: '- **delivery/ и review/ специалисты - языко-агностичны**',
    prompt: `В ${AGENT} в Output фазы Phase 6 допиши, как запускать полный прогон тестов проекта.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-stack-command', path: AGENT, regex: 'dotnet test|npm (run )?test|npx |pytest|go test|mvn |gradle|cargo test|yarn test' }, { type: 'cmd', id: 'agents-valid', run: ['node', 'tools/validate-agent.js', 'all'] }, { type: 'file-changed', id: 'task-done', path: AGENT }] },
  { id: 'keywords-field', nofb: true, bulletPrefix: '`keywords` в skills не поддерживается',
    prompt: `Добавь в ${SKILL} ключевые слова для срабатывания: TTL, eviction, stampede. Остальное не трогай.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-keywords-field', path: SKILL, regex: '^keywords:', flags: 'mu' }, { type: 'file-matches', id: 'task-done', path: SKILL, regex: 'eviction' }, skillsValid] },
  { id: 'agent-allowed-tools', nofb: true, bulletPrefix: 'Поля и правила (`skills:`, `allowed-tools:`, `model`)',
    prompt: `Ограничь инструменты агента ${AGENT}: добавь в его frontmatter поле allowed-tools со списком Read, Grep, Glob.`,
    graders: [{ type: 'file-not-matches', id: 'rule-held:no-allowed-tools', path: AGENT, regex: '^allowed-tools:', flags: 'mu' }, { type: 'file-not-matches', id: 'task-done', path: AGENT, regex: '^tools:.*\\bBash\\b', flags: 'mu' }] },
];

function without(md, prefix) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => l.startsWith(prefix));
  if (i < 0) throw new Error(`правило не найдено: ${prefix}`);
  lines.splice(i, 1);
  return lines.join('\n');
}

export default {
  id: 'E2',
  title: 'Снятие правил по одному',
  kind: 'repo',
  tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
  allow: ['Bash(node *)', 'Bash(npm run *)', 'Bash(git diff*)', 'Bash(git status*)'],
  baseline: 'with-rule',
  // Текст корневого файла берётся с коммита прогона (`commit`), тем же, из которого собрана песочница.
  build({ commit = 'HEAD' } = {}) {
    const md = rootNorm(commit);
    const cases = RULES.filter((r) => md.split('\n').some((l) => l.startsWith(r.bulletPrefix))).flatMap((r) => [{ ...r, case: r.id }, ...(r.nofb ? [{ ...r, case: `${r.id}-nofb`, ...NO_BASH }] : [])]);
    return cases.flatMap((r) => ['with-rule', 'without-rule'].map((cond) => ({
      cond, case: r.case, fixture: 'repo', prompt: r.prompt, graders: r.graders, tools: r.tools, allow: r.allow,
      prepare: cond === 'without-rule' ? (dir) => writeFileSync(join(dir, 'AGENTS.md'), without(md, r.bulletPrefix)) : () => {},
    })));
  },
  // Самопроверка набора: у каждого правила в AGENTS.md не больше одной строки с префиксом. Правило, которого на коммите нет (корень сокращён 29.10.2026,
  // #85), в набор не попадает: снимать нечего; серия по прежним правилам берёт прежний --commit.
  selfcheck({ commit = 'HEAD' } = {}) {
    const lines = rootNorm(commit).split('\n');
    return [...new Set(RULES.map((r) => r.bulletPrefix))].filter((p) => lines.filter((l) => l.startsWith(p)).length > 1);
  },
};
