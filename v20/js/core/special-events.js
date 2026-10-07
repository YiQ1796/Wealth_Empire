import{SPECIAL_EVENT_POOLS}from"../data/special-events.js?v=alpha32-233";
import{appendEventHistory,pickEventFromPool,RARE_EVENT_RATE}from"./event-picker.js";
import{applyRandomPropertyUpgrade,grantDevelopmentPermits,grantPropertyProtectionPermits}from"./property-events.js?v=alpha32-233";
import{grantItem,inventoryCount}from"./items.js?v=alpha32-233";
import{ITEM_BY_ID}from"../data/items.js";
import{resolveExtendedEventEffect}from"./world-events.js?v=alpha32-233";

function wrappedPosition(position,delta,size){
  return((position+delta)%size+size)%size;
}

function applyCash(player,amount){
  const requested=Math.round(Number(amount)||0);
  if(requested<0&&player.taxEventShield){
    player.taxEventShield=false;
    return{amount:0,cashAfter:player.cash,blockedBy:"tax"};
  }
  const actual=requested<0?-Math.min(player.cash,Math.abs(requested)):requested;
  player.cash=Math.max(0,player.cash+actual);
  return{amount:actual,cashAfter:player.cash};
}

export function resolveSpecialEvent(state,player,type,random=Math.random){
  const pool=SPECIAL_EVENT_POOLS[type];
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
    moved:false,
    from:player.position,
    to:player.position,
    delta:0,
    property:null,
    permitDelta:0,
    permitsTotal:Math.max(0,Math.floor(Number(player.developmentPermits)||0)),
    protectionPermitDelta:0,
    protectionPermitsTotal:Math.max(0,Math.floor(Number(player.propertyProtectionPermits)||0)),
    itemId:null,
    itemName:null,
    itemDelta:0,
    itemTotal:0
  };

  if(effect.kind==="cash"){
    result={...result,...applyCash(player,effect.amount)};
  }else if(effect.kind==="move"){
    const delta=Math.trunc(Number(effect.delta)||0);
    if(delta<0&&player.medicalMoveShield){
      player.medicalMoveShield=false;
      result={...result,delta:0,blockedBy:"hospital"};
    }else{
      const size=Math.max(1,state.tiles?.length??44);
      const from=player.position;
      const to=wrappedPosition(from,delta,size);
      player.position=to;
      result={...result,moved:from!==to,from,to,delta};
    }
  }else if(effect.kind==="grant_permit"){
    const granted=grantDevelopmentPermits(player,effect.count??1);
    result={
      ...result,
      permitDelta:granted.added,
      permitsTotal:granted.total
    };
    if(granted.added===0){
      const fallback=applyCash(player,800);
      result={...result,kind:"cash",...fallback,fallback:"permit_cap"};
    }
  }else if(effect.kind==="grant_property_protection"){
    const granted=grantPropertyProtectionPermits(player,effect.count??1);
    result={
      ...result,
      protectionPermitDelta:granted.added,
      protectionPermitsTotal:granted.total
    };
    if(granted.added===0){
      const fallback=applyCash(player,700);
      result={...result,kind:"cash",...fallback,fallback:"property_protection_cap"};
    }
  }else if(effect.kind==="grant_item"){
    const definition=ITEM_BY_ID[effect.itemId];
    const granted=grantItem(state,player.seat,effect.itemId,effect.count??1);
    result={
      ...result,
      itemId:effect.itemId,
      itemName:definition?.name??effect.itemId,
      itemDelta:granted.added??0,
      itemTotal:inventoryCount(player,effect.itemId)
    };
    if(!granted.ok){
      const fallback=applyCash(player,900);
      result={...result,kind:"cash",...fallback,fallback:"item_cap"};
    }
  }else if(effect.kind==="random_upgrade"){
    const upgraded=applyRandomPropertyUpgrade(state,player,random);
    if(upgraded){
      result={...result,property:upgraded};
    }else{
      const fallback=applyCash(player,effect.fallbackAmount??1500);
      result={...result,kind:"cash",...fallback,fallback:"no_upgradeable_property"};
    }
  }else{
    const extended=resolveExtendedEventEffect(state,player,effect,event,random);
    if(extended)result={...result,...extended,kind:extended.kind??effect.kind};
  }

  appendEventHistory(state,{type,event});
  return result;
}
