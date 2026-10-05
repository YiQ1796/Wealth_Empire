import{SPECIAL_EVENT_POOLS}from"../data/special-events.js";

const RECENT_SPECIAL_LIMIT=3;
const HISTORY_LIMIT=20;

function normalizedIndex(random,length){
  const value=Number(random?.());
  const normalized=Number.isFinite(value)?Math.max(0,Math.min(0.999999999,value)):0;
  return Math.floor(normalized*length);
}

function wrappedPosition(position,delta,size){
  return((position+delta)%size+size)%size;
}

export function resolveSpecialEvent(state,player,type,random=Math.random){
  const pool=SPECIAL_EVENT_POOLS[type];
  if(!pool?.length||!player)return null;

  const history=Array.isArray(state.specialEventHistory)?state.specialEventHistory:[];
  const recentIds=new Set(
    history
      .filter(entry=>entry?.type===type)
      .slice(-RECENT_SPECIAL_LIMIT)
      .map(entry=>entry.id)
  );
  const candidates=pool.filter(event=>!recentIds.has(event.id));
  const available=candidates.length?candidates:pool;
  const event=available[normalizedIndex(random,available.length)];
  const effect=event.effect??{kind:"none"};

  let result={type,event,kind:effect.kind,amount:0,moved:false,from:player.position,to:player.position,delta:0};

  if(effect.kind==="cash"){
    const requested=Math.round(Number(effect.amount)||0);
    const actual=requested<0?-Math.min(player.cash,Math.abs(requested)):requested;
    player.cash=Math.max(0,player.cash+actual);
    result={...result,amount:actual,cashAfter:player.cash};
  }else if(effect.kind==="move"){
    const delta=Math.trunc(Number(effect.delta)||0);
    const size=Math.max(1,state.tiles?.length??44);
    const from=player.position;
    const to=wrappedPosition(from,delta,size);
    player.position=to;
    result={...result,moved:from!==to,from,to,delta};
  }

  state.specialEventHistory=[
    ...history,
    {type,id:event.id,round:state.round??1}
  ].slice(-HISTORY_LIMIT);

  return result;
}
