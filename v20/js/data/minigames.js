export const MINIGAME_DEFINITIONS=Object.freeze([
  {
    id:"courier",
    name:"幸運快遞",
    category:"運氣＋風險",
    durationMs:45000,
    description:"每輪選安全大道、快速道路或神秘捷徑；風險越高，可能拿到的分數越高。"
  },
  {
    id:"vault",
    name:"黃金金庫",
    category:"純運氣",
    durationMs:42000,
    description:"每輪從 6 個金庫中選 1 個；大獎、小獎與空箱位置每次都不同。"
  },
  {
    id:"tower",
    name:"幸運樓層",
    category:"猜骰",
    durationMs:42000,
    description:"先猜 1～6 樓，再擲骰；猜中最高分，差一格也有獎勵。"
  },
  {
    id:"memory",
    name:"命運翻牌",
    category:"抽卡",
    durationMs:42000,
    description:"每輪翻一張命運卡，共翻 3 張；有普通獎勵，也可能翻到大獎或空卡。"
  },
  {
    id:"route",
    name:"城市岔路",
    category:"運氣＋選擇",
    durationMs:46000,
    description:"連續 4 站選安全、均衡或冒險路線；每條路的報酬與風險不同。"
  },
  {
    id:"district",
    name:"商圈開盤",
    category:"運氣＋策略",
    durationMs:46000,
    description:"每輪選保守、均衡或高風險投資，再看隨機市場走勢決定報酬。"
  }
]);

export const MINIGAME_BY_ID=Object.freeze(
  Object.fromEntries(MINIGAME_DEFINITIONS.map(game=>[game.id,game]))
);
