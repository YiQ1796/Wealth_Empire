import{V5_BADGES,V5_CHARACTERS,V5_HOUSES,V5_MODAL}from"./v5-embedded-assets.js";

const PLAYER_COLOR_KEYS=Object.freeze(["blue","red","green","purple"]);

export function playerColorKey(seat){
  return PLAYER_COLOR_KEYS[Number(seat)]??"blue";
}

export function characterAsset(seat,state="idle"){
  const character=V5_CHARACTERS[playerColorKey(seat)]??V5_CHARACTERS.blue;
  return character[state]??character.idle;
}

export function houseAsset(seat){
  return V5_HOUSES[playerColorKey(seat)]??V5_HOUSES.blue;
}

export function propertyHouseCount(tile){
  if(!tile||tile.type!=="property"||tile.owner==null)return 0;
  return Math.max(1,Math.min(3,1+(Number(tile.level)||0)));
}

export const REGION_BADGES=Object.freeze({
  "海港區":V5_BADGES.region_harbor,
  "商業區":V5_BADGES.region_commercial,
  "科技區":V5_BADGES.region_tech,
  "住宅區":V5_BADGES.region_residential,
  "金融區":V5_BADGES.region_financial,
  "觀光區":V5_BADGES.region_tourism,
  "豪宅區":V5_BADGES.region_luxury,
  "帝王區":V5_BADGES.region_imperial
});

export const UI_ASSETS=Object.freeze({
  actions:Object.freeze({
    roll:"./assets/ui/ACTION_ROLL.webp",
    endTurn:"./assets/ui/ACTION_END_TURN.webp"
  }),
  quick:Object.freeze({
    stock:V5_MODAL.stock_icon,
    property:V5_MODAL.property_icon,
    item:V5_MODAL.items_icon,
    info:V5_MODAL.info_icon
  }),
  modal:Object.freeze({
    stockHeader:V5_MODAL.stock_header,
    propertyHeader:V5_MODAL.property_header,
    itemHeader:V5_MODAL.items_header,
    infoHeader:V5_MODAL.info_header,
    close:V5_MODAL.close,
    emptyData:V5_MODAL.empty_data,
    emptyHoldings:V5_MODAL.empty_holdings
  }),
  badges:Object.freeze({
    ai:V5_BADGES.ai,
    player:V5_BADGES.player,
    thinking:V5_BADGES.thinking,
    autoFill:V5_BADGES.auto_fill,
    regionBonus25:V5_BADGES.region_bonus_25,
    propertyMax:V5_BADGES.property_max,
    noAcquisition:V5_BADGES.no_acquisition
  }),
  houses:V5_HOUSES,
  characters:V5_CHARACTERS
});
