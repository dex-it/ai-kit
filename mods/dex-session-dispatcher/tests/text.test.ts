import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseAgents } from '../hooks/sessions.ts'
import { ageWord, detailText, entryLine, listText, openText, planLine, shortPath, usageLine } from '../hooks/text.ts'
import { absorbChunk, emptyStats } from '../hooks/transcript.ts'

const [row] = parseAgents(
  JSON.stringify([{ id: 'c1', cwd: '/Users/me/proj', kind: 'background', startedAt: 1000, sessionId: 'cccccccc-3', name: 'fix', state: 'blocked', waitingFor: 'разрешение' }]),
)

if (!row) throw new Error('нет строки')

const stats = absorbChunk(
  emptyStats(),
  {
    from: 0,
    text:
      JSON.stringify({ type: 'assistant', requestId: 'r', message: { model: 'm', content: [{ type: 'tool_use', name: 'TodoWrite', input: { todos: [{ content: 'шаг', status: 'in_progress' }] } }], usage: { input_tokens: 1, cache_read_input_tokens: 999, output_tokens: 5 } } }) + '\n',
  },
)

describe('text', () => {
  it('возраст словами', () => {
    assert.equal(ageWord(1000, 1000 + 30_000), 'только что')
    assert.equal(ageWord(1000, 1000 + 5 * 60_000), '5 мин назад')
    assert.equal(ageWord(1000, 1000 + 3 * 3_600_000), '3 ч назад')
    assert.equal(ageWord(0, 5), '')
  })

  it('путь с домом сокращается', () => {
    assert.equal(shortPath('/Users/me/proj', '/Users/me'), '~/proj')
    assert.equal(shortPath('/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q', ''), '/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q')
    assert.equal(shortPath(`/${'x'.repeat(30)}/${'y'.repeat(30)}/z`, ''), `…/${'y'.repeat(30)}/z`)
  })

  it('расход и план', () => {
    assert.match(usageLine(stats, 0), /контекст 1% \(1\.0k из 200k\)/)
    assert.equal(usageLine(undefined, 0), 'расход пока не известен')
    assert.equal(planLine(stats), 'план: 0 из 1 шагов, сейчас: шаг')
  })

  it('строка списка несёт причину ожидания и тип сессии', () => {
    const text = entryLine({ index: 1, row, stats, isSelf: false }, 0, 1000 + 60_000, '/Users/me')

    assert.match(text, /^1\. fix - ждёт вас: разрешение; фоновая; ~\/proj/)
  })

  it('пустой список учит начинать', () => {
    assert.match(listText([], 0, 0, ''), /1\. Опишите задачу/)
  })

  it('деталь без транскрипта говорит об этом прямо', () => {
    assert.match(detailText({ index: 1, row, stats: undefined, isSelf: false }, 0, 0, ''), /Транскрипт не прочитан/)
  })

  it('как открыть: фоновая, окно, своя', () => {
    assert.match(openText(row, false), /claude attach c1/)
    assert.match(openText({ ...row, kind: 'interactive', pid: 7 }, false), /другом окне терминала \(процесс 7\)/)
    assert.match(openText(row, true), /текущая сессия/)
  })
})
