import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  absorbChunk,
  emptyStats,
  percentOf,
  snippet,
  todoProgress,
  tokensWord,
  topOf,
  windowOf,
} from '../hooks/transcript.ts'

const line = (value: unknown): string => JSON.stringify(value)

const assistant = (requestId: string, content: unknown[], usage?: Record<string, number>) =>
  line({ type: 'assistant', requestId, timestamp: 't', message: { model: 'claude-x', content, ...(usage ? { usage } : {}) } })

describe('absorbChunk', () => {
  it('считает usage один раз на запрос, хотя блоков несколько', () => {
    const usage = { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 7 }
    const text = [
      assistant('r1', [{ type: 'text', text: 'думаю' }], usage),
      assistant('r1', [{ type: 'tool_use', name: 'Skill', input: { skill: 'review' } }], usage),
      assistant('r2', [{ type: 'text', text: 'готово' }], { ...usage, output_tokens: 3 }),
    ].join('\n') + '\n'

    const stats = absorbChunk(emptyStats(), { text, from: 0 })

    assert.equal(stats.calls, 2)
    assert.equal(stats.outputTokens, 10)
    assert.equal(stats.inputTokens, 24)
    assert.equal(stats.cacheReadTokens, 200)
    assert.equal(stats.contextTokens, 112)
    assert.equal(stats.model, 'claude-x')
    assert.equal(stats.lastAnswer, 'готово')
    assert.deepEqual(stats.skills, { review: 1 })
  })

  it('отличает слова человека от ответов инструментов, заметок и сообщений соседей', () => {
    const text = [
      line({ type: 'user', message: { content: 'сделай тесты' } }),
      line({ type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } }),
      line({ type: 'user', isMeta: true, message: { content: 'служебное' } }),
      line({ type: 'user', origin: { kind: 'task-notification' }, message: { content: 'уведомление' } }),
      line({ type: 'user', origin: { kind: 'peer', name: 'приёмка' }, message: { content: 'привет' } }),
    ].join('\n') + '\n'

    const stats = absorbChunk(emptyStats(), { text, from: 0 })

    assert.equal(stats.prompts, 1)
    assert.equal(stats.lastPrompt, 'сделай тесты')
    assert.deepEqual(stats.received, [{ who: 'приёмка', text: 'привет' }])
  })

  it('берёт план, шаги, субагентов, отправленные сообщения, заголовок и PR', () => {
    const text = [
      assistant('r1', [
        { type: 'tool_use', name: 'TodoWrite', input: { todos: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'in_progress' }, { content: 'c', status: 'pending' }] } },
        { type: 'tool_use', name: 'Agent', input: { description: 'проверка слоя' } },
        { type: 'tool_use', name: 'SendMessage', input: { to: 'DP-3168', message: 'привет' } },
        { type: 'tool_use', name: 'ExitPlanMode', input: { plan: '\n# План дня\n\nтекст' } },
      ]),
      line({ type: 'ai-title', aiTitle: 'Приёмка слоя' }),
      line({ type: 'pr-link', prUrl: 'https://github.com/o/r/pull/1' }),
      line({ type: 'pr-link', prUrl: 'https://github.com/o/r/pull/1' }),
    ].join('\n') + '\n'

    const stats = absorbChunk(emptyStats(), { text, from: 0 })

    assert.deepEqual(todoProgress(stats.todos), { done: 1, total: 3, current: 'b' })
    assert.equal(stats.subagents, 1)
    assert.deepEqual(stats.subagentNotes, ['проверка слоя'])
    assert.deepEqual(stats.sent, [{ who: 'DP-3168', text: 'привет' }])
    assert.equal(stats.plan, 'План дня')
    assert.equal(stats.title, 'Приёмка слоя')
    assert.deepEqual(stats.pullRequests, ['https://github.com/o/r/pull/1'])
  })

  it('кусок не с начала файла теряет первую (оборванную) строку', () => {
    const whole = line({ type: 'user', message: { content: 'первая' } })
    const text = `${whole.slice(10)}\n${line({ type: 'user', message: { content: 'вторая' } })}\n`

    const stats = absorbChunk(emptyStats(), { text, from: 500 })

    assert.equal(stats.prompts, 1)
    assert.equal(stats.lastPrompt, 'вторая')
    assert.equal(stats.since, 500)
  })

  it('оборванная последняя запись не теряется: offset встаёт до неё, дочитывается потом', () => {
    const full = line({ type: 'user', message: { content: 'целая' } })
    const cut = line({ type: 'user', message: { content: 'половина' } })
    const first = `${full}\n${cut.slice(0, 15)}`
    const stats = absorbChunk(emptyStats(), { text: first, from: 0 })

    assert.equal(stats.prompts, 1)
    assert.equal(stats.offset, new TextEncoder().encode(`${full}\n`).length)

    const tail = `${cut}\n`

    absorbChunk(stats, { text: tail, from: stats.offset })

    assert.equal(stats.prompts, 2)
    assert.equal(stats.lastPrompt, 'половина')
  })

  it('мусорные строки пропускаются', () => {
    const stats = absorbChunk(emptyStats(), { text: 'не json\n{"type":"user"\n\n', from: 0 })

    assert.equal(stats.prompts, 0)
  })
})

describe('вспомогательные', () => {
  it('snippet чистит управляющие символы и режет длину', () => {
    assert.equal(snippet('а\u001b[31m\nб   в'), 'а [31m б в')
    assert.equal(snippet('x'.repeat(50), 10), 'xxxxxxxxx…')
  })

  it('окно контекста: названное, иначе угаданное', () => {
    const stats = emptyStats()

    assert.equal(windowOf(stats, 0), 200_000)
    assert.equal(windowOf(stats, 123), 123)

    stats.contextTokens = 300_000

    assert.equal(windowOf(stats, 0), 1_000_000)
    assert.equal(percentOf(300_000, 1_000_000), 30)
    assert.equal(percentOf(5, 0), 0)
    assert.equal(percentOf(9_000_000, 1_000_000), 100)
  })

  it('tokensWord и topOf', () => {
    assert.equal(tokensWord(950), '950')
    assert.equal(tokensWord(1500), '1.5k')
    assert.equal(tokensWord(42_000), '42k')
    assert.equal(tokensWord(2_500_000), '2.5M')
    assert.deepEqual(topOf({ a: 1, b: 3, c: 3 }, 2), [['b', 3], ['c', 3]])
  })
})
