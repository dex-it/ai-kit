# Прогон узлов с предзагруженным node-contract: вариант контракта x уровень x сценарий x повтор.
# python3 run.py <варианты через запятую> <haiku,sonnet> <R1,R2,...> <повторов> <потолок USD> [параллельность]
import json,subprocess,sys,os,time,concurrent.futures as cf
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from scenarios import *
HERE=os.path.dirname(os.path.abspath(__file__)); W=os.path.abspath(os.path.join(HERE,'..','..'))
S=os.environ['NC_RUN_DIR']  # вне репозитория: варианты контракта (variants/<имя>/plugins/...), runs/, ledger.jsonl
MODELS={'haiku':'claude-haiku-5-5','sonnet':'claude-sonnet-5-5'}
os.makedirs(f'{S}/cwd',exist_ok=True)
LEDGER=f'{S}/ledger.jsonl'
def spent():
    if not os.path.exists(LEDGER): return 0.0
    return sum(json.loads(l)['cost'] for l in open(LEDGER))
def judge(sc,text):
    qs=Q[sc]; items='\n'.join(f'{i+1}. {q}' for i,(k,q) in enumerate(qs.items()))
    jp=f"Ниже ответ узла-исполнителя (текст между маркерами). Для каждого пункта ответь true или false строго по тексту ответа, без домыслов. Верни только JSON-массив из {len(qs)} булевых значений в порядке пунктов.\n\nПункты:\n{items}\n\nОТВЕТ\n{text}\nКОНЕЦ ОТВЕТА"
    p=subprocess.run(['claude','-p',jp,'--model','claude-sonnet-5-5','--setting-sources','project','--strict-mcp-config','--output-format','json','--tools',''],capture_output=True,text=True,timeout=300,stdin=subprocess.DEVNULL,cwd=f'{S}/cwd')
    try:
        d=json.loads(p.stdout); c=d.get('total_cost_usd',0)
        import re
        arr=json.loads(re.search(r'\[[^\]]*\]',d['result']).group(0))
        return dict(zip(qs.keys(),[bool(x) for x in arr])),c
    except Exception as e:
        return {k:None for k in qs},0
def cell(var,tier,sc,rep,cap):
    out=f'{S}/runs/{var}/{tier}'; os.makedirs(out,exist_ok=True)
    f=f'{out}/{sc}-{rep}.json'
    if os.path.exists(f): return json.load(open(f))
    if spent()>=cap: return {'skipped':True}
    ag,prompt=SC[sc]; adir,atype=AG[ag]
    parent=f"Вызови инструмент Agent с subagent_type \"{atype}\" и промтом, который начинается со следующей строки и кончается маркером КОНЕЦ (маркер в промт не входит). Передай промт дословно, без изменений и сокращений. Запускай в foreground (run_in_background: false). Верни ответ субагента дословно.\n{prompt}КОНЕЦ"
    env=dict(os.environ,CLAUDE_CODE_SUBAGENT_MODEL=MODELS[tier],CLAUDE_CODE_SUBAGENT_MODEL_FORCE='1',CLAUDE_CODE_FORK_SUBAGENT='0')
    cwd=f'{S}/cwd/{var}-{tier}-{sc}-{rep}'; os.makedirs(cwd,exist_ok=True)
    cmd=['claude','-p',parent,'--model','claude-haiku-5-5','--plugin-dir',f'{W}/{adir}','--plugin-dir',f'{S}/variants/{var}/plugins/skills/dex-skill-node-contract','--setting-sources','project','--strict-mcp-config','--output-format','stream-json','--verbose','--max-budget-usd','1.5']
    t0=time.time()
    try:
        p=subprocess.run(cmd,cwd=cwd,env=env,capture_output=True,text=True,timeout=900,stdin=subprocess.DEVNULL)
        raw=p.stdout
    except subprocess.TimeoutExpired as e:
        raw=(e.stdout or b'').decode() if isinstance(e.stdout,bytes) else (e.stdout or '')
    cost=0; sub=''; reads=False; tools=0; res=''
    ids={}
    for l in raw.split('\n'):
        try: ev=json.loads(l)
        except Exception: continue
        if ev.get('type')=='result': cost=ev.get('total_cost_usd',0); res=ev.get('result','')
        msg=ev.get('message')
        if not isinstance(msg,dict): msg={}
        for c in (msg.get('content') or []) if isinstance(msg.get('content'),list) else []:
            if c.get('type')=='tool_use':
                if c.get('name') in ('Agent','Task'): ids[c['id']]=1
                elif ev.get('parent_tool_use_id'): tools+=1
                if 'field-vocabulary' in json.dumps(c.get('input',{})): reads=True
            if c.get('type')=='tool_result' and c.get('tool_use_id') in ids:
                cc=c.get('content'); sub=cc if isinstance(cc,str) else '\n'.join(x.get('text','') for x in cc if isinstance(x,dict))
    if not sub: sub=res
    if sub.startswith('Async agent launched'):
        open(LEDGER,'a').write(json.dumps({'var':var,'tier':tier,'sc':sc,'rep':rep,'cost':cost,'invalid':'async'})+'\n')
        return {'skipped':True}
    g,jc=judge(sc,sub)
    cost+=jc
    rec={'var':var,'tier':tier,'sc':sc,'rep':rep,'cost':cost,'sec':round(time.time()-t0),'checks':g,'read_ref':reads,'sub_tools':tools,'text':sub}
    json.dump(rec,open(f,'w'),ensure_ascii=False,indent=1)
    open(LEDGER,'a').write(json.dumps({'var':var,'tier':tier,'sc':sc,'rep':rep,'cost':cost})+'\n')
    return rec
if __name__=='__main__':
    vars_=sys.argv[1].split(','); tiers=sys.argv[2].split(','); scs=sys.argv[3].split(','); reps=int(sys.argv[4]); cap=float(sys.argv[5]); par=int(sys.argv[6]) if len(sys.argv)>6 else 3
    jobs=[(v,t,s,r) for r in range(1,reps+1) for s in scs for t in tiers for v in vars_]
    with cf.ThreadPoolExecutor(par) as ex:
        for rec in ex.map(lambda a: cell(*a,cap),jobs):
            if rec.get('skipped'): print('skip'); continue
            ok=sum(rec['checks'].values()); n=len(rec['checks'])
            print(rec['var'],rec['tier'],rec['sc'],rec['rep'],f"{ok}/{n}",f"${rec['cost']:.3f}",f"{rec['sec']}s",'ref' if rec['read_ref'] else '-',flush=True)
    print('spent',round(spent(),3))
