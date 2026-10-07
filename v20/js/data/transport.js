export const TRANSPORT_NODE_INDEXES=Object.freeze([10,13,32,43]);

export const TRANSPORT_NODES=Object.freeze([
  {
    index:10,id:"central_station",name:"中央車站",mode:"都市鐵路",icon:"🚆",
    description:"城市快線：可直達下一個機會／命運格，或留在車站領通勤回饋。",
    actions:Object.freeze([
      Object.freeze({id:"station_chance_line",label:"機會快線",description:"前往下一個「機會」格並立即觸發事件。",effect:"move_to_type",tileType:"chance",cost:0,icon:"🎫",aiValue:8}),
      Object.freeze({id:"station_fate_line",label:"命運快線",description:"前往下一個「命運」格並立即觸發事件。",effect:"move_to_type",tileType:"fate",cost:0,icon:"🔮",aiValue:7}),
      Object.freeze({id:"station_commuter_bonus",label:"通勤回饋",description:"留在中央車站，直接取得 $500 通勤回饋。",effect:"cash",amount:500,cost:0,icon:"💳",aiValue:5})
    ])
  },
  {
    index:13,id:"international_airport",name:"國際機場",mode:"商務航空",icon:"✈️",
    description:"商務航班：支付機票後，可直接前往高價值功能格並立即觸發。",
    actions:Object.freeze([
      Object.freeze({id:"airport_acquisition",label:"飛往收購中心",description:"支付 $600，直達「收購中心」並觸發功能。",effect:"move_to_index",destinationIndex:17,cost:600,icon:"🏢",aiValue:9}),
      Object.freeze({id:"airport_auction",label:"飛往地產拍賣行",description:"支付 $600，直達「地產拍賣行」並觸發功能。",effect:"move_to_index",destinationIndex:33,cost:600,icon:"🔨",aiValue:8}),
      Object.freeze({id:"airport_urban",label:"飛往城市更新局",description:"支付 $600，直達「城市更新局」並觸發功能。",effect:"move_to_index",destinationIndex:34,cost:600,icon:"🏗️",aiValue:8})
    ])
  },
  {
    index:32,id:"international_port",name:"國際港口",mode:"國際海運",icon:"🚢",
    description:"港口貿易：可接出口訂單、操作航運行情，或進口建材取得建案許可。",
    actions:Object.freeze([
      Object.freeze({id:"port_export_order",label:"出口訂單",description:"完成港口出口訂單，立即取得 $900。",effect:"cash",amount:900,cost:0,icon:"📦",aiValue:8}),
      Object.freeze({id:"port_shipping_market",label:"航運利多",description:"國際貨運需求上升，「海港運輸」股價立即 +10%。",effect:"stock_move",stockId:"SHIP",percent:.10,cost:0,icon:"📈",aiValue:7}),
      Object.freeze({id:"port_material_import",label:"進口建材",description:"支付 $600，取得建案許可 ×1；許可已滿則改領 $500。",effect:"grant_permit",count:1,cost:600,icon:"🧱",aiValue:9})
    ])
  },
  {
    index:43,id:"cross_sea_bridge",name:"跨海大橋",mode:"快速道路",icon:"🌉",
    description:"跨海通行：可選擇 6 格／11 格高速捷徑，或留在橋上領工程回饋。",
    actions:Object.freeze([
      Object.freeze({id:"bridge_shortcut_6",label:"跨海捷徑｜前進 6 格",description:"沿快速道路前進 6 格，抵達後正常觸發格子。",effect:"move_forward",distance:6,cost:0,icon:"🛣️",aiValue:7}),
      Object.freeze({id:"bridge_shortcut_11",label:"跨海快線｜前進 11 格",description:"沿快速道路前進 11 格，抵達後正常觸發格子。",effect:"move_forward",distance:11,cost:0,icon:"⚡",aiValue:9}),
      Object.freeze({id:"bridge_rebate",label:"橋務回饋",description:"留在跨海大橋，取得 $500 工程通行回饋。",effect:"cash",amount:500,cost:0,icon:"🎁",aiValue:5})
    ])
  }
]);

export const TRANSPORT_NODE_BY_INDEX=Object.freeze(
  Object.fromEntries(TRANSPORT_NODES.map(node=>[node.index,node]))
);

export const TRANSPORT_ACTION_BY_ID=Object.freeze(
  Object.fromEntries(
    TRANSPORT_NODES.flatMap(node=>node.actions.map(action=>[
      action.id,
      Object.freeze({...action,sourceIndex:node.index,nodeId:node.id,nodeName:node.name})
    ]))
  )
);

export function isTransportNodeIndex(index){
  return TRANSPORT_NODE_INDEXES.includes(Number(index));
}

export function transportDestinations(sourceIndex){
  const source=Number(sourceIndex);
  return TRANSPORT_NODES.filter(node=>node.index!==source);
}

export function transportActions(sourceIndex){
  return TRANSPORT_NODE_BY_INDEX[Number(sourceIndex)]?.actions??[];
}
