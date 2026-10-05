import{
  GROUP_SIZES,
  GROUP_RENT_MULTIPLIERS,
  MAX_PROPERTY_LEVEL,
  PROPERTY_LEVEL_RENT_BONUS,
  PROPERTY_UPGRADE_COST_RATE
}from"../data/board.js";

export function propertyTilesForGroup(state,group){
  return state.tiles.filter(tile=>tile.type==="property"&&tile.group===group);
}

export function groupProgress(state,playerSeat,group){
  const groupTiles=propertyTilesForGroup(state,group);
  const owned=groupTiles.filter(tile=>tile.owner===playerSeat).length;
  const total=GROUP_SIZES[group]??groupTiles.length;
  return{owned,total,complete:total>0&&owned===total};
}

export function ownsCompleteGroup(state,playerSeat,group){
  return groupProgress(state,playerSeat,group).complete;
}

export function rentFor(state,tile){
  if(!tile||tile.type!=="property")return 0;
  const levelMultiplier=1+Math.max(0,tile.level||0)*PROPERTY_LEVEL_RENT_BONUS;
  const groupMultiplier=tile.owner!=null&&ownsCompleteGroup(state,tile.owner,tile.group)
    ? (GROUP_RENT_MULTIPLIERS[tile.group]??1)
    : 1;
  return Math.round(tile.rent*levelMultiplier*groupMultiplier);
}

export function upgradeCost(tile){
  if(!tile||tile.type!=="property")return 0;
  return Math.round(tile.price*PROPERTY_UPGRADE_COST_RATE);
}

export function canUpgradeProperty(playerSeat,tile){
  return Boolean(
    tile&&
    tile.type==="property"&&
    tile.owner===playerSeat&&
    tile.level<MAX_PROPERTY_LEVEL
  );
}

export function propertyValue(tile){
  if(!tile||tile.type!=="property")return 0;
  return tile.price+upgradeCost(tile)*Math.max(0,tile.level||0);
}

/*
  Acquisition remains a negotiated system. This helper is informational only:
  the previously approved suggested-offer example is 125% of current asset value.
*/
export function suggestedAcquisitionOffer(tile){
  if(!tile||tile.type!=="property")return 0;
  return Math.round(propertyValue(tile)*1.25);
}


export function canForceAcquireProperty(state,tileIndex,buyerSeat){
  const tile=state?.tiles?.[Number(tileIndex)];
  const owner=tile?.owner!=null?state?.players?.[tile.owner]:null;
  const courtProtected=Boolean(owner&&Number(owner.courtShieldUntilRound)>=Number(state?.round??1));
  return Boolean(
    tile&&
    tile.type==="property"&&
    tile.owner!=null&&
    tile.owner!==buyerSeat&&
    tile.level<MAX_PROPERTY_LEVEL&&
    !courtProtected
  );
}

export function transferPropertyOwnership(state,tileIndex,buyerSeat){
  if(!canForceAcquireProperty(state,tileIndex,buyerSeat)){
    return{ok:false,reason:"protected_or_invalid"};
  }

  const tile=state.tiles[Number(tileIndex)];
  const previousOwnerSeat=tile.owner;
  const previousOwner=state.players?.[previousOwnerSeat];
  const buyer=state.players?.[buyerSeat];
  if(!buyer)return{ok:false,reason:"buyer"};

  if(previousOwner){
    previousOwner.properties=previousOwner.properties.filter(index=>index!==Number(tileIndex));
  }
  if(!buyer.properties.includes(Number(tileIndex))){
    buyer.properties.push(Number(tileIndex));
  }
  tile.owner=buyerSeat;

  return{ok:true,previousOwnerSeat,buyerSeat,tileIndex:Number(tileIndex)};
}
