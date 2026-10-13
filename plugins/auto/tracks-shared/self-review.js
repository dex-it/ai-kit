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
