import{MAX_PROPERTY_LEVEL}from"../data/board.js";

export const MAX_DEVELOPMENT_PERMITS=3;
export const MAX_PROPERTY_PROTECTION_PERMITS=2;
export const PROPERTY_PROTECTION_ROUNDS=2;

function normalizedIndex(random,length){
  const value=Number(random?.());
  const normalized=Number.isFinite(value)?Math.max(0,Math.min(0.999999999,value)):0;
  return Math.floor(normalized*Math.max(1,length));
}

function noBlockingDecision(state){
  return(
    state.pendingPurchase==null&&
    state.pendingUpgrade==null&&
    state.pendingTransport==null&&
    state.pendingAcquisition==null&&
    state.pendingUrban==null&&
    state.phase!=="minigame"&&
    state.phase!=="finished"
  );
}

export function eligibleOwnedPropertyIndexes(state,playerOrSeat){
  const seat=typeof playerOrSeat==="object"?Number(playerOrSeat?.seat):Number(playerOrSeat);
  const player=typeof playerOrSeat==="object"?playerOrSeat:state.players?.[seat];
  return [...(player?.properties??[])]
    .filter(index=>{
      const tile=state.tiles?.[Number(index)];
      return Boolean(
        tile?.type==="property"&&
        tile.owner===seat&&
        Number(tile.level)<MAX_PROPERTY_LEVEL
      );
    })
    .sort((a,b)=>a-b);
}

export function eligibleProtectionPropertyIndexes(state,playerOrSeat){
  const seat=typeof playerOrSeat==="object"?Number(playerOrSeat?.seat):Number(playerOrSeat);
  const player=typeof playerOrSeat==="object"?playerOrSeat:state.players?.[seat];
  const round=Math.max(1,Number(state?.round)||1);
  return [...(player?.properties??[])]
    .filter(index=>{
      const tile=state.tiles?.[Number(index)];
      return Boolean(
        tile?.type==="property"&&
        tile.owner===seat&&
        Number(tile.level)<MAX_PROPERTY_LEVEL&&
        Math.max(0,Number(tile.acquisitionProtectedUntilRound)||0)<round
      );
    })
    .sort((a,b)=>a-b);
}

export function grantDevelopmentPermits(player,count=1){
  if(!player)return{added:0,total:0};
  const before=Math.max(0,Math.floor(Number(player.developmentPermits)||0));
  const requested=Math.max(0,Math.floor(Number(count)||0));
  const total=Math.min(MAX_DEVELOPMENT_PERMITS,before+requested);
  player.developmentPermits=total;
  return{added:total-before,total};
}

export function grantPropertyProtectionPermits(player,count=1){
  if(!player)return{added:0,total:0};
  const before=Math.max(0,Math.floor(Number(player.propertyProtectionPermits)||0));
  const requested=Math.max(0,Math.floor(Number(count)||0));
  const total=Math.min(MAX_PROPERTY_PROTECTION_PERMITS,before+requested);
  player.propertyProtectionPermits=total;
  return{added:total-before,total};
}

export function applyRandomPropertyUpgrade(state,player,random=Math.random){
  const eligible=eligibleOwnedPropertyIndexes(state,player);
  if(!eligible.length)return null;
  const tileIndex=eligible[normalizedIndex(random,eligible.length)]??eligible[0];
  const tile=state.tiles[tileIndex];
  tile.level=Math.min(MAX_PROPERTY_LEVEL,Number(tile.level||0)+1);
  return{
    tileIndex,
    tileName:tile.name,
    group:tile.group,
    level:tile.level
  };
}

export function canUseDevelopmentPermit(state,seat,tileIndex){
  const player=state.players?.[Number(seat)];
  const tile=state.tiles?.[Number(tileIndex)];
  if(!player||!tile)return false;
  return Boolean(
    state.gameStatus==="playing"&&
    state.currentPlayer===Number(seat)&&
    noBlockingDecision(state)&&
    ["await-roll","landed"].includes(state.phase)&&
    Math.floor(Number(player.developmentPermits)||0)>0&&
    tile.type==="property"&&
    tile.owner===Number(seat)&&
    Number(tile.level)<MAX_PROPERTY_LEVEL
  );
}

export function useDevelopmentPermit(state,seat,tileIndex){
  if(!canUseDevelopmentPermit(state,seat,tileIndex))return{ok:false,reason:"unavailable"};
  const player=state.players[Number(seat)];
  const tile=state.tiles[Number(tileIndex)];
  player.developmentPermits=Math.max(0,Math.floor(Number(player.developmentPermits)||0)-1);
  tile.level=Math.min(MAX_PROPERTY_LEVEL,Number(tile.level||0)+1);
  return{
    ok:true,
    seat:Number(seat),
    tileIndex:Number(tileIndex),
    tileName:tile.name,
    group:tile.group,
    level:tile.level,
    permitsLeft:player.developmentPermits
  };
}

export function canUsePropertyProtectionPermit(state,seat,tileIndex){
  const player=state.players?.[Number(seat)];
  const tile=state.tiles?.[Number(tileIndex)];
  const round=Math.max(1,Number(state?.round)||1);
  if(!player||!tile)return false;
  return Boolean(
    state.gameStatus==="playing"&&
    state.currentPlayer===Number(seat)&&
    noBlockingDecision(state)&&
    ["await-roll","landed"].includes(state.phase)&&
    Math.floor(Number(player.propertyProtectionPermits)||0)>0&&
    tile.type==="property"&&
    tile.owner===Number(seat)&&
    Number(tile.level)<MAX_PROPERTY_LEVEL&&
    Math.max(0,Number(tile.acquisitionProtectedUntilRound)||0)<round
  );
}

export function usePropertyProtectionPermit(state,seat,tileIndex){
  if(!canUsePropertyProtectionPermit(state,seat,tileIndex))return{ok:false,reason:"unavailable"};
  const player=state.players[Number(seat)];
  const tile=state.tiles[Number(tileIndex)];
  const round=Math.max(1,Number(state.round)||1);
  player.propertyProtectionPermits=Math.max(0,Math.floor(Number(player.propertyProtectionPermits)||0)-1);
  tile.acquisitionProtectedUntilRound=round+PROPERTY_PROTECTION_ROUNDS-1;
  return{
    ok:true,
    seat:Number(seat),
    tileIndex:Number(tileIndex),
    tileName:tile.name,
    group:tile.group,
    untilRound:tile.acquisitionProtectedUntilRound,
    permitsLeft:player.propertyProtectionPermits
  };
}
