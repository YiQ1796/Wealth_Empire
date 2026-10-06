import{ITEM_BY_ID,ITEM_DEFINITIONS,ITEM_INVENTORY_LIMIT}from"../data/items.js";

const HISTORY_LIMIT=40;

function safeCount(value){
  return Math.max(0,Math.floor(Number(value)||0));
}

function boundedPrice(value){
  return Math.max(10,Math.min(9999,Math.round(Number(value)||10)));
}

function roundPercent(value){
  return Math.round(Number(value)*10)/10;
}

function ownPropertyTargets(state,seat,itemId){
  return (state.tiles??[])
    .map((tile,index)=>({tile,index}))
    .filter(({tile})=>{
      if(tile?.type!=="property"||tile.owner!==Number(seat))return false;
      if(itemId==="rent_boost")return Number(tile.permanentRentBoost||0)<0.2;
      if(itemId==="rent_burst")return safeCount(tile.rentBurstCharges)===0;
      if(itemId==="property_guard")return Number(tile.acquisitionProtectedUntilRound||0)<Number(state.round||1)+2;
      return true;
    })
    .map(({tile,index})=>({
      kind:"tile",
      value:index,
      label:tile.name+"｜LV."+safeCount(tile.level)
    }));
}

function opponentPropertyTargets(state,seat){
  return (state.tiles??[])
    .map((tile,index)=>({tile,index}))
    .filter(({tile})=>
      tile?.type==="property"&&
      tile.owner!=null&&
      tile.owner!==Number(seat)&&
      safeCount(tile.rentBlockedCharges)===0
    )
    .map(({tile,index})=>({
      kind:"tile",
      value:index,
      label:tile.name+"｜玩家 "+(Number(tile.owner)+1)
    }));
}

function stockTargets(state){
  return (state.market?.stocks??[]).map(stock=>({
    kind:"stock",
    value:stock.id,
    label:stock.name+"｜$"+Math.round(stock.price).toLocaleString()
  }));
}

function diceTargets(){
  return Array.from({length:11},(_,index)=>({
    kind:"value",
    value:index+2,
    label:"總點數 "+(index+2)
  }));
}

export function normalizeInventory(raw){
  const source=raw&&typeof raw==="object"?raw:{};
  const normalized={};
  let remaining=ITEM_INVENTORY_LIMIT;
  for(const definition of ITEM_DEFINITIONS){
    if(remaining<=0)break;
    const count=Math.min(definition.maxPerPlayer??2,safeCount(source[definition.id]),remaining);
    if(count>0){
      normalized[definition.id]=count;
      remaining-=count;
    }
  }
  return normalized;
}

export function totalInventoryCount(player){
  return Object.values(normalizeInventory(player?.inventory)).reduce((sum,count)=>sum+count,0);
}

export function inventoryCount(player,itemId){
  return safeCount(normalizeInventory(player?.inventory)[itemId]);
}

export function grantItem(state,seat,itemId,count=1){
  const player=state?.players?.[Number(seat)];
  const definition=ITEM_BY_ID[itemId];
  if(!player||!definition)return{ok:false,reason:"invalid_item",added:0,total:0};

  player.inventory=normalizeInventory(player.inventory);
  const current=inventoryCount(player,itemId);
  const itemRoom=Math.max(0,(definition.maxPerPlayer??2)-current);
  const totalRoom=Math.max(0,ITEM_INVENTORY_LIMIT-totalInventoryCount(player));
  const requested=Math.max(1,safeCount(count));
  const added=Math.min(requested,itemRoom,totalRoom);
  if(added<=0)return{ok:false,reason:itemRoom<=0?"item_cap":"inventory_cap",added:0,total:current};

  player.inventory[itemId]=current+added;
  return{ok:true,added,total:player.inventory[itemId],definition};
}

export function listValidTargets(state,seat,itemId){
  const definition=ITEM_BY_ID[itemId];
  if(!definition)return[];
  if(definition.targetType==="owned_property")return ownPropertyTargets(state,seat,itemId);
  if(definition.targetType==="opponent_property")return opponentPropertyTargets(state,seat);
  if(definition.targetType==="stock")return stockTargets(state);
  if(definition.targetType==="dice_total")return diceTargets();
  return[];
}

function normalizeTarget(target){
  if(target==null)return null;
  if(typeof target!=="object")return{value:target};
  if("tileIndex"in target)return{value:Number(target.tileIndex),kind:"tile"};
  if("stockId"in target)return{value:String(target.stockId),kind:"stock"};
  if("value"in target)return{value:target.value,kind:target.kind??null};
  return null;
}

export function getItemUseStatus(state,seat,itemId,target=null){
  const player=state?.players?.[Number(seat)];
  const definition=ITEM_BY_ID[itemId];
  if(!player||!definition)return{usable:false,reason:"無效道具",targets:[]};
  if(inventoryCount(player,itemId)<=0)return{usable:false,reason:"目前未持有",targets:[]};
  if(state.gameStatus!=="playing")return{usable:false,reason:"遊戲尚未開始",targets:[]};
  if(Number(state.currentPlayer)!==Number(seat))return{usable:false,reason:"等待自己的回合",targets:[]};
  if(!(definition.allowedPhases??[]).includes(state.phase)){
    return{usable:false,reason:"目前時機不可使用",targets:[]};
  }

  const targets=listValidTargets(state,seat,itemId);
  if(targets.length===0)return{usable:false,reason:"目前沒有合法目標",targets};

  if(target!=null){
    const normalized=normalizeTarget(target);
    const match=targets.some(option=>String(option.value)===String(normalized?.value));
    if(!match)return{usable:false,reason:"目標不合法",targets};
  }

  return{usable:true,reason:"可使用",targets};
}

export function canUseItem(state,seat,itemId,target=null){
  return getItemUseStatus(state,seat,itemId,target).usable;
}

function applyStockShock(state,stockId,percent){
  const stock=state.market?.stocks?.find(item=>item.id===String(stockId));
  if(!stock)return{ok:false,reason:"stock"};
  const previousPrice=boundedPrice(stock.price);
  const nextPrice=boundedPrice(previousPrice*(1+Number(percent||0)));
  stock.previousPrice=previousPrice;
  stock.price=nextPrice===previousPrice
    ? boundedPrice(previousPrice+(percent>=0?1:-1))
    : nextPrice;
  stock.changePercent=roundPercent(((stock.price-previousPrice)/Math.max(1,previousPrice))*100);
  stock.history=[...(stock.history??[]),stock.price].slice(-HISTORY_LIMIT);
  return{
    ok:true,
    stockId:stock.id,
    stockName:stock.name,
    previousPrice,
    price:stock.price,
    changePercent:stock.changePercent
  };
}

export function applyItemEffect(state,seat,itemId,target){
  const player=state?.players?.[Number(seat)];
  const normalized=normalizeTarget(target);
  if(!player)return{ok:false,reason:"player"};

  if(itemId==="rent_boost"){
    const tile=state.tiles?.[Number(normalized?.value)];
    if(!tile)return{ok:false,reason:"tile"};
    tile.permanentRentBoost=0.2;
    return{ok:true,tileIndex:Number(normalized.value),tileName:tile.name,permanentRentBoost:0.2};
  }

  if(itemId==="rent_burst"){
    const tile=state.tiles?.[Number(normalized?.value)];
    if(!tile)return{ok:false,reason:"tile"};
    tile.rentBurstCharges=1;
    return{ok:true,tileIndex:Number(normalized.value),tileName:tile.name,rentBurstCharges:1};
  }

  if(itemId==="remote_dice"){
    const total=Math.max(2,Math.min(12,Math.floor(Number(normalized?.value)||0)));
    player.forcedDiceTotal=total;
    return{ok:true,forcedDiceTotal:total};
  }

  if(itemId==="stock_boost"){
    return applyStockShock(state,normalized?.value,0.12);
  }

  if(itemId==="stock_drop"){
    return applyStockShock(state,normalized?.value,-0.09);
  }

  if(itemId==="rent_block"){
    const tile=state.tiles?.[Number(normalized?.value)];
    if(!tile)return{ok:false,reason:"tile"};
    tile.rentBlockedCharges=1;
    return{ok:true,tileIndex:Number(normalized.value),tileName:tile.name,rentBlockedCharges:1};
  }

  if(itemId==="property_guard"){
    const tile=state.tiles?.[Number(normalized?.value)];
    if(!tile)return{ok:false,reason:"tile"};
    const untilRound=(Number(state.round)||1)+2;
    tile.acquisitionProtectedUntilRound=Math.max(Number(tile.acquisitionProtectedUntilRound)||0,untilRound);
    return{ok:true,tileIndex:Number(normalized.value),tileName:tile.name,untilRound:tile.acquisitionProtectedUntilRound};
  }

  return{ok:false,reason:"unsupported"};
}

export function useItem(state,seat,itemId,target){
  const status=getItemUseStatus(state,seat,itemId,target);
  if(!status.usable)return{ok:false,reason:status.reason};

  const player=state.players[Number(seat)];
  const effect=applyItemEffect(state,seat,itemId,target);
  if(!effect.ok)return effect;

  player.inventory=normalizeInventory(player.inventory);
  const remaining=Math.max(0,inventoryCount(player,itemId)-1);
  if(remaining>0)player.inventory[itemId]=remaining;
  else delete player.inventory[itemId];

  return{
    ok:true,
    itemId,
    definition:ITEM_BY_ID[itemId],
    effect,
    remaining
  };
}

export function chooseAiItemAction(state,seat){
  const player=state?.players?.[Number(seat)];
  if(!player||player.kind!=="ai"||Number(state.currentPlayer)!==Number(seat))return null;

  const priorities=["rent_boost","property_guard","rent_block","stock_boost","remote_dice","rent_burst","stock_drop"];
  for(const itemId of priorities){
    if(inventoryCount(player,itemId)<=0)continue;
    const status=getItemUseStatus(state,seat,itemId);
    if(!status.usable||status.targets.length===0)continue;

    let target=status.targets[0];
    if(["rent_boost","rent_burst","property_guard"].includes(itemId)){
      target=[...status.targets].sort((a,b)=>{
        const tileA=state.tiles?.[Number(a.value)];
        const tileB=state.tiles?.[Number(b.value)];
        return Number(tileB?.price||0)-Number(tileA?.price||0);
      })[0];
    }else if(itemId==="rent_block"){
      target=[...status.targets].sort((a,b)=>{
        const tileA=state.tiles?.[Number(a.value)];
        const tileB=state.tiles?.[Number(b.value)];
        return Number(tileB?.rent||0)-Number(tileA?.rent||0);
      })[0];
    }else if(itemId==="stock_boost"){
      const held=(state.market?.stocks??[])
        .map(stock=>({stock,shares:safeCount(player.portfolio?.[stock.id]?.shares)}))
        .sort((a,b)=>b.shares-a.shares)[0];
      if(held?.shares>0){
        target=status.targets.find(option=>option.value===held.stock.id)??target;
      }
    }else if(itemId==="remote_dice"){
      target=status.targets.find(option=>Number(option.value)===12)??target;
    }

    return{itemId,target};
  }
  return null;
}
