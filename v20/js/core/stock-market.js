import{STOCK_DEFINITIONS,STOCK_BY_ID}from"../data/stocks.js";

const MIN_PRICE=10;
const MAX_PRICE=9999;
const HISTORY_LIMIT=40;

function hashString(value){
  let hash=2166136261;
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

function mulberry32(seed){
  return function(){
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return((t^t>>>14)>>>0)/4294967296;
  };
}

function roundPrice(value){
  return Math.max(MIN_PRICE,Math.min(MAX_PRICE,Math.round(value)));
}

function roundPercent(value){
  return Math.round(value*10)/10;
}

export function createInitialMarket(){
  return{
    round:1,
    tick:0,
    lastSeat:0,
    seed:20261005,
    stocks:STOCK_DEFINITIONS.map(stock=>({
      ...stock,
      price:stock.basePrice,
      previousPrice:stock.basePrice,
      changePercent:0,
      history:[stock.basePrice]
    }))
  };
}

export function getMarketStock(state,stockId){
  return state.market?.stocks?.find(stock=>stock.id===stockId)??null;
}

export function ensurePortfolio(player){
  if(!player.portfolio)player.portfolio={};
  return player.portfolio;
}

export function getHolding(player,stockId){
  const portfolio=ensurePortfolio(player);
  if(!portfolio[stockId]){
    portfolio[stockId]={shares:0,avgCost:0,realizedPnl:0};
  }
  return portfolio[stockId];
}

export function advanceStockMarket(state,context={}){
  if(!state.market)state.market=createInitialMarket();

  const options=typeof context==="number"?{round:context}:context;
  const round=Math.max(1,Number(options.round)||Number(state.round)||state.market.round||1);
  const nextSeat=Number.isInteger(options.nextSeat)?options.nextSeat:Number(state.currentPlayer)||0;
  const tick=Math.max(1,(Number(state.market.tick)||0)+1);

  const macroRandom=mulberry32(hashString(
    "macro:"+state.market.seed+":"+tick+":"+round+":"+nextSeat
  ));
  const macro=(macroRandom()-0.5)*0.055;

  for(const stock of state.market.stocks){
    const random=mulberry32(hashString(
      stock.id+":"+state.market.seed+":"+tick+":"+round+":"+nextSeat
    ));
    const noise=(random()-0.5)*2*stock.volatility;
    const reversion=((stock.basePrice-stock.price)/Math.max(1,stock.basePrice))*0.11;
    const momentum=(stock.changePercent/100)*0.16;
    let move=macro+noise+reversion+momentum;

    if(Math.abs(move)<0.006){
      move=(random()>0.5?1:-1)*(0.006+random()*0.006);
    }
    move=Math.max(-0.18,Math.min(0.18,move));

    const previousPrice=stock.price;
    const nextPrice=roundPrice(previousPrice*(1+move));
    stock.previousPrice=previousPrice;
    if(nextPrice===previousPrice){
      let direction=move>0?1:-1;
      if(previousPrice<=MIN_PRICE&&direction<0)direction=1;
      if(previousPrice>=MAX_PRICE&&direction>0)direction=-1;
      stock.price=roundPrice(previousPrice+direction);
    }else{
      stock.price=nextPrice;
    }
    stock.changePercent=roundPercent(((stock.price-previousPrice)/previousPrice)*100);
    stock.history=[...(stock.history??[]),stock.price].slice(-HISTORY_LIMIT);
  }

  state.market.round=round;
  state.market.tick=tick;
  state.market.lastSeat=nextSeat;
  return state.market;
}

export function canTradeStock(state,seat){
  const player=state.players?.[seat];
  return Boolean(
    player&&
    !player.bankrupt&&
    state.gameStatus==="playing"&&
    state.phase!=="minigame"&&
    state.phase!=="finished"
  );
}

export function buyStock(state,seat,stockId,shares){
  const player=state.players?.[seat];
  const stock=getMarketStock(state,stockId);
  const quantity=Math.floor(Number(shares));
  if(!player||!stock||!Number.isFinite(quantity)||quantity<=0)return{ok:false,reason:"invalid"};
  if(!canTradeStock(state,seat))return{ok:false,reason:"trade_locked"};

  const total=stock.price*quantity;
  if(player.cash<total)return{ok:false,reason:"cash"};

  const holding=getHolding(player,stockId);
  const previousCost=holding.avgCost*holding.shares;
  player.cash-=total;
  holding.shares+=quantity;
  holding.avgCost=holding.shares>0
    ? Math.round(((previousCost+total)/holding.shares)*100)/100
    : 0;

  return{ok:true,total,quantity,price:stock.price,holding};
}

export function sellStock(state,seat,stockId,shares){
  const player=state.players?.[seat];
  const stock=getMarketStock(state,stockId);
  const quantity=Math.floor(Number(shares));
  if(!player||!stock||!Number.isFinite(quantity)||quantity<=0)return{ok:false,reason:"invalid"};
  if(!canTradeStock(state,seat))return{ok:false,reason:"trade_locked"};

  const holding=getHolding(player,stockId);
  if(holding.shares<quantity)return{ok:false,reason:"shares"};

  const total=stock.price*quantity;
  const realized=(stock.price-holding.avgCost)*quantity;
  player.cash+=total;
  holding.shares-=quantity;
  holding.realizedPnl=Math.round((holding.realizedPnl+realized)*100)/100;
  if(holding.shares===0)holding.avgCost=0;

  return{ok:true,total,quantity,price:stock.price,realized,holding};
}

export function stockPosition(player,marketStock){
  const holding=getHolding(player,marketStock.id);
  const marketValue=holding.shares*marketStock.price;
  const cost=holding.shares*holding.avgCost;
  const unrealized=marketValue-cost;
  return{
    shares:holding.shares,
    avgCost:holding.avgCost,
    marketValue,
    unrealized,
    realized:holding.realizedPnl
  };
}

export function portfolioValue(player,state){
  if(!state.market)return 0;
  return state.market.stocks.reduce((total,stock)=>{
    const holding=getHolding(player,stock.id);
    return total+holding.shares*stock.price;
  },0);
}

export function stockDefinition(stockId){
  return STOCK_BY_ID[stockId]??null;
}
