// Запуск новой сессии: имя, команда и поручение. Чистое, без `$`.

export const NAME_LIMIT = 40

/**
 * Имя сессии из задачи, если человек имя не назвал: первые слова, без
 * знаков, через дефис. Имя видно в списке и служит адресом для `attach` и
 * `say`, поэтому оно короткое и без пробелов.
 */
export function nameFromTask(task: string): string {
  const words = task
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(word => word !== '')
    .slice(0, 4)

  const name = words.join('-').slice(0, NAME_LIMIT).replace(/-+$/, '')

  return name === '' ? 'sessiya' : name
}

/** Имя, пригодное в адресной строке команд: без пробелов и кавычек. */
export function cleanName(name: string): string {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, NAME_LIMIT)
}

export type NewSession = {
  task: string
  name: string
  /** Рабочий каталог; пусто - каталог этой сессии. */
  dir: string
  /** Режим разрешений для новой сессии; пусто - как настроено по умолчанию. */
  permissionMode: string
  /** Модель; пусто - как настроено по умолчанию. */
  model: string
}

/**
 * Команда запуска в фоне. Задача идёт отдельным аргументом без оболочки: ни
 * кавычки, ни переводы строк в ней ничего не ломают.
 */
export function startArgv(spec: NewSession): string[] {
  const name = cleanName(spec.name) !== '' ? cleanName(spec.name) : nameFromTask(spec.task)
  const argv = ['claude', '--bg', '--name', name]

  if (spec.permissionMode !== '') argv.push('--permission-mode', spec.permissionMode)
  if (spec.model !== '') argv.push('--model', spec.model)

  // Задача, начатая с «-», читалась бы как ключ `claude`: ей достаточно слова впереди.
  argv.push(spec.task.startsWith('-') ? `Задача: ${spec.task}` : spec.task)

  return argv
}

/** Что вывел `claude --bg`: `backgrounded · 0de41c8d · имя`. */
export function startedOf(stdout: string): { id: string; name: string } | null {
  const hit = /backgrounded\s*[·\-:]\s*([0-9a-f]{6,})\s*[·\-:]\s*(.+)/i.exec(stdout)

  return hit ? { id: hit[1] ?? '', name: (hit[2] ?? '').trim() } : null
}

/** Причина отказа CLI одной строкой, для человека. */
export function failureOf(stderr: string, stdout: string): string {
  const text = `${stderr}\n${stdout}`.trim()

  if (/not trusted/i.test(text)) {
    return 'Каталог не доверенный: откройте в нём `claude` один раз, подтвердите доверие и повторите.'
  }

  const line = text.split('\n').find(row => row.trim() !== '')

  return line ? line.trim().slice(0, 200) : 'команда завершилась без объяснения'
}

/** Поручение для сообщения другой сессии: от кого оно, чтобы ответить адресно. */
export function messageFor(from: string, text: string): string {
  return `[от диспетчера сессий, отправитель: ${from}] ${text.trim()}`
}

export type Preset = { label: string; task: string }

/**
 * Готовые задачи для новичка: кнопка вместо формулировки. Показываются только
 * те, чья команда в этой сессии есть: плагин не установлен - кнопки нет, а не
 * кнопка, которая запускает пустоту.
 */
export function presetsOf(commandNames: readonly string[]): Preset[] {
  const has = (name: string) => commandNames.includes(name)
  const presets: Preset[] = []

  if (has('dex-auto:onboard')) {
    presets.push({
      label: 'Подготовить проект к работе с агентами',
      task: '/dex-auto:onboard',
    })
  }

  return presets
}
