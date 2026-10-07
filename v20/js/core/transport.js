import{TRANSPORT_NODE_BY_INDEX,isTransportNodeIndex,transportDestinations}from"../data/transport.js";
import{GROUP_ORDER,groupTileIndexes}from"../data/board.js";

const BRIDGE_EXIT_INDEXES=Object.freeze([10,13,32]);

export function transportDestinationPreview(state,startIndex,steps=6){
  const size=state.tiles?.length??44;
  const preview={
    unownedProperties:0,
    ownedProperties:0,
    chanceOrFate:0,
    otherSpecial:0
  };

  for(let offset=1;offset<=steps;offset++){
    const tile=state.tiles?.[(Number(startIndex)+offset)%size];
    if(!tile)continue;
    if(tile.type==="property"){
      if(tile.owner==null)preview.unownedProperties++;
      else preview.ownedProperties++;
      continue;
    }
    if(["chance","fate"].includes(tile.type)){
      preview.chanceOrFate++;
      continue;
    }
    if(tile.type!=="start")preview.otherSpecial++;
  }
  return preview;
}

function destinationScore(state,startIndex){
  const preview=transportDestinationPreview(state,startIndex);
  return(
    preview.unownedProperties*4+
    preview.chanceOrFate-
    preview.ownedProperties
  );
}

function groupEntryIndexes(){
  return GROUP_ORDER
    .map(group=>groupTileIndexes(group)[0])
    .filter(Number.isInteger);
}

function ownedGroupRepresentatives(state,player){
  return GROUP_ORDER
    .map(group=>{
      const indexes=groupTileIndexes(group).filter(index=>state.tiles?.[index]?.owner===player.seat);
      if(indexes.length===0)return null;
      return indexes
        .map(index=>({index,price:Number(state.tiles?.[index]?.price)||0,group}))
        .sort((a,b)=>b.price-a.price||a.index-b.index)[0];
    })
    .filter(Boolean);
}

export function createPendingTransport(state,player){
  const sourceIndex=Number(player?.position);
  if(!player||!isTransportNodeIndex(sourceIndex))return null;
  const source=TRANSPORT_NODE_BY_INDEX[sourceIndex];
  if(!source)return null;

  const round=Math.max(1,Number(state?.round)||1);
  const transportEffect=state?.strategicEffects?.transport??{};
  const blocked=(
    Number(transportEffect.blockedNodeIndex)===sourceIndex&&
    Number(transportEffect.blockedUntilRound)>=round
  );
  const freeDay=Number(transportEffect.freeUntilRound)>=round;
  const effectiveFee=freeDay?0:Math.max(0,Number(source.fee)||0);
  const freeDayBonus=freeDay?Math.max(0,Number(transportEffect.freeDayBonus)||0):0;

  if(blocked){
    return{
      seat:player.seat,
      sourceIndex,
      kind:"blocked",
      originalKind:source.id,
      fee:0,
      freeDayBonus:0,
      resolveLanding:false,
      destinationIndexes:[]
    };
  }

  if(source.id==="central_station"){
    return{
      seat:player.seat,
      sourceIndex,
      kind:"station",
      fee:effectiveFee,
      freeDayBonus,
      resolveLanding:false,
      destinationIndexes:transportDestinations(sourceIndex).map(node=>node.index)
    };
  }

  if(source.id==="international_airport"){
    return{
      seat:player.seat,
      sourceIndex,
      kind:"airport",
      fee:effectiveFee,
      freeDayBonus,
      resolveLanding:true,
      destinationIndexes:groupEntryIndexes()
    };
  }

  if(source.id==="international_port"){
    const options=ownedGroupRepresentatives(state,player);
    return{
      seat:player.seat,
      sourceIndex,
      kind:"port_logistics",
      fee:effectiveFee,
      freeDayBonus,
      resolveLanding:false,
      destinationIndexes:options.map(option=>option.index)
    };
  }

  return{
    seat:player.seat,
    sourceIndex,
    kind:"bridge",
    fee:effectiveFee,
    freeDayBonus,
    resolveLanding:false,
    destinationIndexes:BRIDGE_EXIT_INDEXES.filter(index=>index!==sourceIndex)
  };
}

export function canUseTransport(state,seat,destinationIndex){
  const pending=state.pendingTransport;
  const player=state.players?.[Number(seat)];
  if(!pending||state.phase!=="transport"||!player)return false;
  if(Number(seat)!==pending.seat||player.position!==pending.sourceIndex)return false;
  const destination=Number(destinationIndex);
  if(!pending.destinationIndexes.includes(destination))return false;
  if(player.cash<Math.max(0,Number(pending.fee)||0))return false;

  if(pending.kind==="port_logistics"){
    const tile=state.tiles?.[destination];
    return Boolean(tile?.type==="property"&&tile.owner===Number(seat));
  }
  if(pending.kind==="airport"){
    return state.tiles?.[destination]?.type==="property";
  }
  return isTransportNodeIndex(destination);
}

export function chooseAiTransportDestination(state,seat){
  const pending=state.pendingTransport;
  if(!pending||pending.seat!==Number(seat))return null;
  if(pending.destinationIndexes.length===0)return null;

  if(pending.kind==="port_logistics"){
    return pending.destinationIndexes
      .map(index=>({index,score:Number(state.tiles?.[index]?.price)||0}))
      .sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.index??null;
  }

  return pending.destinationIndexes
    .map(index=>({
      index,
      score:destinationScore(state,index)
    }))
    .sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.index??null;
}

export function transportNode(index){
  return TRANSPORT_NODE_BY_INDEX[Number(index)]??null;
}
