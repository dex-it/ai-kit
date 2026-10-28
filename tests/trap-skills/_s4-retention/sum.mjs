import { readFileSync } from 'node:fs';
const rows = process.argv.slice(2).flatMap(f => readFileSync(f,'utf8').trim().split('\n').map(JSON.parse));
const ids=[...new Set(rows.map(r=>r.id))], models=[...new Set(rows.map(r=>r.model))];
let tot=0;
for (const m of models){ console.log('==',m);
 for (const id of ids){ const o=['old','new','cand','none'].map(a=>{const x=rows.filter(r=>r.model==m&&r.id==id&&r.arm==a);return x.length?`${x.filter(r=>r.pass).length}/${x.length}`:'-'}); console.log(id.padEnd(4),'old',o[0],'new',o[1],'cand',o[2],'none',o[3]); }
 for (const a of ['old','new','cand','none']){const x=rows.filter(r=>r.model==m&&r.arm==a);console.log(a,'итого',x.filter(r=>r.pass).length+'/'+x.length,'USD',x.reduce((s,r)=>s+r.cost,0).toFixed(3));}
}
const t=rows.reduce((s,r)=>s+r.cost,0); console.log('всего USD',t.toFixed(3),'ошибок',rows.filter(r=>r.err).length);
