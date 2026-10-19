const STR = { type: 'string' }
const STRS = { type: 'array', items: STR }
const CORPUS = { type: 'string', enum: ['present', 'absent'] }
const CHECK = { type: 'object', properties: {
  status: STATUS, 'corpus-status': CORPUS, 'corpus-basis': STR,
  checks: { type: 'array', items: { type: 'object', properties: { id: STR, verdict: { type: 'string', enum: ['upheld', 'contradicted', 'unverifiable'] }, evidence: STR }, required: ['id', 'verdict', 'evidence'] } },
  missed: { type: 'array', items: { type: 'object', properties: { where: STR, what: STR }, required: ['where', 'what'] } },
  foreign: STRS, secrets: STRS, decisions: STRS, missing: STR,
}, required: ['status', 'corpus-status', 'corpus-basis', 'checks', 'missed', 'foreign', 'secrets', 'decisions', 'missing'] }
const checkGaps = (units, chk) => {
  const byId = new Map(chk.checks.map(c => [c.id, c]))
  const ids = new Set(units.map(u => u.id))
  const unheld = units.map(u => byId.get(u.id) || { id: u.id, verdict: 'без вердикта', evidence: 'строки сверщика с этим id нет' })
    .filter(c => c.verdict !== 'upheld').map(c => `${c.id} - ${c.verdict}: ${c.evidence}`)
  // Иначе вердикт под id вне единиц (диапазон у составителя) пропал бы молча.
  const stray = chk.checks.filter(c => !ids.has(c.id)).map(c => c.verdict === 'upheld' ? `${c.id} - upheld` : `${c.id} - ${c.verdict}: ${c.evidence}`)
  return [unheld.length && `единица не подтверждена сверкой: ${unheld.join(' | ')}`,
    stray.length && `вердикт сверщика по id вне единиц: ${stray.join(' | ')}`,
    chk.missed.length && `предмет без единицы корпуса: ${chk.missed.map(m => `${m.where} - ${m.what}`).join(' | ')}`].filter(Boolean)
}
