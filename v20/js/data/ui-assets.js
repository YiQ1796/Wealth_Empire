const ROOT="./assets/v5";

const character=(color)=>Object.freeze({
  idle:ROOT+"/ui/characters/PLAYER_"+color+"_IDLE.webp",
  walkA:ROOT+"/ui/characters/PLAYER_"+color+"_WALK_A.webp",
  walkB:ROOT+"/ui/characters/PLAYER_"+color+"_WALK_B.webp",
  jump:ROOT+"/ui/characters/PLAYER_"+color+"_JUMP.webp"
});

export const UI_ASSETS=Object.freeze({
  quick:Object.freeze({
    stock:ROOT+"/ui/modal/MODAL_STOCK_ICON.webp",
    property:ROOT+"/ui/modal/MODAL_PROPERTY_ICON.webp",
    item:ROOT+"/ui/modal/MODAL_ITEMS_ICON.webp",
    info:ROOT+"/ui/modal/MODAL_INFO_ICON.webp"
  }),

  headers:Object.freeze({
    stock:ROOT+"/ui/modal/MODAL_STOCK_HEADER.webp",
    property:ROOT+"/ui/modal/MODAL_PROPERTY_HEADER.webp",
    item:ROOT+"/ui/modal/MODAL_ITEMS_HEADER.webp",
    info:ROOT+"/ui/modal/MODAL_INFO_HEADER.webp"
  }),

  modal:Object.freeze({
    close:ROOT+"/ui/modal/MODAL_CLOSE.webp",
    emptyData:ROOT+"/ui/modal/MODAL_EMPTY_DATA.webp",
    emptyHoldings:ROOT+"/ui/modal/MODAL_EMPTY_HOLDINGS.webp"
  }),

  actions:Object.freeze({
    roll:"./assets/ui/ACTION_ROLL.webp",
    endTurn:"./assets/ui/ACTION_END_TURN.webp"
  }),

  characters:Object.freeze([
    character("BLUE"),
    character("RED"),
    character("GREEN"),
    character("PURPLE")
  ]),

  houses:Object.freeze([
    ROOT+"/ui/houses/HOUSE_BLUE.webp",
    ROOT+"/ui/houses/HOUSE_RED.webp",
    ROOT+"/ui/houses/HOUSE_GREEN.webp",
    ROOT+"/ui/houses/HOUSE_PURPLE.webp"
  ]),

  badges:Object.freeze({
    ai:ROOT+"/ui/badges/BADGE_AI.webp",
    player:ROOT+"/ui/badges/BADGE_PLAYER.webp",
    thinking:ROOT+"/ui/badges/BADGE_THINKING.webp",
    autoFill:ROOT+"/ui/badges/ICON_AUTO_FILL.webp",
    propertyMax:ROOT+"/ui/badges/BADGE_PROPERTY_MAX.webp",
    noAcquisition:ROOT+"/ui/badges/BADGE_NO_ACQUISITION.webp",
    regionBonus:ROOT+"/ui/badges/BADGE_REGION_BONUS_25.webp",
    regions:Object.freeze({
      "海港區":ROOT+"/ui/badges/BADGE_REGION_HARBOR.webp",
      "商業區":ROOT+"/ui/badges/BADGE_REGION_COMMERCIAL.webp",
      "科技區":ROOT+"/ui/badges/BADGE_REGION_TECH.webp",
      "住宅區":ROOT+"/ui/badges/BADGE_REGION_RESIDENTIAL.webp",
      "金融區":ROOT+"/ui/badges/BADGE_REGION_FINANCIAL.webp",
      "觀光區":ROOT+"/ui/badges/BADGE_REGION_TOURISM.webp",
      "豪宅區":ROOT+"/ui/badges/BADGE_REGION_LUXURY.webp",
      "帝王區":ROOT+"/ui/badges/BADGE_REGION_IMPERIAL.webp"
    })
  }),

  notification:Object.freeze({
    cards:Object.freeze({
      majorDesktop:ROOT+"/notification/cards/NOTIFY_CARD_MAJOR_DESKTOP.webp",
      majorMobile:ROOT+"/notification/cards/NOTIFY_CARD_MAJOR_MOBILE.webp",
      standardDesktop:ROOT+"/notification/cards/NOTIFY_CARD_STANDARD_DESKTOP.webp",
      standardMobile:ROOT+"/notification/cards/NOTIFY_CARD_STANDARD_MOBILE.webp"
    }),
    market:Object.freeze({
      desktop:ROOT+"/notification/market/NOTIFY_MARKET_PULSE_DESKTOP.webp",
      mobile:ROOT+"/notification/market/NOTIFY_MARKET_PULSE_MOBILE.webp"
    }),
    icons:Object.freeze({
      acquisition:ROOT+"/notification/icons/NOTIFY_ICON_ACQUISITION.webp",
      bankruptcy:ROOT+"/notification/icons/NOTIFY_ICON_BANKRUPTCY.webp",
      marketTick:ROOT+"/notification/icons/NOTIFY_ICON_MARKET_TICK.webp",
      minigameResult:ROOT+"/notification/icons/NOTIFY_ICON_MINIGAME_RESULT.webp",
      propertyBuy:ROOT+"/notification/icons/NOTIFY_ICON_PROPERTY_BUY.webp",
      propertyUpgrade:ROOT+"/notification/icons/NOTIFY_ICON_PROPERTY_UPGRADE.webp",
      regionComplete:ROOT+"/notification/icons/NOTIFY_ICON_REGION_COMPLETE.webp",
      rent:ROOT+"/notification/icons/NOTIFY_ICON_RENT.webp",
      stockBuy:ROOT+"/notification/icons/NOTIFY_ICON_STOCK_BUY.webp",
      stockSell:ROOT+"/notification/icons/NOTIFY_ICON_STOCK_SELL.webp",
      aiTakeover:ROOT+"/notification/icons/NOTIFY_ICON_AI_TAKEOVER.webp",
      network:ROOT+"/notification/icons/NOTIFY_ICON_NETWORK.webp",
      victory:ROOT+"/notification/icons/NOTIFY_ICON_VICTORY.webp"
    }),
    effects:Object.freeze({
      edgeShine:ROOT+"/notification/effects/NOTIFY_FX_EDGE_SHINE.webp",
      gold:ROOT+"/notification/effects/NOTIFY_FX_GLOW_GOLD.webp",
      blue:ROOT+"/notification/effects/NOTIFY_FX_GLOW_BLUE.webp",
      green:ROOT+"/notification/effects/NOTIFY_FX_GLOW_GREEN.webp",
      purple:ROOT+"/notification/effects/NOTIFY_FX_GLOW_PURPLE.webp",
      red:ROOT+"/notification/effects/NOTIFY_FX_GLOW_RED.webp",
      sparkleGold:ROOT+"/notification/effects/NOTIFY_FX_SPARKLE_GOLD.webp"
    })
  })
});

// Temporary aliases for code paths that still ask for a single standing character.
// The old PAWN_*.webp render sources are no longer used.
export const IDLE_CHARACTER_ASSETS=Object.freeze(
  UI_ASSETS.characters.map(characterSet=>characterSet.idle)
);
