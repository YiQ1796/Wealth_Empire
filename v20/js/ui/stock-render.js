import{stockPosition}from"../core/stock-market.js";

function trendClass(change){
  if(change>0)return"up";
  if(change<0)return"down";
  return"flat";
}

function trendText(change){
  if(change>0)return"▲ 上漲 +"+change.toFixed(1)+"%";
  if(change<0)return"▼ 下跌 -"+Math.abs(change).toFixed(1)+"%";
  return"● 平盤 +0.0%";
}

function money(value){
  return"$"+Math.round(value).toLocaleString();
}

function signedMoney(value){
  const rounded=Math.round(value);
  return(rounded>=0?"+":"-")+"$"+Math.abs(rounded).toLocaleString();
}

function signedPercent(value){
  const rounded=Math.round(value*10)/10;
  return(rounded>=0?"+":"")+rounded.toFixed(1)+"%";
}

function portfolioSummary(player,state){
  return state.market.stocks.reduce((summary,stock)=>{
    const position=stockPosition(player,stock);
    summary.marketValue+=position.marketValue;
    summary.unrealized+=position.unrealized;
    summary.realized+=position.realized;
    return summary;
  },{marketValue:0,unrealized:0,realized:0});
}

function stockCardMarkup(stock,player,canTrade){
  const trend=trendClass(stock.changePercent);
  const position=stockPosition(player,stock);
  const cost=position.shares*position.avgCost;
  const pnlPercent=cost>0?(position.unrealized/cost)*100:0;
  const pnlClass=position.unrealized>0?"profit":position.unrealized<0?"loss":"flat";

  return '<article class="stock-trade-card" data-stock-id="'+stock.id+'">'+
    '<div class="stock-trade-card__head">'+
      '<div class="stock-title">'+
        '<strong>'+stock.name+'</strong>'+
        '<small>'+stock.id+'｜'+stock.sector+'</small>'+
      '</div>'+
      '<div class="stock-quote">'+
        '<b>'+stock.price+'</b>'+
        '<em class="stock-trend '+trend+'">'+trendText(stock.changePercent)+'</em>'+
      '</div>'+
    '</div>'+
    '<div class="stock-holding-row">'+
      '<span>目前持有 <b>'+position.shares+' 股</b></span>'+
      '<span>平均成本 <b>'+(position.shares>0?money(position.avgCost):"—")+'</b></span>'+
    '</div>'+
    '<div class="stock-pnl-row '+pnlClass+'">'+
      '<span>持倉損益</span>'+
      '<strong>'+signedMoney(position.unrealized)+' <small>('+signedPercent(pnlPercent)+')</small></strong>'+
    '</div>'+
    '<div class="stock-trade-controls">'+
      '<label><span class="sr-only">股數</span><input type="number" min="1" max="9999" step="1" value="1" inputmode="numeric" data-stock-qty aria-label="交易股數"></label>'+
      '<button type="button" class="stock-buy" data-stock-buy '+(canTrade?"":"disabled")+'>買進</button>'+
      '<button type="button" class="stock-sell" data-stock-sell '+(canTrade&&position.shares>0?"":"disabled")+'>賣出</button>'+
    '</div>'+
  '</article>';
}

export function renderStockMarket(container,state,localSeat,{onBuy=()=>{},onSell=()=>{}}={}){
  if(!container||!state?.market)return;
  const player=state.players?.[localSeat];
  if(!player)return;

  const canTrade=
    state.gameStatus==="playing"&&
    !player.bankrupt&&
    state.phase!=="minigame"&&
    state.phase!=="finished";

  const summary=portfolioSummary(player,state);
  const summaryUnrealizedClass=summary.unrealized>0?"profit":summary.unrealized<0?"loss":"flat";
  const summaryRealizedClass=summary.realized>0?"profit":summary.realized<0?"loss":"flat";

  const cards=state.market.stocks.map(stock=>stockCardMarkup(stock,player,canTrade));
  const rows=[];
  for(let index=0;index<cards.length;index+=2){
    rows.push(
      '<div class="stock-pair-row">'+
        cards[index]+
        (cards[index+1]??'<div class="stock-pair-row__spacer" aria-hidden="true"></div>')+
      '</div>'
    );
  }

  container.innerHTML=
    '<section class="stock-summary" aria-label="股票持倉總覽">'+
      '<div><span>持股總市值</span><strong>'+money(summary.marketValue)+'</strong></div>'+
      '<div class="'+summaryUnrealizedClass+'"><span>未實現損益</span><strong>'+signedMoney(summary.unrealized)+'</strong></div>'+
      '<div class="'+summaryRealizedClass+'"><span>已實現損益</span><strong>'+signedMoney(summary.realized)+'</strong></div>'+
    '</section>'+
    '<div class="stock-card-list">'+rows.join("")+'</div>';

  container.querySelectorAll("[data-stock-buy]").forEach(button=>{
    button.addEventListener("click",()=>{
      const card=button.closest("[data-stock-id]");
      const qty=card?.querySelector("[data-stock-qty]");
      const shares=Math.max(1,Math.min(9999,Math.floor(Number(qty?.value)||1)));
      onBuy(card.dataset.stockId,shares);
    });
  });

  container.querySelectorAll("[data-stock-sell]").forEach(button=>{
    button.addEventListener("click",()=>{
      const card=button.closest("[data-stock-id]");
      const qty=card?.querySelector("[data-stock-qty]");
      const shares=Math.max(1,Math.min(9999,Math.floor(Number(qty?.value)||1)));
      onSell(card.dataset.stockId,shares);
    });
  });
}
