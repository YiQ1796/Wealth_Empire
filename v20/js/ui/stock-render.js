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
      '<div class="stock-card__main">'+
        '<div class="stock-name-line"><strong>'+stock.name+'</strong><b>'+stock.price+'</b></div>'+
        '<em class="stock-trend '+trend+'">'+trendText(stock.change)+'</em>'+
      '</div>'+
      '<div class="stock-card__meta"><span>'+stock.id+'</span><span>持有 0 股</span></div>'+
    '</article>';
  }).join("");
}
