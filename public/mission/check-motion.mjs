// Browser check: motion must match state.
//
//   npx http-server public -p 8099   (or: cd public && python -m http.server 8099)
//   node public/mission/check-motion.mjs
//
// The load-bearing rule this guards: a blocked, asleep or offline room must NEVER
// animate. If a stuck agent keeps hammering, the floor tells the viewer it is
// working -- and the floor is a far bigger visual surface than the Now table, so
// it wins. The unit tests assert the frame maths; only a real canvas proves the
// pixels.
import { chromium } from 'playwright';
const now=new Date(), iso=s=>new Date(now.getTime()-s*1000).toISOString();
const row=(o={})=>({queue_depth:0,inbox_count:0,local:false,current_task:null,current_stage:null,
  session_active:false,health:'green',completed_today:0,cost:null,last_seen:iso(5),...o});
const state={ts:now.toISOString(),schema:'v2',agents:{
  goop:row({session_active:true,current_task:'Hammering',current_stage:'executing'}),
  iris:row({session_active:true,current_task:'Reviewing',current_stage:'critique'}),
  'vortex-reviewer':row({health:'red',current_task:'Criteria ambiguous',current_stage:'blocked'}),
  'vortex-analyst':row({}), 'lil-claw':row({session_active:true,current_task:'Routing',current_stage:'dispatch'}),
  pip:row({last_seen:iso(9000)}), mason:row({local:true}),
}};
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1400,height:1100}});
await p.route('**/state',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(state)}));
await p.goto('http://127.0.0.1:8099/mission/index.html',{waitUntil:'networkidle'});
await p.waitForTimeout(800);
const sample=()=>p.evaluate(()=>{
  const c=document.querySelector('canvas'), ctx=c.getContext('2d');
  const dpr=c.width/parseFloat(c.style.width);
  return [...document.querySelectorAll('.room-name')].map(el=>{
    const x=parseFloat(el.style.left), y=parseFloat(el.style.top);
    const d=ctx.getImageData((x-90)*dpr,(y-150)*dpr,180*dpr,140*dpr).data;
    let h=0; for(let i=0;i<d.length;i+=4) h=(h*31+d[i]+d[i+1]*3+d[i+2]*7)|0;
    return {name:el.textContent.replace('STUCK',''), h};
  });
});
// Slowest working loop is 520ms; fastest idle is 1700ms. Sampling at 0 / +650 /
// +3200 makes every assertion deterministic instead of racing a frame boundary.
const t0=await sample(); await p.waitForTimeout(650); const t1=await sample();
await p.waitForTimeout(2550); const t2=await sample();
const want={Goop:'working',Iris:'working',Rook:'blocked',Vera:'idle','Lil Claw':'working',Pip:'offline'};
let fail=0;
for(let i=0;i<t0.length;i++){
  const n=t0[i].name, st=want[n];
  const short=t0[i].h!==t1[i].h, long=t0[i].h!==t2[i].h||t1[i].h!==t2[i].h;
  let ok, note;
  // Only claims that do not race a frame boundary are asserted. "idle holds at
  // 650ms" is NOT one: a 650ms window straddles a 2000ms boundary ~33% of the
  // time. The provable claims are that working advances fast, idle advances
  // eventually, and a stopped state never advances at all.
  if(st==='working'){ ok=short; note='advances within 650ms (slowest work loop is 520ms)'; }
  else if(st==='idle'){ ok=long; note='breathes within 3.2s (slowest idle loop is 2100ms)'; }
  else { ok=!short&&!long; note='NEVER moves - stopped work must not look like working'; }
  if(!ok) fail++;
  console.log(`${n.padEnd(9)} ${st.padEnd(8)} 650ms:${short?'moved':'held '} 3.2s:${long?'moved':'held '}  ${ok?'OK  ':'FAIL'}  ${note}`);
}
console.log(fail?`\n${fail} MISMATCH`:'\nMotion matches state in all six rooms.');
await b.close();
process.exit(fail?1:0);
