import{
  TRANSPORT_ACTION_BY_ID,
  TRANSPORT_NODE_BY_INDEX,
  isTransportNodeIndex,
  transportActions,
  transportDestinations
}from"../data/transport.js";
import{transportWorldStatus}from"./world-events.js";

export function transportDestinationPreview(state,startIndex,steps=6){
  const size=state.tiles?.length??44;
  const preview={unownedProperties:0,ownedProperties:0,chanceOrFate:0,otherSpecial:0};
  for(let offset=1;offset<=steps;offset++){
    const tile=state.tiles?.[(Number(startIndex)+offset)%size];
    if(!tile)continue;
    if(tile.type==="property"){
      if(tile.owner==null)preview.unownedProperties++;
      else preview.ownedProperties++;
      continue;
    }
    if(["chance","fate"].includes(tile.type))preview.chanceOrFate++;
    else if(tile.type!=="start")preview.otherSpecial++;
  }
  return preview;
}

function nextIndexByType(state,startIndex,tileType){
  const size=Math.max(1,state.tiles?.length??44);
  for(let offset=1;offset<size;offset++){
    const index=(Number(startIndex)+offset)%size;
    if(state.tiles?.[index]?.type===tileType)return index;
  }
  return null;
}

export function transportActionOptions(state,sourceIndex){
  const source=Number(sourceIndex);
  const node=TRANSPORT_NODE_BY_INDEX[source];
  if(!node)return[];
  const status=transportWorldStatus(state);
  if(status?.mode==="strike")return[];
  const freeDay=status?.mode==="free_day";
  return transportActions(source).map(action=>{
    const destinationIndex=action.effect==="move_to_type"
      ? nextIndexByType(state,source,action.tileType)
      : action.destinationIndex??null;
    return{
      ...action,
      destinationIndex,
      cost:freeDay?0:Math.max(0,Number(action.cost)||0),
      originalCost:Math.max(0,Number(action.cost)||0),
      freeDay
    };
  }).filter(action=>action.effect!=="move_to_type"||action.destinationIndex!=null);
}

export function createPendingTransport(state,player){
  const sourceIndex=Number(player?.position);
  if(!player||!isTransportNodeIndex(sourceIndex))return null;
  const status=transportWorldStatus(state);
  return{
    seat:player.seat,
    sourceIndex,
    nodeId:TRANSPORT_NODE_BY_INDEX[sourceIndex]?.id??null,
    status:status?.mode??"normal",
    actions:transportActionOptions(state,sourceIndex)
  };
}

export function canUseTransportAction(state,seat,actionId){
  const pending=state.pendingTransport;
  const player=state.players?.[Number(seat)];
  if(!pending||state.phase!=="transport"||!player)return false;
  if(Number(seat)!==pending.seat||player.position!==pending.sourceIndex)return false;
  const action=(pending.actions??[]).find(item=>item.id===String(actionId));
  if(!action)return false;
  return player.cash>=Math.max(0,Number(action.cost)||0);
}

export function chooseAiTransportAction(state,seat){
  const pending=state.pendingTransport;
  const player=state.players?.[Number(seat)];
  if(!pending||pending.seat!==Number(seat)||!player)return null;
  return(pending.actions??[])
    .filter(action=>player.cash>=Math.max(0,Number(action.cost)||0))
    .map(action=>({
      action,
      score:(Number(action.aiValue)||0)-(Math.max(0,Number(action.cost)||0)/500)
    }))
    .sort((a,b)=>b.score-a.score)[0]?.action?.id??null;
}

// Compatibility helpers retained for older imports/tests.
export function canUseTransport(state,seat,destinationIndex){
  const pending=state.pendingTransport;
  return Boolean(
    pending&&
    (pending.actions??[]).some(action=>Number(action.destinationIndex)===Number(destinationIndex))&&
    canUseTransportAction(state,seat,(pending.actions??[]).find(action=>Number(action.destinationIndex)===Number(destinationIndex))?.id)
  );
}

export function chooseAiTransportDestination(state,seat){
  const actionId=chooseAiTransportAction(state,seat);
  const pending=state.pendingTransport;
  return pending?.actions?.find(action=>action.id===actionId)?.destinationIndex??null;
}

export function transportAction(actionId){
  return TRANSPORT_ACTION_BY_ID[String(actionId)]??null;
}

export function transportNode(index){
  return TRANSPORT_NODE_BY_INDEX[Number(index)]??null;
}

export{transportDestinations};
