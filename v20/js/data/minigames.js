export const MINIGAME_DEFINITIONS=Object.freeze([
  {
    id:"courier",
    name:"都會快遞戰",
    category:"反應",
    durationMs:26000,
    description:"判斷路況並快速切換正確行動，連續成功可累積 Combo。"
  },
  {
    id:"vault",
    name:"金庫解鎖",
    category:"精準",
    durationMs:24000,
    description:"在黃金區域通過時精準解鎖，連續五層會越來越困難。"
  },
  {
    id:"tower",
    name:"摩天樓疊樓戰",
    category:"空間",
    durationMs:30000,
    description:"精準堆疊樓層，偏移越大可用的平台越窄。"
  },
  {
    id:"memory",
    name:"商業記憶戰",
    category:"記憶",
    durationMs:30000,
    description:"記住商業圖示的順序與位置，依指定順序找回目標。"
  },
  {
    id:"route",
    name:"城市路線規劃",
    category:"邏輯",
    durationMs:35000,
    description:"在道路成本不同的城市網路中規劃最低成本有效路線。"
  },
  {
    id:"district",
    name:"商圈選址戰",
    category:"策略",
    durationMs:32000,
    description:"依人流、成本、交通與成長條件挑出最有價值的投資位置。"
  }
]);

export const MINIGAME_BY_ID=Object.freeze(
  Object.fromEntries(MINIGAME_DEFINITIONS.map(game=>[game.id,game]))
);
