import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ordered, parseAgents, phaseOf, pickSession, tallyLine, tallyOf } from '../hooks/sessions.ts'

const SAMPLE = JSON.stringify([
  { pid: 1, cwd: '/a', kind: 'interactive', startedAt: 10, sessionId: 'aaaaaaaa-1', name: 'dp-3168', status: 'idle' },
  { pid: 2, cwd: '/a', kind: 'interactive', startedAt: 20, sessionId: 'bbbbbbbb-2', name: 'dp-3233', status: 'busy' },
  { id: 'c1', cwd: '/b', kind: 'background', startedAt: 30, sessionId: 'cccccccc-3', name: 'fix-tests', state: 'blocked', waitingFor: 'разрешение на Bash' },
  { id: 'd1', cwd: '/b', kind: 'background', startedAt: 5, sessionId: 'dddddddd-4', name: 'old', state: 'done' },
  { cwd: '/x' },
])

describe('phaseOf', () => {
  it('читает оба поля CLI', () => {
    assert.equal(phaseOf('busy', ''), 'working')
    assert.equal(phaseOf('', 'working'), 'working')
    assert.equal(phaseOf('idle', ''), 'idle')
    assert.equal(phaseOf('', 'blocked'), 'waiting')
    assert.equal(phaseOf('waiting', ''), 'waiting')
    assert.equal(phaseOf('', 'failed'), 'failed')
    assert.equal(phaseOf('', 'done'), 'done')
    assert.equal(phaseOf('', 'stopped'), 'stopped')
    assert.equal(phaseOf('', ''), 'unknown')
  })
})

describe('parseAgents', () => {
  it('разбирает сессии и пропускает записи без sessionId', () => {
    const rows = parseAgents(SAMPLE)

    assert.equal(rows.length, 4)
    assert.equal(rows[2]?.kind, 'background')
    assert.equal(rows[2]?.shortId, 'c1')
    assert.equal(rows[2]?.waitingFor, 'разрешение на Bash')
    assert.equal(rows[0]?.shortId, 'aaaaaaaa')
  })

  it('мусор и не массив дают пустой список', () => {
    assert.deepEqual(parseAgents('не json'), [])
    assert.deepEqual(parseAgents('{"a":1}'), [])
    assert.deepEqual(parseAgents(''), [])
  })
})

describe('ordered и итог', () => {
  it('сначала то, что ждёт человека, затем работа, затем законченное', () => {
    const rows = ordered(parseAgents(SAMPLE))

    assert.deepEqual(rows.map(row => row.name), ['fix-tests', 'dp-3233', 'dp-3168', 'old'])
  })

  it('итог перечисляет только непустые фазы', () => {
    const line = tallyLine(tallyOf(parseAgents(SAMPLE)))

    assert.equal(line, 'Сессий 4: ждут вас: 1, работают: 1, свободны: 1, готовы: 1.')
    assert.equal(tallyLine(tallyOf([])), 'Сессий нет.')
  })
})

describe('pickSession', () => {
  const shown = ordered(parseAgents(SAMPLE))

  it('по номеру из списка', () => {
    assert.deepEqual(pickSession('1', shown), { row: shown[0] })
    assert.deepEqual(pickSession('#2', shown), { row: shown[1] })
  })

  it('номер вне списка - ошибка с размером списка', () => {
    const picked = pickSession('9', shown)

    assert.ok('error' in picked && picked.error.includes('4'))
  })

  it('по имени и по началу имени', () => {
    assert.deepEqual(pickSession('fix-tests', shown), { row: shown[0] })
    assert.deepEqual(pickSession('fix', shown), { row: shown[0] })
    assert.deepEqual(pickSession('DP-3233', shown), { row: shown[1] })
  })

  it('неоднозначное называет кандидатов и не выбирает молча', () => {
    const picked = pickSession('dp', shown)

    assert.ok('error' in picked)
    assert.match(picked.error, /dp-3233 \(bbbbbbbb\)/)
    assert.match(picked.error, /dp-3168/)
  })

  it('имя законченной сессии находится, хотя в показанном списке её нет', () => {
    const all = ordered(parseAgents(SAMPLE))
    const visible = all.filter(row => row.name !== 'old')

    assert.deepEqual(pickSession('old', visible, all), { row: all[3] })
    assert.ok('error' in pickSession('old', visible))
  })

  it('не найдено и пусто', () => {
    assert.ok('error' in pickSession('нет такой', shown))
    assert.ok('error' in pickSession('  ', shown))
  })

  it('по началу id', () => {
    assert.deepEqual(pickSession('cccc', shown), { row: shown[0] })
  })
})
