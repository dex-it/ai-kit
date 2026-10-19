import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cleanName, failureOf, messageFor, nameFromTask, dirChoices, presetsOf, recentDirs, startArgv, startedOf } from '../hooks/dispatch.ts'

describe('имена', () => {
  it('имя из задачи: первые слова через дефис', () => {
    assert.equal(nameFromTask('Разобрать падающие тесты в модуле оплаты!'), 'разобрать-падающие-тесты-в')
    assert.equal(nameFromTask('!!!'), 'sessiya')
  })

  it('cleanName оставляет безопасные знаки', () => {
    assert.equal(cleanName(' мой/проект: 1 '), 'мой-проект-1')
    assert.equal(cleanName('--'), '')
  })
})

describe('startArgv', () => {
  it('задача идёт одним аргументом, ключи только заданные', () => {
    const argv = startArgv({ task: 'сделай "это"; rm -rf', name: '', dir: '', permissionMode: '', model: '' })

    assert.deepEqual(argv, ['claude', '--bg', '--name', 'сделай-это-rm-rf', 'сделай "это"; rm -rf'])
  })

  it('режим и модель добавляются, когда названы', () => {
    const argv = startArgv({ task: 'x', name: 'n', dir: '', permissionMode: 'plan', model: 'sonnet' })

    assert.deepEqual(argv, ['claude', '--bg', '--name', 'n', '--permission-mode', 'plan', '--model', 'sonnet', 'x'])
  })
})

describe('задача, похожая на ключ', () => {
  it('не уходит в claude голой', () => {
    const argv = startArgv({ task: '--dangerously-skip-permissions', name: '', dir: '', permissionMode: '', model: '' })

    assert.equal(argv.at(-1), 'Задача: --dangerously-skip-permissions')
    assert.ok(!argv.includes('--dangerously-skip-permissions'))
  })
})

describe('вывод CLI', () => {
  it('startedOf читает id и имя', () => {
    assert.deepEqual(startedOf('Starting background service…\nbackgrounded · 0de41c8d · probe-disp\n  claude agents'), {
      id: '0de41c8d',
      name: 'probe-disp',
    })
    assert.equal(startedOf('что-то другое'), null)
  })

  it('failureOf объясняет недоверенный каталог и берёт первую строку иначе', () => {
    assert.match(failureOf('Workspace not trusted. Run `claude`', ''), /доверен/)
    assert.equal(failureOf('\nошибка раз\nдва', ''), 'ошибка раз')
    assert.equal(failureOf('', ''), 'команда завершилась без объяснения')
  })

  it('сообщение соседу называет отправителя', () => {
    assert.equal(messageFor('5d8e1b88', ' привет '), '[от диспетчера сессий, отправитель: 5d8e1b88] привет')
  })
})

describe('presetsOf', () => {
  it('кнопка есть, только если команда в сессии есть', () => {
    assert.deepEqual(presetsOf(['review', 'dex-auto:onboard']).map(preset => preset.task), ['/dex-auto:onboard'])
    assert.deepEqual(presetsOf(['review']), [])
  })
})

describe('dirChoices', () => {
  it('текущая первой, затем папки сессий, затем соседи, без повторов', () => {
    const choices = dirChoices({
      current: '/h/work/a',
      recents: ['/h/work/r', '/h/work/a'],
      sessionDirs: ['/h/work/b', '/h/work/a'],
      neighbours: ['/h/work/b', '/h/work/c'],
      home: '/h',
    })

    assert.deepEqual(choices, [
      { value: '/h/work/a', label: 'эта папка: ~/work/a' },
      { value: '/h/work/r', label: 'недавняя: ~/work/r' },
      { value: '/h/work/b', label: 'где идут сессии: ~/work/b' },
      { value: '/h/work/c', label: 'рядом: ~/work/c' },
    ])
  })

  it('не длиннее потолка', () => {
    const many = Array.from({ length: 40 }, (_, i) => `/p/d${i}`)

    assert.equal(dirChoices({ current: '/p', recents: [], sessionDirs: [], neighbours: many, home: '' }).length, 20)
  })
})

describe('recentDirs', () => {
  const row = (project: unknown) => JSON.stringify({ display: 'x', project })

  it('свежие первыми, без повторов и временных, оборванная первая строка отброшена', () => {
    const text = [
      '{"оборвано',
      row('/h/old'),
      row('/h/new'),
      row('/h/old'),
      row('/private/tmp/claude-501/x'),
      row('/h/.cache/review/pr1'),
      row(42),
      'мусор',
      row('/h/last'),
    ].join('\n')

    assert.deepEqual(recentDirs(text), ['/h/last', '/h/old', '/h/new'])
  })

  it('не длиннее лимита', () => {
    const text = ['x', ...Array.from({ length: 50 }, (_, i) => row(`/p/${i}`))].join('\n')

    assert.equal(recentDirs(text, 5).length, 5)
  })
})
