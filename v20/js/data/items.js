export const ITEM_INVENTORY_LIMIT=6;

export const ITEM_DEFINITIONS=Object.freeze([
  Object.freeze({
    id:"rent_boost",
    name:"地租增幅卡",
    description:"指定自己一塊地產，永久提高 20% 過路費；同一地產最多套用 1 次。",
    rarity:"rare",
    category:"property_buff",
    targetType:"owned_property",
    allowedPhases:Object.freeze(["await-roll","landed"]),
    maxPerPlayer:1
  }),
  Object.freeze({
    id:"rent_burst",
    name:"過路費爆發卡",
    description:"指定自己一塊地產；下一位對手踩中時，本次過路費 ×2，觸發後消耗效果。",
    rarity:"common",
    category:"property_buff",
    targetType:"owned_property",
    allowedPhases:Object.freeze(["await-roll","landed"]),
    maxPerPlayer:2
  }),
  Object.freeze({
    id:"remote_dice",
    name:"遙控骰子",
    description:"擲骰前指定本回合骰子總點數 2–12；進入其他決策流程後不可使用。",
    rarity:"rare",
    category:"movement",
    targetType:"dice_total",
    allowedPhases:Object.freeze(["await-roll"]),
    maxPerPlayer:2
  }),
  Object.freeze({
    id:"stock_boost",
    name:"股票拉升卡",
    description:"指定一檔股票，立即上漲 12%；所有玩家共用同一個市場價格。",
    rarity:"common",
    category:"market",
    targetType:"stock",
    allowedPhases:Object.freeze(["await-roll","landed"]),
    maxPerPlayer:2
  }),
  Object.freeze({
    id:"stock_drop",
    name:"股票打壓卡",
    description:"指定一檔股票，立即下跌 9%；也可能傷到自己的持股。",
    rarity:"common",
    category:"market_attack",
    targetType:"stock",
    allowedPhases:Object.freeze(["await-roll","landed"]),
    maxPerPlayer:2
  }),
  Object.freeze({
    id:"rent_block",
    name:"租金封鎖卡",
    description:"指定對手一塊地產；下一位踩中時，本次不收租，之後解除。",
    rarity:"rare",
    category:"property_attack",
    targetType:"opponent_property",
    allowedPhases:Object.freeze(["await-roll","landed"]),
    maxPerPlayer:2
  }),
  Object.freeze({
    id:"property_guard",
    name:"產權保全卡",
    description:"指定自己一塊地產，保護 2 ROUND 不被強制收購。",
    rarity:"common",
    category:"property_defense",
    targetType:"owned_property",
    allowedPhases:Object.freeze(["await-roll","landed"]),
    maxPerPlayer:2
  })
]);

export const ITEM_BY_ID=Object.freeze(
  Object.fromEntries(ITEM_DEFINITIONS.map(item=>[item.id,item]))
);
