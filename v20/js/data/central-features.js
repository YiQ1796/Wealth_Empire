export const CENTRAL_FEATURES=Object.freeze([
  {
    id:"bank",
    name:"都會銀行",
    position:"center",
    building:"./assets/center-v1/CENTRAL_BANK.webp",
    description:"2 ROUND 定存；到期自動返還本金與測試版利息。"
  },
  {
    id:"mission",
    name:"城市委託中心",
    position:"top",
    building:"./assets/center-v1/CENTRAL_MISSION.webp",
    description:"接受一項城市委託，完成指定操作後取得獎勵。"
  },
  {
    id:"transit",
    name:"快捷通車",
    position:"right",
    building:"./assets/center-v1/CENTRAL_TRANSIT.webp",
    description:"本回合不用正常擲骰，改搭短／中／長距離快線。"
  },
  {
    id:"insurance",
    name:"租金保險中心",
    position:"left",
    building:"./assets/center-v1/CENTRAL_INSURANCE.webp",
    description:"啟動一次租金保護，降低下一次踩到他人地產的租金。"
  },
  {
    id:"development",
    name:"城市建案中心",
    position:"bottom",
    building:"./assets/center-v1/CENTRAL_DEVELOPMENT.webp",
    description:"使用既有升級價格與等級規則，直接執行一項持有地產建案。"
  }
]);

export const CENTRAL_FEATURE_BY_ID=Object.freeze(
  Object.fromEntries(CENTRAL_FEATURES.map(feature=>[feature.id,feature]))
);


export const CENTRAL_TEST_TUNING=Object.freeze({
  bankPrincipal:5000,
  bankRounds:2,
  bankReturn:5500,
  insuranceRentMultiplier:0.5,
  missionReward:900,
  transitDistances:Object.freeze([3,6,9])
});

export const CENTRAL_MISSIONS=Object.freeze([
  {id:"buy_property",name:"城市置產",description:"購買 1 塊無主地產。",target:1},
  {id:"upgrade_property",name:"建物改善",description:"完成 1 次地產升級。",target:1},
  {id:"buy_stock",name:"資本市場",description:"完成 1 次股票買進。",target:1}
]);

export const CENTRAL_MISSION_BY_ID=Object.freeze(
  Object.fromEntries(CENTRAL_MISSIONS.map(mission=>[mission.id,mission]))
);
