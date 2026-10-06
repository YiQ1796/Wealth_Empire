export const RARE_EVENT_RATE=0.12;
export const EVENT_HISTORY_LIMIT=30;
export const RECENT_EVENT_LIMIT=3;

function normalizedRandom(random){
  const value=Number(random?.());
  return Number.isFinite(value)?Math.max(0,Math.min(0.999999999,value)):0;
}

export function pickEventFromPool(pool,history=[],type,random=Math.random,rareRate=RARE_EVENT_RATE){
  if(!Array.isArray(pool)||pool.length===0)return null;
  const recent=[...history]
    .filter(entry=>entry?.type===type)
    .slice(-RECENT_EVENT_LIMIT);
  const recentIds=new Set(recent.map(entry=>entry.id));
  const lastCategory=recent.at(-1)?.category??null;
  const wantsRare=normalizedRandom(random)<rareRate;

  const rarity=wantsRare?"rare":"common";
  let candidates=pool.filter(event=>(event.rarity??"common")===rarity&&!recentIds.has(event.id));
  if(!candidates.length)candidates=pool.filter(event=>(event.rarity??"common")===rarity);
  if(!candidates.length)candidates=pool.filter(event=>!recentIds.has(event.id));
  if(!candidates.length)candidates=[...pool];

  const categoryVariety=candidates.filter(event=>event.category!==lastCategory);
  if(categoryVariety.length)candidates=categoryVariety;

  const weights=candidates.map(event=>Math.max(0.01,Number(event.weight)||1));
  const totalWeight=weights.reduce((sum,weight)=>sum+weight,0);
  let cursor=normalizedRandom(random)*totalWeight;
  for(let index=0;index<candidates.length;index++){
    cursor-=weights[index];
    if(cursor<0)return candidates[index];
  }
  return candidates.at(-1)??candidates[0]??null;
}

export function appendEventHistory(state,{type,event}){
  const history=Array.isArray(state.specialEventHistory)?state.specialEventHistory:[];
  state.specialEventHistory=[
    ...history,
    {
      type,
      id:event.id,
      category:event.category??event.effect?.kind??"other",
      rarity:event.rarity??"common",
      round:Number(state.round)||1
    }
  ].slice(-EVENT_HISTORY_LIMIT);
}
