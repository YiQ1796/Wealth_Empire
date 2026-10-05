import{stockPosition}from"../core/stock-market.js";
import{UI_ASSETS}from"../data/ui-assets.js";

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

function money(value){
  return"$"+Math.round(value).toLocaleString();
}

function signedMoney(value){
  const rounded=Math.round(value);
  return(rounded>=0?"+":"-")+"$"+Math.abs(rounded).toLocaleString();
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

  container.innerHTML=state.market.stocks.map(stock=>{
    const trend=trendClass(stock.changePercent);
    const position=stockPosition(player,stock);
    const pnlClass=position.unrealized>0?"profit":position.unrealized<0?"loss":"flat";
    const holdingInfo=position.shares>0
      ? '<div class="stock-position">'+
          '<span>持有 <b>'+position.shares+'</b> 股</span>'+
          '<span>均價 <b>'+money(position.avgCost)+'</b></span>'+
          '<span>現值 <b>'+money(position.marketValue)+'</b></span>'+
          '<span class="'+pnlClass+'">損益 <b>'+signedMoney(position.unrealized)+'</b></span>'+
        '</div>'
      : '<div class="stock-position stock-position--empty"><img src="'+UI_ASSETS.modal.emptyHoldings+'" alt=""><span>尚未持有</span></div>';

    return '<article class="stock-trade-card" data-stock-id="'+stock.id+'">'+
      '<div class="stock-trade-card__head">'+
        '<div><strong>'+stock.name+'</strong><small>'+stock.id+'｜'+stock.sector+'</small></div>'+
        '<div class="stock-price"><b>'+stock.price+'</b><em class="stock-trend '+trend+'">'+trendText(stock.changePercent)+'</em></div>'+
      '</div>'+
      holdingInfo+
      '<div class="stock-trade-controls">'+
        '<label>股數<input type="number" min="1" max="9999" step="1" value="1" inputmode="numeric" data-stock-qty></label>'+
        '<button type="button" class="stock-buy" data-stock-buy '+(canTrade?"":"disabled")+'>買進</button>'+
        '<button type="button" class="stock-sell" data-stock-sell '+(canTrade&&position.shares>0?"":"disabled")+'>賣出</button>'+
      '</div>'+
    '</article>';
  }).join("");

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
