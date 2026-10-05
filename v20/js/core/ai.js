import{groupProgress,upgradeCost}from"./property-economy.js";
import{getHolding,getMarketStock}from"./stock-market.js";

const PROFILES=Object.freeze(["balanced","cautious","aggressive"]);

export function assignAiProfile(seat){
  return PROFILES[(Math.max(0,seat)-1)%PROFILES.length]??"balanced";
}

function reserveFor(player){
  const profile=player.aiProfile??"balanced";
  if(profile==="cautious")return 12000;
  if(profile==="aggressive")return 6500;
  return 9000;
}

export function shouldBuyProperty(state,seat,tile){
  const player=state.players[seat];
  if(!player||!tile||tile.type!=="property"||tile.owner!=null)return false;

  const reserve=reserveFor(player);
  const afterPurchase=player.cash-tile.price;
  if(afterPurchase<reserve)return false;

  const progress=groupProgress(state,seat,tile.group);
  let score=0.48;
  if(progress.owned===1)score+=0.18;
  if(progress.owned===2)score+=0.34;
  if(tile.price<player.cash*0.12)score+=0.12;
  if(player.aiProfile==="aggressive")score+=0.12;
  if(player.aiProfile==="cautious")score-=0.08;

  return score>=0.60;
}

export function chooseUpgrade(state,seat){
  const player=state.players[seat];
  if(!player)return null;
  const reserve=reserveFor(player);

  const candidates=player.properties
    .map(index=>({index,tile:state.tiles[index]}))
    .filter(({tile})=>tile&&tile.owner===seat&&tile.level<2)
    .map(entry=>{
      const progress=groupProgress(state,seat,entry.tile.group);
      const cost=upgradeCost(entry.tile);
      const score=
        (progress.complete?100:0)+
        entry.tile.level*25+
        entry.tile.rent/50-
        cost/500;
      return{...entry,cost,score};
    })
    .filter(entry=>player.cash-entry.cost>=reserve)
    .sort((a,b)=>b.score-a.score);

  return candidates[0]?.index??null;
}

export function chooseStockOrders(state,seat){
  const player=state.players[seat];
  if(!player||!state.market)return[];
  const reserve=reserveFor(player);
  const orders=[];

  const ranked=state.market.stocks.map(stock=>{
    const history=stock.history??[];
    const previous=history.length>=3?history[history.length-3]:stock.previousPrice;
    const momentum=(stock.price-previous)/Math.max(1,previous);
    const value=(stock.basePrice-stock.price)/Math.max(1,stock.basePrice);
    const holding=getHolding(player,stock.id);
    let score=momentum*0.8+value*0.55;
    if(player.aiProfile==="aggressive")score+=momentum*0.25;
    if(player.aiProfile==="cautious")score-=stock.volatility*0.45;
    return{stock,holding,score};
  });

  const sellCandidate=ranked
    .filter(item=>item.holding.shares>0&&(item.score<-0.025||item.stock.changePercent<-8))
    .sort((a,b)=>a.score-b.score)[0];

  if(sellCandidate){
    const shares=Math.max(1,Math.floor(sellCandidate.holding.shares*0.5));
    orders.push({type:"sell",stockId:sellCandidate.stock.id,shares});
  }

  const buyCandidate=ranked
    .filter(item=>item.score>0.02)
    .sort((a,b)=>b.score-a.score)[0];

  if(buyCandidate){
    const budget=Math.max(0,player.cash-reserve);
    const riskFraction=player.aiProfile==="aggressive"?0.28:player.aiProfile==="cautious"?0.12:0.20;
    const shares=Math.floor((budget*riskFraction)/buyCandidate.stock.price);
    if(shares>0)orders.push({type:"buy",stockId:buyCandidate.stock.id,shares});
  }

  return orders.slice(0,2);
}

export function aiDisplayName(seat){
  return"AI玩家"+(seat+1);
}
