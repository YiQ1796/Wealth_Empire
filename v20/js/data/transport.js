export const TRANSPORT_NODE_INDEXES=Object.freeze([10,13,32,43]);

export const TRANSPORT_NODES=Object.freeze([
  {
    index:10,
    id:"central_station",
    name:"中央車站",
    mode:"城市轉乘",
    icon:"🚆",
    fee:400,
    description:"低成本轉乘：可前往其他交通節點。"
  },
  {
    index:13,
    id:"international_airport",
    name:"國際機場",
    mode:"跨區航班",
    icon:"✈️",
    fee:1200,
    description:"高成本精準移動：點選棋盤上任意其他格子直達，亦可選八區快捷入口。"
  },
  {
    index:32,
    id:"international_port",
    name:"國際港口",
    mode:"商業物流",
    icon:"🚢",
    fee:800,
    description:"選擇自己已持有的一個區域，啟動接下來 2 次收租 +15% 的物流加成。"
  },
  {
    index:43,
    id:"cross_sea_bridge",
    name:"跨海大橋",
    mode:"快速通道",
    icon:"🌉",
    fee:0,
    description:"免費跨越棋盤：可前往三個主要交通出口，不觸發沿途格子。"
  }
]);

export const TRANSPORT_NODE_BY_INDEX=Object.freeze(
  Object.fromEntries(TRANSPORT_NODES.map(node=>[node.index,node]))
);

export function isTransportNodeIndex(index){
  return TRANSPORT_NODE_INDEXES.includes(Number(index));
}

export function transportDestinations(sourceIndex){
  const source=Number(sourceIndex);
  return TRANSPORT_NODES.filter(node=>node.index!==source);
}
