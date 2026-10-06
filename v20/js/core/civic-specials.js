import{advanceStockMarket}from"./stock-market.js";
import{CIVIC_EVENT_POOLS}from"../data/civic-events.js";
import{appendEventHistory,pickEventFromPool,RARE_EVENT_RATE}from"./event-picker.js";
import{applyRandomPropertyUpgrade,grantDevelopmentPermits}from"./property-events.js";

function nextPropertyOpportunityScore(state,startIndex,steps=6){
  const size=state.tiles?.length??44;
  let score=0;
  for(let offset=1;offset<=steps;offset++){
    const tile=state.tiles?.[(Number(startIndex)+offset)%size];
    if(!tile)continue;
    if(tile.type==="property"){
      score+=tile.owner==null?4:tile.owner===state.currentPlayer?1:-1;
    }else if(["chance","fate"].includes(tile.type)){
      score+=1;
    }
  }
  return score;
}

function applyCash(player,amount){
  const requested=Math.round(Number(amount)||0);
  const actual=requested<0?-Math.min(player.cash,Math.abs(requested)):requested;
  player.cash=Math.max(0,player.cash+actual);
  return{amount:actual,cashAfter:player.cash};
}

export function resolveCivicEvent(state,player,type,random=Math.random){
  const pool=CIVIC_EVENT_POOLS[type];
  if(!pool?.length||!player)return null;
  const history=Array.isArray(state.specialEventHistory)?state.specialEventHistory:[];
  const event=pickEventFromPool(pool,history,type,random,RARE_EVENT_RATE);
  if(!event)return null;
  const effect=event.effect??{kind:"none"};
  let result={
    type,
    event,
    rarity:event.rarity??"common",
    kind:effect.kind,
    amount:0,
    property:null,
    permitDelta:0,
    permitsTotal:Math.max(0,Math.floor(Number(player.developmentPermits)||0)),
    tick:null,
    movers:[]
  };

  if(effect.kind==="cash"){
    result={...result,...applyCash(player,effect.amount)};
  }else if(effect.kind==="tax_shield"){
    player.taxEventShield=true;
  }else if(effect.kind==="medical_shield"){
    player.medicalMoveShield=true;
  }else if(effect.kind==="dual_shield"){
    player.taxEventShield=true;
    player.medicalMoveShield=true;
  }else if(effect.kind==="court_shield"){
    const untilRound=(Number(state.round)||1)+Math.max(1,Number(effect.rounds)||1);
    player.courtShieldUntilRound=Math.max(Number(player.courtShieldUntilRound)||0,untilRound);
    result={...result,untilRound};
  }else if(effect.kind==="grant_permit"){
    const granted=grantDevelopmentPermits(player,effect.count??1);
    result={...result,permitDelta:granted.added,permitsTotal:granted.total};
    if(granted.added===0){
      result={...result,kind:"cash",...applyCash(player,700),fallback:"permit_cap"};
    }
  }else if(effect.kind==="random_upgrade"){
    const upgraded=applyRandomPropertyUpgrade(state,player,random);
    if(upgraded){
      result={...result,property:upgraded};
    }else{
      result={...result,kind:"cash",...applyCash(player,effect.fallbackAmount??1400),fallback:"no_upgradeable_property"};
    }
  }else if(effect.kind==="market_tick"){
    let latest=null;
    const count=Math.max(1,Math.min(3,Math.floor(Number(effect.count)||1)));
    for(let index=0;index<count;index++){
      latest=advanceStockMarket(state,{round:state.round,nextSeat:state.currentPlayer});
    }
    const movers=[...(latest?.stocks??state.market?.stocks??[])]
      .sort((a,b)=>Math.abs(b.changePercent)-Math.abs(a.changePercent))
      .slice(0,3)
      .map(stock=>({name:stock.name,changePercent:stock.changePercent}));
    result={...result,tick:latest?.tick??state.market?.tick??null,movers,marketTicks:count};
  }

  appendEventHistory(state,{type,event});
  return result;
}

// Compatibility wrappers retained for older tests/imports.
export function applyTaxOffice(state,player,random=Math.random){return resolveCivicEvent(state,player,"tax",random)}
export function applyCourt(state,player,random=Math.random){return resolveCivicEvent(state,player,"court",random)}
export function applyHospital(state,player,random=Math.random){return resolveCivicEvent(state,player,"hospital",random)}
export function applyMarketEvent(state,player,random=Math.random){return resolveCivicEvent(state,player,"market",random)}

export function createPendingUrban(state,player){
  const indexes=[...(player?.properties??[])]
    .filter(index=>state.tiles?.[index]?.type==="property"&&state.tiles[index].owner===player.seat)
    .sort((a,b)=>a-b);
  if(!player||indexes.length===0)return null;
  return{
    seat:player.seat,
    sourceIndex:player.position,
    destinationIndexes:indexes
  };
}

export function canUseUrban(state,seat,destinationIndex){
  const pending=state.pendingUrban;
  const player=state.players?.[Number(seat)];
  const target=state.tiles?.[Number(destinationIndex)];
  return Boolean(
    pending&&
    state.phase==="urban"&&
    player&&
    pending.seat===Number(seat)&&
    pending.destinationIndexes.includes(Number(destinationIndex))&&
    target?.type==="property"&&
    target.owner===Number(seat)
  );
}

export function chooseAiUrbanDestination(state,seat){
  const pending=state.pendingUrban;
  if(!pending||pending.seat!==Number(seat))return null;
  return pending.destinationIndexes
    .map(index=>({index,score:nextPropertyOpportunityScore(state,index)}))
    .sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.index??null;
}
