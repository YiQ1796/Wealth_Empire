import{createInitialState,createLobbyState,hydrateState,setAiSeat,setHumanSeat,setPlayerCharacter}from"./core/state.js?v=alpha32-240";
import{GameEngine}from"./core/game.js?v=alpha32-240";
import{
  PeerNetwork,
  clearNetworkSession,
  createRoomCode,
  getOrCreateClientId,
  loadHostSnapshot,
  loadNetworkSession,
  prewarmNetworkTransport,
  sanitizePlayerName,
  sanitizeRoomCode,
  saveHostSnapshot
}from"./core/network.js?v=alpha32-240";
import{characterAsset,mountStaticBoard,render}from"./ui/render.js?v=alpha32-240";
import{itemUiSummary}from"./ui/item-render.js";
import{renderStockMarket}from"./ui/stock-render.js?v=alpha32-240";
import{UI_ASSETS}from"./data/ui-assets.js";
import{MinigameUI}from"./ui/minigame-ui.js";
import{GROUP_SIZES,MAX_PROPERTY_LEVEL,groupRentMultiplier}from"./data/board.js";
import{canForceAcquireProperty,groupProgress,propertyValue,rentFor,suggestedAcquisitionOffer,upgradeCost}from"./core/property-economy.js?v=alpha32-240";
import{TRANSPORT_NODE_BY_INDEX}from"./data/transport.js?v=alpha32-240";
import{bankReturnAmount,worldStatusSummary}from"./core/world-events.js?v=alpha32-240";
import{
  CENTRAL_FEATURE_BY_ID,
  CENTRAL_MISSIONS,
  CENTRAL_MISSION_BY_ID,
  CENTRAL_TEST_TUNING
}from"./data/central-features.js";
import{centralDevelopmentOptions,centralFacilityStatus}from"./core/central-features.js?v=alpha32-240";
import{initBgmController}from"./ui/bgm-controller.js";

try{initBgmController()}catch(error){console.warn("BGM controller unavailable",error)}

const board=document.getElementById("board");
mountStaticBoard(board);
const boardCharacterLayer=document.createElement("div");
boardCharacterLayer.id="boardCharacterLayer";
boardCharacterLayer.className="board-character-layer";
board.appendChild(boardCharacterLayer);

let state=createInitialState();
let aiTimer=null;
let lastToastEventId=0;
let lastMoveEventId=0;
let initialGuestStatePending=false;
let noticeQueue=[];
let noticeActive=false;
let movementQueue=Promise.resolve();
let selectedCharacterIndex=0;
let lastItemPromptKey="";
const disconnectTimers=new Map();
const ACTION_TOAST_KINDS=new Set([
  "property_buy",
  "property_upgrade",
  "group_complete",
  "rent",
  "acquisition_offer",
  "stock_buy",
  "stock_sell",
  "market_tick",
  "minigame_complete",
  "network_join",
  "network_reconnect",
  "network_ai_takeover",
  "property_acquisition",
  "item_use",
  "bankruptcy",
  "cash",
  "special_event",
  "special_grid",
  "transport_complete",
  "transport_event",
  "world_event_choice",
  "government_contract_complete",
  "government_contract_expired",
  "urban_complete",
  "central_bank_active",
  "central_bank_matured",
  "central_mission_complete",
  "central_insurance_active",
  "central_insurance_used",
  "central_development",
  "game_complete"
]);
const uiContext={
  localSeat:0,
  networkMode:"offline"
};

const featureDialog=document.getElementById("featureDialog");
const itemPromptDialog=document.getElementById("itemPromptDialog");
const centralFacilityDialog=document.getElementById("centralFacilityDialog");
const networkDialog=document.getElementById("networkDialog");
const purchaseDialog=document.getElementById("purchaseDialog");
const propertyInfoDialog=document.getElementById("propertyInfoDialog");
const urbanDialog=document.getElementById("urbanDialog");
const acquisitionDialog=document.getElementById("acquisitionDialog");
const transportDialog=document.getElementById("transportDialog");
const worldChoiceDialog=document.getElementById("worldChoiceDialog");
const entryGate=document.getElementById("entryGate");
const actionToastStack=document.getElementById("actionToastStack");
board.appendChild(actionToastStack);

function setNetworkStatus(text,kind="info"){
  const node=document.getElementById("networkStatus");
  if(node){
    node.textContent=text;
    node.dataset.kind=kind;
  }
}

function currentLocalSeat(){
  return Number.isInteger(uiContext.localSeat)?uiContext.localSeat:0;
}

function isLocalRoomHost(){
  const hostSeat=Number.isInteger(Number(state.network?.hostSeat))
    ?Number(state.network.hostSeat)
    :0;
  const localSeat=currentLocalSeat();
  if(network.mode!=="host"||localSeat!==hostSeat)return false;
  const host=state.players?.[hostSeat];
  const expectedClientId=state.network?.hostClientId??host?.clientId??null;
  return !expectedClientId||expectedClientId===network.clientId;
}

function canStartRoomGame(){
  return isLocalRoomHost()&&(state.gameStatus==="lobby"||state.phase==="lobby");
}

function uniqueLobbyPlayerName(requestedName,clientId){
  const base=sanitizePlayerName(requestedName);
  const normalized=value=>String(value??"").trim().toLocaleLowerCase();
  const usedNames=new Set(
    (state.players??[])
      .filter(player=>player.kind==="human"&&player.clientId!==clientId)
      .map(player=>normalized(player.name))
      .filter(Boolean)
  );
  if(!usedNames.has(normalized(base)))return base;

  for(let index=2;index<=9;index++){
    const suffix=" ("+index+")";
    const candidate=base.slice(0,Math.max(1,20-suffix.length))+suffix;
    if(!usedNames.has(normalized(candidate)))return candidate;
  }

  const suffix="-"+String(clientId??"").slice(-4);
  return base.slice(0,Math.max(1,20-suffix.length))+suffix;
}

function friendlyNetworkError(error){
  const message=String(error?.message??error??"unknown");
  if(/unavailable-id|is taken|ID is taken|duplicate/i.test(message)){
    return"房間識別暫時衝突，系統不會用玩家名稱判定身份；請直接再試一次。";
  }
  if(/relay_join_timeout|relay_timeout|join_timeout|peer_timeout/i.test(message)){
    return"連線逾時，已嘗試中繼與備援連線；請確認房號後再試一次。";
  }
  if(/room_unavailable|invalid_room|invalid_room_code/i.test(message)){
    return"找不到可加入的房間，請確認 6 位數房號。";
  }
  return message;
}

const phoneLandscapeQuery=window.matchMedia("(orientation: landscape) and (max-height: 650px) and (max-width: 1180px)");
let phoneLayoutSettleTimers=[];

function syncPhoneViewportHeight(){
  if(!phoneLandscapeQuery.matches){
    document.documentElement.style.removeProperty("--phone-app-height");
    return;
  }
  const visualHeight=Math.round(window.visualViewport?.height||0);
  const innerHeight=Math.round(window.innerHeight||0);
  const height=Math.max(1,visualHeight||innerHeight);
  document.documentElement.style.setProperty("--phone-app-height",height+"px");
}

function settlePhoneLandscapeLayout(){
  if(!phoneLandscapeQuery.matches)return;
  phoneLayoutSettleTimers.forEach(clearTimeout);
  phoneLayoutSettleTimers=[];
  const settle=()=>{
    syncPhoneViewportHeight();
    document.querySelector(".app-shell")?.getBoundingClientRect();
    window.scrollTo(0,0);
  };

  settle();
  requestAnimationFrame(()=>{
    settle();
    requestAnimationFrame(settle);
  });

  [80,180,350,650,1000].forEach(delay=>{
    phoneLayoutSettleTimers.push(setTimeout(settle,delay));
  });
}

function setEntryVisible(visible){
  document.body.classList.toggle("entry-pending",visible);
  entryGate.hidden=!visible;
  if(!visible)settlePhoneLandscapeLayout();
}
window.visualViewport?.addEventListener("resize",settlePhoneLandscapeLayout);
window.visualViewport?.addEventListener("scroll",syncPhoneViewportHeight);
window.addEventListener("resize",settlePhoneLandscapeLayout);
window.addEventListener("orientationchange",settlePhoneLandscapeLayout);
syncPhoneViewportHeight();

function selectEntryCharacter(index){
  const next=Math.max(0,Math.min(3,Math.floor(Number(index)||0)));
  selectedCharacterIndex=next;
  document.querySelectorAll("[data-character-choice]").forEach(button=>{
    const selected=Number(button.dataset.characterChoice)===next;
    button.classList.toggle("selected",selected);
    button.setAttribute("aria-pressed",String(selected));
  });
}


function maxEventId(targetState=state){
  return Math.max(0,...(targetState.events??[]).map(event=>Number(event.id)||0));
}

function resetToastTracker(targetState=state){
  const maxId=maxEventId(targetState);
  lastToastEventId=maxId;
  lastMoveEventId=maxId;
  noticeQueue=[];
  noticeActive=false;
  lastItemPromptKey="";
  actionToastStack.replaceChildren();
}

function noticeConfig(event){
  const N=UI_ASSETS.notification;
  if(event.kind==="special_event"){
    const amount=Number(event.data?.amount)||0;
    const tone=event.data?.effectKind==="cash"&&amount<0?"red":event.data?.type==="fate"?"purple":"gold";
    return{
      title:event.data?.type==="fate"?"命運事件":"機會事件",
      icon:N.icons.minigameResult,
      effect:tone==="red"?N.effects.red:tone==="purple"?N.effects.purple:N.effects.gold,
      tone,
      major:true,
      metric:true
    };
  }
  const map={
    property_buy:{title:"地產購入",icon:N.icons.propertyBuy,effect:N.effects.gold,tone:"gold",major:true},
    property_upgrade:{title:"地產升級",icon:N.icons.propertyUpgrade,effect:N.effects.purple,tone:"purple",major:true},
    group_complete:{title:"區域完成",icon:N.icons.regionComplete,effect:N.effects.gold,tone:"gold",major:true},
    rent:{title:"過路費結算",icon:N.icons.rent,effect:N.effects.green,tone:"green",major:true},
    acquisition_offer:{title:"取得強制收購權",icon:N.icons.acquisition,effect:N.effects.red,tone:"red",major:true},
    property_acquisition:{title:"強制收購",icon:N.icons.acquisition,effect:N.effects.red,tone:"red",major:true},
    item_use:{title:"策略道具",icon:N.icons.minigameResult,effect:N.effects.purple,tone:"purple",major:true},
    bankruptcy:{title:"玩家破產",icon:N.icons.bankruptcy,effect:N.effects.red,tone:"red",major:true},
    minigame_complete:{title:"都會挑戰結算",icon:N.icons.minigameResult,effect:N.effects.gold,tone:"gold",major:true},
    game_complete:{title:"遊戲結束",icon:N.icons.victory,effect:N.effects.gold,tone:"gold",major:true},
    stock_buy:{title:"股票買進",icon:N.icons.stockBuy,effect:N.effects.blue,tone:"blue",metric:true},
    stock_sell:{title:"股票賣出",icon:N.icons.stockSell,effect:N.effects.blue,tone:"blue",metric:true},
    market_tick:{title:"市場更新",icon:N.icons.marketTick,effect:N.effects.blue,tone:"blue",market:true},
    network_join:{title:"好友加入",icon:N.icons.network,effect:N.effects.blue,tone:"blue"},
    network_reconnect:{title:"重新連線",icon:N.icons.network,effect:N.effects.green,tone:"green"},
    network_ai_takeover:{title:"AI 接手",icon:N.icons.aiTakeover,effect:N.effects.purple,tone:"purple"},
    transport_complete:{title:"交通樞紐",icon:N.icons.network,effect:N.effects.blue,tone:"blue",major:true},
    transport_event:{title:"交通事件",icon:N.icons.network,effect:N.effects.gold,tone:"gold",major:true},
    world_event_choice:{title:"城市事件決策",icon:N.icons.minigameResult,effect:N.effects.gold,tone:"gold",major:true},
    government_contract_complete:{title:"政府標案完成",icon:N.icons.minigameResult,effect:N.effects.green,tone:"green",major:true},
    government_contract_expired:{title:"政府標案逾期",icon:N.icons.minigameResult,effect:N.effects.red,tone:"red",major:true},
    urban_complete:{title:"城市更新",icon:N.icons.propertyUpgrade,effect:N.effects.green,tone:"green",major:true},
    special_grid:{title:"特殊設施",icon:N.icons.minigameResult,effect:N.effects.purple,tone:"purple",major:true},
    central_bank_active:{title:"都會銀行",icon:N.icons.marketTick,effect:N.effects.gold,tone:"gold",major:true},
    central_bank_matured:{title:"定存到期",icon:N.icons.marketTick,effect:N.effects.green,tone:"green",major:true},
    central_mission_complete:{title:"委託完成",icon:N.icons.minigameResult,effect:N.effects.gold,tone:"gold",major:true},
    central_insurance_active:{title:"租金保險",icon:N.icons.rent,effect:N.effects.blue,tone:"blue",major:true},
    central_insurance_used:{title:"租金保險生效",icon:N.icons.rent,effect:N.effects.green,tone:"green",major:true},
    central_development:{title:"城市建案",icon:N.icons.propertyUpgrade,effect:N.effects.purple,tone:"purple",major:true},
    cash:{title:"現金變動",icon:N.icons.rent,effect:N.effects.green,tone:"green",metric:true}
  };
  return map[event.kind]??{title:"遊戲動態",icon:N.icons.marketTick,effect:N.effects.blue,tone:"blue"};
}

function noticeCardSources(config){
  const cards=UI_ASSETS.notification.cards;
  const market=UI_ASSETS.notification.market;
  if(config.market){
    return{desktop:market.desktop,mobile:market.mobile};
  }
  if(config.major||config.metric){
    return{desktop:cards.majorDesktop,mobile:cards.majorMobile};
  }
  return{desktop:cards.standardDesktop,mobile:cards.standardMobile};
}

function noticeMoney(value){
  const number=Number(value);
  if(!Number.isFinite(number))return"—";
  return"$"+Math.round(number).toLocaleString();
}

function noticeSignedMoney(value){
  const number=Number(value);
  if(!Number.isFinite(number))return"—";
  const rounded=Math.round(number);
  return(rounded>=0?"+":"-")+"$"+Math.abs(rounded).toLocaleString();
}

function noticeView(event){
  const data=event.data??{};
  const tile=Number.isInteger(Number(data.tile))?state.tiles?.[Number(data.tile)]:null;
  const player=Number.isInteger(Number(data.seat))?state.players?.[Number(data.seat)]:null;
  const playerName=data.playerName??player?.name??"玩家";
  const tileName=data.tileName??tile?.name??"地產";
  const group=data.group??tile?.group??"";
  const details=[];

  switch(event.kind){
    case"property_buy":
      details.push("成交 "+noticeMoney(data.amount));
      if(group)details.push("區域 "+group);
      details.push("剩餘現金 "+noticeMoney(data.cashAfter));
      return{
        message:playerName+" 購入「"+tileName+"」",
        metric:noticeMoney(data.amount),
        details
      };

    case"property_upgrade":
      details.push("升級費 "+noticeMoney(data.amount));
      details.push("目前過路費 "+noticeMoney(data.rentAfter));
      details.push("剩餘現金 "+noticeMoney(data.cashAfter));
      return{
        message:playerName+" 將「"+tileName+"」升級至 LV."+data.level,
        metric:"LV."+data.level,
        details
      };

    case"rent":
      if(data.strategyRentEffect==="rent_block")details.push("租金封鎖生效，本次免收");
      else if(data.strategyRentEffect==="rent_burst")details.push("過路費爆發生效，本次租金 ×2");
      else details.push("支付 "+noticeMoney(data.amount));
      if(Number(data.requested)!==Number(data.amount)&&data.strategyRentEffect!=="rent_block")details.push("原應付 "+noticeMoney(data.requested));
      if(group)details.push("區域 "+group);
      return{
        message:(data.payerName??"玩家")+" → "+(data.ownerName??"地主")+"｜「"+tileName+"」",
        metric:noticeMoney(data.amount),
        details
      };

    case"group_complete":{
      const groupName=data.group??"區域";
      const total=Number(data.total)||(GROUP_SIZES[groupName]??0);
      const multiplier=Number(data.multiplier)||groupRentMultiplier(groupName);
      return{
        message:(player?.name??"玩家")+" 完成「"+groupName+"」"+total+"/"+total+" 地產",
        metric:"×"+multiplier,
        details:["完成連區後，該區過路費提升至 ×"+multiplier]
      };
    }

    case"stock_buy":
      details.push("成交價 "+noticeMoney(data.price));
      details.push("總額 "+noticeMoney(data.total));
      details.push("持股 "+(data.holdingShares??data.shares)+" 股");
      details.push("剩餘現金 "+noticeMoney(data.cashAfter));
      return{
        message:playerName+" 買進「"+(data.stockName??data.stockId??"股票")+"」"+data.shares+" 股",
        metric:noticeMoney(data.total),
        details
      };

    case"stock_sell":
      details.push("成交價 "+noticeMoney(data.price));
      details.push("總額 "+noticeMoney(data.total));
      details.push("剩餘持股 "+(data.holdingShares??0)+" 股");
      details.push("已實現 "+noticeSignedMoney(data.realized));
      return{
        message:playerName+" 賣出「"+(data.stockName??data.stockId??"股票")+"」"+data.shares+" 股",
        metric:noticeSignedMoney(data.realized),
        details
      };

    case"item_use":{
      const itemDetails=[];
      if(data.tileName)itemDetails.push("目標 "+data.tileName);
      if(data.stockName)itemDetails.push(data.stockName+" "+noticeMoney(data.previousPrice)+" → "+noticeMoney(data.price));
      if(data.forcedDiceTotal)itemDetails.push("骰子總點數 "+data.forcedDiceTotal);
      itemDetails.push("剩餘 "+Math.max(0,Number(data.remaining)||0)+" 張");
      return{message:playerName+" 使用「"+(data.itemName??"策略道具")+"」",metric:data.itemName??"已使用",details:itemDetails};
    }

    case"acquisition_offer":
      return{
        message:data.source==="landing"
          ?playerName+" 踩到「"+tileName+"」，取得強制收購權"
          :event.text,
        metric:Number.isFinite(Number(data.offer))?noticeMoney(data.offer):"可收購",
        details:[
          data.source==="landing"?"已先完成本次過路費結算；是否收購由你決定":null,
          data.affordable===false?"目前現金不足，只能選擇不收購":"未滿級且未受保護；確認收購後會直接取得地產並自動升 1 級"
        ].filter(Boolean)
      };

    case"property_acquisition":
      return{
        message:event.text,
        metric:Number.isFinite(Number(data.amount))?noticeMoney(data.amount):"收購",
        details:[
          data.sellerName?"原持有人 "+data.sellerName:null,
          Number.isFinite(Number(data.buyerCashAfter))?"收購後現金 "+noticeMoney(data.buyerCashAfter):null
        ].filter(Boolean)
      };

    case"bankruptcy":
      return{
        message:event.text,
        metric:"破產",
        details:[]
      };

    case"minigame_complete":{
      const winner=Array.isArray(data.rankings)?data.rankings.find(item=>item.rank===1):null;
      return{
        message:event.text,
        metric:winner?"#1":"結算",
        details:winner?["冠軍獎勵 "+noticeMoney(winner.reward)]:[]
      };
    }

    case"cash":
      return{
        message:event.text,
        metric:noticeSignedMoney(data.amount),
        details:[]
      };

    case"special_event":{
      const metric=data.blockedBy==="tax"
        ?"已抵免"
        :data.blockedBy==="hospital"
          ?"已保護"
          :data.effectKind==="cash"
            ? noticeSignedMoney(data.amount)
            : data.effectKind==="move"
              ? ((Number(data.delta)>=0?"前進 ":"後退 ")+Math.abs(Number(data.delta)||0)+" 格")
              : data.effectKind==="random_upgrade"&&data.property
                ?"LV."+data.property.level
                : data.effectKind==="grant_permit"
                  ?"建案券 +"+Math.max(0,Number(data.permitDelta)||0)
                  : data.effectKind==="grant_property_protection"
                    ?"保全券 +"+Math.max(0,Number(data.protectionPermitDelta)||0)
                    : data.effectKind==="grant_item"
                      ?"道具 +"+Math.max(0,Number(data.itemDelta)||0)
                      :"事件";
      const details=[];
      if(data.effectKind==="cash"&&Number.isFinite(Number(data.cashAfter))){
        details.push("事件後現金 "+noticeMoney(data.cashAfter));
      }
      if(data.effectKind==="move"){
        details.push("位置 "+(Number(data.from)+1)+" → "+(Number(data.to)+1));
      }
      if(data.effectKind==="random_upgrade"&&data.property){
        details.push("免費升級 "+data.property.tileName+" → LV."+data.property.level);
      }
      if(data.effectKind==="grant_permit"&&Number(data.permitDelta)>0){
        details.push("目前建案許可 "+data.permitsTotal+" 張");
      }
      if(data.effectKind==="grant_property_protection"&&Number(data.protectionPermitDelta)>0){
        details.push("目前產權保全券 "+data.protectionPermitsTotal+" 張");
      }
      if(data.effectKind==="grant_item"&&Number(data.itemDelta)>0){
        details.push("取得「"+data.itemName+"」｜同名持有 "+data.itemTotal+" 張");
      }
      return{message:event.text,metric,details};
    }

    case"special_grid":{
      const labels={
        tax:"稅務事件",
        court:"法院事件",
        hospital:"醫療事件",
        urban:"城市更新",
        acquisition:"收購事件",
        auction:"拍賣事件",
        property_protection:"產權保全"
      };
      let metric=labels[data.type]??"特殊效果";
      const details=[];
      if(data.effectKind==="cash")metric=noticeSignedMoney(data.amount);
      if(data.effectKind==="random_upgrade"&&data.property){
        metric="LV."+data.property.level;
        details.push("免費升級 "+data.property.tileName+" → LV."+data.property.level);
      }
      if(data.effectKind==="grant_permit"){
        metric="建案券 +"+Math.max(0,Number(data.permitDelta)||0);
        if(Number(data.permitDelta)>0)details.push("目前建案許可 "+data.permitsTotal+" 張");
      }
      if(data.effectKind==="grant_property_protection"){
        metric="保全券 +"+Math.max(0,Number(data.protectionPermitDelta)||0);
        if(Number(data.protectionPermitDelta)>0)details.push("目前產權保全券 "+data.protectionPermitsTotal+" 張");
      }
      if(data.untilRound)details.push("保護至 ROUND "+data.untilRound);
      return{message:event.text,metric,details};
    }

    case"urban_complete":
      return{
        message:(data.playerName??"玩家")+" 完成城市更新重新部署",
        metric:"#"+(Number(data.to)+1),
        details:[data.tileName?"移動至 "+data.tileName:""]
      };

    case"transport_complete":
      return{
        message:event.text,
        metric:data.actionLabel??"已完成",
        details:[
          data.sourceName?"樞紐 "+data.sourceName:null,
          Number(data.cost)>0?"費用 "+noticeMoney(data.cost):"本次不收費",
          Number.isInteger(Number(data.destinationIndex))
            ?"抵達 #"+(Number(data.destinationIndex)+1)+" "+(state.tiles?.[Number(data.destinationIndex)]?.name??"")
            :null
        ].filter(Boolean)
      };

    case"transport_event":
      return{
        message:event.text,
        metric:Number.isFinite(Number(data.amount))?noticeSignedMoney(data.amount):"交通事件",
        details:[data.sourceName??""].filter(Boolean)
      };

    case"world_event_choice":
      return{
        message:event.text,
        metric:"已選擇",
        details:[data.eventName??""].filter(Boolean)
      };

    case"government_contract_complete":
      return{
        message:event.text,
        metric:"+"+noticeMoney(data.reward),
        details:[data.taskName??"政府標案"]
      };

    case"government_contract_expired":
      return{
        message:event.text,
        metric:"逾期",
        details:[data.taskName??"政府標案"]
      };

    case"market_tick":{
      const movers=Array.isArray(data.movers)?data.movers:[];
      const isMarketGrid=data.type==="market";
      const repriced=data.effectKind==="market_tick"||!isMarketGrid;
      return{
        message:isMarketGrid
          ?(repriced?"股市事件｜全市場立即重新漲跌":event.text)
          :"輪到 "+(data.playerName??"下一位玩家")+"｜全市場重新漲跌",
        metric:null,
        details:movers.map(stock=>stock.name+" "+(stock.changePercent>0?"+":"")+Number(stock.changePercent).toFixed(1)+"%")
      };
    }

    case"central_bank_active":
      return{
        message:event.text,
        metric:"定存中",
        details:[
          "本金 "+noticeMoney(data.principal),
          "到期 ROUND "+data.maturesRound+"｜返還 "+noticeMoney(data.returnAmount)
        ]
      };

    case"central_bank_matured":
      return{
        message:event.text,
        metric:noticeMoney(data.amount),
        details:["入帳後現金 "+noticeMoney(data.cashAfter)]
      };

    case"central_mission_complete":
      return{
        message:event.text,
        metric:"+"+noticeMoney(data.reward),
        details:["完成城市委託"]
      };

    case"central_insurance_active":
      return{
        message:event.text,
        metric:"已啟動",
        details:["下一次他人地產租金降低 50%"]
      };

    case"central_insurance_used":
      return{
        message:event.text,
        metric:"-"+noticeMoney(data.discount),
        details:[
          "原租金 "+noticeMoney(data.requested),
          "保險後 "+noticeMoney(data.amount)
        ]
      };

    case"central_development":
      return{
        message:event.text,
        metric:"LV."+data.level,
        details:[data.tileName??"地產"]
      };

    case"game_complete":{
      const rankings=Array.isArray(data.rankings)?data.rankings:[];
      const champion=rankings.find(item=>item.rank===1);
      return{
        message:event.text,
        metric:champion?"#1 "+champion.playerName:"ROUND "+(data.round??state.round),
        details:rankings.slice(0,4).map(item=>
          "#"+item.rank+" "+item.playerName+"｜總資產 "+noticeMoney(item.total)+
          "（現金 "+noticeMoney(item.cash)+"／地產 "+noticeMoney(item.properties)+
          "／股票 "+noticeMoney(item.stocks)+
          (Number(item.bankDeposit)>0?"／定存 "+noticeMoney(item.bankDeposit):"")+"）"
        )
      };
    }

    default:
      return{message:event.text,metric:null,details:[]};
  }
}

function enqueueActionNotice(event){
  noticeQueue.push(event);
  pumpActionNotice();
}

function pumpActionNotice(){
  if(noticeActive||noticeQueue.length===0)return;
  noticeActive=true;

  const event=noticeQueue.shift();
  const config=noticeConfig(event);
  const source=noticeCardSources(config);
  const view=noticeView(event);
  const node=document.createElement("div");
  node.className=
    "action-toast action-toast--"+event.kind+
    " action-toast--"+config.tone+
    (config.major?" action-toast--major":"")+
    (config.market?" action-toast--market":"")+
    (view.metric?" action-toast--has-metric":"");

  node.innerHTML=
    '<picture class="action-toast__card-bg" aria-hidden="true">'+
      '<img src="'+source.desktop+'" alt="">'+
    '</picture>'+
    '<img class="action-toast__fx" src="'+config.effect+'" alt="">'+
    (config.major&&config.tone==="gold"?'<img class="action-toast__sparkle" src="'+UI_ASSETS.notification.effects.sparkleGold+'" alt="">':"")+
    '<div class="action-toast__content">'+
      '<img class="action-toast__icon" src="'+config.icon+'" alt="">'+
      '<div class="action-toast__copy">'+
        '<strong></strong>'+
        '<p></p>'+
        '<div class="action-toast__details"></div>'+
      '</div>'+
      (view.metric?'<div class="action-toast__metric"></div>':"")+
    '</div>';

  node.querySelector("strong").textContent=config.title;
  node.querySelector("p").textContent=view.message;

  const details=node.querySelector(".action-toast__details");
  for(const detail of view.details){
    const chip=document.createElement("span");
    chip.textContent=detail;
    details.appendChild(chip);
  }

  const metric=node.querySelector(".action-toast__metric");
  if(metric)metric.textContent=view.metric;

  actionToastStack.replaceChildren(node);

  requestAnimationFrame(()=>node.classList.add("show"));

  const hold=config.major?2400:config.market?1500:1850;
  setTimeout(()=>{
    let finished=false;
    const finish=()=>{
      if(finished)return;
      finished=true;
      node.removeEventListener("transitionend",onTransitionEnd);
      node.remove();
      noticeActive=false;
      pumpActionNotice();
    };
    const onTransitionEnd=event=>{
      if(event.target===node&&event.propertyName==="opacity")finish();
    };
    node.addEventListener("transitionend",onTransitionEnd);
    node.classList.add("leaving");
    node.classList.remove("show");
    setTimeout(finish,460);
  },hold);
}

function processActionToasts(){
  const events=(state.events??[])
    .filter(event=>(Number(event.id)||0)>lastToastEventId)
    .sort((a,b)=>a.id-b.id);

  if(events.length){
    lastToastEventId=Math.max(lastToastEventId,...events.map(event=>Number(event.id)||0));
  }

  for(const event of events){
    if(ACTION_TOAST_KINDS.has(event.kind))enqueueActionNotice(event);
  }
}

function sleep(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

function tileCenter(index){
  const tile=document.querySelector('.tile[data-index="'+index+'"]');
  if(!tile)return null;
  const boardRect=board.getBoundingClientRect();
  const rect=tile.getBoundingClientRect();
  return{
    left:rect.left-boardRect.left+rect.width/2,
    top:rect.top-boardRect.top+rect.height/2
  };
}

async function animateMoveEvent(event){
  const seat=Number(event.data?.seat);
  const path=Array.isArray(event.data?.path)?event.data.path:[];
  const from=Number(event.data?.from);
  if(!Number.isInteger(seat)||!Number.isInteger(from)||path.length===0)return;

  const start=tileCenter(from);
  if(!start)return;

  const layer=document.getElementById("boardCharacterLayer");
  if(!layer)return;

  const moving=document.createElement("img");
  moving.className="moving-character";
  moving.src=characterAsset(state.players[seat]??seat,"idle");
  moving.alt="";
  moving.style.left=start.left+"px";
  moving.style.top=start.top+"px";
  layer.appendChild(moving);

  document.body.classList.add("board-motion-active");
  board.classList.add("moving-seat-"+seat);
  try{
    await sleep(35);

    for(let i=0;i<path.length;i++){
      const point=tileCenter(path[i]);
      if(!point)continue;
      moving.src=characterAsset(state.players[seat]??seat,i%2===0?"walkA":"walkB");
      moving.classList.add("walking");
      moving.style.left=point.left+"px";
      moving.style.top=point.top+"px";
      await sleep(65);
    }

    moving.classList.remove("walking");
    moving.classList.add("jumping");
    moving.src=characterAsset(state.players[seat]??seat,"jump");
    await sleep(180);
    moving.src=characterAsset(state.players[seat]??seat,"idle");
    await sleep(70);
  }finally{
    moving.remove();
    board.classList.remove("moving-seat-"+seat);
    document.body.classList.remove("board-motion-active");
  }
}

function processMoveAnimations(){
  const moves=(state.events??[])
    .filter(event=>event.kind==="move"&&(Number(event.id)||0)>lastMoveEventId)
    .sort((a,b)=>a.id-b.id);

  if(moves.length){
    lastMoveEventId=Math.max(lastMoveEventId,...moves.map(event=>Number(event.id)||0));
  }

  for(const event of moves){
    movementQueue=movementQueue.then(()=>animateMoveEvent(event)).catch(()=>{});
  }
}

function onEngineChange(nextState){
  state=nextState;
  renderAll();

  if(network.mode==="host"){
    saveHostSnapshot(network.roomCode,state);
    network.broadcastState(state);
  }

  scheduleAi();
}

const engine=new GameEngine(state,onEngineChange);

const network=new PeerNetwork({
  onStatus:status=>{
    uiContext.networkMode=network.mode;
    setNetworkStatus(status.text,status.kind);
    renderNetworkUi();
  },
  onState:snapshot=>{
    if(network.mode!=="guest")return;
    state=hydrateState(snapshot);
    engine.state=state;
    uiContext.localSeat=network.localSeat;
    uiContext.networkMode="guest";
    if(initialGuestStatePending){
      resetToastTracker(state);
      initialGuestStatePending=false;
    }
    renderAll();
  },
  onJoin:({clientId,playerName,characterIndex})=>{
    const existing=state.players.find(player=>player.kind==="human"&&player.clientId===clientId);
    const displayName=existing?.name??uniqueLobbyPlayerName(playerName,clientId);
    let seat=existing?.seat??null;

    if(seat==null){
      if(state.gameStatus!=="lobby"){
        return{ok:false,error:"遊戲已開始，只允許原玩家重新連線。"};
      }
      const chosenCharacter=Math.max(0,Math.min(3,Math.floor(Number(characterIndex)||0)));
      const usedByHuman=state.players.some(player=>
        player.kind==="human"&&
        player.clientId!==clientId&&
        player.characterIndex===chosenCharacter
      );
      if(usedByHuman){
        return{ok:false,error:"這個角色已被其他玩家選走，請換一個角色再加入。"};
      }
      const available=state.players.find(player=>player.seat!==0&&player.kind==="ai");
      if(!available)return{ok:false,error:"房間已滿。"};
      seat=available.seat;
      setHumanSeat(state,seat,{
        name:displayName,
        clientId,
        connected:true,
        characterIndex:chosenCharacter
      });
      engine.log(displayName+" 加入房間，座位 "+(seat+1)+"。","network_join",{seat});
    }else{
      setHumanSeat(state,seat,{
        name:displayName,
        clientId,
        connected:true,
        characterIndex:existing.characterIndex
      });
      engine.log(displayName+" 已重新連回座位 "+(seat+1)+"。","network_reconnect",{seat});
      const timer=disconnectTimers.get(seat);
      if(timer){
        clearTimeout(timer);
        disconnectTimers.delete(seat);
      }
    }

    engine.notify();
    return{ok:true,seat,state};
  },
  onAction:({seat,action})=>{
    return executeAction(action,seat);
  },
  onDisconnect:({seat,clientId})=>{
    const player=state.players[seat];
    if(!player||player.clientId!==clientId)return;
    player.connected=false;
    engine.log(player.name+" 暫時斷線，保留座位 20 秒等待重新連線。","network_disconnect",{seat});
    engine.notify();

    const previous=disconnectTimers.get(seat);
    if(previous)clearTimeout(previous);

    const timer=setTimeout(()=>{
      const current=state.players[seat];
      if(current?.kind==="human"&&current.clientId===clientId&&current.connected===false){
        const oldName=current.name;
        setAiSeat(state,seat);
        current.name=oldName+" AI代理";
        engine.log(oldName+" 未在期限內重新連線，該座位由 AI 接手。","network_ai_takeover",{seat});
        engine.notify();
      }
      disconnectTimers.delete(seat);
    },20000);
    disconnectTimers.set(seat,timer);
  }
});

const minigameUi=new MinigameUI({
  dialog:document.getElementById("minigameDialog"),
  arena:document.getElementById("minigameArena"),
  title:document.getElementById("minigameTitle"),
  subtitle:document.getElementById("minigameSubtitle"),
  timer:document.getElementById("minigameTimer"),
  scoreboard:document.getElementById("minigameScoreboard"),
  onSubmit:result=>dispatchAction({
    type:"minigame_result",
    score:result.score,
    detail:result.detail
  })
});

function executeAction(action,seat=currentLocalSeat()){
  if(!action||typeof action!=="object")return false;

  switch(action.type){
    case"roll":
      return engine.roll(seat);
    case"buy_property":
      return engine.buyCurrentProperty(seat);
    case"decline_property":
      return engine.declineCurrentProperty(seat);
    case"upgrade_property":
      return engine.upgradeProperty(action.tileIndex,seat);
    case"property_permit_upgrade":
      return engine.usePropertyPermit(action.tileIndex,seat);
    case"property_protection_apply":
      return engine.usePropertyProtection(action.tileIndex,seat);
    case"item_use":
      return engine.useStrategyItem(action.itemId,action.target,seat);
    case"decline_upgrade":
      return engine.declineUpgrade(seat);
    case"buy_stock":
      return engine.buyStock(action.stockId,action.shares,seat);
    case"sell_stock":
      return engine.sellStock(action.stockId,action.shares,seat);
    case"minigame_result":
      return engine.submitMinigameResult(seat,{score:action.score,detail:action.detail});
    case"transport_travel":
      return engine.useTransport(action.destinationIndex,seat);
    case"transport_action":
      return engine.useTransportAction(action.actionId,seat);
    case"transport_skip":
      return engine.skipTransport(seat);
    case"world_choice_select":
      return engine.resolveWorldChoice(action.optionId,seat);
    case"acquisition_buy":
      return engine.acquireFromCenter(action.tileIndex,seat);
    case"acquisition_skip":
      return engine.skipAcquisition(seat);
    case"urban_move":
      return engine.useUrban(action.destinationIndex,seat);
    case"urban_skip":
      return engine.skipUrban(seat);
    case"central_bank_deposit":
      return engine.centralBankDeposit(seat,action.principal);
    case"central_mission_accept":
      return engine.centralAcceptMission(action.missionId,seat);
    case"central_transit":
      return engine.centralTransit(action.distance,seat);
    case"central_insurance":
      return engine.centralActivateInsurance(seat);
    case"central_development":
      return engine.centralDevelopmentUpgrade(action.tileIndex,seat);
    case"end_turn":
      return engine.endTurn(seat);
    default:
      return false;
  }
}

function dispatchAction(action){
  if(network.mode==="guest"){
    return network.sendAction(action);
  }
  return executeAction(action,currentLocalSeat());
}

function renderStocks(){
  const containers=[
    document.getElementById("stockMarketDesktopGrid"),
    document.getElementById("stockMarketMobileGrid")
  ].filter(Boolean);

  containers.forEach(container=>{
    renderStockMarket(
      container,
      state,
      currentLocalSeat(),
      {
        onBuy:(stockId,shares)=>dispatchAction({type:"buy_stock",stockId,shares}),
        onSell:(stockId,shares)=>dispatchAction({type:"sell_stock",stockId,shares})
      }
    );
  });
}

function renderNetworkUi(){
  const seatList=document.getElementById("networkSeatList");
  seatList.innerHTML=state.players.map(player=>{
    const status=player.kind==="ai"
      ? "AI｜"+(player.aiProfile??"balanced")
      : player.connected===false
        ? "真人｜重新連線等待中"
        : "真人｜已連線";
    const badge=player.kind==="ai"
      ? UI_ASSETS.badges.autoFill
      : UI_ASSETS.badges.player;
    return '<div class="network-seat-row">'+
      '<span style="--player-color:'+player.color+'"></span>'+
      '<img class="network-seat-badge" src="'+badge+'" alt="">'+
      '<strong>座位 '+(player.seat+1)+"｜"+player.name+'</strong>'+
      '<em>'+status+'</em>'+
    '</div>';
  }).join("");

  const startButton=document.getElementById("startRoomGameButton");
  const localHost=isLocalRoomHost();
  const startable=canStartRoomGame();
  startButton.disabled=!startable;
  startButton.textContent=localHost
    ?(startable?"開始遊戲":state.gameStatus==="playing"?"遊戲進行中":"開始遊戲")
    :(state.gameStatus==="lobby"||state.phase==="lobby"?"等待房主開始":"遊戲進行中");

  const connected=network.mode!=="offline";
  const createButton=document.getElementById("createRoomButton");
  const joinButton=document.getElementById("joinRoomButton");
  const leaveButton=document.getElementById("leaveRoomButton");
  if(createButton)createButton.disabled=connected;
  if(joinButton)joinButton.disabled=connected;
  leaveButton.disabled=!connected;

  const activeRoomPlaying=connected&&state.gameStatus==="playing"&&Boolean(state.network?.roomCode);
  if(activeRoomPlaying&&networkDialog.open)networkDialog.close();

  const roomInput=document.getElementById("networkRoomCode");
  const roomHero=document.getElementById("roomCodeHero");
  const roomDisplay=document.getElementById("networkRoomCodeDisplay");
  if(network.roomCode){
    roomInput.value=network.roomCode;
    roomDisplay.textContent=network.roomCode;
    roomHero.hidden=false;
  }else{
    roomDisplay.textContent="------";
    roomHero.hidden=true;
  }

  const lobbyCard=document.getElementById("networkLobbyCard");
  const lobbyRoomCode=document.getElementById("networkLobbyRoomCode");
  const lobbySummary=document.getElementById("networkLobbySummary");
  const lobbyStartButton=document.getElementById("networkLobbyStartButton");
  const lobbyActive=network.mode!=="offline"&&(state.gameStatus==="lobby"||state.phase==="lobby");
  document.querySelector(".hud-panel")?.classList.toggle("has-network-lobby",lobbyActive);
  networkDialog.classList.toggle("is-room-lobby",lobbyActive);

  const networkDialogTitle=document.getElementById("networkDialogTitle");
  const networkDialogDescription=document.getElementById("networkDialogDescription");
  if(networkDialogTitle){
    networkDialogTitle.textContent=lobbyActive
      ?(isLocalRoomHost()?"好友房等待室":"已加入好友房")
      :"建立或加入好友房";
  }
  if(networkDialogDescription){
    networkDialogDescription.textContent=lobbyActive
      ?(isLocalRoomHost()
        ?"房間會保持等待狀態。請把房號給好友；只有你按下「開始遊戲」才會正式開局。"
        :"已成功進入等待室，請等待房主按下「開始遊戲」。")
      :"建立房間或輸入朋友的 6 位數房號加入。";
  }
  if(lobbyCard){
    lobbyCard.hidden=!lobbyActive;
    if(lobbyActive){
      const humanCount=(state.players??[]).filter(player=>player.kind==="human").length;
      const aiCount=Math.max(0,(state.players?.length??4)-humanCount);
      if(lobbyRoomCode)lobbyRoomCode.textContent=network.roomCode??"------";
      if(lobbySummary){
        lobbySummary.textContent=humanCount+" 真人＋"+aiCount+" AI｜"+
          (isLocalRoomHost()?"你是房主，可直接開始":"已進房，等待房主開始");
      }
      if(lobbyStartButton){
        lobbyStartButton.disabled=!canStartRoomGame();
        lobbyStartButton.textContent=isLocalRoomHost()?"開始遊戲":"等待房主";
      }
    }
  }
}

let openCentralFacilityId=null;

function localCanUseCentral(){
  const seat=currentLocalSeat();
  const player=state.players?.[seat];
  return Boolean(
    player&&
    player.kind==="human"&&
    player.connected!==false&&
    state.gameStatus==="playing"&&
    state.currentPlayer===seat&&
    state.phase==="await-roll"
  );
}

function centralButton(label,detail,disabled,action){
  const button=document.createElement("button");
  button.type="button";
  button.className="central-feature-action";
  button.disabled=Boolean(disabled);
  const strong=document.createElement("strong");
  strong.textContent=label;
  const small=document.createElement("small");
  small.textContent=detail;
  button.append(strong,small);
  if(!disabled)button.addEventListener("click",action,{once:true});
  return button;
}

function renderCentralFacilityBody(id){
  const feature=CENTRAL_FEATURE_BY_ID[id];
  const body=document.getElementById("centralFacilityBody");
  if(!feature||!body)return;

  const seat=currentLocalSeat();
  const player=state.players?.[seat];
  const usable=localCanUseCentral();
  const status=centralFacilityStatus(state,seat,id);

  document.getElementById("centralFacilityTitleText").textContent=feature.name;
  document.getElementById("centralFacilityDescription").textContent=feature.description;
  body.replaceChildren();

  const summary=document.createElement("div");
  summary.className="central-feature-summary";
  const summaryRows=[
    ["狀態",status==="active"?"已啟動":status==="ready"?"可使用":"冷卻／不可用"],
    ["目前現金",noticeMoney(player?.cash??0)],
    ["ROUND",String(state.round)]
  ];
  for(const [label,value] of summaryRows){
    const cell=document.createElement("div");
    const span=document.createElement("span");
    span.textContent=label;
    const strong=document.createElement("strong");
    strong.textContent=value;
    cell.append(span,strong);
    summary.appendChild(cell);
  }
  body.appendChild(summary);

  if(id==="bank"){
    const deposit=player?.centralBankDeposit;
    if(deposit){
      const active=document.createElement("div");
      active.className="central-feature-active";
      active.innerHTML="<strong>2 ROUND 定存進行中</strong><p>本金 "+
        noticeMoney(deposit.principal)+"｜ROUND "+deposit.maturesRound+
        " 到期自動返還 "+noticeMoney(deposit.returnAmount)+"。</p>";
      body.appendChild(active);
    }else{
      const note=document.createElement("p");
      note.className="central-feature-note";
      note.textContent="選擇一種 2 ROUND 定存方案；同一時間只能持有 1 筆定存。";
      body.appendChild(note);
      const actions=document.createElement("div");
      actions.className="central-feature-actions";
      for(const plan of CENTRAL_TEST_TUNING.bankPlans){
        const adjustedReturn=bankReturnAmount(state,plan.principal,plan.returnAmount);
        const returnDetail=adjustedReturn===plan.returnAmount
          ?"2 ROUND 後返還 "+noticeMoney(adjustedReturn)
          :"原方案 "+noticeMoney(plan.returnAmount)+"｜本次城市利率後返還 "+noticeMoney(adjustedReturn);
        actions.appendChild(centralButton(
          "存入 "+noticeMoney(plan.principal),
          returnDetail,
          !usable||player.cash<plan.principal,
          ()=>dispatchAction({type:"central_bank_deposit",principal:plan.principal})
        ));
      }
      body.appendChild(actions);
    }
    return;
  }

  if(id==="mission"){
    const mission=player?.centralMission;
    if(mission){
      const definition=CENTRAL_MISSION_BY_ID[mission.id];
      const active=document.createElement("div");
      active.className="central-feature-active";
      active.innerHTML="<strong>"+(definition?.name??mission.id)+"</strong><p>"+
        (definition?.description??"城市委託進行中")+
        "｜進度 "+mission.progress+"/"+mission.target+
        "｜獎勵 "+noticeMoney(mission.reward)+"</p>";
      body.appendChild(active);
    }else{
      const grid=document.createElement("div");
      grid.className="central-mission-grid";
      for(const missionDef of CENTRAL_MISSIONS){
        const button=document.createElement("button");
        button.type="button";
        button.className="central-mission-card";
        button.disabled=!usable||Number(player?.centralMissionUsedRound)===Number(state.round);
        button.innerHTML="<strong>"+missionDef.name+"</strong><small>"+missionDef.description+
          "<br>完成獎勵 "+noticeMoney(CENTRAL_TEST_TUNING.missionReward)+"</small>";
        if(!button.disabled){
          button.addEventListener("click",()=>dispatchAction({
            type:"central_mission_accept",
            missionId:missionDef.id
          }),{once:true});
        }
        grid.appendChild(button);
      }
      body.appendChild(grid);
    }
    return;
  }

  if(id==="transit"){
    const note=document.createElement("p");
    note.className="central-feature-note";
    note.textContent="快捷通車會取代本回合正常擲骰；抵達目的格後照正常落地規則處理。";
    body.appendChild(note);
    const actions=document.createElement("div");
    actions.className="central-feature-actions";
    const names=new Map([[3,"短線"],[6,"中線"],[9,"長線"]]);
    for(const distance of CENTRAL_TEST_TUNING.transitDistances){
      actions.appendChild(centralButton(
        names.get(distance)+"｜前進 "+distance+" 格",
        "使用後本回合不能再正常擲骰",
        !usable||Number(player?.centralTransitUsedRound)===Number(state.round),
        ()=>{
          const sent=dispatchAction({type:"central_transit",distance});
          if(sent!==false)centralFacilityDialog.close();
        }
      ));
    }
    body.appendChild(actions);
    return;
  }

  if(id==="insurance"){
    if(player?.rentInsuranceActive){
      const active=document.createElement("div");
      active.className="central-feature-active";
      active.innerHTML="<strong>租金保險已啟動</strong><p>下一次踩到其他玩家地產時，應付租金降低 50%；生效後自動解除。</p>";
      body.appendChild(active);
    }else{
      const note=document.createElement("p");
      note.className="central-feature-note";
      note.textContent="Alpha 28 測試值：下一次他人地產租金降低 50%，每 ROUND 最多啟動一次。";
      body.appendChild(note);
      const actions=document.createElement("div");
      actions.className="central-feature-actions";
      actions.appendChild(centralButton(
        "啟動租金保險",
        "下一次租金 ×0.5",
        !usable||Number(player?.rentInsuranceUsedRound)===Number(state.round),
        ()=>dispatchAction({type:"central_insurance"})
      ));
      body.appendChild(actions);
    }
    return;
  }

  if(id==="development"){
    const options=centralDevelopmentOptions(state,seat);
    if(!options.length){
      const empty=document.createElement("p");
      empty.className="central-feature-note";
      empty.textContent="目前沒有可升級的持有地產。建案沿用既有最高 LV.2 與升級價格規則。";
      body.appendChild(empty);
      return;
    }
    const grid=document.createElement("div");
    grid.className="central-development-grid";
    for(const option of options){
      const button=document.createElement("button");
      button.type="button";
      button.className="central-development-card";
      button.disabled=!usable||!option.affordable||Number(player?.centralDevelopmentUsedRound)===Number(state.round);
      button.innerHTML="<strong>"+option.tileName+"｜LV."+option.level+" → LV."+(option.level+1)+"</strong>"+
        "<small>"+option.group+"｜建案費 "+noticeMoney(option.cost)+
        (option.affordable?"":"｜現金不足")+"</small>";
      if(!button.disabled){
        button.addEventListener("click",()=>dispatchAction({
          type:"central_development",
          tileIndex:option.tileIndex
        }),{once:true});
      }
      grid.appendChild(button);
    }
    body.appendChild(grid);
  }
}

function renderCentralFacilities(){
  const seat=currentLocalSeat();
  document.querySelectorAll("[data-central-facility]").forEach(button=>{
    const id=button.dataset.centralFacility;
    const status=centralFacilityStatus(state,seat,id);
    button.dataset.status=status;
    button.classList.toggle("is-selected",centralFacilityDialog.open&&openCentralFacilityId===id);
    const badge=button.querySelector("[data-central-status]");
    if(badge){
      const label=status==="active"?"已啟動":status==="ready"?"可使用":"冷卻中";
      badge.dataset.status=status;
      badge.textContent=label;
      badge.setAttribute("aria-label",label);
    }
  });

  if(centralFacilityDialog.open&&openCentralFacilityId){
    renderCentralFacilityBody(openCentralFacilityId);
  }
}

function openCentralFacility(id){
  const feature=CENTRAL_FEATURE_BY_ID[id];
  if(!feature)return;
  openCentralFacilityId=id;
  renderCentralFacilityBody(id);
  renderCentralFacilities();
  if(!centralFacilityDialog.open)centralFacilityDialog.showModal();
}

function renderUrbanDialog(){
  const pending=state.pendingUrban;
  const localSeat=currentLocalSeat();
  const player=state.players?.[localSeat];
  const shouldShow=Boolean(
    urbanDialog&&
    state.phase==="urban"&&
    pending&&
    pending.seat===localSeat&&
    player?.kind==="human"&&
    player.connected!==false
  );

  if(!shouldShow){
    if(urbanDialog?.open)urbanDialog.close();
    return;
  }

  const list=document.getElementById("urbanDestinationList");
  list.replaceChildren();
  for(const destinationIndex of pending.destinationIndexes??[]){
    const tile=state.tiles?.[destinationIndex];
    if(!tile)continue;
    const button=document.createElement("button");
    button.type="button";
    button.className="urban-destination";
    button.dataset.destinationIndex=String(destinationIndex);

    const title=document.createElement("strong");
    title.textContent=tile.name;
    const meta=document.createElement("span");
    meta.textContent=tile.group+"｜LV."+tile.level+"｜第 "+(destinationIndex+1)+" 格";
    button.append(title,meta);
    button.addEventListener("click",()=>{
      dispatchAction({type:"urban_move",destinationIndex});
    },{once:true});
    list.appendChild(button);
  }

  if(!urbanDialog.open)urbanDialog.showModal();
}

function renderAcquisitionDialog(){
  const pending=state.pendingAcquisition;
  const localSeat=currentLocalSeat();
  const player=state.players?.[localSeat];
  const shouldShow=Boolean(
    acquisitionDialog&&
    state.phase==="acquisition"&&
    pending&&
    pending.seat===localSeat&&
    player?.kind==="human"&&
    player.connected!==false
  );

  if(!shouldShow){
    if(acquisitionDialog?.open)acquisitionDialog.close();
    return;
  }

  if(itemPromptDialog?.open)itemPromptDialog.close();
  if(featureDialog?.open)featureDialog.close();
  if(propertyInfoDialog?.open)propertyInfoDialog.close();

  const landingOffer=pending.source==="landing";
  acquisitionDialog.classList.toggle("is-landing-acquisition",landingOffer);
  const title=document.getElementById("acquisitionTitle");
  if(title)title.textContent=landingOffer?"取得強制收購權｜要不要收購？":"強制收購";
  const eyebrow=document.getElementById("acquisitionEyebrow");
  const description=document.getElementById("acquisitionDescription");
  const summaryNote=document.getElementById("acquisitionSummaryNote");
  if(eyebrow)eyebrow.textContent=landingOffer?"踩到對手地產｜你來決定":"收購中心";
  if(description){
    description.textContent=landingOffer
      ?"已支付過路費。你現在取得這塊地的強制收購權：對手不能拒絕，但是否收購完全由你決定。"
      :"使用既有規則：符合條件的對手地產，以目前資產估值的 125% 報價收購。";
  }
  if(summaryNote){
    summaryNote.textContent=landingOffer
      ?"收購價＝目前資產估值 ×125%。確認後會轉移地產並免費自動升 1 級（最高 LV.2）；也可以選擇這次不收購。"
      :"符合條件的收購成交後會免費自動升 1 級；滿級 LV.2 或受保護地產不可強制收購。";
  }

  document.getElementById("acquisitionCash").textContent=noticeMoney(player.cash);
  const list=document.getElementById("acquisitionOptionList");
  list.replaceChildren();

  for(const option of pending.options??[]){
    const button=document.createElement("button");
    button.type="button";
    button.className="acquisition-option";
    if(landingOffer)button.classList.add("acquisition-option--confirm");
    button.disabled=!option.affordable;
    button.dataset.tileIndex=String(option.tileIndex);

    const heading=document.createElement("span");
    heading.className="acquisition-option__heading";
    const title=document.createElement("strong");
    title.textContent=option.tileName;
    const badge=document.createElement("b");
    badge.textContent="LV."+option.level+" → LV."+option.levelAfterAcquisition;
    heading.append(title,badge);

    const meta=document.createElement("span");
    meta.className="acquisition-option__meta";
    meta.textContent=option.group+"｜持有人 "+option.ownerName;

    const offer=document.createElement("span");
    offer.className="acquisition-option__offer";
    offer.textContent=landingOffer
      ?"確認收購這塊地｜"+noticeMoney(option.offer)
      :"收購價 "+noticeMoney(option.offer);

    const status=document.createElement("small");
    status.textContent=landingOffer
      ?(option.affordable
        ?"按下後成交並自動升 1 級；對手無法拒絕"
        :"現金不足，無法執行收購")
      :(option.affordable?"可收購":"現金不足");

    button.setAttribute(
      "aria-label",
      landingOffer
        ?"確認收購 "+option.tileName+"，價格 "+noticeMoney(option.offer)+"，收購後升至 LV."+option.levelAfterAcquisition
        :"收購 "+option.tileName
    );
    button.append(heading,meta,offer,status);
    if(option.affordable){
      button.addEventListener("click",()=>{
        dispatchAction({type:"acquisition_buy",tileIndex:option.tileIndex});
      },{once:true});
    }
    list.appendChild(button);
  }

  const skipButton=document.getElementById("skipAcquisitionButton");
  const skipIconButton=document.getElementById("skipAcquisitionIconButton");
  if(skipButton){
    skipButton.textContent=landingOffer
      ?"不要收購，保留現金並繼續遊戲"
      :"這次不收購";
  }
  if(skipIconButton){
    skipIconButton.setAttribute(
      "aria-label",
      landingOffer?"不要收購，關閉強制收購權":"放棄收購"
    );
  }

  if(!acquisitionDialog.open)acquisitionDialog.showModal();
}

function renderTransportDialog(){
  const pending=state.pendingTransport;
  const localSeat=currentLocalSeat();
  const player=state.players?.[localSeat];
  const shouldShow=Boolean(
    transportDialog&&
    state.phase==="transport"&&
    pending&&
    pending.seat===localSeat&&
    player?.kind==="human"&&
    player.connected!==false
  );

  if(!shouldShow){
    if(transportDialog?.open)transportDialog.close();
    return;
  }

  const source=TRANSPORT_NODE_BY_INDEX[pending.sourceIndex];
  document.getElementById("transportTitle").textContent=source?.name??"交通樞紐";
  document.getElementById("transportSubtitle").textContent=source?.description??"選擇本交通樞紐的一項功能。";
  document.getElementById("transportSourceName").textContent=(source?.icon?source.icon+" ":"")+(source?.name??"交通設施");
  const note=document.getElementById("transportSourceNote");
  if(note){
    note.textContent=pending.status==="free_day"
      ?"交通免費日生效：本次所有原本需要付費的交通選項皆免費。"
      :"每個交通節點功能不同；選擇後會立即結算，也可以本次不用。";
  }

  const list=document.getElementById("transportDestinationList");
  list.replaceChildren();

  for(const action of pending.actions??[]){
    const button=document.createElement("button");
    button.type="button";
    button.className="transport-destination transport-destination--action";
    button.dataset.actionId=String(action.id);
    const cost=Math.max(0,Math.round(Number(action.cost)||0));
    button.disabled=player.cash<cost;

    const icon=document.createElement("span");
    icon.className="transport-destination__icon";
    icon.textContent=action.icon??source?.icon??"🚇";

    const copy=document.createElement("span");
    copy.className="transport-destination__copy";
    const title=document.createElement("strong");
    title.textContent=action.label;
    const meta=document.createElement("small");
    if(action.freeDay&&Number(action.originalCost)>0){
      meta.textContent="原價 "+noticeMoney(action.originalCost)+"｜交通免費日：免費";
    }else{
      meta.textContent=cost>0?"費用 "+noticeMoney(cost):"本次免費";
    }
    const strategy=document.createElement("small");
    strategy.className="transport-destination__strategy";
    strategy.textContent=action.description+(button.disabled?"｜現金不足":"");
    copy.append(title,meta,strategy);

    button.append(icon,copy);
    if(!button.disabled){
      button.addEventListener("click",()=>{
        dispatchAction({type:"transport_action",actionId:action.id});
      },{once:true});
    }
    list.appendChild(button);
  }

  if(!transportDialog.open)transportDialog.showModal();
}

function renderWorldEventStatus(){
  const container=document.getElementById("worldEventStatus");
  if(!container)return;
  const items=worldStatusSummary(state);
  container.replaceChildren();

  const heading=document.createElement("strong");
  heading.textContent="進行中的城市效果";
  container.appendChild(heading);

  if(items.length===0){
    const empty=document.createElement("span");
    empty.className="world-event-status__empty";
    empty.textContent="目前沒有持續中的城市事件或限時標案。";
    container.appendChild(empty);
    container.classList.remove("active");
    return;
  }

  container.classList.add("active");
  const list=document.createElement("div");
  list.className="world-event-status__list";
  for(const item of items){
    const badge=document.createElement("span");
    badge.textContent=item;
    list.appendChild(badge);
  }
  container.appendChild(list);
}

function renderWorldChoiceDialog(){
  const pending=state.pendingWorldChoice;
  const localSeat=currentLocalSeat();
  const player=state.players?.[localSeat];
  const shouldShow=Boolean(
    worldChoiceDialog&&
    state.phase==="world_choice"&&
    pending&&
    pending.seat===localSeat&&
    player?.kind==="human"&&
    player.connected!==false
  );

  if(!shouldShow){
    if(worldChoiceDialog?.open)worldChoiceDialog.close();
    return;
  }

  if(itemPromptDialog?.open)itemPromptDialog.close();
  if(featureDialog?.open)featureDialog.close();
  if(propertyInfoDialog?.open)propertyInfoDialog.close();

  document.getElementById("worldChoiceTitle").textContent=pending.title??pending.eventName??"事件選擇";
  document.getElementById("worldChoiceDescription").textContent=pending.description??"請選擇本次事件的處理方式。";
  document.getElementById("worldChoiceCash").textContent=noticeMoney(player.cash);

  const list=document.getElementById("worldChoiceOptionList");
  list.replaceChildren();
  for(const option of pending.options??[]){
    const cost=Math.max(0,Math.round(Number(option.cost)||0));
    const button=document.createElement("button");
    button.type="button";
    button.className="world-choice-option";
    button.dataset.optionId=String(option.id);
    button.disabled=option.enabled===false||player.cash<cost;

    const title=document.createElement("strong");
    title.textContent=option.label;
    const description=document.createElement("span");
    description.textContent=option.description??"";
    const meta=document.createElement("small");
    meta.textContent=button.disabled
      ? "目前條件不足"
      : cost>0
        ? "確認後支付 "+noticeMoney(cost)
        : "不需支付現金";
    button.append(title,description,meta);
    if(!button.disabled){
      button.addEventListener("click",()=>{
        dispatchAction({type:"world_choice_select",optionId:option.id});
      },{once:true});
    }
    list.appendChild(button);
  }

  if(!worldChoiceDialog.open)worldChoiceDialog.showModal();
}

function maybePromptStrategyItems(){
  if(!itemPromptDialog||itemPromptDialog.open||featureDialog?.open)return;
  if(
    state.pendingPurchase!=null||
    state.pendingUpgrade!=null||
    state.pendingAcquisition||
    state.pendingUrban||
    state.pendingTransport||
    state.pendingWorldChoice||
    state.phase==="world_choice"||
    state.phase==="minigame"||
    purchaseDialog?.open||
    upgradeDialog?.open||
    acquisitionDialog?.open||
    urbanDialog?.open||
    transportDialog?.open||
    worldChoiceDialog?.open
  )return;
  const seat=currentLocalSeat();
  const player=state.players?.[seat];
  if(
    !player||
    player.kind!=="human"||
    player.connected===false||
    state.gameStatus!=="playing"||
    state.currentPlayer!==seat
  )return;

  const summary=itemUiSummary(state,player);
  if(summary.usable.length===0)return;
  const key=state.turnToken+":"+state.phase+":"+summary.usable.map(item=>item.id).join(",");
  if(lastItemPromptKey===key)return;

  lastItemPromptKey=key;
  const names=summary.usable.slice(0,3).map(item=>item.name).join("、");
  document.getElementById("itemPromptText").textContent=
    "目前可使用："+names+(summary.usable.length>3?" 等 "+summary.usable.length+" 種":"")+"。";
  itemPromptDialog.showModal();
}

function renderAll(){
  uiContext.networkMode=network.mode;
  render(state,{
    localSeat:currentLocalSeat(),
    networkMode:network.mode
  });
  renderStocks();
  renderNetworkUi();
  renderCentralFacilities();
  renderWorldEventStatus();
  renderUrbanDialog();
  renderAcquisitionDialog();
  renderTransportDialog();
  renderWorldChoiceDialog();
  minigameUi.sync(state,currentLocalSeat());
  processMoveAnimations();
  processActionToasts();
  maybePromptStrategyItems();
}

function scheduleAi(){
  if(aiTimer){
    clearTimeout(aiTimer);
    aiTimer=null;
  }
  if(network.mode==="guest")return;
  if(state.gameStatus!=="playing")return;

  const current=state.players[state.currentPlayer];
  if(current?.kind!=="ai")return;

  aiTimer=setTimeout(()=>{
    aiTimer=null;
    engine.runAiStep();
  },1100);
}

function setPropertyInfoValue(id,value){
  const node=document.getElementById(id);
  if(node)node.textContent=value;
}

function openPropertyInfo(tileIndex){
  const index=Number(tileIndex);
  const tile=state.tiles?.[index];
  if(!tile||tile.type!=="property")return;

  const viewer=state.players?.[currentLocalSeat()]??state.players?.[0];
  const owner=tile.owner!=null?state.players?.[tile.owner]:null;
  const value=propertyValue(tile);
  const currentRent=rentFor(state,tile);
  const maxLevel=tile.level>=MAX_PROPERTY_LEVEL;
  const nextLevel=maxLevel?null:tile.level+1;
  const nextRent=nextLevel==null?null:rentFor(state,{...tile,level:nextLevel});
  const nextUpgradeCost=maxLevel?null:upgradeCost(tile);
  const progressSeat=owner?.seat??viewer?.seat??0;
  const progress=groupProgress(state,progressSeat,tile.group);
  const progressLabel=(owner?"地主":"你的")+"區域進度 "+progress.owned+"/"+progress.total+
    (progress.complete?"｜已完成連區 ×"+groupRentMultiplier(tile.group):"");

  const opponentOwned=Boolean(owner&&viewer&&owner.seat!==viewer.seat);
  const estimatedOffer=opponentOwned?suggestedAcquisitionOffer(tile):0;
  const forceEligible=opponentOwned&&canForceAcquireProperty(state,index,viewer.seat);

  document.getElementById("propertyInfoTitle").textContent=tile.name;
  document.getElementById("propertyInfoSubtitle").textContent="#"+tile.number+"｜"+tile.group;
  setPropertyInfoValue("propertyInfoPurchasePrice",noticeMoney(tile.price));
  setPropertyInfoValue("propertyInfoAssetValue",noticeMoney(value));
  setPropertyInfoValue("propertyInfoRent",noticeMoney(currentRent));
  setPropertyInfoValue("propertyInfoLevel","LV."+tile.level+" / "+MAX_PROPERTY_LEVEL);
  setPropertyInfoValue(
    "propertyInfoUpgrade",
    maxLevel?"已滿級":noticeMoney(nextUpgradeCost)+" → LV."+nextLevel
  );
  setPropertyInfoValue(
    "propertyInfoNextRent",
    nextRent==null?"—":noticeMoney(nextRent)
  );
  setPropertyInfoValue("propertyInfoOwner",owner?.name??"尚未持有");
  setPropertyInfoValue("propertyInfoRegion",progressLabel);

  const acquisitionValue=document.getElementById("propertyInfoAcquisition");
  const acquisitionNote=document.getElementById("propertyInfoAcquisitionNote");
  if(!owner){
    acquisitionValue.textContent="—";
    acquisitionNote.textContent="目前無地主，可依售價直接購買。";
  }else if(!opponentOwned){
    acquisitionValue.textContent="自己的地產";
    acquisitionNote.textContent="不需要收購。";
  }else{
    const courtProtected=Number(owner?.courtShieldUntilRound)>=Number(state.round);
    const titleProtected=Number(tile.acquisitionProtectedUntilRound)>=Number(state.round);
    acquisitionValue.textContent=noticeMoney(estimatedOffer);
    acquisitionNote.textContent=forceEligible
      ?"預估報價＝目前資產估值 ×1.25；LV."+tile.level+" 可強制收購。實際交易仍依收購/協商流程。"
      :courtProtected
        ?"法院財產保全生效中（至 ROUND "+owner.courtShieldUntilRound+"），目前不可強制收購。"
        :titleProtected
          ?"產權保全生效中（至 ROUND "+tile.acquisitionProtectedUntilRound+"），目前不可強制收購。"
          :"預估報價＝目前資產估值 ×1.25；LV."+tile.level+" 已受滿級保護，不可強制收購，仍可一般協商。";
  }

  if(!propertyInfoDialog.open)propertyInfoDialog.showModal();
}

function openFeature(name){
  const meta={
    property:["我的房產","地產經營中心：查看地產與收租，並使用事件取得的建案許可與產權保全券。"],
    item:["策略道具","符合使用條件時會主動提示。"],
    market:["市場操作","查看即時行情、持股損益並進行買賣。"],
    info:["遊戲資訊","目前格子與事件紀錄。"]
  }[name];
  if(!meta)return;

  document.getElementById("featureDialogTitle").textContent=meta[0];
  document.getElementById("featureDialogSubtitle").textContent=meta[1];
  const headerArt=document.getElementById("featureDialogHeaderArt");
  if(headerArt)headerArt.src=(name==="market"?UI_ASSETS.headers.stock:UI_ASSETS.headers[name])??UI_ASSETS.headers.info;
  document.querySelectorAll("[data-feature-panel]").forEach(panel=>{
    panel.classList.toggle("active",panel.dataset.featurePanel===name);
  });
  renderAll();
  if(!featureDialog.open)featureDialog.showModal();
}

document.querySelectorAll("[data-central-facility]").forEach(button=>{
  button.addEventListener("click",()=>openCentralFacility(button.dataset.centralFacility));
});
document.getElementById("closeCentralFacilityDialog").addEventListener("click",()=>centralFacilityDialog.close());
centralFacilityDialog.addEventListener("close",()=>{
  openCentralFacilityId=null;
  renderCentralFacilities();
});
centralFacilityDialog.addEventListener("click",event=>{
  if(event.target===centralFacilityDialog)centralFacilityDialog.close();
});

document.getElementById("rollButton").addEventListener("click",()=>dispatchAction({type:"roll"}));
const mobileRollButton=document.getElementById("mobileRollButton");
if(mobileRollButton){
  mobileRollButton.addEventListener("click",()=>dispatchAction({type:"roll"}));
}
document.getElementById("confirmPurchaseButton").addEventListener("click",()=>dispatchAction({type:"buy_property"}));
document.getElementById("declinePurchaseButton").addEventListener("click",()=>dispatchAction({type:"decline_property"}));
document.getElementById("confirmUpgradeButton").addEventListener("click",()=>{
  if(state.pendingUpgrade==null)return;
  dispatchAction({type:"upgrade_property",tileIndex:state.pendingUpgrade});
});
document.getElementById("declineUpgradeButton").addEventListener("click",()=>dispatchAction({type:"decline_upgrade"}));
document.getElementById("endTurnButton").addEventListener("click",()=>dispatchAction({type:"end_turn"}));
const desktopEndTurnButton=document.getElementById("desktopEndTurnButton");
if(desktopEndTurnButton){
  desktopEndTurnButton.addEventListener("click",()=>dispatchAction({type:"end_turn"}));
}

board.addEventListener("click",event=>{
  const tileNode=event.target.closest(".tile--property[data-index]");
  if(!tileNode)return;
  openPropertyInfo(tileNode.dataset.index);
});
board.addEventListener("keydown",event=>{
  if(!["Enter"," "].includes(event.key))return;
  const tileNode=event.target.closest(".tile--property[data-index]");
  if(!tileNode)return;
  event.preventDefault();
  openPropertyInfo(tileNode.dataset.index);
});

document.getElementById("closePropertyInfoDialog").addEventListener("click",()=>propertyInfoDialog.close());
propertyInfoDialog.addEventListener("click",event=>{
  if(event.target===propertyInfoDialog)propertyInfoDialog.close();
});

document.getElementById("propertyTabList").addEventListener("click",event=>{
  const permitButton=event.target.closest("[data-property-permit-upgrade]");
  if(permitButton&&!permitButton.disabled){
    dispatchAction({
      type:"property_permit_upgrade",
      tileIndex:Number(permitButton.dataset.propertyPermitUpgrade)
    });
    return;
  }

  const protectionButton=event.target.closest("[data-property-protection]");
  if(protectionButton&&!protectionButton.disabled){
    dispatchAction({
      type:"property_protection_apply",
      tileIndex:Number(protectionButton.dataset.propertyProtection)
    });
  }
});

document.querySelectorAll("[data-feature]").forEach(button=>{
  button.addEventListener("click",()=>openFeature(button.dataset.feature));
});

document.getElementById("itemInventoryList").addEventListener("click",event=>{
  const button=event.target.closest("[data-item-use]");
  if(!button||button.disabled)return;
  const itemId=button.dataset.itemUse;
  const select=document.querySelector('[data-item-target="'+CSS.escape(itemId)+'"]');
  const raw=String(select?.value??"");
  const [kind,...parts]=raw.split(":");
  const value=parts.join(":");
  let target=null;
  if(kind==="tile")target={tileIndex:Number(value)};
  if(kind==="stock")target={stockId:value};
  if(kind==="value")target={value:Number(value)};
  if(!target)return;
  dispatchAction({type:"item_use",itemId,target});
});

document.getElementById("openItemPromptButton").addEventListener("click",()=>{
  itemPromptDialog.close();
  openFeature("item");
});
document.getElementById("dismissItemPromptButton").addEventListener("click",()=>itemPromptDialog.close());
itemPromptDialog.addEventListener("cancel",event=>{
  event.preventDefault();
  itemPromptDialog.close();
});

document.getElementById("closeFeatureDialog").addEventListener("click",()=>featureDialog.close());
featureDialog.addEventListener("click",event=>{
  if(event.target===featureDialog)featureDialog.close();
});

purchaseDialog.addEventListener("cancel",event=>event.preventDefault());
document.getElementById("upgradeDialog").addEventListener("cancel",event=>event.preventDefault());

const skipUrban=()=>dispatchAction({type:"urban_skip"});
document.getElementById("skipUrbanButton").addEventListener("click",skipUrban);
document.getElementById("skipUrbanIconButton").addEventListener("click",skipUrban);
urbanDialog.addEventListener("cancel",event=>event.preventDefault());

const skipAcquisition=()=>dispatchAction({type:"acquisition_skip"});
document.getElementById("skipAcquisitionButton").addEventListener("click",skipAcquisition);
document.getElementById("skipAcquisitionIconButton").addEventListener("click",skipAcquisition);
acquisitionDialog.addEventListener("cancel",event=>event.preventDefault());

const skipTransport=()=>dispatchAction({type:"transport_skip"});
document.getElementById("skipTransportButton").addEventListener("click",skipTransport);
document.getElementById("skipTransportIconButton").addEventListener("click",skipTransport);
transportDialog.addEventListener("cancel",event=>event.preventDefault());
worldChoiceDialog.addEventListener("cancel",event=>event.preventDefault());

document.getElementById("closeNetworkDialog").addEventListener("click",()=>networkDialog.close());
networkDialog.addEventListener("click",event=>{
  if(event.target===networkDialog)networkDialog.close();
});

document.querySelectorAll("[data-character-choice]").forEach(button=>{
  button.addEventListener("click",()=>selectEntryCharacter(button.dataset.characterChoice));
});

document.getElementById("startSoloButton").addEventListener("click",async()=>{
  await network.close(true);
  clearNetworkSession();
  uiContext.localSeat=0;
  uiContext.networkMode="offline";
  state=createInitialState();
  setPlayerCharacter(state,0,selectedCharacterIndex);
  resetToastTracker(state);
  engine.replaceState(state);
  setEntryVisible(false);
  scheduleAi();
});

const startFriendButton=document.getElementById("startFriendButton");
const warmFriendNetwork=()=>{void prewarmNetworkTransport()};
startFriendButton.addEventListener("pointerenter",warmFriendNetwork,{once:true});
startFriendButton.addEventListener("focus",warmFriendNetwork,{once:true});
startFriendButton.addEventListener("click",()=>{
  warmFriendNetwork();
  renderNetworkUi();
  if(!networkDialog.open)networkDialog.showModal();
});

document.getElementById("resumeRoomButton").addEventListener("click",async()=>{
  const restored=await restorePreviousSession();
  if(restored)setEntryVisible(false);
});

document.getElementById("copyRoomCodeButton").addEventListener("click",async()=>{
  if(!network.roomCode)return;
  try{
    await navigator.clipboard.writeText(network.roomCode);
    setNetworkStatus("房號 "+network.roomCode+" 已複製。","success");
  }catch{
    setNetworkStatus("房號："+network.roomCode+"（可長按 / 手動複製）","warning");
  }
});

document.getElementById("createRoomButton").addEventListener("click",async()=>{
  const name=sanitizePlayerName(document.getElementById("networkPlayerName").value);
  const code=createRoomCode();
  const previousState=state;
  const lobbyState=createLobbyState(name,getOrCreateClientId());
  setPlayerCharacter(lobbyState,0,selectedCharacterIndex);
  lobbyState.network.roomCode=code;
  lobbyState.network.hostSeat=0;
  lobbyState.network.hostClientId=getOrCreateClientId();

  state=lobbyState;
  resetToastTracker(state);
  engine.replaceState(state);
  document.getElementById("networkRoomCode").value=code;
  setNetworkStatus("正在建立等待室…");
  renderNetworkUi();

  try{
    const result=await network.host({roomCode:code,playerName:name,characterIndex:selectedCharacterIndex});
    const finalCode=result.roomCode;
    uiContext.localSeat=0;
    uiContext.networkMode="host";
    state.network.roomCode=finalCode;
    state.network.hostSeat=0;
    state.network.hostClientId=getOrCreateClientId();
    engine.replaceState(state);
    document.getElementById("networkRoomCode").value=finalCode;
    setEntryVisible(false);
    setNetworkStatus("房間 "+finalCode+" 已建立，正在等待好友加入。","success");
    renderNetworkUi();
    if(!networkDialog.open)networkDialog.showModal();
  }catch(error){
    await network.close(false);
    uiContext.localSeat=0;
    uiContext.networkMode="offline";
    state=previousState;
    engine.replaceState(state);
    setNetworkStatus("建立房間失敗："+friendlyNetworkError(error),"error");
    renderNetworkUi();
  }
});

document.getElementById("joinRoomButton").addEventListener("click",async()=>{
  const name=sanitizePlayerName(document.getElementById("networkPlayerName").value);
  const code=sanitizeRoomCode(document.getElementById("networkRoomCode").value);
  if(!code){
    setNetworkStatus("請輸入正確的 6 位數房號。","error");
    return;
  }
  setNetworkStatus("正在加入房間 "+code+"…");
  try{
    initialGuestStatePending=true;
    const result=await network.join({
      roomCode:code,
      playerName:name,
      characterIndex:selectedCharacterIndex
    });
    uiContext.localSeat=result.seat;
    uiContext.networkMode="guest";
    setEntryVisible(false);
    renderAll();
    renderNetworkUi();
    if(state.gameStatus==="playing"){
      if(networkDialog.open)networkDialog.close();
    }else{
      setNetworkStatus("已加入房間 "+code+"，等待房主開始遊戲。","success");
      if(!networkDialog.open)networkDialog.showModal();
    }
  }catch(error){
    initialGuestStatePending=false;
    setNetworkStatus("加入房間失敗："+friendlyNetworkError(error),"error");
  }
});

function startRoomGameFromUi(){
  if(!isLocalRoomHost()){
    setNetworkStatus("只有房主可以開始遊戲。","warning");
    renderNetworkUi();
    return;
  }
  if(state.gameStatus!=="lobby"&&state.phase==="lobby"){
    state.gameStatus="lobby";
  }
  const hostSeat=Number(state.network?.hostSeat??0);
  const started=engine.startGame(hostSeat);
  if(!started){
    setNetworkStatus("目前房間狀態無法開始，請重新同步房間後再試一次。","error");
    renderNetworkUi();
    return;
  }
  if(networkDialog.open)networkDialog.close();
  setNetworkStatus("遊戲已開始，好友與 AI 補位已同步進入棋盤。","success");
  renderNetworkUi();
}

document.getElementById("startRoomGameButton").addEventListener("click",startRoomGameFromUi);
document.getElementById("networkLobbyStartButton").addEventListener("click",startRoomGameFromUi);
document.getElementById("networkLobbyManageButton").addEventListener("click",()=>{
  renderNetworkUi();
  if(!networkDialog.open)networkDialog.showModal();
});

document.getElementById("leaveRoomButton").addEventListener("click",async()=>{
  await network.close(true);
  clearNetworkSession();
  for(const timer of disconnectTimers.values())clearTimeout(timer);
  disconnectTimers.clear();
  uiContext.localSeat=0;
  uiContext.networkMode="offline";
  state=createInitialState();
  resetToastTracker(state);
  engine.replaceState(state);
  setNetworkStatus("已離開連線，請重新選擇遊玩模式。","info");
  setEntryVisible(true);
});

setInterval(()=>{
  if(network.mode!=="guest"&&state.phase==="minigame"){
    engine.tick(Date.now());
  }
},500);

async function restorePreviousSession(){
  const saved=loadNetworkSession();
  if(!saved)return false;

  document.getElementById("networkPlayerName").value=saved.playerName;
  document.getElementById("networkRoomCode").value=saved.roomCode;
  setNetworkStatus("偵測到上一個房間，正在嘗試恢復…");

  try{
    if(saved.mode==="host"){
      await network.host({
        roomCode:saved.roomCode,
        playerName:saved.playerName,
        characterIndex:saved.characterIndex
      });
      const snapshot=loadHostSnapshot(saved.roomCode);
      state=hydrateState(snapshot??createLobbyState(saved.playerName,saved.clientId));
      state.network.roomCode=saved.roomCode;
      state.network.hostSeat=0;
      state.network.hostClientId=saved.clientId;
      setHumanSeat(state,0,{
        name:saved.playerName,
        clientId:saved.clientId,
        connected:true,
        characterIndex:saved.characterIndex
      });
      uiContext.localSeat=0;
      uiContext.networkMode="host";
      resetToastTracker(state);
      engine.replaceState(state);
      setNetworkStatus("房主狀態已恢復，房號 "+saved.roomCode+"。","success");
      return true;
    }

    if(saved.mode==="guest"){
      initialGuestStatePending=true;
      const result=await network.join({
        roomCode:saved.roomCode,
        playerName:saved.playerName,
        characterIndex:saved.characterIndex
      });
      uiContext.localSeat=result.seat;
      uiContext.networkMode="guest";
      renderAll();
      return true;
    }
  }catch(error){
    initialGuestStatePending=false;
    setNetworkStatus(
      "恢復失敗，可重新建立或加入房間："+friendlyNetworkError(error),
      "warning"
    );
    uiContext.networkMode="offline";
    renderAll();
  }
  return false;
}

function navigationIsReload(){
  const navigation=performance.getEntriesByType?.("navigation")?.[0];
  return navigation?.type==="reload";
}

async function initializeEntryFlow(){
  renderAll();
  resetToastTracker(state);

  const saved=loadNetworkSession();
  if(saved)selectEntryCharacter(saved.characterIndex);
  const resumeButton=document.getElementById("resumeRoomButton");
  if(saved){
    resumeButton.hidden=false;
    resumeButton.textContent="重新連回房間 "+saved.roomCode;
  }

  if(saved&&navigationIsReload()){
    const restored=await restorePreviousSession();
    if(restored){
      setEntryVisible(false);
      return;
    }
  }

  setEntryVisible(true);
}

initializeEntryFlow();

window.__WEALTH_V20__=Object.freeze({
  get version(){return state.version},
  getState:()=>state,
  getNetworkMode:()=>network.mode
});
