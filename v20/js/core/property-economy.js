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

export function rentBreakdown(state,tile){
  if(!tile||tile.type!=="property"){
    return{
      baseRent:0,
      levelMultiplier:1,
      levelRent:0,
      permanentMultiplier:1,
      beforeGroupRent:0,
      groupMultiplier:1,
      groupBonus:0,
      finalRent:0,
      completeGroup:false
    };
  }

  const baseRent=Math.max(0,Math.round(Number(tile.rent)||0));
  const levelMultiplier=1+Math.max(0,tile.level||0)*PROPERTY_LEVEL_RENT_BONUS;
  const levelRent=Math.round(baseRent*levelMultiplier);
  const permanentMultiplier=1+Math.max(0,Math.min(0.2,Number(tile.permanentRentBoost)||0));
  const beforeGroupRent=Math.round(baseRent*levelMultiplier*permanentMultiplier);
  const completeGroup=Boolean(
    tile.owner!=null&&ownsCompleteGroup(state,tile.owner,tile.group)
  );
  const groupMultiplier=completeGroup
    ? (GROUP_RENT_MULTIPLIERS[tile.group]??1)
    : 1;
  const finalRent=Math.round(
    baseRent*levelMultiplier*permanentMultiplier*groupMultiplier
  );

  return{
    baseRent,
    levelMultiplier,
    levelRent,
    permanentMultiplier,
    beforeGroupRent,
    groupMultiplier,
    groupBonus:Math.max(0,finalRent-beforeGroupRent),
    finalRent,
    completeGroup
  };
}

export function rentFor(state,tile){
  return rentBreakdown(state,tile).finalRent;
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
  const round=Number(state?.round??1);
  const courtProtected=Boolean(owner&&Number(owner.courtShieldUntilRound)>=round);
  const titleProtected=Boolean(Number(tile?.acquisitionProtectedUntilRound)>=round);
  return Boolean(
    tile&&
    tile.type==="property"&&
    tile.owner!=null&&
    tile.owner!==buyerSeat&&
    tile.level<MAX_PROPERTY_LEVEL&&
    !courtProtected&&
    !titleProtected
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
