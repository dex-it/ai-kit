// E5 - удержание ограничений при сжатии нормативного текста.
// Гипотеза: LLM-сжатие сохраняет факты и теряет условия, исключения и границы (R44, R48).
// Текстов 10: три исходных и семь абзацев нормативных правил корневого CLAUDE.md (снимок строки на коммите стенда). Мера - доля удержанных ограничений (ключевые слова условий, статусов и исключений) и длина. Это прокси на уровне токенов:
// выживание слова не доказывает выживание условия, поэтому решающий вывод по E5 требует слепого судьи (PREREG.md); провал прокси однозначен.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ARMS = { 'llm-30': 30, 'llm-50': 50, 'llm-70': 70 };

const CONSTRAINTS = {
  'gate-loopholes': [
    ['unverifiable', 'unverifiable'], ['contradicted', 'contradicted'], ['n/a', 'n/a'], ['fallback-tool', 'запасн'], ['obvious-not-excuse', 'очевидно'],
    ['branch-terminal', 'иначе'], ['failure-outcome', 'откат|возврат наверх'], ['good-faith-test', 'добросовестн'], ['status-with-reason', 'обоснован'], ['loophole-signals', 'обычно|по усмотрению|при необходимости'],
  ],
  'bundle-closure': [
    ['validate-cmd', 'validate:bundles'], ['rule-name', 'bundle-not-closed'], ['reference-mark', 'справочно'], ['mark-placement', 'вплотную|у самого вызова'], ['foreign-stack-only', 'чужой стек|не нужен проекту'],
    ['flat-install', 'плоская|каскада'], ['silent-degrade', 'молча'], ['triggers', 'триггер'],
  ],
  'count-in-norm': [
    ['prescription-class', 'предписани'], ['generator-or-gate', 'генератор|гейт'], ['measurement-class', 'замер'], ['remove-number-test', 'убери число'], ['snapshot', 'снимок'],
    ['commit-or-history', 'git history|сообщени\\w+ коммита'], ['qualitative-form', 'качественн'], ['manual-check', 'ручная'],
  ],
  'skill-generic': [
    ['project-names', 'UpCore|EyeLineData'], ['ide-binding', '\\.junie|\\.cursorrules'], ['stack-api-boundary', 'API стека'], ['product-forbidden', 'конкретного продукта'],
    ['remove-names-test', 'убери имена'], ['source-mr', 'MR'], ['anti-pattern', '№10'],
  ],
  'agent-phases': [
    ['phases', 'фаз'], ['contract-parts', 'Exit criteria'], ['no-grep', 'grep'], ['no-code-examples', 'примеров кода'], ['bare-mandatory', 'голой пометкой'], ['why-in-goal', 'зачем'],
  ],
  'unambiguous-wording': [
    ['two-readings', 'двумя способами|двум способам'], ['rule-not-applying', 'не применя'], ['contradiction', 'взаимоисключающ'], ['explicit-condition', 'явным условием'],
    ['good-faith-test', 'добросовестн'], ['defect-not-style', 'не стилистика'], ['wider-than-skip', 'шире'],
  ],
  'terminology-dictionary': [
    ['dictionary-home', 'domain-model'], ['same-change', 'тем же изменением'], ['ousted-marker', 'к вытеснению'], ['open-divergence', 'D-N'], ['ousted-name-rule', 'ousted-name'],
    ['home-unresolved', 'home-unresolved'], ['sync-command', 'sync:terminology'], ['closed-list', 'Закрытый перечень'],
  ],
  'ascii-punctuation': [
    ['default', 'Дефолт'], ['arrow-ascii', '->'], ['keep-quotes', 'кавычки'], ['box-drawing', 'box-drawing'], ['emoji', 'эмодзи'], ['inline-code-exception', 'inline code'],
    ['per-file', 'пофайлов'], ['untouched-not-defect', 'не дефект'], ['not-economy', 'не экономия'],
  ],
  'readme-absolute-url': [
    ['absolute', 'абсолютн'], ['delivery-channel', 'канал поставки'], ['anchor', 'якор'], ['sync-condition', 'Синхронность'], ['pin', '@ref'], ['outside-plugins', 'за пределами'],
    ['git-grep-check', 'git grep'], ['both-anchor-forms', 'двух формах'],
  ],
  'bundle-json-home': [
    ['bundle-json', 'bundle\\.json'], ['not-plugin-json', 'НЕ в'], ['includes', 'includes'], ['dependencies', 'dependencies'], ['unknown-fields', 'неизвестн'],
    ['union-judged', 'объединение'], ['diverge-rule', 'dependency-also-included'],
  ],
};

export default {
  id: 'E5',
  title: 'Удержание ограничений при сжатии',
  kind: 'text',
  baseline: 'llm-30',
  build() {
    const cells = [];
    for (const [id, constraints] of Object.entries(CONSTRAINTS)) {
      const text = readFileSync(join(here, 'texts', `${id}.md`), 'utf8').trim();
      for (const [arm, pct] of Object.entries(ARMS)) {
        cells.push({
          cond: arm,
          case: id,
          srcChars: text.length,
          prompt: `Сократи нормативный текст примерно на ${pct}% по длине. Сохрани смысл. Верни только сокращённый текст.\n\n${text}`,
          graders: constraints.map(([cid, regex]) => ({ type: 'output-matches', id: cid, regex, flags: 'iu' })),
        });
      }
    }
    return cells;
  },
  // Самопроверка набора: исходный текст обязан проходить все свои ограничения (иначе регулярка не про этот текст).
  selfcheck() {
    const bad = [];
    for (const [id, constraints] of Object.entries(CONSTRAINTS)) {
      const text = readFileSync(join(here, 'texts', `${id}.md`), 'utf8');
      for (const [cid, regex] of constraints) if (!new RegExp(regex, 'iu').test(text)) bad.push(`${id}:${cid}`);
    }
    return bad;
  },
};
