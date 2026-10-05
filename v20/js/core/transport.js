import{TRANSPORT_NODE_BY_INDEX,isTransportNodeIndex,transportDestinations}from"../data/transport.js";

function countForwardOpportunities(state,startIndex,steps=6){
  const size=state.tiles?.length??44;
  let score=0;
  for(let offset=1;offset<=steps;offset++){
    const tile=state.tiles?.[(startIndex+offset)%size];
    if(!tile)continue;
    if(tile.type==="property"){
      if(tile.owner==null)score+=4;
      else score-=1;
    }else if(["chance","fate"].includes(tile.type)){
      score+=1;
    }
  }
  return score;
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
  if(!pending||state.phase!=="transport")return false;
  if(Number(seat)!==pending.seat)return false;
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
      score:countForwardOpportunities(state,node.index)
    }))
    .sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.index??null;
}

export function transportNode(index){
  return TRANSPORT_NODE_BY_INDEX[Number(index)]??null;
}
