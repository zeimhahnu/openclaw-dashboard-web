// Mission Control — pure core, ported verbatim from the design prototype.
// World space, not screen space: the floor is ONE building with a shared aisle,
// so rooms, doors and the travelling parcel all live in the same coordinate system
// and are resolved by one global ground-depth sort.

export const GEOMETRY = Object.freeze({ roomW:194, roomH:184, pitchX:236, bankGap:88, pairPitch:544, doorX:98, doorW:36, spineX:-30 });
export function layoutAgents(entries) {
  const g=GEOMETRY;
  return entries.filter(a=>a.resident!==false).map((a,i)=>{
    const pair=Math.floor(i/6),bank=Math.floor((i%6)/3),col=i%3;
    const x=col*g.pitchX,y=pair*g.pairPitch+bank*(g.roomH+g.bankGap);
    return {station:'unknown',sprite:'placeholder',room:'Station',color:'#aeb8a7',floor:'#636653',wall:'#586860',trim:'#98a88f',...a,x,y,bank,aisleY:pair*g.pairPitch+g.roomH+g.bankGap/2,
      door:{x:x+g.doorX,y:y+(bank===0?g.roomH:0)},
      dock:{x:x+g.doorX,y:y+(bank===0?151:33)},
      readyBay:{x:x+139,y:y+(bank===0?141:27)},
      sentBay:{x:x+28,y:y+135}};
  });
}
export function project(x,y,z=0){return {x:(x-y)*.86,y:(x+y)*.43-z};}
export function unproject(x,y){return {x:(x/.86+y/.43)/2,y:(y/.43-x/.86)/2};}
export function routeBetween(from,to) {
  const pickup={x:from.readyBay.x+5,y:from.readyBay.y+5};
  const p=[pickup,{x:from.dock.x,y:pickup.y},from.dock,from.door,{x:from.door.x,y:from.aisleY}];
  if(from.aisleY!==to.aisleY)p.push({x:GEOMETRY.spineX,y:from.aisleY},{x:GEOMETRY.spineX,y:to.aisleY});
  p.push({x:to.door.x,y:to.aisleY},to.door,to.dock);
  return p.filter((v,i)=>!i||v.x!==p[i-1].x||v.y!==p[i-1].y);
}
export function alongRoute(route,progress) {
  const lens=route.slice(1).map((v,i)=>Math.hypot(v.x-route[i].x,v.y-route[i].y));
  let remaining=lens.reduce((a,b)=>a+b,0)*Math.max(0,Math.min(1,progress));
  for(let i=0;i<lens.length;i++){
    if(remaining<=lens[i]||i===lens.length-1){const u=lens[i]===0?0:remaining/lens[i];return {x:route[i].x+(route[i+1].x-route[i].x)*u,y:route[i].y+(route[i+1].y-route[i].y)*u};}remaining-=lens[i];
  }return route[0];
}
// Sort by world-ground support, never a sprite's top edge or bobbing height.
// Long walls are segmented; local overlap is resolved by explicit tie layers.
export function sortDrawables(items){return [...items].sort((a,b)=>(a.x+a.y)-(b.x+b.y)||(a.layer??0)-(b.layer??0)||a.id.localeCompare(b.id));}
export function counts(packages,agentId){const own=packages.filter(p=>p.from===agentId);return {completed:own.length,ready:own.filter(p=>p.status==='ready').length,transit:own.filter(p=>p.status==='transit').length,sent:own.filter(p=>p.status==='received').length};}
export function effectiveState(agent,now,staleAfterMs=45000){if(agent.observedAt==null||now-agent.observedAt>staleAfterMs)return 'offline';return agent.state;}
export function applyEvent(model,event){
  if(!event.id||!Number.isInteger(event.seq)||event.seq<=model.lastSeq||model.seen.includes(event.id))return model;
  if(event.seq!==model.lastSeq+1)return {...model,resyncRequired:true};
  const next=structuredClone(model);next.lastSeq=event.seq;next.seen.push(event.id);next.seen=next.seen.slice(-1000);
  if(event.type==='task.completed'){
    // One package per completed stage attempt, stable across replay.
    if(!next.packages.some(p=>p.id===event.package.id))next.packages.push({...event.package,status:'ready'});
  }else if(event.type==='handoff.departed'){
    const p=next.packages.find(p=>p.id===event.packageId);if(p?.status==='ready')p.status='transit';
  }else if(event.type==='handoff.received'){
    const p=next.packages.find(p=>p.id===event.packageId);if(p?.status==='transit')p.status='received';
  }else if(event.type==='handoff.failed'){
    const p=next.packages.find(p=>p.id===event.packageId);if(p?.status==='transit')p.status='ready';
  }else if(event.type==='agent.state'){
    const a=next.agents.find(a=>a.id===event.agentId);if(a){a.state=event.state;a.observedAt=event.observedAt;if(event.publicTitle!==undefined)a.publicTitle=event.publicTitle;}
  }
  return next;
}
export function packageSlots(count,origin,maxVisible=12){return Array.from({length:Math.min(count,maxVisible)},(_,i)=>({x:origin.x+(i%3)*14,y:origin.y+Math.floor(i/3)%2*13,z:Math.floor(i/6)*12}));}
export function avoidLabelCollisions(candidates,width,height){
  const placed=[];
  for(const c of [...candidates].sort((a,b)=>a.y-b.y)){
    const box={...c,x:Math.max(4,Math.min(width-c.w-4,c.x)),y:Math.max(5,c.y)};
    for(let tries=0;tries<12;tries++){
      const hit=placed.find(p=>box.x<p.x+p.w+5&&box.x+box.w+5>p.x&&box.y<p.y+p.h+5&&box.y+box.h+5>p.y);
      if(!hit)break;box.y=hit.y+hit.h+6;
    }
    box.y=Math.min(height-box.h-4,box.y);placed.push(box);
  }return placed;
}
