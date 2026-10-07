import{stockPosition}from"../core/stock-market.js";

const tradeDrafts=new WeakMap();

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

function normalizeShares(value){
  if(value==null||String(value).trim()==="")return 0;
  const number=Math.floor(Number(value));
  if(!Number.isFinite(number)||number<1)return 0;
  return Math.min(9999,number);
}

function sharesPreview(stock,shares){
  return shares>0
    ?shares+" 股｜預估 "+money(stock.price*shares)
    :"請輸入交易股數";
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

function getDraft(container){
  let draft=tradeDrafts.get(container);
  if(!draft){
    draft={stockId:null,quantities:new Map()};
    tradeDrafts.set(container,draft);
  }
  return draft;
}

function stockCardMarkup(stock,player,canTrade,draft){
  const trend=trendClass(stock.changePercent);
  const position=stockPosition(player,stock);
  const cost=position.shares*position.avgCost;
  const pnlPercent=cost>0?(position.unrealized/cost)*100:0;
  const pnlClass=position.unrealized>0?"profit":position.unrealized<0?"loss":"flat";
  const shares=normalizeShares(draft.quantities.get(stock.id)??"");
  const active=draft.stockId===stock.id;

  const held=position.shares>0;
  return '<article class="stock-trade-card '+(held?"is-held-stock ":"")+(active?"is-active-trade":"")+'" data-stock-id="'+stock.id+'" data-stock-name="'+stock.name+'" data-stock-price="'+stock.price+'">'+
    '<div class="stock-trade-card__head">'+
      '<div class="stock-title">'+
        '<div class="stock-title__line"><strong>'+stock.name+'</strong>'+
          (held?'<span class="stock-owned-badge">持有 '+position.shares+' 股</span>':"")+
        '</div>'+
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
    '<div class="stock-trade-preview" data-stock-card-preview>'+
      '<span>正在操作</span><strong>'+stock.name+'｜'+sharesPreview(stock,shares)+'</strong>'+
    '</div>'+
    '<div class="stock-trade-controls">'+
      '<label class="stock-qty-field"><span>交易股數</span><span class="stock-qty-input"><input type="number" min="1" max="9999" step="1" value="'+(shares>0?shares:"")+'" placeholder="輸入股數" inputmode="numeric" enterkeyhint="done" autocomplete="off" data-stock-qty aria-label="'+stock.name+'交易股數"><b>股</b></span></label>'+
      '<button type="button" class="stock-buy" data-stock-buy '+(canTrade?"":"disabled")+'>買進</button>'+
      '<button type="button" class="stock-sell" data-stock-sell '+(canTrade&&position.shares>0?"":"disabled")+'>賣出</button>'+
    '</div>'+
  '</article>';
}

function stockMobileCardMarkup(stock,player,draft){
  const trend=trendClass(stock.changePercent);
  const position=stockPosition(player,stock);
  const cost=position.shares*position.avgCost;
  const pnlPercent=cost>0?(position.unrealized/cost)*100:0;
  const pnlClass=position.unrealized>0?"profit":position.unrealized<0?"loss":"flat";
  const active=draft.stockId===stock.id;
  return '<article class="stock-mobile-card '+(active?"is-selected ":"")+(position.shares>0?"is-held ":"")+'" data-stock-mobile-select data-stock-id="'+stock.id+'">'+
    '<div class="stock-mobile-card__top">'+
      '<div><strong>'+stock.name+'</strong><small>'+stock.id+'｜'+stock.sector+'</small></div>'+
      '<div class="stock-mobile-card__quote"><b>'+stock.price+'</b><em class="stock-trend '+trend+'">'+trendText(stock.changePercent)+'</em></div>'+
    '</div>'+
    '<div class="stock-mobile-card__bottom">'+
      '<span>持有 <b>'+position.shares+' 股</b></span>'+
      '<span class="'+pnlClass+'">損益 <b>'+signedMoney(position.unrealized)+'</b></span>'+
      '<button type="button" data-stock-mobile-open>'+(active?"收合":"交易")+'</button>'+
    '</div>'+
  '</article>';
}

function mobileTradePanelMarkup(state,player,draft,canTrade){
  const stock=state.market.stocks.find(item=>item.id===draft.stockId);
  if(!stock)return "";

  const trend=trendClass(stock.changePercent);
  const position=stockPosition(player,stock);
  const cost=position.shares*position.avgCost;
  const pnlPercent=cost>0?(position.unrealized/cost)*100:0;
  const pnlClass=position.unrealized>0?"profit":position.unrealized<0?"loss":"flat";
  const shares=normalizeShares(draft.quantities.get(stock.id)??"");
  const maxBuy=Math.max(0,Math.min(9999,Math.floor(player.cash/Math.max(1,stock.price))));
  const allHeld=Math.max(0,Math.min(9999,position.shares));
  const buyDisabled=!canTrade||shares<1||shares>maxBuy;
  const sellDisabled=!canTrade||shares<1||shares>allHeld;

  return '<section class="stock-mobile-trade-dock is-active" data-stock-mobile-trade-dock data-stock-id="'+stock.id+'">'+
    '<div class="stock-mobile-trade-dock__head">'+
      '<div><small>目前交易</small><strong>'+stock.name+'</strong><span>'+stock.id+'｜'+stock.sector+'</span></div>'+
      '<div class="stock-mobile-trade-dock__head-actions">'+
        '<div class="stock-mobile-trade-dock__quote"><b>'+stock.price+'</b><em class="stock-trend '+trend+'">'+trendText(stock.changePercent)+'</em></div>'+
        '<button type="button" class="stock-mobile-trade-dock__close" data-stock-mobile-close aria-label="收合交易面板">✕ 收合</button>'+
      '</div>'+
    '</div>'+
    '<div class="stock-mobile-trade-dock__status">'+
      '<span>持有 <b>'+position.shares+' 股</b></span>'+
      '<span>均價 <b>'+(position.shares>0?money(position.avgCost):"—")+'</b></span>'+
      '<span class="'+pnlClass+'">損益 <b>'+signedMoney(position.unrealized)+' ('+signedPercent(pnlPercent)+')</b></span>'+
    '</div>'+
    '<div class="stock-mobile-trade-dock__entry">'+
      '<label><span>交易股數</span><span class="stock-mobile-qty"><input type="number" min="1" max="9999" step="1" value="'+(shares>0?shares:"")+'" placeholder="直接輸入股數" inputmode="numeric" enterkeyhint="done" autocomplete="off" data-stock-qty aria-label="'+stock.name+'交易股數"><b>股</b></span></label>'+
      '<div class="stock-mobile-quick">'+
        '<button type="button" data-stock-quick="10">10 股</button>'+
        '<button type="button" data-stock-quick="100">100 股</button>'+
        '<button type="button" data-stock-quick="max-buy" '+(maxBuy>0?"":"disabled")+'>可買 '+maxBuy+'</button>'+
        '<button type="button" data-stock-quick="all-held" '+(allHeld>0?"":"disabled")+'>全賣 '+allHeld+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="stock-mobile-trade-dock__preview"><span data-stock-mobile-preview>'+sharesPreview(stock,shares)+'</span></div>'+
    '<div class="stock-mobile-trade-dock__actions">'+
      '<button type="button" class="stock-buy" data-stock-mobile-buy '+(buyDisabled?"disabled":"")+'>買進</button>'+
      '<button type="button" class="stock-sell" data-stock-mobile-sell '+(sellDisabled?"disabled":"")+'>賣出</button>'+
    '</div>'+
  '</section>';
}

function selectionMarkup(state,draft,canTrade){
  if(!canTrade){
    return '<div class="stock-selection-bar is-locked" data-stock-selection><strong>目前暫停股票交易</strong><span>小遊戲或遊戲結算期間暫時不能交易。</span></div>';
  }
  const stock=state.market.stocks.find(item=>item.id===draft.stockId);
  if(!stock){
    return '<div class="stock-selection-bar" data-stock-selection><strong>選擇一檔股票</strong><span>點一下「交易股數」，這裡會固定顯示股票名稱、股數與預估金額。</span></div>';
  }
  const shares=normalizeShares(draft.quantities.get(stock.id)??"");
  return '<div class="stock-selection-bar is-active" data-stock-selection><strong>目前操作：'+stock.name+'</strong><span>'+sharesPreview(stock,shares)+'</span></div>';
}

export function renderStockMarket(container,state,localSeat,{onBuy=()=>{},onSell=()=>{}}={}){
  if(!container||!state?.market)return;
  const player=state.players?.[localSeat];
  if(!player)return;

  const canTrade=
    state.gameStatus==="playing"&&
    player.kind==="human"&&
    player.connected!==false&&
    !player.bankrupt&&
    state.phase!=="minigame"&&
    state.phase!=="finished";

  const draft=getDraft(container);
  if(draft.stockId&&!state.market.stocks.some(stock=>stock.id===draft.stockId))draft.stockId=null;

  const summary=portfolioSummary(player,state);
  const summaryUnrealizedClass=summary.unrealized>0?"profit":summary.unrealized<0?"loss":"flat";
  const summaryRealizedClass=summary.realized>0?"profit":summary.realized<0?"loss":"flat";
  const summaryMarkup=
    '<section class="stock-summary" aria-label="股票持倉總覽">'+
      '<div><span>持股總市值</span><strong>'+money(summary.marketValue)+'</strong></div>'+
      '<div class="'+summaryUnrealizedClass+'"><span>未實現損益</span><strong>'+signedMoney(summary.unrealized)+'</strong></div>'+
      '<div class="'+summaryRealizedClass+'"><span>已實現損益</span><strong>'+signedMoney(summary.realized)+'</strong></div>'+
    '</section>';

  const isMobile=container.id==="stockMarketMobileGrid";

  if(isMobile){
    const rows=[];
    for(let index=0;index<state.market.stocks.length;index+=2){
      const pair=state.market.stocks.slice(index,index+2);
      const hasActive=pair.some(stock=>stock.id===draft.stockId);
      const pairCards=pair.map(stock=>stockMobileCardMarkup(stock,player,draft)).join("");
      rows.push(
        '<div class="stock-mobile-pair-row '+(hasActive?"has-active-trade":"")+'">'+
          pairCards+
          (hasActive?mobileTradePanelMarkup(state,player,draft,canTrade):"")+
        '</div>'
      );
    }

    container.innerHTML=
      summaryMarkup+
      '<div class="stock-card-list stock-card-list--mobile-compact">'+rows.join("")+'</div>';

    const rerender=()=>renderStockMarket(container,state,localSeat,{onBuy,onSell});
    container.querySelectorAll("[data-stock-mobile-select]").forEach(card=>{
      card.addEventListener("click",event=>{
        if(event.target.closest("input,button")&&!event.target.closest("[data-stock-mobile-open]"))return;
        const nextStockId=card.dataset.stockId;
        const collapse=draft.stockId===nextStockId;
        draft.stockId=collapse?null:nextStockId;
        rerender();
        if(!collapse){
          requestAnimationFrame(()=>{
            container.querySelector('[data-stock-mobile-select][data-stock-id="'+nextStockId+'"]')
              ?.scrollIntoView({block:"nearest",behavior:"smooth"});
          });
        }
      });
    });

    const dock=container.querySelector("[data-stock-mobile-trade-dock].is-active");
    if(!dock)return;
    const stockId=dock.dataset.stockId;
    const stock=state.market.stocks.find(item=>item.id===stockId);
    const position=stock?stockPosition(player,stock):null;
    const input=dock.querySelector("[data-stock-qty]");
    const preview=dock.querySelector("[data-stock-mobile-preview]");
    const buyButton=dock.querySelector("[data-stock-mobile-buy]");
    const sellButton=dock.querySelector("[data-stock-mobile-sell]");
    const closeButton=dock.querySelector("[data-stock-mobile-close]");

    const closeTradePanel=()=>{
      if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
      document.body.classList.remove("stock-mobile-trade-focused");
      draft.stockId=null;
      rerender();
      requestAnimationFrame(()=>{
        container.querySelector('[data-stock-mobile-select][data-stock-id="'+stockId+'"]')
          ?.scrollIntoView({block:"nearest",behavior:"smooth"});
      });
    };

    closeButton?.addEventListener("click",event=>{
      event.stopPropagation();
      closeTradePanel();
    });

    const syncTradeState=()=>{
      if(!stock||!input)return 0;
      const shares=normalizeShares(input.value);
      if(shares>0)draft.quantities.set(stockId,shares);
      else draft.quantities.delete(stockId);
      if(preview)preview.textContent=sharesPreview(stock,shares);
      const maxBuy=Math.max(0,Math.min(9999,Math.floor(player.cash/Math.max(1,stock.price))));
      const held=Math.max(0,Math.min(9999,position?.shares??0));
      if(buyButton)buyButton.disabled=!canTrade||shares<1||shares>maxBuy;
      if(sellButton)sellButton.disabled=!canTrade||shares<1||shares>held;
      return shares;
    };

    input?.addEventListener("focus",()=>{
      document.body.classList.add("stock-mobile-trade-focused");
      requestAnimationFrame(()=>dock.scrollIntoView({block:"nearest",behavior:"smooth"}));
    });
    input?.addEventListener("blur",()=>document.body.classList.remove("stock-mobile-trade-focused"));
    input?.addEventListener("input",syncTradeState);
    input?.addEventListener("change",syncTradeState);

    dock.querySelectorAll("[data-stock-quick]").forEach(button=>{
      button.addEventListener("click",()=>{
        if(!input||!stock)return;
        const mode=button.dataset.stockQuick;
        let value=0;
        if(mode==="10")value=10;
        else if(mode==="100")value=100;
        else if(mode==="max-buy")value=Math.max(0,Math.min(9999,Math.floor(player.cash/Math.max(1,stock.price))));
        else if(mode==="all-held")value=Math.max(0,Math.min(9999,position?.shares??0));
        input.value=value>0?String(value):"";
        syncTradeState();
      });
    });

    buyButton?.addEventListener("click",()=>{
      const shares=syncTradeState();
      if(shares<1){input?.focus();return;}
      onBuy(stockId,shares);
    });
    sellButton?.addEventListener("click",()=>{
      const shares=syncTradeState();
      if(shares<1){input?.focus();return;}
      onSell(stockId,shares);
    });
    return;
  }

  const cards=state.market.stocks.map(stock=>stockCardMarkup(stock,player,canTrade,draft));
  const cardsPerRow=2;
  const rows=[];
  for(let index=0;index<cards.length;index+=cardsPerRow){
    const rowCards=cards.slice(index,index+cardsPerRow).join("");
    const spacer=cardsPerRow===2&&index+1>=cards.length
      ?'<div class="stock-pair-row__spacer" aria-hidden="true"></div>'
      :"";
    rows.push('<div class="stock-pair-row">'+rowCards+spacer+'</div>');
  }

  container.innerHTML=
    summaryMarkup+
    selectionMarkup(state,draft,canTrade)+
    '<div class="stock-card-list">'+rows.join("")+'</div>';

  const selection=container.querySelector("[data-stock-selection]");

  const activateCard=(card,{scroll=false}={})=>{
    if(!card)return;
    const stockId=card.dataset.stockId;
    const stock=state.market.stocks.find(item=>item.id===stockId);
    const qty=card.querySelector("[data-stock-qty]");
    if(!stock||!qty)return;
    const shares=normalizeShares(qty.value);
    draft.stockId=stockId;
    if(shares>0)draft.quantities.set(stockId,shares);
    else draft.quantities.delete(stockId);

    container.querySelectorAll(".stock-trade-card").forEach(node=>{
      node.classList.toggle("is-active-trade",node===card);
    });

    const cardPreview=card.querySelector("[data-stock-card-preview] strong");
    if(cardPreview)cardPreview.textContent=stock.name+"｜"+sharesPreview(stock,shares);
    if(selection){
      selection.classList.remove("is-locked");
      selection.classList.add("is-active");
      selection.innerHTML="<strong>目前操作："+stock.name+"</strong><span>"+sharesPreview(stock,shares)+"</span>";
    }

    if(scroll){
      setTimeout(()=>{
        try{card.scrollIntoView({block:"center",behavior:"smooth"})}catch{}
      },120);
    }
  };

  container.querySelectorAll("[data-stock-qty]").forEach(input=>{
    const card=input.closest("[data-stock-id]");
    input.addEventListener("focus",()=>activateCard(card,{scroll:true}));
    input.addEventListener("click",()=>activateCard(card));
    input.addEventListener("input",()=>activateCard(card));
    input.addEventListener("change",()=>activateCard(card));
  });

  container.querySelectorAll("[data-stock-buy]").forEach(button=>{
    button.addEventListener("click",()=>{
      const card=button.closest("[data-stock-id]");
      activateCard(card);
      const qty=card?.querySelector("[data-stock-qty]");
      const shares=normalizeShares(qty?.value);
      if(shares<1){qty?.focus();return;}
      onBuy(card.dataset.stockId,shares);
    });
  });

  container.querySelectorAll("[data-stock-sell]").forEach(button=>{
    button.addEventListener("click",()=>{
      const card=button.closest("[data-stock-id]");
      activateCard(card);
      const qty=card?.querySelector("[data-stock-qty]");
      const shares=normalizeShares(qty?.value);
      if(shares<1){qty?.focus();return;}
      onSell(card.dataset.stockId,shares);
    });
  });
}
