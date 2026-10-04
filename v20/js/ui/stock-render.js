import{STOCKS}from"../data/stocks.js";

function trendClass(change){
  if(change>0)return"up";
  if(change<0)return"down";
  return"flat";
}

function trendText(change){
  if(change>0)return"▲ "+change.toFixed(1)+"%";
  if(change<0)return"▼ "+Math.abs(change).toFixed(1)+"%";
  return"● 0.0%";
}

export function renderStockMarket(container){
  container.innerHTML=STOCKS.map(stock=>{
    const trend=trendClass(stock.change);
    return '<article class="stock-card">'+
      '<div class="stock-card__top">'+
        '<div><strong>'+stock.name+'</strong><span>'+stock.id+'</span></div>'+
        '<em class="stock-trend '+trend+'">'+trendText(stock.change)+'</em>'+
      '</div>'+
      '<div class="stock-card__price">'+stock.price+'</div>'+
      '<div class="stock-card__holding">持有 0 股</div>'+
    '</article>';
  }).join("");
}
