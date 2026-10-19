import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cleanName, failureOf, messageFor, nameFromTask, presetsOf, startArgv, startedOf } from '../hooks/dispatch.ts'

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
