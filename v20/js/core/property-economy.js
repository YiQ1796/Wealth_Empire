import{
  COMPLETE_GROUP_RENT_BONUS,
  GROUP_SIZES,
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
    ? 1+COMPLETE_GROUP_RENT_BONUS
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
