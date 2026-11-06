const steps = (t) => (Array.isArray(t) ? t : String(t || '').split('\n')).map(s => typeof s === 'string' ? fromLedger(s.replace(/^- /, '')) : s).filter(e => e && typeof e === 'object')
// Первый замер green либо red из trail старше свежего: на возобновлении дерево несёт правки трека, а их опознание узлом не гарантия.
function baselineOf(fresh, trail) {
  const e = steps(trail).find(x => x.step === '1-tree' && ['green', 'red'].includes(x.baseline))
  if (e) return { status: e.baseline, log: e.baseline_log || '', failing: Array.isArray(e.baseline_failing) ? e.baseline_failing : [], fresh: false }
  if (fresh && ['green', 'red'].includes(fresh.status)) return { ...fresh, fresh: true }
  return null
}
// Замер покупается только там, где он что-то меряет: база прошлого прогона в trail не перебивается свежей (T5a).
const baseSkip = (p, trail) => !p || p.status === 'blocked' ? 'подготовка не отработала' : p['prepare-status'] === 'failed' ? 'подготовка дерева не удалась'
  : p['prepare-status'] === 'skipped' ? 'каталог подготовлен прошлым прогоном' : !p.build_cmd && !p.test_cmd ? 'нет ни сборки, ни тестов'
  : baselineOf(null, trail) ? 'база прошлого прогона в trail' : ''
const baseFrom = (v) => noRun(v) ? { status: 'n/a', log: `верификация базы не прогнала: ${(v && v.missing) || 'выхода нет'}`, failing: [] }
  : v.dirty || v.ahead > 0 ? { status: 'n/a', log: 'в дереве правки трека', failing: [] }
  : v.build_ok && v.exit_code === 0 && !v.failing.length ? { status: 'green', log: `прошло тестов: ${v.pass_count}`, failing: [] }
  : { status: 'red', log: redNote(v, []), failing: v.failing }
const baselineNote = (b) => !b ? '' : b.status === 'red'
  ? ` До правок трека сборка и тесты уже падали (${b.failing.join('; ') || b.log || 'что упало, не названо'}): эти падения унаследованы, прочие внесены правками трека.`
  : ' До правок трека сборка и тесты были зелёными: любое падение внесено правками трека.'
// Узел подготовки на возобновлении повторял установленное (T1a); опора - последний настоящий замер, пропуск ею не служит.
function priorPrep(tc, trail) {
  const last = steps(trail).filter(e => e.step === '1-tree' && e.status !== 'skipped').pop()
  const fits = !!tc && typeof tc.stack === 'string' && !!tc.stack && !!(tc.build_cmd || tc.test_cmd)
    && !!last && ['complete', 'partial'].includes(last.status) && last.prepare !== 'failed'
  return fits ? { status: 'complete', stack: tc.stack, build_cmd: tc.build_cmd || '', test_cmd: tc.test_cmd || '', report_cmd: tc.report_cmd || '', prepare_cmd: tc.prepare_cmd || '', 'prepare-status': 'skipped' } : null
}
const TREE_SKIPPED = { step: '1-tree', doer: 'ledger (техконтекст прошлого прогона)', status: 'skipped' }
