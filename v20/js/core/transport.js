import{TRANSPORT_NODE_BY_INDEX,isTransportNodeIndex,transportDestinations}from"../data/transport.js";

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

export function createPendingTransport(state,player){
  const sourceIndex=Number(player?.position);
  if(!player||!isTransportNodeIndex(sourceIndex))return null;
  return{
    seat:player.seat,
    sourceIndex,
    destinationIndexes:transportDestinations(sourceIndex).map(node=>node.index)
  };
}

export function canUseTransport(state,seat,destinationIndex){
  const pending=state.pendingTransport;
  const player=state.players?.[Number(seat)];
  if(!pending||state.phase!=="transport"||!player)return false;
  if(Number(seat)!==pending.seat||player.position!==pending.sourceIndex)return false;
  const destination=Number(destinationIndex);
  return(
    destination!==pending.sourceIndex&&
    pending.destinationIndexes.includes(destination)&&
    isTransportNodeIndex(destination)
  );
}

export function chooseAiTransportDestination(state,seat){
  const pending=state.pendingTransport;
  if(!pending||pending.seat!==Number(seat))return null;
  const destinations=transportDestinations(pending.sourceIndex);
  if(destinations.length===0)return null;

  return destinations
    .map(node=>({
      index:node.index,
      score:destinationScore(state,node.index)
    }))
    .sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.index??null;
}

export function transportNode(index){
  return TRANSPORT_NODE_BY_INDEX[Number(index)]??null;
}
