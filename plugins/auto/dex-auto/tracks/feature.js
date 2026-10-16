// Трек feature как Workflow-скрипт (artifacts.md, O12 вариант A; форма проверена probes.md P9, P11).
// Вход через args: { task, goal, done, boundary, mode, cwd, source, goal_path, resume, trail, open_findings, ctx }.
// Обязательства формы: status первым полем каждой схемы; потолки петель в скрипте; схема несёт
// поле под каждую часть контракта узла; нумерацию единиц отдаёт узел контекста.
export const meta = {
  name: 'dex-auto-feature',
  description: 'Трек feature: контекст R/I параллельно подготовке дерева -> правка с верификацией (потолок 3) -> саморевью -> правка по находкам (потолок 1)',
  phases: [
    { title: 'Context', detail: 'параллельно: R/I из цели, кода и корпуса документации проекта и подготовка дерева - зависимости по манифесту стека, сборка и тесты до правок' },
    { title: 'Implement', detail: 'узел-кодер x верификация внешним фактом, потолок 3; при возобновлении - сначала верификация' },
    { title: 'Review', detail: 'саморевью, при блокирующих находках одна правка с верификацией и повторное ревью' },
  ],
}

const A = args || {}
const FIX_CEILING = 3, REVIEW_FIX_CEILING = 1
// Дерево, стоп-линии и отсутствие оператора одинаковы для любого узла трека; цель и критерий
// несёт только тот, кто их исполняет.
const TREE = `Рабочий каталог - ${A.cwd}: отдельное git worktree трека на ветке auto/${A.task}, процесс уже в нём; чужой работы в нём нет - всё незакоммиченное в нём от этой работы. Дерево сессии, от которого оно заведено, не трогай. Push, деплой, миграции данных и удаление вне рабочего дерева не делать - это стоп-линия. Оператора нет: невыводимое не додумывай, верни status: blocked с полем нехватки.\n`
// >>> shared: goal-args
// Главный поток может не подать done и boundary: узел берёт их из файла цели, пропуск - в degraded
const blank = (v) => !String(v || '').trim()
const fromGoal = (v, absent, section, dflt) => !blank(v) ? v : A.goal_path ? `${absent}, возьми из раздела \`## ${section}\` файла цели ${A.goal_path}` : dflt
const goalLack = [blank(A.done) && 'критерий «готово» не подан', blank(A.boundary) && 'граница не подана'].filter(Boolean)
  .map(s => `${s} в args: ${A.goal_path ? `узлы отосланы к файлу цели ${A.goal_path}` : 'файла цели нет'}`)
const ownerSide = 'Пункт критерия «готово» или границы с пометкой «ответ оператора» - сторона, выбранная оператором: расхождение источника с ним противоречием не судится и в conflicts не идёт.'
// <<< shared: goal-args
const HEAD = `mode: ${A.mode || 'autonomous'}\nцель (${A.task}): ${A.goal}\nкритерий «готово»: ${fromGoal(A.done, 'не подан', 'Критерий «готово»', 'не подан')}\nграница: ${fromGoal(A.boundary, 'не подана', 'Граница', 'не выходить за рабочий каталог')}\nфайл цели: ${A.goal_path || 'нет'}\ndecision-log: n/a (трек журнал решений не ведёт; решения - полем decisions)\n${TREE}`
// Узел подготовки цели не получает: прочитав её первой строкой, он реализует фичу целиком, и
// хвостовой запрет его не держит (зонд P25). Предмет узла - дерево, и шапка несёт только его.
const PREP_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): подготовить дерево трека к сборке и тестам - и только это. Цель трека тебе не передана намеренно: реализацию ведёт другой узел, и код в дереве не твой предмет.\n${TREE}`
// Возобновление - это «продолжить» плюс след прошлого прогона: без следа прогона не было, и возобновлять нечего.
const resuming = !!(A.resume && A.trail)
const DONE = resuming ? `\nВозобновление: шаги ниже уже сделаны (из ledger), не повторяй их, продолжай с незакрытого:\n${A.trail}\n` : ''

// >>> shared: contract
const STATUS = { type: 'string', enum: ['complete', 'blocked', 'partial'] }
const VERDICT = { type: 'string', enum: ['APPROVE', 'REQUEST_CHANGES', 'NEEDS_DISCUSSION'] }
const lack = (v, who) => !v ? `${who} не вернул выход` : v.missing || `${who} вернул blocked без нехватки`
// Трек виден в списке / и зовётся без args: узлы с правом записи на пустом cwd работали бы в дереве сессии.
const unfed = (A, fields) => fields.filter(f => !String(A[f] ?? '').trim())
const why = (e) => String(e && e.message || e).slice(0, 300)
// <<< shared: contract
// >>> shared: nodes
// Цену узла ставит трек, frontmatter узла её не несёт; запись без model и effort - уровень сессии.
const NODE = {
  // sonnet - модель пробы в прогонах P76-P86 и P95.
  'goal-reader': { agentType: 'dex-auto:goal-reader', model: 'sonnet' },
  // opus - модель контроля dex-self-reviewer: сверка P74 различает норму, а не модель.
  reviewer: { agentType: 'dex-auto:reviewer', model: 'opus' },
  // без model - замера модели скептика нет (#289).
  skeptic: { agentType: 'dex-auto:skeptic' },
  // sonnet - модель кодеров каталога: сверка P75 различает норму, а не модель.
  coder: { agentType: 'dex-auto:coder', model: 'sonnet' },
  // opus - модель контроля dex-debugger: сверка P91 различает норму, а не модель.
  debugger: { agentType: 'dex-auto:debugger', model: 'opus' },
  // sonnet - узел исполняет публикацию по каналу хостинга, суждения о коде у него нет.
  deliverer: { agentType: 'dex-auto:deliverer', model: 'sonnet' },
}
// <<< shared: nodes
// >>> shared: domain
const SEV = { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'P0 = CRITICAL, P1 = HIGH, P2 = MEDIUM, P3 = LOW' }
const AXIS = { type: 'string', enum: ['security', 'architecture', 'language', 'business', 'regressions', 'performance', 'coverage', 'loose-ends', 'non-code'] }
const AXIS_OUTCOME = ['findings', 'clean', 'unverifiable', 'n/a']
const AXES = { type: 'array', items: { type: 'object', properties: { name: AXIS, outcome: { type: 'string', enum: AXIS_OUTCOME }, checked: { type: 'string' } }, required: ['name', 'outcome', 'checked'] } }
// Трек судит форму набора осей и её согласие с findings, верность исхода судит скептик.
const axesGap = (axes, findings) => {
  const a = axes || []
  const unnamed = AXIS.enum.filter(n => !a.some(x => x.name === n && x.outcome))
  const count = (n) => (findings || []).filter(f => f.axis === n).length
  return [unnamed.length ? `оси не названы: ${unnamed.join(', ')}` : '',
    ...a.filter(x => x.outcome === 'unverifiable').map(x => `ось не проверена: ${x.name} - ${x.checked || 'причина не названа'}`),
    ...(findings ? a.filter(x => (x.outcome === 'findings') !== count(x.name) > 0).map(x => `исход оси расходится с findings: ${x.name} - ${x.outcome}, находок оси ${count(x.name)}`) : [])].filter(Boolean).join('; ')
}
const ROOT_VERDICT = ['legitimate', 'illegitimate', 'none']
const ROOTS = { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string', description: 'место решения: file:line, file:from-to либо file' }, decision: { type: 'string' }, root: { type: 'string', description: 'проблема, требование или ограничение, которое решение закрывает, с источником' }, verdict: { type: 'string', enum: ROOT_VERDICT }, evidence: { type: 'string' } }, required: ['anchor', 'decision', 'root', 'verdict', 'evidence'] }, description: 'запись на каждое решение правки; место правки без решения - verdict none' }
// Нелегитимное решение без открытой находки ушло бы из выхода вердиктом без дефекта, который можно закрыть; у находки ревьюера статуса нет.
const stillOpen = (f) => !f.status || OPEN_FINDING.includes(f.status)
// Узлы называют одно место строкой, диапазоном или файлом: строковое равенство якорей разводит их в разные места.
const spot = (a) => { const s = String(a || '').trim().replace(/:$/, ''), m = /^(.+?):(\d+)(?:-(\d+))?(?::\d+)?$/.exec(s); return m ? [m[1], Math.min(+m[2], +(m[3] || m[2])), Math.max(+m[2], +(m[3] || m[2]))] : [s, 0, Infinity] }
const sameSpot = (a, b) => { const [fa, a1, a2] = spot(a), [fb, b1, b2] = spot(b); return fa !== '' && fa === fb && a1 <= b2 && b1 <= a2 }
const atFinding = (f, a) => [f.anchor, ...(f.places || [])].some(p => sameSpot(p, a))
const rootsGap = (roots, found) => {
  const bare = (roots || []).filter(x => x.verdict === 'illegitimate' && !(found || []).some(f => atFinding(f, x.anchor) && stillOpen(f))).map(x => x.anchor)
  return bare.length ? `решение нелегитимно без находки: ${bare.join(', ')}` : ''
}
// Форма одна у всех ревьюеров: ledger хранит находку одной записью, и поле, которого нет у одного узла, из реестра выпадает молча.
const FINDING = { type: 'object', properties: {
  anchor: { type: 'string', description: 'file:line' }, places: { type: 'array', items: { type: 'string' } }, severity: SEV, axis: AXIS,
  text: { type: 'string' }, closure: { type: 'string', description: 'критерий закрытия' }, evidence: { type: 'string' },
  premise: { type: 'string', description: 'посылка, которую не доказали ни код, ни прогон, и проба, которая её проверит; посылка доказана - пусто' },
}, required: ['anchor', 'places', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise'] }
// Узел выносит статус из PRIOR_STATUS; unverified и dropped ставит только трек. Перечень реестра держат и dexauto.py с finish.py - сверяет sync-tracks --check.
const PRIOR_STATUS = ['closed', 'partial', 'open', 'disputed', 'no-longer-applicable']
const OPEN_FINDING = ['open', 'partial', 'unverified']
const FINDING_STATUS = [...OPEN_FINDING, 'closed', 'disputed', 'no-longer-applicable', 'dropped']
// Прежняя находка опознаётся по id реестра ledger: без него finish.sh заводит её новой, и разность «открытые» двоится.
const PRIOR = { type: 'object', properties: {
  id: { type: 'string', description: 'id находки из перечня; находки в перечне нет - её место в findings, не здесь' },
  anchor: FINDING.properties.anchor, places: FINDING.properties.places, severity: SEV, axis: { type: 'string', description: 'ось из перечня; не названа - пусто' }, text: { type: 'string' },
  status: { type: 'string', enum: PRIOR_STATUS }, evidence: { type: 'string' },
  premise: { type: 'string', description: 'посылка находки, всё ещё не доказанная, с пробой; доказана кодом, прогоном либо ответом оператора в цели - пусто' },
}, required: ['id', 'anchor', 'severity', 'axis', 'text', 'status', 'evidence', 'premise'] }
const isOpen = (f) => OPEN_FINDING.includes(f.status)
const isBlocking = (f) => f.severity === 'P0' || f.severity === 'P1'
const isFixable = (f) => isBlocking(f) || f.severity === 'P2'
// Исход такой находки решает проба оператора, а не правка: кодер по ней покупал круг за кругом на недостижимом пути.
const awaitsProbe = (f) => !!String(f.premise || '').trim()
const priorLine = (p) => `- ${p.id ? `${p.id} ` : ''}[${p.severity}] ${p.axis ? `${p.axis} ` : ''}${p.anchor}: ${p.text}${(p.places || []).length ? ` (также: ${p.places.join(', ')})` : ''}${awaitsProbe(p) ? ` (проба: ${p.premise})` : ''}`
const findingLine = (f) => `${priorLine(f)}${f.closure ? ` (закрытие: ${f.closure})` : ''}${f.evidence ? `\n  улика: ${f.evidence}` : ''}`
// Опознание - по id (ledger.md R10): строка сдвигается правкой, а на одной строке бывают разные находки. Статус прежней - последний, вынесенный узлом; о которой узел промолчал, та остаётся непроверенной.
// id записей, которые узел закрыл в своём выходе (статус не из открытых).
const shutBy = (r) => (r.prior || []).filter(p => p.id && !isOpen(p)).map(p => p.id)
function registry(unsettled) {
  const list = []
  let minted = 0
  const at = (id) => id ? list.findIndex(q => q.id === id) : -1
  const seat = (p, status, evidence) => {
    const i = at(p.id)
    // Важность записи только растёт: повторное ревью, поднявшее P2 до P1, должно держать порог допуска.
    const base = i < 0 ? { id: p.id || `N${++minted}`, anchor: p.anchor || '', places: p.places || [], severity: p.severity || '', axis: p.axis || '', text: p.text || '', closure: p.closure || '', premise: p.premise || '' }
      : { ...list[i], severity: p.severity && (!list[i].severity || p.severity < list[i].severity) ? p.severity : list[i].severity, premise: 'premise' in p ? p.premise || '' : list[i].premise || '', places: (p.places || []).length ? p.places : list[i].places || [] }
    const rec = { ...base, status: FINDING_STATUS.includes(status) ? status : 'unverified', evidence: FINDING_STATUS.includes(status) ? evidence : `статус вне словаря реестра (${status}): ${evidence}` }
    if (i < 0) list.push(rec); else list[i] = rec
    return rec.id
  }
  // Страховка от промаха узла: молча склеивает только якорь с той же непустой осью, совпавший один якорь - на вид.
  // Запись, которую узел в этом же выходе закрыл, он назвал сам: находка на её месте - другая, склейка отменила бы его статус и потеряла её суть.
  const take = (fs, who, known = list.slice(), shut = []) => {
    return (fs || []).map(f => {
      const hit = known.find(q => q.anchor === f.anchor && q.axis && q.axis === f.axis && !shut.includes(q.id))
      if (hit) { degraded.push(`${who}: находка ${hit.id} (${f.anchor}) подана новой - узел не назвал id, опознана по якорю и оси`); return { f, id: hit.id } }
      const near = known.find(q => q.anchor === f.anchor)
      if (near) degraded.push(`${who}: находка ${f.anchor} (${f.axis || 'ось не названа'}) - возможный дубль ${near.id}, заведена отдельно`)
      return { f, id: '' }
    })
  }
  return {
    seat, take, all: () => list.slice(), open: () => list.filter(isOpen),
    blocking: () => list.filter(isOpen).filter(isBlocking),
    fixable: () => list.filter(isOpen).filter(isFixable).filter(f => !awaitsProbe(f)),
    probes: () => list.filter(isOpen).filter(isFixable).filter(awaitsProbe),
    doubt: (p) => seat(p, 'unverified', !p.evidence || p.evidence === unsettled ? unsettled : p.evidence.startsWith(`${unsettled}; `) ? p.evidence : `${unsettled}; ${p.evidence}`),
    // Опознание - только в перечне, поданном узлу; статус из blocked-выхода не принимается, но его новые находки не теряются.
    apply: (r, who, listed = list.slice()) => {
      if (!r) return
      const blocked = r.status === 'blocked'
      if (!blocked) for (const p of r.prior || []) {
        if (!p.id || !listed.some(q => q.id === p.id)) degraded.push(`${who}: запись prior ${p.id || 'без id'} (${p.anchor}) не из перечня - статус не принят`)
        else seat(p, p.status, p.evidence)
      }
      for (const { f, id } of take(r.findings, who, listed, blocked ? [] : shutBy(r))) if (!id) seat(f, 'open', f.evidence); else if (!blocked) seat({ ...f, id }, 'open', f.evidence)
    },
  }
}
// Не-complete без места и нехватки оператору не действенен, а finish.sh пишет цели пустую нехватку: инвариант держит конструктор, не каждый выход.
const outcome = (status, where, missing, extra) => status === 'complete'
  ? { status, where: '', missing: '', loops, trail, degraded, ...extra }
  : { status, where: where || 'место не названо', missing: missing || `${where || 'шаг не назван'}: нехватка не названа`, loops, trail, degraded, ...extra }
// Узел каталога может быть не установлен: тогда general-purpose с ролью в промпте, факт - в degraded (graceful degradation).
async function node(role, prompt, opts, type) {
  if (type) {
    try { const r = await agent(prompt, { ...opts, agentType: type }); return r }
    catch (e) {
      // Причина обрыва платформой не типизирована: узел мог не существовать, а мог упасть посреди работы. Замена получает причину и сверяет уже сделанное.
      const w = why(e)
      degraded.push(`${role}: ${type} не отработал (${w})`); log(`узел ${type} не отработал, general-purpose`)
      return agent(`Роль: ${role}.\nУзел ${type} на этом шаге оборвался ошибкой: ${w}. Прежде чем действовать, сверь git log и рабочее дерево: сделанное им не повторяй и не коммить второй раз.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
    }
  }
  return agent(`Роль: ${role}.\n${prompt}`, { ...opts, agentType: 'general-purpose' })
}
// Узел dex-auto заменой не страхуется: у general-purpose нет его нормы.
async function own(role, prompt, opts, spec) {
  try { return await agent(prompt, { ...opts, ...spec }) }
  catch (e) { degraded.push(`${role}: ${spec.agentType} не отработал (${why(e)})`); log(`узел ${spec.agentType} не отработал`); return null }
}
// Поля возобновления ledger.py печатает строкой JSON, а главный поток подаёт их как есть либо разобранными.
const fromLedger = (v) => { if (typeof v !== 'string') return v; try { return JSON.parse(v) } catch (e) { return null } }
// Непригодный реестр прогон не останавливает (записи ledger без события прогона открыты сами), но и complete не выпускает: его P0/P1 трек не видел.
let ledgerUnread = false
const LEDGER_UNREAD = 'реестр прежних находок не прочитан - открытые P0/P1 прошлого прогона не сверены'
const ledgerList = (v, lost) => {
  if (v === undefined || v === null || v === '') return []
  const list = fromLedger(v)
  if (!Array.isArray(list)) { ledgerUnread = true; degraded.push(`поле open_findings не JSON-массив реестра ledger - ${lost}`); return [] }
  return list.filter(f => f && typeof f === 'object')
}
// <<< shared: domain
// >>> shared: falsify
const AXIS_CHECK = ['upheld', 'overturned']
// Исход оси ревьюера - claim: ось clean/n/a без записи скептика ушла бы в выход чистой непроверенной.
const axesCheckGap = (axes, check, confirmed) => {
  const c = check || []
  const unchecked = (axes || []).filter(a => ['clean', 'n/a'].includes(a.outcome) && !c.some(x => x.name === a.name)).map(a => a.name)
  const bare = c.filter(x => x.verdict === 'overturned' && !(confirmed || []).some(f => f.axis === x.name && stillOpen(f))).map(x => x.name)
  return [unchecked.length ? `исход оси не сверен скептиком: ${unchecked.join(', ')}` : '', bare.length ? `ось опровергнута без находки: ${bare.join(', ')}` : ''].filter(Boolean).join('; ')
}
const ROOT_CHECK = ['upheld', 'overturned']
// Вердикт по решению - claim в обе стороны, а overturned у legitimate и illegitimate значит противоположное: запись сверки - на одно решение.
const rootsCheckGap = (roots, check, found) => {
  const r = (roots || []).filter(x => x.verdict !== 'none')
  // Решения ревьюера пересекаются между собой: запись с местом решения иначе задела бы и соседнее.
  const exact = (y) => r.filter(x => String(spot(x.anchor)) === String(spot(y.anchor)))
  const hits = (check || []).map(y => [y, exact(y).length ? exact(y) : r.filter(x => sameSpot(y.anchor, x.anchor))])
  const wide = hits.filter(([, xs]) => xs.length > 1).map(([y]) => y.anchor)
  const own = (x) => hits.filter(([, xs]) => xs.length === 1 && xs[0] === x).map(([y]) => y)
  const unchecked = r.filter(x => !own(x).length).map(x => x.anchor)
  const bare = r.filter(x => own(x).some(y => (x.verdict === 'legitimate') === (y.verdict === 'overturned')) && !(found || []).some(f => atFinding(f, x.anchor) && stillOpen(f))).map(x => x.anchor)
  return [wide.length ? `запись сверки покрывает несколько решений: ${wide.join(', ')}` : '', unchecked.length ? `решение не сверено скептиком: ${unchecked.join(', ')}` : '', bare.length ? `решение нелегитимно после сверки без находки: ${bare.join(', ')}` : ''].filter(Boolean).join('; ')
}
// Решение, которого ревьюер не назвал (и под none тоже), сверка его записей не видит - его называет скептик этим полем; запись на месте названного решения - спор о его вердикте, его судит roots-check.
const rootsMissedGap = (missed, roots) => {
  const bare = (missed || []).filter(x => !(roots || []).some(r => r.verdict !== 'none' && sameSpot(r.anchor, x.anchor)))
  return bare.length ? `решение не перечислено ревьюером: ${bare.map(x => `${x.anchor} - ${x.decision}`).join('; ')}` : ''
}
// Находка ревьюера - claim: молчание скептика о ней убрало бы её из реестра без следа.
const silentGap = (findings, fal) => {
  const seen = [...(fal.confirmed || []), ...(fal.dropped || []), ...(fal.prior || [])]
  const bare = (findings || []).filter(f => !seen.some(x => sameSpot(x.anchor, f.anchor))).map(f => f.anchor)
  return bare.length ? `находка не сверена скептиком: ${bare.join(', ')}` : ''
}
const checkGap = (rev, fal) => {
  const found = [...(fal.confirmed || []), ...(fal.prior || [])]
  return [silentGap(rev.findings, fal), axesCheckGap(rev.axes, fal['axes-check'], found), rootsCheckGap(rev.roots, fal['roots-check'], found), rootsMissedGap(fal['roots-missed'], rev.roots)].filter(Boolean).join('; ')
}
// Места правки снимает не ревьюер: перечень, собранный тем, чью полноту он проверяет, ничего не проверяет.
const hunkList = (hunks) => (hunks || []).length ? `\nМеста правки (без тестов) - каждое пересекает запись roots: решение либо none с причиной:\n${hunks.map(h => `- ${h}`).join('\n')}` : ''
const hunkGap = (hunks, roots) => {
  const bare = (hunks || []).filter(h => !(roots || []).some(x => sameSpot(h, x.anchor)))
  return bare.length ? `место правки без записи roots: ${bare.join(', ')}` : ''
}
// Правила проекта ищет узел снимка, читает ревьюер: прочтение - поле выдачи, иначе непрочитанное правило неотличимо от соблюдённого.
const CONVENTIONS = {
  conventions: { type: 'array', items: { type: 'string' }, description: 'пути от корня репозитория: документы, которыми проект нормирует код и ревью; не нашёл - пусто' },
  'conventions-searched': { type: 'string', description: 'где искал правила проекта' },
}
const CONVENTIONS_READ = { type: 'array', items: { type: 'string' }, description: 'пути из правил проекта во входе, прочитанные до суждения' }
const conventionsAsk = 'Правила проекта - conventions: документы, предписывающие, каким быть коду и ревью: CLAUDE.md, AGENTS.md и аналоги в корне и на пути к изменённым файлам, названное ими нормой, гайды вклада и стиля, ADR. Не правила: конфиги сборки и линтера, заметки, которые проект нормой не называет. conventions-searched - где искал.'
const conventionsOf = (x) => x && x.status !== 'blocked' ? x.conventions || [] : []
const conventionsText = (x) => !x || x.status === 'blocked' ? '' : conventionsOf(x).length
  ? `\nПравила проекта - прочитай каждое до суждения: нарушение правила - находка, в evidence путь и ключ либо цитата правила; где правило расходится с отраслевой нормой о форме кода, судит правило:\n${conventionsOf(x).map(c => `- ${c}`).join('\n')}`
  : `\nПравил проекта не найдено (искали: ${x['conventions-searched'] || 'не названо'}).`
const conventionsGap = (x, rev) => {
  const path = (c) => String(c).trim().replace(/^\.\//, '')
  const read = ((rev && rev['conventions-read']) || []).map(path)
  const unread = conventionsOf(x).filter(c => !read.includes(path(c)))
  return unread.length ? `правила проекта не прочитаны: ${unread.join(', ')}` : ''
}
const axesText = (axes) => (axes || []).map(a => `- ${a.name}: ${a.outcome}${a.checked ? ` - ${a.checked}` : ''}`).join('\n') || '- не названы'
const rootsText = (roots) => (roots || []).map(x => `- ${x.anchor}: ${x.decision} - корень: ${x.root} - ${x.verdict}${x.evidence ? ` - ${x.evidence}` : ''}`).join('\n') || '- не названы'
const FALSIFY = { type: 'object', properties: {
  status: STATUS,
  confirmed: { type: 'array', items: FINDING },
  dropped: { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, reason: { type: 'string' } }, required: ['anchor', 'reason'] } },
  coverage: { type: 'string', description: 'вердикт по покрытию изменённого поведения: непокрытые ветки поимённо либо "покрыто: <чем>"' },
  'axes-check': { type: 'array', items: { type: 'object', properties: { name: AXIS, verdict: { type: 'string', enum: AXIS_CHECK }, evidence: { type: 'string' } }, required: ['name', 'verdict', 'evidence'] } },
  'roots-check': { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, verdict: { type: 'string', enum: ROOT_CHECK }, evidence: { type: 'string' } }, required: ['anchor', 'verdict', 'evidence'] } },
  'roots-missed': { type: 'array', items: { type: 'object', properties: { anchor: { type: 'string' }, decision: { type: 'string' } }, required: ['anchor', 'decision'] } },
  'review-verdict': VERDICT,
  prior: { type: 'array', items: PRIOR, description: 'сверенный с кодом статус каждой прежней находки перечня; прежних нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'confirmed', 'dropped', 'coverage', 'axes-check', 'roots-check', 'roots-missed', 'review-verdict', 'prior', 'missing'] }
// <<< shared: falsify
// >>> shared: verify
const VERIFY = { type: 'object', properties: {
  status: STATUS,
  exit_code: { type: 'integer' }, pass_count: { type: 'integer' }, fail_count: { type: 'integer' },
  failing: { type: 'array', items: { type: 'string' } },
  flaky: { type: 'array', items: { type: 'string' }, description: 'упали в первом прогоне и прошли в повторе' },
  build_ok: { type: 'boolean' },
  head: { type: 'string', description: 'git log --oneline -3' },
  dirty: { type: 'boolean', description: 'git status --porcelain непустой' },
  ahead: { type: 'integer', description: 'коммитов ветки трека, которых нет ни на одной другой ветке' },
  missing: { type: 'string', description: 'при blocked - почему прогон не выполнен; иначе пусто' },
}, required: ['status', 'exit_code', 'pass_count', 'fail_count', 'failing', 'build_ok', 'head', 'dirty', 'ahead', 'missing'] }
const AHEAD_CMD = 'git rev-list --count HEAD --not --exclude="$(git branch --show-current)" --branches'
const VERIFY_CMDS = `git log --oneline -3, git status --porcelain и ${AHEAD_CMD} (это ahead)`
// Команды едут скрипту hex-строкой: кавычки и $ в команде проекта шелл модели не портит.
const hexOf = (s) => encodeURIComponent(s).replace(/%([0-9A-F]{2})|[^%]/g, (m, h) => h ? h.toLowerCase() : m.charCodeAt(0).toString(16).padStart(2, '0'))
const verifySpec = (t, known, extra) => ({ build: t.build_cmd || '', test: t.report_cmd || t.test_cmd || '', known: known || [], ...extra })
const verifyRun = (scripts, spec) => `Выполни командой Bash с timeout 600000: python3 '${scripts}/verify.py' ${hexOf(JSON.stringify(spec))}
stdout - JSON. status running - повтори python3 '${scripts}/verify.py' --wait <его out> тем же timeout, пока status не станет другим. Поля схемы перенеси из итогового JSON как есть; counts null - pass_count, fail_count и failing выведи из test_tail. Команда не вернула JSON - status blocked, в missing её вывод.`
// Верификатор, не сумевший прогнать, по exit_code неотличим от красных тестов: без этой ветки трек проедает потолок правок вхолостую.
const noRun = (v) => !v || v.status === 'blocked'
const freshFails = (v, known) => ((v && v.failing) || []).filter(f => !(known || []).includes(f))
// Падение базы правке не вменяется, но безымянное падение (exit не 0 при пустом failing) унаследованным не считается.
const isGreen = (v, testCmd, known) => !!v && v.build_ok && !v.dirty && !(testCmd && !(v.pass_count > 0)) && !freshFails(v, known).length
  && ((v.exit_code === 0 && v.fail_count === 0) || (v.failing.length > 0 && v.fail_count <= v.failing.length))
const inheritedFails = (v, known) => ((v && v.failing) || []).filter(f => (known || []).includes(f))
const redNote = (v, known) => `exit=${v.exit_code}, build_ok=${v.build_ok}, прошло тестов: ${v.pass_count}, новые падения: ${freshFails(v, known).join('; ') || 'нет'}${inheritedFails(v, known).length ? `, унаследованы от базы: ${inheritedFails(v, known).join('; ')}` : ''}, dirty=${v.dirty}`
const NO_SCRIPTS = 'каталог скриптов не подан (args.scripts): верификатор гоняет команды сам - без отчёта раннера и повтора нестабильных'
// Полный набор кодер гонял сам и следом его же гонял верификатор: на больших наборах это удваивало каждую попытку.
const COVER_ONLY = 'Гоняй тесты задетого правкой, полный набор не гоняй.'
// <<< shared: verify
// >>> shared: prep
// Техконтекст выводится из манифеста, а не из цели: его отдаёт дешёвый узел подготовки, следующие узлы получают команды готовыми.
const PREP = { type: 'object', properties: {
  status: STATUS,
  stack: { type: 'string', description: 'идентификатор стека по реестру (Skill dex-skill-stack-registry:stack-registry); вне реестра - "other"' },
  stack_basis: { type: 'string', description: 'манифест, из которого выведен стек (путь:строка); манифеста нет - чем определено иначе' },
  test_cmd: { type: 'string', description: 'команда прогона тестов; нет тестов - пустая строка' },
  report_cmd: { type: 'string', description: 'test_cmd со встроенным флагом раннера, пишущим отчёт JUnit XML либо TRX в $DEX_AUTO_JUNIT_DIR; такой флаг не известен наверняка - пустая строка' },
  build_cmd: { type: 'string', description: 'команда сборки/типизации; нет - пустая строка' },
  prepare_cmd: { type: 'string', description: 'команда подготовки дерева до сборки; подготовка не нужна - пустая строка' },
  // Enum: «дерево готово» и «готовить нечего» ведут к разному промпту дальше, а провал установки пустой строкой неотличим от успеха до первой сборки.
  'prepare-status': { type: 'string', enum: ['done', 'not-needed', 'failed'], description: 'done - команда вернула 0; not-needed - prepare_cmd пуст; failed - команда вернула не 0 либо не запущена' },
  prepare_log: { type: 'string', description: 'при done - код возврата, чем подтверждено и возвращённые пути; при failed - команда и последние строки вывода; при not-needed - почему готовить нечего' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'stack', 'stack_basis', 'test_cmd', 'report_cmd', 'build_cmd', 'prepare_cmd', 'prepare-status', 'prepare_log', 'missing'] }
const PREP_STEPS = `1. Стек - идентификатор по реестру: вызови Skill dex-skill-stack-registry:stack-registry и сопоставь с манифестом дерева; вне реестра - "other". Манифест, из которого вывел, назови в stack_basis - догадка по именам файлов не принимается. По тому же манифесту назови команды сборки и тестов.
2. report_cmd - test_cmd, дополненная встроенным флагом раннера, который пишет отчёт JUnit XML либо TRX в каталог "$DEX_AUTO_JUNIT_DIR" (переменную задаёт верификатор), например: dotnet test - --logger trx --results-directory "$DEX_AUTO_JUNIT_DIR"; pytest - --junitxml="$DEX_AUTO_JUNIT_DIR/r.xml"; node --test - --test-reporter=junit --test-reporter-destination="$DEX_AUTO_JUNIT_DIR/r.xml"; vitest - --reporter=junit --outputFile="$DEX_AUTO_JUNIT_DIR/r.xml". Флаг не известен наверняка, требует пакета либо test_cmd - обёртка (npm test, make) без проброса аргументов - пусто.
3. Подготовка: дереву до сборки нужны зависимости, которых сборка сама не ставит, либо шаг подготовки, названный проектом, - назови команду и выполни её в дереве; не нужны - prepare_cmd пуст, prepare-status: not-needed. Строки git status --porcelain, которых до команды не было, верни: ?? - удали путь, прочие - git checkout -- путь. prepare-status: done - команда вернула 0, иначе failed.
Код не правь, сборку и тесты не гоняй.`
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
  : p['prepare-status'] === 'skipped' ? 'дерево подготовлено прошлым прогоном' : !p.build_cmd && !p.test_cmd ? 'нет ни сборки, ни тестов'
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
// <<< shared: prep
// >>> shared: self-review
// Ключи - имена полей выдачи из файлов узлов буквально: трансляция - место тихого расхождения схемы и нормы узла.
const FIX = { type: 'object', properties: {
  status: STATUS,
  plan: { type: 'array', items: { type: 'object', properties: { where: { type: 'string' }, change: { type: 'string' }, trace: { type: 'string' } }, required: ['where', 'change', 'trace'] }, description: 'план реализации в итоговой редакции: where - файл или символ, change - суть изменения, у отступления - с причиной, trace - требование, правило проекта с якорем, стандарт или практика' },
  'diff-scope': { type: 'array', items: { type: 'string' }, description: 'пути изменённых файлов и ветка, не тела' },
  commit: { type: 'string', description: 'sha локального коммита либо пусто' },
  'run-status': { type: 'string', description: 'свой прогон сборки и тестов: команда и исход; проверка неприменима - n/a с причиной, запуск невозможен - unverifiable с тем, что пробовал, и тогда status partial; зелёность трек судит VERIFY-узлом, не этим полем' },
  'red-run': { type: 'string', description: 'чем показано, что тест сторожит требование: нарушение (код до правки либо порча целевой ветки), на котором он был красным, и сверенная причина падения - на каждый новый и изменённый тест и на существующий, чью целевую ветку тронула правка (прежняя запись истекает с прежним поведением); подпадающих тестов нет - n/a с причиной; показать не вышло - unverifiable + чем пробовал' },
  // Признак замкнутости - enum: свободную строку модель отдаёт синонимами, а пустое значение неотличимо от невыясненного.
  'uncovered-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'осталось ли непокрытое тестами: none - не осталось, some - перечень в uncovered, unknown - покрытие не выяснялось; догадка сюда не пишется' },
  uncovered: { type: 'array', items: { type: 'string' }, description: 'при some - непокрытое перечнем (ветка, случай, граница); иначе пустой' },
  'dependents-status': { type: 'string', enum: ['none', 'some', 'unknown'], description: 'видно ли правку за пределами diff-scope: вызывающий код, контракт на проводе, схема данных, публичный API. none - не видно, some - видно (перечень в dependents), unknown - не разобрался; догадка сюда не пишется' },
  dependents: { type: 'array', items: { type: 'string' }, description: 'при some - потребители перечнем file:line; иначе пустой' },
  'fact-check': { type: 'string', description: 'триггер сверки - сигнатура или поведение стороннего API, взятые по памяти' },
  decisions: { type: 'array', items: { type: 'string' }, description: 'первой строкой - вызванные скиллы либо почему ни один не подошёл; далее каждая закрытая узлом развилка: что выбрано, из чего, почему' },
  // Пометку пробы судит ревью: кодеру находку с ней не подают, и его запись её не трогает.
  prior: { type: 'array', items: { type: 'object', properties: { id: PRIOR.properties.id, anchor: PRIOR.properties.anchor, severity: SEV, axis: PRIOR.properties.axis, text: PRIOR.properties.text, status: PRIOR.properties.status, evidence: PRIOR.properties.evidence }, required: ['id', 'anchor', 'severity', 'axis', 'text', 'status', 'evidence'] }, description: 'по каждой находке задания - запись с её id: closed - закрыта правкой, disputed - закрывать не следует; находок в задании нет - пусто' },
  missing: { type: 'string' },
}, required: ['status', 'plan', 'diff-scope', 'commit', 'run-status', 'red-run', 'uncovered-status', 'uncovered', 'dependents-status', 'dependents', 'fact-check', 'decisions', 'prior', 'missing'] }
const REVIEW = { type: 'object', properties: {
  status: STATUS,
  findings: { type: 'array', items: { type: 'object', properties: { anchor: FINDING.properties.anchor, severity: SEV, axis: FINDING.properties.axis, text: FINDING.properties.text,
    closure: FINDING.properties.closure, evidence: FINDING.properties.evidence, premise: FINDING.properties.premise,
    continues: { type: 'string', description: 'id прежней находки из перечня, чьё решение находка продолжает новым путём; иначе пусто' } },
  required: ['anchor', 'severity', 'axis', 'text', 'closure', 'evidence', 'premise', 'continues'] }, description: 'только находки, которых нет в перечне прежних' },
  axes: AXES,
  roots: ROOTS,
  'run-status': { type: 'string', description: 'прогон свой, не пересказ входа' },
  'red-run': { type: 'string', description: 'вердикт по записям red-run кодера во входе: по каждому тесту дельты запись действует / отсутствует / истекла; записей не было - unverifiable + что искал; тестов в дельте нет - n/a' },
  'fact-check': { type: 'string', description: 'предмет сверки - техутверждения находок' },
  'conventions-read': CONVENTIONS_READ,
  intent: { type: 'string', description: 'сверка с источником намерения входа: соответствует / расхождения «корректно, но не то»; источника нет - n/a' },
  'intent-status': { type: 'string', enum: ['match', 'mismatch', 'n/a'], description: 'mismatch - сделано не то, чего требует источник намерения входа; подробности в intent' },
  prior: { type: 'array', items: PRIOR, description: 'по каждой находке перечня прежних - запись с её id, статус с уликой; перечня нет - пусто' },
  'review-verdict': { ...VERDICT, description: 'сигнал оператору, порог допуска трека его не читает' },
  missing: { type: 'string', description: 'при blocked - чего не хватило для ревью; иначе пусто' },
}, required: ['status', 'findings', 'axes', 'roots', 'run-status', 'red-run', 'fact-check', 'conventions-read', 'intent', 'intent-status', 'prior', 'review-verdict', 'missing'] }
const UNSETTLED = 'статус саморевью не сверен'
const LISTED = 'Перечень находок: по каждой - запись в prior с её id, статус с уликой; находка перечня идёт только в prior, в findings - то, чего в перечне нет:'
// fix перезаписывается каждой попыткой: решения и оспаривание прежней находки без переноса в decisions до выхода не доезжают.
const said = (f) => [...(f.decisions || []), ...(f.prior || []).filter(p => p.status === 'disputed').map(p => `${p.id || p.anchor}: кодер оспорил закрытие - ${p.evidence}`)]
// Записи red-run и uncovered кодера - вход саморевьюера: он судит red-run по записям входа, а uncovered адресован следующему узлу.
const coderInput = (f) => f ? `\nВход от кодера - red-run: ${f['red-run']}\nuncovered: ${f['uncovered-status']}${(f.uncovered || []).length ? ' - ' + f.uncovered.join('; ') : ''}\ndependents: ${f['dependents-status']}${(f.dependents || []).length ? ' - ' + f.dependents.join('; ') : ''}` : ''
// Повторное ревью правке, целиком проверенной прогоном и не видимой наружу, нового факта не даёт (ledger: окупалось в 5 из 23); unknown и перечень при none пропуск не дают.
const sealed = (f) => f['uncovered-status'] === 'none' && (f.uncovered || []).length === 0 && f['dependents-status'] === 'none' && (f.dependents || []).length === 0
// Отказ кодера и его молчание - не закрытие.
const closedBy = (f, x) => ((f && f.prior) || []).some(p => p.id === x.id && p.status === 'closed')
const SKIPPED = 'закрыта правкой, повторное саморевью не куплено - правка покрыта прогоном (uncovered-status: none), наружу не видна (dependents-status: none), верификация зелёная'
// partial кодера и опровергнутая им сверка - исход автора: зелёная верификация и чистое ревью их не закрывают.
const authorGap = (f) => !f ? '' : f.status === 'partial' ? `кодер вернул partial: ${f.missing || f['run-status'] || 'нехватка не названа'}` : /^contradicted/.test(f['fact-check'] || '') ? `fact-check кодера: ${f['fact-check']}` : ''
const reviewGap = (r) => !r || r.status === 'blocked' ? '' : r.status === 'partial' ? `саморевью не завершено: ${r.missing || 'нехватка не названа'}` : r['intent-status'] === 'mismatch' ? `саморевью: реализовано не то: ${r.intent}` : axesGap(r.axes, r.findings) ? `саморевью: ${axesGap(r.axes, r.findings)}` : rootsGap(r.roots, [...(r.findings || []), ...(r.prior || [])]) ? `саморевью: ${rootsGap(r.roots, [...(r.findings || []), ...(r.prior || [])])}` : ''
// Порог допуска: зелёная верификация и ноль открытых P0/P1 реестра прогона; review-verdict - сигнал оператору, порог его не читает.
const admit = (green, rev, stuck, gaps) => !green ? 'верификация после правки по саморевью не прошла'
  : !rev ? 'саморевьюер не вернул выход'
  : rev.status === 'blocked' ? `саморевью не выполнено: ${lack(rev, 'саморевьюер')}`
  : stuck.length ? `открытые P0/P1: ${stuck.map(p => `${p.id} ${p.status} - ${awaitsProbe(p) ? `нужна проба оператора: ${p.premise}` : p.evidence}`).join('; ')}` : gaps
// Находка с пробой кодеру не подана: её P2 порога не держит, но вопрос оператору не теряется.
const probeAsks = (r) => r.probes().filter(f => !isBlocking(f)).map(f => `${f.id} [${f.severity}] ${f.anchor}: нужна проба оператора - ${f.premise}`)
const shaOf = (v) => String(v && v.head || '').trim().split(/\s/)[0]
const isSha = (x) => /^[0-9a-f]{7,40}$/i.test(String(x || ''))
// Ветку до head ревью complete уже прочли: повторное чтение всего диффа ветки - главная статья прогона дочистки.
// Ревью с разрывом снимка либо скептика базой не служит: дельта от него унесла бы непроверенное из объёма.
// Диагноз либо разведка, выведенные узлом, а не взятые из ledger, - новое намерение: ревью до них судили прежнее.
const INTENT_STEPS = ['1-repro', '1-req']
const priorBase = (trail) => {
  const all = steps(trail), from = all.reduce((k, e, i) => INTENT_STEPS.includes(e.step) && !/^ledger/.test(e.doer || '') ? i : k, -1)
  return (all.slice(from + 1).filter(e => (e.step === 3 || e.step === '3-repeat') && e.status === 'complete' && e.settled !== false && isSha(e.head)).pop() || {}).head || ''
}
const scope = (base) => base ? `дельта от ${base} - коммиты после него плюс рабочее дерево. Новые находки ищи в дельте, вне её - только сломанное правкой дельты; статус прежних находок перечня суди на текущем коде. ${base} не предок HEAD - ревью по всем коммитам цели.` : 'коммиты этой цели плюс рабочее дерево.'
// Пара «новая - прежняя» - факт поля узла: какой механизм тот же, судит ревьюер, трек лишь сверяет id с поданным перечнем.
// Находка с пробой с любой стороны пары кодеру не подаётся - размотать её ему нечем (I10).
// В реестре - запись скептика, его текст и место могут отличаться от ревьюера: id ищется по пересечению места и оси.
const pairsOf = (reg, r, listed, degraded) => (r && r.status !== 'blocked' ? r.findings : []).filter(f => isFixable(f) && !awaitsProbe(f) && String(f.continues || '').trim()).map(f => {
  const of = String(f.continues).trim(), earlier = listed.find(q => q.id === of), shut = shutBy(r)
  const at = reg.all().find(q => !listed.some(l => l.id === q.id) && sameSpot(q.anchor, f.anchor) && (q.axis || '') === (f.axis || '')) || listed.find(q => q.anchor === f.anchor && q.axis && q.axis === f.axis && !shut.includes(q.id))
  if (!earlier) { degraded.push(`саморевьюер: находка ${f.anchor} продолжает ${of} - id вне поданного перечня, пара не принята`); return null }
  if (awaitsProbe(earlier)) return null
  return { id: at ? at.id : f.anchor, of }
}).filter(Boolean)
const unwindOf = (chain, listed) => chain.length ? `\nНовый путь прежнего механизма: ${chain.map(p => `${p.id} продолжает ${p.of}`).join('; ')}. Прежние:\n${listed.filter(q => chain.some(p => p.of === q.id)).map(findingLine).join('\n')}\nРазмотай решение по всем входам и состояниям, где оно ошибается, и закрой разом; пути - в evidence записи prior.` : ''
const pairDecision = (p) => `${p.id} продолжает ${p.of}: правка по ${p.of} закрыла путь, а не механизм - кодеру задано размотать решение, повторное ревью куплено`
const pairLeft = (p) => `${p.id} продолжает ${p.of}: механизм не размотан правкой по находкам`
const HUNKS = { type: 'object', properties: {
  status: STATUS,
  hunks: { type: 'array', items: { type: 'string' }, description: 'путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file' },
  conventions: CONVENTIONS.conventions, 'conventions-searched': CONVENTIONS['conventions-searched'],
  missing: { type: 'string' },
}, required: ['status', 'hunks', 'conventions', 'conventions-searched', 'missing'] }
const OWN_COMMITS = 'git rev-list HEAD --not --exclude="$(git branch --show-current)" --branches'
const hunksAsk = (base) => `ТОЛЬКО перечень мест правки и правил проекта, код не менять. ${base ? `git diff -U0 ${base}; ${base} не предок HEAD (git merge-base --is-ancestor) - как без базы. ` : ''}Без базы - git diff -U0 "$(${OWN_COMMITS} | tail -1)^", своих коммитов нет - git diff -U0 HEAD. Место - путь от корня репозитория без a/ и b/, место file:from-to по +start,count заголовка @@ (from = start, to = start+count-1); только удалённые строки (count 0) - file:start; удалённый файл - file. Файлы тестов не включай. ${conventionsAsk}`
const hunksOf = (tag, base) => node('снимок правки', `${HEAD}Шаг 3 (${tag}): ${hunksAsk(base)}`, { label: `hunks:${tag}`, phase: 'Review', model: 'haiku', effort: 'low', schema: HUNKS })
const spotsOf = (h) => h && h.status !== 'blocked' ? h.hunks : []
const doubted = (rev, listed) => listed.map(p => { const c = (rev.prior || []).find(q => q.id === p.id); return `${priorLine(p)} - саморевьюер: ${c ? `${c.status} - ${c.evidence}` : 'статус не назван'}` }).join('\n')
const falsifyOf = (tag, rev, listed, base, h) => own('скептик', `${HEAD}Шаг 3 (${tag}): фальсификация находок, исходов осей, решений и статусов прежних из саморевью; вердикт по покрытию. Объём - ${scope(base)} Код не меняй.${conventionsText(h)}\nНаходки:\n${rev.findings.map(findingLine).join('\n') || '- находок нет: только вердикт по покрытию'}${listed.length ? `\nПрежние находки - статус саморевьюера:\n${doubted(rev, listed)}` : ''}\nОси саморевьюера:\n${axesText(rev.axes)}\nРешения саморевьюера:\n${rootsText(rev.roots)}`,
  { label: `falsify:${tag}`, phase: 'Review', schema: FALSIFY }, NODE.skeptic)
const judged = (fal) => !!fal && fal.status !== 'blocked'
// В реестр входит выход скептика; без него - claims ревьюера, и разрыв не выпускает complete.
const verdictOf = (rev, fal) => judged(fal) ? { status: fal.status, findings: fal.confirmed, prior: fal.prior } : rev
// Пара continues - поле ревьюера: держится, пока скептик подтвердил находку на том же месте и оси.
const kept = (rev, fal) => !rev || !judged(fal) ? rev : { ...rev, findings: rev.findings.filter(f => fal.confirmed.some(c => sameSpot(c.anchor, f.anchor) && c.axis === f.axis)) }
const settledOf = (rev, h, fal) => !spotGap(rev, h) && !falsifyGap(rev, fal)
const spotGap = (rev, h) => !rev || rev.status === 'blocked' ? '' : !h || h.status === 'blocked' ? `места правки не сняты: ${lack(h, 'снимок правки')}`
  : [h.status === 'partial' ? `места правки сняты не целиком: ${h.missing || 'нехватка не названа'}` : '', hunkGap(h.hunks, rev.roots) ? `саморевью: ${hunkGap(h.hunks, rev.roots)}` : '', conventionsGap(h, rev) ? `саморевью: ${conventionsGap(h, rev)}` : ''].filter(Boolean).join('; ')
const falsifyGap = (rev, fal) => !rev || rev.status === 'blocked' ? '' : !judged(fal) ? `фальсификация саморевью не выполнена: ${lack(fal, 'скептик')}`
  : [fal.status === 'partial' ? `фальсификация саморевью не завершена: ${fal.missing || 'нехватка не названа'}` : '', checkGap(rev, fal) ? `саморевью: ${checkGap(rev, fal)}` : ''].filter(Boolean).join('; ')
// <<< shared: self-review
const REQ = { type: 'object', properties: {
  status: STATUS,
  requirements: { type: 'array', items: { type: 'string' }, description: 'единицы R/I с номером R1..Rn и источником файл:строка либо пометкой "допущение"' },
  files: { type: 'array', items: { type: 'string' } },
  corpus: { type: 'string', description: 'найденный корпус документации проекта либо "корпуса нет"' },
  // Противоречие источников уезжало вниз строкой внутри requirements: трек читает у разведки
  // только status, и работа шла по стороне, выбранной узлом (зонд P23). Поле - enum, чтобы «нет
  // противоречий» отличалось от невыясненного, а не угадывалось по пустому перечню.
  'conflict-status': { type: 'string', enum: ['none', 'some'], description: 'противоречие между источниками о том, что считать готовым: none - нет, some - перечень в conflicts' },
  conflicts: { type: 'array', items: { type: 'string' }, description: 'при some - каждое противоречие строкой: якорь обеих сторон и что требует каждая; иначе пустой' },
  missing: { type: 'string', description: 'при blocked - чего не хватает и у кого это есть' },
}, required: ['status', 'requirements', 'files', 'corpus', 'conflict-status', 'conflicts', 'missing'] }
const loops = { fix: 0, review_fix: 0, review: 0 }
const trail = [], degraded = [...goalLack]
const unfedArgs = unfed(A, ['task', 'cwd', 'goal'])
if (unfedArgs.length) return outcome('blocked', 'Context', `трек вызван без входа: нет ${unfedArgs.join(', ')}`)
const LEDGER = resuming ? ledgerList(A.open_findings, 'находки прошлого прогона кодеру не поданы') : []
const ASK = LEDGER.filter(f => !awaitsProbe(f))
const OPEN = ASK.length ? `\nНезакрытые находки прошлого прогона (из ledger): по каждой - запись в prior с тем же id: closed с уликой либо disputed с основанием, почему закрывать не следует:\n${ASK.map(findingLine).join('\n')}\n` : ''
let ctx = null, fix = null, fix2 = null, ver = null, ver2 = null
// Решения копятся по попыткам: fix перезаписывается каждым кругом, и без накопления в ledger уезжает только последний.
const decisions = []
const dec = () => decisions.slice()
const bail = (where, missing, extra) => outcome('blocked', where, missing, { decisions: dec(), ctx, fix, ...extra })
// Падения базы до правок: правке не вменяются (T10).
let known = []
const passed = (v) => isGreen(v, ctx && ctx.test_cmd, known)

// Вход собирает /auto; workflow, вызванный по имени, приходит без него - узлы без цели и каталога не запускаются (T0).
const noInput = ['task', 'goal', 'cwd'].filter(k => !String(A[k] || '').trim())
if (noInput.length) return outcome('blocked', 'Context', `трек вызван без входа: нет ${noInput.join(', ')}`)
phase('Context')
const BASE_HEAD = `mode: ${A.mode || 'autonomous'}\nзадача (${A.task}): замерить сборку и тесты дерева до правок трека - и только это.\n${TREE}`
const verifyNode = async (head, tag, t, kn, ph) => {
  const v = await node('верификатор', `${head}Верификация (${tag}): ТОЛЬКО прогон и отчёт, код не менять. ${A.scripts ? verifyRun(A.scripts, verifySpec(t, kn)) : `Выполни ${t.build_cmd ? `сборку: ${t.build_cmd}; ` : ''}${t.test_cmd ? `тесты: ${t.test_cmd}` : 'тестов нет - build_ok по сборке, счётчики 0'}; затем ${VERIFY_CMDS}. Числа - из вывода раннера как есть.`}`,
    { label: `verify:${tag}`, phase: ph, model: 'haiku', effort: 'low', schema: VERIFY })
  if (v && Array.isArray(v.flaky) && v.flaky.length) decisions.push(`верификация (${tag}): нестабильные тесты - упали и прошли в повторе: ${v.flaky.join('; ')}`)
  return v
}
// Разведка выводится из неизменного - цели, манифеста и кода, - поэтому при возобновлении берётся
// из ledger, а не покупается заново: повтор ещё и перевыводит номера R, на которые ссылаются
// находки прошлого прогона.
// Барьер здесь по существу: шаг 2 нуждается в обеих половинах, а порознь они выводятся из разного -
// требования из цели и кода, команды из манифеста.
// Поле возобновления кладёт главный поток из ledger, но подать он может что угодно: непроверенная
// форма роняла трек на первом же обращении к разведке (зонд P25). Непригодное поле трек не
// останавливает - разведка покупается узлом, а подмена названа оператору.
const ctxIn = fromLedger(A.ctx)
const ctxFormed = !!ctxIn && Array.isArray(ctxIn.requirements) && ctxIn.requirements.length > 0 && Array.isArray(ctxIn.files) && (ctxIn.conflicts === undefined || Array.isArray(ctxIn.conflicts))
// Неполная разведка прошлого прогона - не продукт: недостающее оператор даёт в источник, и «продолжить» выводит её заново, иначе разрыв повторялся бы каждым прогоном.
const ctxResumed = ctxFormed && ctxIn.status === 'complete' ? ctxIn : null
if (A.ctx && !ctxFormed) degraded.push('поле ctx подано не в форме разведки (нужны перечни requirements и files, conflicts - перечнем) - разведка выведена узлом заново')
else if (ctxFormed && !ctxResumed) decisions.push(`разведка прошлого прогона ${ctxIn.status || 'без статуса'} - выведена узлом заново`)
const priorTree = priorPrep(ctxResumed, resuming ? A.trail : null)
if (!A.scripts) degraded.push(NO_SCRIPTS)
// База - за подготовкой в той же ветке: разведка дерево не трогает, а замер до правок нужен только подготовленному дереву (T5b).
const [tree, req] = await parallel([
  async () => {
    const p = priorTree || await node('подготовка дерева', `${PREP_HEAD}Шаг 1 (техконтекст и подготовка):\n${PREP_STEPS}`,
      { label: 'ctx:tree', phase: 'Context', model: 'haiku', schema: PREP })
    const skip = baseSkip(p, resuming ? A.trail : null)
    return { p, base: skip ? { status: 'n/a', log: skip, failing: [] } : baseFrom(await verifyNode(BASE_HEAD, 'база', p, [], 'Context')) }
  },
  () => ctxResumed ? Promise.resolve(ctxResumed) : node('аналитик контекста', `${HEAD}${DONE}Шаг 1 (требования): R/I. Источник: ${A.source || 'формулировка цели выше'}; прочитай его, исходники и тесты. Поищи корпус документации проекта (docs/, README, ADR, CLAUDE.md) - нет, так и скажи. Верни R/I: каждая единица пронумерована R1..Rn, с источником файл:строка либо пометкой "допущение". ${A.source ? `Требования и критерии приёмки источника против критерия «готово» цели суди вызовом Skill dex-skill-requirement-quality:requirement-quality, раздел «Противоречие»: поднятое им расхождение - строкой conflicts с якорями обеих сторон и тем, что требует каждая, conflict-status: some. ${ownerSide}` : `Источника требований нет - критерий «готово» сверять не с чем: conflict-status: none, conflicts пустой.`} Расхождение о техконтексте (файлы, корпус) сюда не подпадает: техконтекст берётся из дерева. Стек, команды сборки и тестов не выводи - их даёт соседний узел по манифесту. Код не меняй, сборку и тесты не прогоняй: соседний узел в этот момент ставит в это дерево зависимости и прогоняет сборку и тесты.`,
    { label: 'ctx:R-I', phase: 'Context', schema: REQ }, 'Explore'),
])
const prep = tree.p
trail.push(priorTree ? TREE_SKIPPED : { step: '1-tree', doer: 'подготовка дерева', status: prep ? prep.status : 'null', prepare: prep ? prep['prepare-status'] : null, baseline: tree.base.status, baseline_log: tree.base.log, baseline_failing: tree.base.failing })
trail.push({ step: '1-req', doer: ctxResumed ? 'ledger (разведка прошлого прогона)' : 'Explore', status: req ? req.status : 'null' })
if (!prep || prep.status === 'blocked') return bail('Context: подготовка дерева', lack(prep, 'узел подготовки дерева'))
if (!req || req.status === 'blocked') return bail('Context', lack(req, 'узел контекста'))
if (!req.requirements.length) return bail('Context', 'разведка не вывела ни одной единицы R/I - реализовывать нечего')
if (prep.status === 'partial') degraded.push(`подготовка дерева partial: ${prep.missing || 'нехватка не названа'}`)
// Форма ctx общая - её же принимает ledger и подаёт обратно в A.ctx.
ctx = { ...req, stack: prep.stack, build_cmd: prep.build_cmd, test_cmd: prep.test_cmd, report_cmd: prep.report_cmd || '', prepare_cmd: prep.prepare_cmd }
// Провал подготовки - не стоп: дерево лечит кодер первой попыткой, но знать о провале он обязан,
// иначе молча встанет на первой сборке и проест потолок.
if (prep['prepare-status'] === 'failed') degraded.push(`подготовка дерева не удалась: ${prep.prepare_log || 'причина не названа'}`)
const treeBase = baselineOf(tree.base, resuming ? A.trail : null)
if (treeBase && treeBase.fresh && treeBase.status === 'red') degraded.push(`дерево красное до правок трека: ${treeBase.log || 'что упало, не названо'}`)
known = treeBase ? treeBase.failing : []
const baseline = baselineNote(treeBase)
// Выбор стороны в противоречии источников - полномочие владельца требований, не узла: узел, выбравший
// сторону, закрепляет её тестом и коммитом, и решение в пользу второй стоит инверсии теста (зонд P23).
// Перечень судится наравне со статусом: «none» при непустом перечне сам себя опровергает.
const conflicts = ctx.conflicts || []
// Разведку этот исход не переживает (ctx: null): решение владельца меняет источник, из которого она
// выведена, и поданная из ledger она встала бы на том же противоречии по уже исправленным документам.
if (ctx['conflict-status'] === 'some' || conflicts.length) return bail('Context', `противоречие источников требований, выбор стороны не за исполнителем: ${conflicts.join('; ') || 'перечень не назван при conflict-status: some'}`, { ctx: null })
const reqText = ctx.requirements.join('\n')

phase('Implement')
// Фаза параметром: verify зовётся и из Review, а фаза берётся из opts, не из phase().
const verifyOnce = (tag, ph = 'Implement') => verifyNode(HEAD, tag, ctx, known, ph)
// Зелёная верификация на цели без прошлого прогона значит «работа не покрыта тестами», а не «сделана»: молча пропустить правку по ней нельзя.
if (A.resume && !resuming) {
  log('«продолжить» без следа прошлого прогона в ledger: трек идёт как первый, фаза правки не пропускается')
  decisions.push('«продолжить» подано без trail: прогона по этой цели в ledger нет, возобновление не применено - трек отработал как первый')
}
// Возобновление начинается с верификации: зелёное дерево с коммитами не переделывается (ledger.md, «продолжить»).
// Кодер, вызываемый при любом исходе верификации, гоняет тесты сам (T7a).
const coderAnyway = resuming && ASK.length > 0
if (coderAnyway) trail.push({ step: 'resume', doer: 'не куплено: кодер вызывается при любом исходе', status: 'skipped' })
else if (resuming) {
  ver = await verifyOnce('возобновление')
  trail.push({ step: 'resume', doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail('Implement: верификация при возобновлении', lack(ver, 'верификатор'))
}
// Зелёное дерево с незакрытыми находками прошлого прогона не выпускает трек мимо правки (ledger.md, «продолжить»);
// без коммитов трека - тоже: прошлый прогон встал до правки, и зелёные базовые тесты работу не подтверждают.
let pending = ASK.length > 0 || (resuming && !ver.ahead)
for (let k = 1; k <= FIX_CEILING && (!passed(ver) || pending); k++) {
  loops.fix = k; pending = false
  // red-run прошлой попытки - установленный факт: без него следующая попытка показывает тот же тест красным заново, проедая потолок.
  const priorRed = fix && fix['red-run'] && !/^(n\/a|unverifiable)/.test(fix['red-run']) ? `\nКрасный прогон уже показан прошлой попыткой и перепроверке не подлежит: ${fix['red-run']}` : ''
  const prev = ver && !passed(ver) ? `\n${k === 1 ? 'Верификация при возобновлении' : `Попытка ${k - 1}`} не прошла: ${redNote(ver, known)}.${priorRed}` : ''
  fix = await own('кодер', `${HEAD}${DONE}${OPEN}Шаг 2, попытка ${k} из ${FIX_CEILING}: реализация по требованиям, TDD (тесты на каждую R).\nТребования:\n${reqText}\nФайлы: ${ctx.files.join(', ')}. Тесты: ${ctx.test_cmd || 'нет'}. Сборка: ${ctx.build_cmd || 'нет'}. ${COVER_ONLY}${prep['prepare-status'] === 'done' ? ` Дерево подготовлено узлом контекста (${ctx.prepare_cmd}) - установку не повторяй.` : prep['prepare-status'] === 'failed' ? ` Подготовка дерева узлом контекста не удалась (${prep.prepare_log || 'причина не названа'}) - до первой сборки выполни её сам: ${ctx.prepare_cmd || 'команда не названа, выведи по манифесту'}` : prep['prepare-status'] === 'skipped' ? ` Дерево подготовлено прошлым прогоном, подготовка не повторялась: сборка упала на зависимостях - выполни ${ctx.prepare_cmd || 'подготовку по манифесту'} сам.` : ''}${baseline}${prev}\nПо завершении: коммит локально (сообщение по цели, без служебной нумерации R), push не делать.`,
    { label: `fix:${k}`, phase: 'Implement', schema: FIX }, NODE.coder)
  trail.push({ step: 2, attempt: k, doer: NODE.coder.agentType, status: fix ? fix.status : 'null', 'red-run': fix ? fix['red-run'] : null })
  if (fix) decisions.push(...said(fix))
  if (!fix || fix.status === 'blocked') return bail(`Implement#${k}`, lack(fix, 'узел-кодер'))
  ver = await verifyOnce(`после попытки ${k}`)
  trail.push({ step: '2-exit', attempt: k, doer: 'general-purpose', passed: passed(ver) })
  if (noRun(ver)) return bail(`Implement#${k}: верификация`, lack(ver, 'верификатор'))
  if (!passed(ver)) log(`попытка ${k}: exit=${ver && ver.exit_code}, build_ok=${ver && ver.build_ok}, fail=${ver && ver.fail_count}, dirty=${ver && ver.dirty}`)
}
if (!passed(ver)) return outcome('partial', `Implement: потолок ${FIX_CEILING} исчерпан`, `дерево не зелёное после ${FIX_CEILING} попыток: ${redNote(ver, known)}`, { ver, ctx, fix, decisions: dec() })

phase('Review')
// Разведка этого прогона - другое намерение: коммиты до прежней базы судились против прежних требований.
const firstBase = priorBase(resuming && ctxResumed ? A.trail : null)
const review = (tag, f, priors, base, h) => own('саморевьюер', `${HEAD}Шаг 3 (${tag}): pre-push саморевью локальной ветки - ${scope(base)}${hunkList(spotsOf(h))}${conventionsText(h)}${coderInput(f)} Источник намерения - требования:\n${reqText}${priors.length ? `\n${LISTED}\n${priors.map(priorLine).join('\n')}` : ''}\nПрогон build/test реальный, итог - в run-status, не в findings. Код не меняй.`,
  { label: `self-review:${tag}`, phase: 'Review', schema: REVIEW }, NODE.reviewer)
let spots = await hunksOf('первое', firstBase)
let rev = await review('первое', fix, LEDGER, firstBase, spots); loops.review = 1
const first = { step: 3, doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver), base: firstBase }
trail.push(first)
const dropped = []
const falsify = async (tag, r, listed, base, h) => {
  if (!r || r.status === 'blocked') return null
  const f = await falsifyOf(tag, r, listed, base, h)
  trail.push({ step: tag === 'первое' ? '3-falsify' : '3-repeat-falsify', doer: NODE.skeptic.agentType, status: f ? f.status : 'null', confirmed: f ? f.confirmed.length : -1, dropped: f ? f.dropped.length : -1 })
  if (judged(f)) dropped.push(...f.dropped)
  return f
}
let fal = await falsify('первое', rev, LEDGER, firstBase, spots)
first.settled = settledOf(rev, spots, fal)
const reg = registry(UNSETTLED)
LEDGER.forEach(reg.doubt)
reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик' : 'саморевьюер')
const chain = pairsOf(reg, kept(rev, fal), LEDGER, degraded)
decisions.push(...chain.map(pairDecision))
if (rev && rev.status !== 'blocked' && reg.fixable().length) {
  loops.review_fix = REVIEW_FIX_CEILING
  fix2 = await own('кодер', `${HEAD}Шаг 2 (повтор после саморевью, потолок ${REVIEW_FIX_CEILING}): закрой находки:\n${reg.fixable().map(findingLine).join('\n')}${unwindOf(chain, LEDGER)}\nТребования:\n${reqText}\nПосле правки коммит локально, push не делать. По каждой находке - запись в prior с её id: closed с уликой либо disputed с основанием, почему закрывать не следует.`,
    { label: 'fix:after-review', phase: 'Review', schema: FIX }, NODE.coder)
  ver2 = !fix2 || fix2.status === 'blocked' ? null : await verifyOnce('после саморевью', 'Review')
  trail.push({ step: '2-after-review', doer: NODE.coder.agentType, status: fix2 ? fix2.status : 'null', passed: passed(ver2), 'red-run': fix2 ? fix2['red-run'] : null })
  if (fix2) decisions.push(...said(fix2))
  const openNow = { review: rev, falsify: fal, prior: reg.all(), dropped }
  if (!fix2 || fix2.status === 'blocked') return bail('Review: правка по находкам', lack(fix2, 'узел-кодер'), openNow)
  if (noRun(ver2)) return bail('Review: верификация после правки', lack(ver2, 'верификатор'), openNow)
  if (passed(ver2) && sealed(fix2) && reg.blocking().filter(f => !awaitsProbe(f)).every(f => closedBy(fix2, f)) && !chain.length) {
    // Находка без своей строки решения - шаг не выполнен: снятая правкой идёт в decisions поимённо.
    // P2, не закрытая кодером, порога не держит и круга не покупает - остаётся открытой в реестре.
    const shut = reg.fixable().filter(f => closedBy(fix2, f))
    shut.forEach(f => {
      decisions.push(`${f.id} ${f.anchor}: ${SKIPPED}${f.closure ? `; критерий закрытия: ${f.closure}` : ''}`)
      reg.seat(f, 'closed', SKIPPED)
    })
    trail.push({ step: '3-repeat', doer: 'не куплено: правка замкнута и проверена прогоном', status: 'skipped', closed: shut.length })
  } else {
    const listed = reg.open()
    const firstDone = rev && rev.status === 'complete' && first.settled
    const repeatBase = firstDone ? shaOf(ver) : firstBase
    spots = await hunksOf('повторное', repeatBase)
    rev = await review('повторное', fix2, listed, repeatBase, spots); loops.review = 2
    fal = await falsify('повторное', rev, listed, repeatBase, spots)
    // Повторное без выхода или blocked статусов не выносит: реестр остаётся, каким его оставило первое.
    if (rev && rev.status !== 'blocked') listed.forEach(reg.doubt)
    reg.apply(verdictOf(rev, fal), judged(fal) ? 'скептик (повторное)' : 'саморевьюер (повторное)', listed)
    decisions.push(...pairsOf(reg, kept(rev, fal), listed, degraded).map(pairLeft))
    trail.push({ step: '3-repeat', doer: NODE.reviewer.agentType, status: rev ? rev.status : 'null', findings: rev ? rev.findings.length : -1, verdict: rev ? rev['review-verdict'] : null, head: shaOf(ver2), base: repeatBase, settled: settledOf(rev, spots, fal) })
  }
}
const finalVer = ver2 || ver
const gap = authorGap(fix2 || fix)
const green = passed(finalVer)
if (green && inheritedFails(finalVer, known).length) degraded.push(`падения базы не исправлены и правке не вменены: ${inheritedFails(finalVer, known).join('; ')}`)
const gaps = [ledgerUnread ? LEDGER_UNREAD : '', req.status === 'partial' ? `разведка требований неполна: ${req.missing || 'нехватка не названа'}` : '', !ctx.build_cmd && !ctx.test_cmd ? 'внешнего факта нет: ни сборки, ни тестов' : '', finalVer && !finalVer.ahead ? 'коммитов трека нет' : '', reviewGap(rev), spotGap(rev, spots), falsifyGap(rev, fal), gap].filter(Boolean).join('; ')
const where = admit(green, rev, reg.blocking(), gaps)
return outcome(where ? 'partial' : 'complete', where, where, {
  goal_check: { build_ok: !!finalVer && finalVer.build_ok, tests_green: !!finalVer && finalVer.exit_code === 0 && finalVer.fail_count === 0, inherited: inheritedFails(finalVer, known), committed: !!finalVer && !finalVer.dirty && finalVer.ahead > 0, head: finalVer ? finalVer.head : '' },
  ctx, fix, fix_after_review: fix2, review: rev, falsify: fal, prior: reg.all(), dropped,
  decisions: [...dec(), ...probeAsks(reg)],
})
