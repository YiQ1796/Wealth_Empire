import{
  canForceAcquireProperty,
  suggestedAcquisitionOffer,
  transferPropertyOwnership
}from"./property-economy.js?v=alpha32-233";

export function acquisitionOptions(state,buyerSeat){
  const buyer=state.players?.[Number(buyerSeat)];
  if(!buyer)return[];

  return state.tiles
    .map((tile,tileIndex)=>({tile,tileIndex}))
    .filter(({tile,tileIndex})=>canForceAcquireProperty(state,tileIndex,buyerSeat))
    .map(({tile,tileIndex})=>{
      const offer=suggestedAcquisitionOffer(tile);
      const owner=state.players?.[tile.owner];
      return{
        tileIndex,
        tileName:tile.name,
        group:tile.group,
        level:tile.level,
        ownerSeat:tile.owner,
        ownerName:owner?.name??"其他玩家",
        offer,
        affordable:buyer.cash>=offer
      };
    });
}

export function createPendingAcquisition(
  state,
  buyerSeat,
  sourceIndex,
  {tileIndexes=null,source="center"}={}
){
  const allowedIndexes=Array.isArray(tileIndexes)
    ? new Set(tileIndexes.map(index=>Number(index)).filter(Number.isInteger))
    : null;
  const options=acquisitionOptions(state,buyerSeat)
    .filter(option=>!allowedIndexes||allowedIndexes.has(option.tileIndex));
  return{
    seat:Number(buyerSeat),
    sourceIndex:Number(sourceIndex),
    source,
    options
  };
}

export function canAcquireFromCenter(state,buyerSeat,tileIndex){
  const pending=state.pendingAcquisition;
  const buyer=state.players?.[Number(buyerSeat)];
  if(!pending||state.phase!=="acquisition"||!buyer)return false;
  if(pending.seat!==Number(buyerSeat))return false;

  const option=pending.options?.find(entry=>entry.tileIndex===Number(tileIndex));
  if(!option||!option.affordable)return false;
  if(!canForceAcquireProperty(state,tileIndex,buyerSeat))return false;
  return buyer.cash>=option.offer;
}

export function executeAcquisition(state,buyerSeat,tileIndex){
  if(!canAcquireFromCenter(state,buyerSeat,tileIndex)){
    return{ok:false,reason:"invalid"};
  }

  const pending=state.pendingAcquisition;
  const option=pending.options.find(entry=>entry.tileIndex===Number(tileIndex));
  const buyer=state.players[Number(buyerSeat)];
  const seller=state.players[option.ownerSeat];

  buyer.cash-=option.offer;
  if(seller)seller.cash+=option.offer;

  const transfer=transferPropertyOwnership(state,tileIndex,buyerSeat);
  if(!transfer.ok){
    buyer.cash+=option.offer;
    if(seller)seller.cash-=option.offer;
    return{ok:false,reason:transfer.reason};
  }

  return{
    ok:true,
    tileIndex:Number(tileIndex),
    tileName:option.tileName,
    group:option.group,
    level:option.level,
    offer:option.offer,
    previousOwnerSeat:option.ownerSeat,
    previousOwnerName:option.ownerName,
    buyerSeat:Number(buyerSeat),
    buyerCashAfter:buyer.cash,
    sellerCashAfter:seller?.cash??null
  };
}

export function chooseAiAcquisition(state,buyerSeat){
  const buyer=state.players?.[Number(buyerSeat)];
  const pending=state.pendingAcquisition;
  const sourceOptions=pending?.seat===Number(buyerSeat)
    ? (pending.options??[])
    : acquisitionOptions(state,buyerSeat);
  const options=sourceOptions
    .filter(option=>
      option.affordable&&
      buyer?.cash>=option.offer&&
      canForceAcquireProperty(state,option.tileIndex,buyerSeat)
    );
  if(!buyer||options.length===0)return null;

  const ownedGroups=new Map();
  for(const tileIndex of buyer.properties??[]){
    const tile=state.tiles?.[tileIndex];
    if(!tile?.group)continue;
    ownedGroups.set(tile.group,(ownedGroups.get(tile.group)??0)+1);
  }

  return options
    .map(option=>({
      ...option,
      priority:(ownedGroups.get(option.group)??0)*100000-option.offer
    }))
    .sort((a,b)=>b.priority-a.priority||a.offer-b.offer)[0]?.tileIndex??null;
}
