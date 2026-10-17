const KEEP = 'Инварианты правки - источник намерения ниже и закрытые в этом прогоне находки: правка их не нарушает и не сужает поведение допущением о входе или среде, которого в источнике нет; такое допущение находку не закрывает.'
const keepText = (closed) => `\n${KEEP}${closed.length ? `\nЗакрытые в этом прогоне:\n${closed.map(f => `- ${f.id} ${f.anchor}: ${f.closure || f.text}`).join('\n')}` : ''}`
const deltaOf = (v) => v && Array.isArray(v.delta) ? v.delta : null
// Цикл - docs/domain.md §4; t несёт различия треков: review, coder, intent, run (команды прогона), verify, red (итог незелёной верификации либо ''), afterCoder (выход трека либо null), afterVerify, moved (необязательный: сменила ли правка то, что судит только ревью, - тест диагноста bugfix; true - пропуска ревью нет).
const OFFERED = 'На твоё решение - порога не держат: правь, только если правка не выходит за места, которые уже меняет правка цели либо называет находка, и не меняет наблюдаемого поведения вне находки; иначе запись prior disputed с основанием.'
async function reviewLoop(t) {
  const { fix, ver, firstBase } = t
  let fix2 = null, ver2 = null, deltaFrom = null, red = '', offeredOnly = false
  let spots = await hunksOf('первое', firstBase)
  let rev = await t.review('первое', fix, ver, LEDGER, firstBase, spots); loops.review = 1
  const first = { step: 3, doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver), base: firstBase }
  trail.push(first)
  const dropped = []
  // Ревью без правки, купленное разрывом сверки, без скептика закрыло бы разрыв молчанием.
  const falsify = async (tag, r, listed, base, h, gaps, recheck = false) => {
    if (!r || r.status === 'blocked') return null
    const step = tag === 'первое' ? '3-falsify' : '3-repeat-falsify'
    if (!recheck && !needsSkeptic(r, listed)) { trail.push({ step, doer: 'не куплен: P0/P1 нет', status: 'skipped' }); return SKIPPED }
    const f = await falsifyOf(tag, r, listed, base, h, gaps)
    trail.push({ step, doer: NODE.skeptic.agentType, status: f ? f.status : 'null', confirmed: f ? f.confirmed.length : -1, dropped: f ? f.dropped.length : -1 })
    if (judged(f)) dropped.push(...f.dropped)
    return f
  }
  let fal = await falsify('первое', rev, LEDGER, firstBase, spots)
  const reg = registry(UNSETTLED)
  LEDGER.forEach(reg.doubt)
  reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик' : 'саморевьюер')
  // Ревью со своим разрывом базой дельты не служит: повторное по дельте не перепроверило бы место разрыва.
  first.settled = settledOf(rev, spots, fal) && !reviewGap(rev, reg.all())
  const offeredHere = new Set()
  let last = first, listed = LEDGER, chain = pairsOf(reg, kept(rev, fal), LEDGER, degraded), base = firstBase
  const advance = () => { if (last.settled && rev && rev.status === 'complete') base = last.head }
  // Вопрос оператору (domain.md §2) едет и в выходе из цикла: иначе P2 видна только записью prior.
  const state = (exit) => ({ exit: exit && { ...exit, decisions: [...(exit.decisions || []), ...askLines(reg)] }, rev, fal, reg, spots, fix2, ver2, dropped, offeredOnly })
  advance()
  while (rev && rev.status !== 'blocked') {
    const reviewLeft = loops.review < REVIEW_CEILING
    let gaps = '', recheck = false
    // Не держащая порог подаётся кодеру один раз: оспоренная им осталась бы открытой и гоняла круги до потолка.
    const may = reg.offers().filter(f => !offeredHere.has(f.id))
    if ((reg.fixes().length || may.length || red) && loops.review_fix < REVIEW_FIX_CEILING && reviewLeft) {
      const k = ++loops.review_fix, must = reg.fixes().length > 0 || !!red
      may.forEach(f => offeredHere.add(f.id))
      if (deltaFrom === null) deltaFrom = shaOf(ver2 || ver)
      decisions.push(...chain.map(pairDecision))
      fix2 = await t.coder(`${HEAD}Шаг 2 (правка по находкам ${k} из ${REVIEW_FIX_CEILING}):${red ? ` верификация прошлой правки не прошла: ${red}.` : ''}${reg.fixes().length ? ` закрой находки:\n${reg.fixes().map(findingLine).join('\n')}` : ''}${may.length ? `\n${OFFERED}\n${may.map(findingLine).join('\n')}` : ''}${unwindOf(chain, listed)}${keepText(reg.closed())}\n${t.intent()}\n${t.run()}\nПосле правки коммит локально, push не делать. По каждой находке - запись в prior с её id: closed с уликой либо disputed с основанием, почему закрывать не следует.`)
      if (fix2) decisions.push(...said(fix2))
      const exit = fix2 && t.afterCoder(fix2, k, { review: rev, prior: reg.all() })
      if (exit) return state(exit)
      const prevVer = ver2 || ver
      ver2 = !fix2 || fix2.status === 'blocked' ? null : await t.verify('после саморевью', deltaFrom)
      t.afterVerify(ver2)
      offeredOnly = !must
      trail.push({ step: '2-after-review', attempt: k, doer: NODE.coder.agentType, status: fix2 ? fix2.status : 'null', passed: passed(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
      const openNow = { review: rev, falsify: fal, prior: reg.all(), dropped }
      if (!fix2 || fix2.status === 'blocked') return state(bail('Review: правка по находкам', lack(fix2, 'узел-кодер'), openNow))
      if (noRun(ver2)) return state(bail('Review: верификация после правки', lack(ver2, 'верификатор'), openNow))
      // Зелёная правка одних offered ревью не покупает: их исход итога не держит (domain.md §4); сменивший тест диагноста круг пропуска не получает (t.moved).
      if (!must && passed(ver2) && last.settled && !(t.moved && t.moved(prevVer, ver2))) {
        const shut = (fix2.prior || []).filter(p => p.status === 'closed' && may.some(f => f.id === p.id))
        shut.forEach(p => reg.seat(p, 'closed', `закрыто кодером без повторного ревью: ${p.evidence}`))
        decisions.push(...shut.map(p => `${p.id}: закрыто кодером без повторного ревью - ${p.evidence}`))
        trail.push({ step: '3-repeat', doer: 'не куплено: правка одних offered, верификация зелёная', status: 'skipped', closed: shut.length })
        break
      }
      red = passed(ver2) ? '' : t.red(ver2)
      if (!deltaOf(ver2)) degraded.push(`дельта правки по находкам ${k} не получена - новые находки ревью после неё считаются внесёнными правкой`)
    } else if (last.settled || rev['intent-status'] === 'mismatch' || !reviewLeft) break
    else { gaps = lapGaps(rev, spots, fal, reg.all()); recheck = !!falsifyGap(rev, fal) }
    listed = loops.review_fix ? reg.listing() : reg.open()
    spots = await hunksOf('повторное', base)
    rev = await t.review('повторное', fix2 || fix, ver2 || ver, listed, base, spots, gaps); loops.review++
    fal = await falsify('повторное', rev, listed, base, spots, gaps, recheck)
    // Повторное без выхода или blocked статусов не выносит: реестр остаётся, каким его оставило прежнее.
    if (rev && rev.status !== 'blocked') listed.forEach(reg.doubt)
    reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик (повторное)' : 'саморевьюер (повторное)', listed, loops.review_fix ? introducedAt(deltaOf(ver2)) : null)
    chain = pairsOf(reg, kept(rev, fal), listed, degraded)
    last = { step: '3-repeat', doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver2 || ver), base, settled: settledOf(rev, spots, fal) && !reviewGap(rev, reg.all()) }
    trail.push(last)
    advance()
  }
  decisions.push(...chain.map(pairLeft))
  return state(null)
}
