export const TRANSPORT_NODE_INDEXES=Object.freeze([10,13,32,43]);

export const TRANSPORT_NODES=Object.freeze([
  {index:10,id:"central_station",name:"中央車站",mode:"鐵路",icon:"🚆"},
  {index:13,id:"international_airport",name:"國際機場",mode:"航空",icon:"✈️"},
  {index:32,id:"international_port",name:"國際港口",mode:"海運",icon:"🚢"},
  {index:43,id:"cross_sea_bridge",name:"跨海大橋",mode:"快速道路",icon:"🌉"}
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
