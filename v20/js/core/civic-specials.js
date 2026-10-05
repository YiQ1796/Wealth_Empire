import{advanceStockMarket}from"./stock-market.js";

function nextPropertyOpportunityScore(state,startIndex,steps=6){
  const size=state.tiles?.length??44;
  let score=0;
  for(let offset=1;offset<=steps;offset++){
    const tile=state.tiles?.[(Number(startIndex)+offset)%size];
    if(!tile)continue;
    if(tile.type==="property"){
      score+=tile.owner==null?4:tile.owner===state.currentPlayer?1:-1;
    }else if(["chance","fate"].includes(tile.type)){
      score+=1;
    }
  }
  return score;
}

export function applyTaxOffice(state,player){
  player.taxEventShield=true;
  return{
    kind:"tax",
    title:"稅務局｜申報完成",
    text:"取得一次「稅務抵免」：下一次機會／命運造成的負面現金事件會被抵消。",
    seat:player.seat
  };
}

export function applyCourt(state,player){
  const untilRound=(Number(state.round)||1)+1;
  player.courtShieldUntilRound=Math.max(Number(player.courtShieldUntilRound)||0,untilRound);
  return{
    kind:"court",
    title:"法院｜財產保全",
    text:"取得暫時財產保全：本回合與下一 ROUND 內，名下非滿級地產也不會出現在收購中心清單。",
    seat:player.seat,
    untilRound
  };
}

export function applyHospital(state,player){
  player.medicalMoveShield=true;
  return{
    kind:"hospital",
    title:"醫療中心｜恢復完成",
    text:"取得一次「行動保護」：下一次機會／命運造成的後退移動會被抵消。",
    seat:player.seat
  };
}

export function applyMarketEvent(state,player){
  const market=advanceStockMarket(state,{
    round:state.round,
    nextSeat:state.currentPlayer
  });
  const movers=[...market.stocks]
    .sort((a,b)=>Math.abs(b.changePercent)-Math.abs(a.changePercent))
    .slice(0,3)
    .map(stock=>({name:stock.name,changePercent:stock.changePercent}));
  return{
    kind:"market",
    title:"股市事件｜盤中震盪",
    text:"股市事件立即觸發一次既有市場更新，所有股票依原本市場公式重新漲跌。",
    seat:player.seat,
    movers,
    tick:market.tick
  };
}

export function createPendingUrban(state,player){
  const indexes=[...(player?.properties??[])]
    .filter(index=>state.tiles?.[index]?.type==="property"&&state.tiles[index].owner===player.seat)
    .sort((a,b)=>a-b);
  if(!player||indexes.length===0)return null;
  return{
    seat:player.seat,
    sourceIndex:player.position,
    destinationIndexes:indexes
  };
}

export function canUseUrban(state,seat,destinationIndex){
  const pending=state.pendingUrban;
  const player=state.players?.[Number(seat)];
  const target=state.tiles?.[Number(destinationIndex)];
  return Boolean(
    pending&&
    state.phase==="urban"&&
    player&&
    pending.seat===Number(seat)&&
    pending.destinationIndexes.includes(Number(destinationIndex))&&
    target?.type==="property"&&
    target.owner===Number(seat)
  );
}

export function chooseAiUrbanDestination(state,seat){
  const pending=state.pendingUrban;
  if(!pending||pending.seat!==Number(seat))return null;
  return pending.destinationIndexes
    .map(index=>({index,score:nextPropertyOpportunityScore(state,index)}))
    .sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.index??null;
}
