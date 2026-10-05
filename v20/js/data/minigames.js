export const MINIGAME_DEFINITIONS=Object.freeze([
  {
    id:"horse",
    name:"財富賽馬",
    category:"下注＋觀看",
    durationMs:50000,
    description:"下注 1 匹馬，觀看實際賽程、超車與最後衝刺。"
  },
  {
    id:"treasure",
    name:"黃金寶箱",
    category:"風險＋收手",
    durationMs:45000,
    description:"逐箱開獎；越開越可能賺更多，也可能踩到陷阱。隨時可以收手保住目前分數。"
  },
  {
    id:"rps",
    name:"財富猜拳",
    category:"對戰",
    durationMs:42000,
    description:"三戰兩勝對決，剪刀、石頭、布直接決勝。"
  },
  {
    id:"blackjack",
    name:"幸運 21 點",
    category:"牌局＋決策",
    durationMs:50000,
    description:"要牌或停牌，越接近 21 越好；超過 21 直接爆牌。"
  },
  {
    id:"plinko",
    name:"財富彈珠",
    category:"落點＋運氣",
    durationMs:42000,
    description:"選擇落點，觀看彈珠一路碰撞後落入不同倍率槽。"
  },
  {
    id:"auction",
    name:"搶錢拍賣",
    category:"暗標＋心理",
    durationMs:45000,
    description:"估計神秘商品價值並暗標；出價最高可能得標，但出太高也可能虧。"
  },
  {
    id:"snail",
    name:"瘋狂蝸牛賽跑",
    category:"下注＋突發事件",
    durationMs:52000,
    description:"下注 1 隻蝸牛；賽途中可能跌倒、坐火箭、分心、放屁衝鋒、踩油、撿寶或作弊偷跑。"
  }
]);

export const MINIGAME_BY_ID=Object.freeze(
  Object.fromEntries(MINIGAME_DEFINITIONS.map(game=>[game.id,game]))
);
