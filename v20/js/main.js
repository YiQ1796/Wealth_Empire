import{createInitialState,createLobbyState,hydrateState,setAiSeat,setHumanSeat,setPlayerCharacter}from"./core/state.js";
import{GameEngine}from"./core/game.js";
import{
  PeerNetwork,
  clearNetworkSession,
  createRoomCode,
  getOrCreateClientId,
  loadHostSnapshot,
  loadNetworkSession,
  sanitizePlayerName,
  sanitizeRoomCode,
  saveHostSnapshot
}from"./core/network.js";
import{characterAsset,mountStaticBoard,render}from"./ui/render.js";
import{renderStockMarket}from"./ui/stock-render.js";
import{UI_ASSETS}from"./data/ui-assets.js";
import{MinigameUI}from"./ui/minigame-ui.js";
import{GROUP_SIZES,MAX_PROPERTY_LEVEL,groupRentMultiplier}from"./data/board.js";
import{canForceAcquireProperty,groupProgress,propertyValue,rentFor,suggestedAcquisitionOffer,upgradeCost}from"./core/property-economy.js";
import{TRANSPORT_NODE_BY_INDEX}from"./data/transport.js";
import{transportDestinationPreview}from"./core/transport.js";
import{
  CENTRAL_FEATURE_BY_ID,
  CENTRAL_MISSIONS,
  CENTRAL_MISSION_BY_ID,
  CENTRAL_TEST_TUNING
}from"./data/central-features.js";
import{centralDevelopmentOptions,centralFacilityStatus}from"./core/central-features.js";

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
const disconnectTimers=new Map();
const ACTION_TOAST_KINDS=new Set([
  "property_buy",
  "property_upgrade",
  "group_complete",
  "rent",
  "stock_buy",
  "stock_sell",
  "market_tick",
  "minigame_complete",
  "network_join",
  "network_reconnect",
  "network_ai_takeover",
  "property_acquisition",
  "bankruptcy",
  "cash",
  "special_event",
  "special_grid",
  "transport_complete",
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
const centralFacilityDialog=document.getElementById("centralFacilityDialog");
const networkDialog=document.getElementById("networkDialog");
const purchaseDialog=document.getElementById("purchaseDialog");
const propertyInfoDialog=document.getElementById("propertyInfoDialog");
const urbanDialog=document.getElementById("urbanDialog");
const acquisitionDialog=document.getElementById("acquisitionDialog");
const transportDialog=document.getElementById("transportDialog");
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
    property_acquisition:{title:"強制收購",icon:N.icons.acquisition,effect:N.effects.red,tone:"red",major:true},
    bankruptcy:{title:"玩家破產",icon:N.icons.bankruptcy,effect:N.effects.red,tone:"red",major:true},
    minigame_complete:{title:"都會挑戰結算",icon:N.icons.minigameResult,effect:N.effects.gold,tone:"gold",major:true},
    game_complete:{title:"遊戲結束",icon:N.icons.victory,effect:N.effects.gold,tone:"gold",major:true},
    stock_buy:{title:"股票買進",icon:N.icons.stockBuy,effect:N.effects.blue,tone:"blue",metric:true},
    stock_sell:{title:"股票賣出",icon:N.icons.stockSell,effect:N.effects.blue,tone:"blue",metric:true},
    market_tick:{title:"市場更新",icon:N.icons.marketTick,effect:N.effects.blue,tone:"blue",market:true},
    network_join:{title:"好友加入",icon:N.icons.network,effect:N.effects.blue,tone:"blue"},
    network_reconnect:{title:"重新連線",icon:N.icons.network,effect:N.effects.green,tone:"green"},
    network_ai_takeover:{title:"AI 接手",icon:N.icons.aiTakeover,effect:N.effects.purple,tone:"purple"},
    transport_complete:{title:"快速通車",icon:N.icons.network,effect:N.effects.blue,tone:"blue",major:true},
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
      details.push("支付 "+noticeMoney(data.amount));
      if(Number(data.requested)!==Number(data.amount))details.push("原應付 "+noticeMoney(data.requested));
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
              : "事件";
      const details=[];
      if(data.effectKind==="cash"&&Number.isFinite(Number(data.cashAfter))){
        details.push("事件後現金 "+noticeMoney(data.cashAfter));
      }
      if(data.effectKind==="move"){
        details.push("位置 "+(Number(data.from)+1)+" → "+(Number(data.to)+1));
      }
      return{message:event.text,metric,details};
    }

    case"special_grid":{
      const labels={
        tax:"稅務抵免",
        court:"財產保全",
        hospital:"醫療保護"
      };
      return{
        message:event.text,
        metric:labels[data.type]??"特殊效果",
        details:data.untilRound?["保護至 ROUND "+data.untilRound]:[]
      };
    }

    case"urban_complete":
      return{
        message:(data.playerName??"玩家")+" 完成城市更新重新部署",
        metric:"#"+(Number(data.to)+1),
        details:[data.tileName?"移動至 "+data.tileName:""]
      };

    case"transport_complete":
      return{
        message:(data.playerName??"玩家")+" 完成交通轉乘",
        metric:"抵達",
        details:[
          (data.sourceName??"交通設施")+" → "+(data.destinationName??"目的地"),
          "本次轉乘不連鎖觸發第二次交通"
        ]
      };

    case"market_tick":{
      const movers=Array.isArray(data.movers)?data.movers:[];
      return{
        message:data.type==="market"
          ?"股市事件｜全市場立即重新漲跌"
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

    case"game_complete":
      return{
        message:event.text,
        metric:"ROUND "+(data.round??state.round),
        details:[]
      };

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
    '<picture class="action-toast__card-bg">'+
      '<source media="(orientation:landscape) and (max-height:650px) and (max-width:1180px), (max-width:760px)" srcset="'+source.mobile+'">'+
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

  const hold=config.major?2350:config.market?1350:1750;
  setTimeout(()=>{
    node.classList.remove("show");
    setTimeout(()=>{
      node.remove();
      noticeActive=false;
      pumpActionNotice();
    },260);
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
        name:playerName,
        clientId,
        connected:true,
        characterIndex:chosenCharacter
      });
      engine.log(playerName+" 加入房間，座位 "+(seat+1)+"。","network_join",{seat});
    }else{
      setHumanSeat(state,seat,{
        name:playerName,
        clientId,
        connected:true,
        characterIndex:existing.characterIndex
      });
      engine.log(playerName+" 已重新連回座位 "+(seat+1)+"。","network_reconnect",{seat});
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
    executeAction(action,seat);
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
    case"buy_stock":
      return engine.buyStock(action.stockId,action.shares,seat);
    case"sell_stock":
      return engine.sellStock(action.stockId,action.shares,seat);
    case"minigame_result":
      return engine.submitMinigameResult(seat,{score:action.score,detail:action.detail});
    case"transport_travel":
      return engine.useTransport(action.destinationIndex,seat);
    case"transport_skip":
      return engine.skipTransport(seat);
    case"acquisition_buy":
      return engine.acquireFromCenter(action.tileIndex,seat);
    case"acquisition_skip":
      return engine.skipAcquisition(seat);
    case"urban_move":
      return engine.useUrban(action.destinationIndex,seat);
    case"urban_skip":
      return engine.skipUrban(seat);
    case"central_bank_deposit":
      return engine.centralBankDeposit(seat);
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
    case"start_game":
      return engine.startGame(seat);
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
    document.getElementById("stockMarketGrid"),
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
  startButton.disabled=!(network.mode==="host"&&state.gameStatus==="lobby");

  const leaveButton=document.getElementById("leaveRoomButton");
  leaveButton.disabled=network.mode==="offline";

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
      note.textContent="Alpha 28 測試值：存入 "+noticeMoney(CENTRAL_TEST_TUNING.bankPrincipal)+
        "，2 ROUND 後自動返還 "+noticeMoney(CENTRAL_TEST_TUNING.bankReturn)+"。";
      body.appendChild(note);
      const actions=document.createElement("div");
      actions.className="central-feature-actions";
      actions.appendChild(centralButton(
        "開始 2 ROUND 定存",
        "立即存入 "+noticeMoney(CENTRAL_TEST_TUNING.bankPrincipal),
        !usable||player.cash<CENTRAL_TEST_TUNING.bankPrincipal,
        ()=>dispatchAction({type:"central_bank_deposit"})
      ));
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

  document.getElementById("acquisitionCash").textContent=noticeMoney(player.cash);
  const list=document.getElementById("acquisitionOptionList");
  list.replaceChildren();

  for(const option of pending.options??[]){
    const button=document.createElement("button");
    button.type="button";
    button.className="acquisition-option";
    button.disabled=!option.affordable;
    button.dataset.tileIndex=String(option.tileIndex);

    const heading=document.createElement("span");
    heading.className="acquisition-option__heading";
    const title=document.createElement("strong");
    title.textContent=option.tileName;
    const badge=document.createElement("b");
    badge.textContent="LV."+option.level;
    heading.append(title,badge);

    const meta=document.createElement("span");
    meta.className="acquisition-option__meta";
    meta.textContent=option.group+"｜持有人 "+option.ownerName;

    const offer=document.createElement("span");
    offer.className="acquisition-option__offer";
    offer.textContent="收購價 "+noticeMoney(option.offer);

    const status=document.createElement("small");
    status.textContent=option.affordable?"可收購":"現金不足";

    button.append(heading,meta,offer,status);
    if(option.affordable){
      button.addEventListener("click",()=>{
        dispatchAction({type:"acquisition_buy",tileIndex:option.tileIndex});
      },{once:true});
    }
    list.appendChild(button);
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
  document.getElementById("transportTitle").textContent=source?.name??"交通轉乘";
  document.getElementById("transportSubtitle").textContent="選擇另一個交通節點作為本回合轉乘目的地。";
  document.getElementById("transportSourceName").textContent=(source?.icon?source.icon+" ":"")+(source?.name??"交通設施");

  const list=document.getElementById("transportDestinationList");
  list.replaceChildren();

  for(const destinationIndex of pending.destinationIndexes??[]){
    const node=TRANSPORT_NODE_BY_INDEX[destinationIndex];
    if(!node)continue;
    const button=document.createElement("button");
    button.type="button";
    button.className="transport-destination";
    button.dataset.destinationIndex=String(destinationIndex);

    const icon=document.createElement("span");
    icon.className="transport-destination__icon";
    icon.textContent=node.icon;

    const copy=document.createElement("span");
    copy.className="transport-destination__copy";
    const title=document.createElement("strong");
    title.textContent=node.name;
    const meta=document.createElement("small");
    meta.textContent=node.mode+"｜第 "+(destinationIndex+1)+" 格";
    const preview=transportDestinationPreview(state,destinationIndex);
    const strategy=document.createElement("small");
    strategy.className="transport-destination__strategy";
    strategy.textContent="前方6格｜可買地產 "+preview.unownedProperties+"｜機會命運 "+preview.chanceOrFate;
    copy.append(title,meta,strategy);

    button.append(icon,copy);
    button.addEventListener("click",()=>{
      dispatchAction({type:"transport_travel",destinationIndex});
    },{once:true});
    list.appendChild(button);
  }

  if(!transportDialog.open)transportDialog.showModal();
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
  renderUrbanDialog();
  renderAcquisitionDialog();
  renderTransportDialog();
  minigameUi.sync(state,currentLocalSeat());
  processMoveAnimations();
  processActionToasts();
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
    acquisitionValue.textContent=noticeMoney(estimatedOffer);
    acquisitionNote.textContent=forceEligible
      ?"預估報價＝目前資產估值 ×1.25；LV."+tile.level+" 可強制收購。實際交易仍依收購/協商流程。"
      :courtProtected
        ?"法院財產保全生效中（至 ROUND "+owner.courtShieldUntilRound+"），目前不可強制收購。"
        :"預估報價＝目前資產估值 ×1.25；LV."+tile.level+" 已受滿級保護，不可強制收購，仍可一般協商。";
  }

  if(!propertyInfoDialog.open)propertyInfoDialog.showModal();
}

function openFeature(name){
  const meta={
    property:["我的房產","查看地產、區域完成度、收租與升級。"],
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
document.getElementById("endTurnButton").addEventListener("click",()=>dispatchAction({type:"end_turn"}));

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
  const button=event.target.closest("[data-upgrade-property]");
  if(!button)return;
  dispatchAction({
    type:"upgrade_property",
    tileIndex:Number(button.dataset.upgradeProperty)
  });
});

document.querySelectorAll("[data-feature]").forEach(button=>{
  button.addEventListener("click",()=>openFeature(button.dataset.feature));
});

document.getElementById("closeFeatureDialog").addEventListener("click",()=>featureDialog.close());
featureDialog.addEventListener("click",event=>{
  if(event.target===featureDialog)featureDialog.close();
});

purchaseDialog.addEventListener("cancel",event=>event.preventDefault());

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

document.getElementById("startFriendButton").addEventListener("click",()=>{
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
  setNetworkStatus("正在建立房間…");
  try{
    const result=await network.host({roomCode:code,playerName:name,characterIndex:selectedCharacterIndex});
    const finalCode=result.roomCode;
    uiContext.localSeat=0;
    const next=createLobbyState(name,getOrCreateClientId());
    setPlayerCharacter(next,0,selectedCharacterIndex);
    next.network.roomCode=finalCode;
    state=next;
    resetToastTracker(state);
    engine.replaceState(state);
    document.getElementById("networkRoomCode").value=finalCode;
    setEntryVisible(false);
  }catch(error){
    setNetworkStatus("建立房間失敗："+(error?.message??"unknown"),"error");
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
  }catch(error){
    initialGuestStatePending=false;
    setNetworkStatus("加入房間失敗："+(error?.message??"unknown"),"error");
  }
});

document.getElementById("startRoomGameButton").addEventListener("click",()=>{
  if(network.mode==="host")dispatchAction({type:"start_game"});
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
      "恢復失敗，可重新建立或加入房間："+(error?.message??"unknown"),
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
