import{createInitialState,createLobbyState,hydrateState,setAiSeat,setHumanSeat}from"./core/state.js";
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
  "game_complete"
]);
const uiContext={
  localSeat:0,
  networkMode:"offline"
};

const featureDialog=document.getElementById("featureDialog");
const networkDialog=document.getElementById("networkDialog");
const purchaseDialog=document.getElementById("purchaseDialog");
const entryGate=document.getElementById("entryGate");
const actionToastStack=document.getElementById("actionToastStack");

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

function setEntryVisible(visible){
  document.body.classList.toggle("entry-pending",visible);
  entryGate.hidden=!visible;
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
  const map={
    property_buy:{title:"地產購入",icon:N.icons.propertyBuy,effect:N.effects.gold,tone:"gold",major:true},
    property_upgrade:{title:"地產升級",icon:N.icons.propertyUpgrade,effect:N.effects.purple,tone:"purple",major:true},
    group_complete:{title:"區域完成",icon:N.icons.regionComplete,effect:N.effects.gold,tone:"gold",major:true},
    rent:{title:"過路費結算",icon:N.icons.rent,effect:N.effects.green,tone:"green",major:true},
    property_acquisition:{title:"強制收購",icon:N.icons.acquisition,effect:N.effects.red,tone:"red",major:true},
    bankruptcy:{title:"玩家破產",icon:N.icons.bankruptcy,effect:N.effects.red,tone:"red",major:true},
    minigame_complete:{title:"都會挑戰結算",icon:N.icons.minigameResult,effect:N.effects.gold,tone:"gold",major:true},
    game_complete:{title:"遊戲結束",icon:N.icons.victory,effect:N.effects.gold,tone:"gold",major:true},
    stock_buy:{title:"股票買進",icon:N.icons.stockBuy,effect:N.effects.blue,tone:"blue"},
    stock_sell:{title:"股票賣出",icon:N.icons.stockSell,effect:N.effects.blue,tone:"blue"},
    market_tick:{title:"市場更新",icon:N.icons.marketTick,effect:N.effects.blue,tone:"blue",market:true},
    network_join:{title:"好友加入",icon:N.icons.network,effect:N.effects.blue,tone:"blue"},
    network_reconnect:{title:"重新連線",icon:N.icons.network,effect:N.effects.green,tone:"green"},
    network_ai_takeover:{title:"AI 接手",icon:N.icons.aiTakeover,effect:N.effects.purple,tone:"purple"},
    cash:{title:"現金變動",icon:N.icons.rent,effect:N.effects.green,tone:"green"}
  };
  return map[event.kind]??{title:"遊戲動態",icon:N.icons.marketTick,effect:N.effects.blue,tone:"blue"};
}

function noticeCardSources(config){
  const cards=UI_ASSETS.notification.cards;
  const market=UI_ASSETS.notification.market;
  if(config.market){
    return{desktop:market.desktop,mobile:market.mobile};
  }
  if(config.major){
    return{desktop:cards.majorDesktop,mobile:cards.majorMobile};
  }
  return{desktop:cards.standardDesktop,mobile:cards.standardMobile};
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
  const node=document.createElement("div");
  node.className="action-toast action-toast--"+event.kind+" action-toast--"+config.tone+(config.major?" action-toast--major":"")+(config.market?" action-toast--market":"");
  node.innerHTML=
    '<picture class="action-toast__card-bg">'+
      '<source media="(max-width:760px)" srcset="'+source.mobile+'">'+
      '<img src="'+source.desktop+'" alt="">'+
    '</picture>'+
    '<img class="action-toast__fx" src="'+config.effect+'" alt="">'+
    '<img class="action-toast__shine" src="'+UI_ASSETS.notification.effects.edgeShine+'" alt="">'+
    (config.major&&config.tone==="gold"?'<img class="action-toast__sparkle" src="'+UI_ASSETS.notification.effects.sparkleGold+'" alt="">':"")+
    '<div class="action-toast__content">'+
      '<img class="action-toast__icon" src="'+config.icon+'" alt="">'+
      '<div class="action-toast__copy"><strong></strong><p></p></div>'+
    '</div>';

  node.querySelector("strong").textContent=config.title;
  node.querySelector("p").textContent=event.text;
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
  moving.src=characterAsset(seat,"idle");
  moving.alt="";
  moving.style.left=start.left+"px";
  moving.style.top=start.top+"px";
  layer.appendChild(moving);

  document.body.classList.add("board-motion-active");
  board.classList.add("moving-seat-"+seat);
  await sleep(35);

  for(let i=0;i<path.length;i++){
    const point=tileCenter(path[i]);
    if(!point)continue;
    moving.src=characterAsset(seat,i%2===0?"walkA":"walkB");
    moving.classList.add("walking");
    moving.style.left=point.left+"px";
    moving.style.top=point.top+"px";
    await sleep(65);
  }

  moving.classList.remove("walking");
  moving.classList.add("jumping");
  moving.src=characterAsset(seat,"jump");
  await sleep(180);
  moving.src=characterAsset(seat,"idle");
  await sleep(70);
  moving.remove();
  board.classList.remove("moving-seat-"+seat);
  document.body.classList.remove("board-motion-active");
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
  onJoin:({clientId,playerName})=>{
    const existing=state.players.find(player=>player.kind==="human"&&player.clientId===clientId);
    let seat=existing?.seat??null;

    if(seat==null){
      if(state.gameStatus!=="lobby"){
        return{ok:false,error:"遊戲已開始，只允許原玩家重新連線。"};
      }
      const available=state.players.find(player=>player.seat!==0&&player.kind==="ai");
      if(!available)return{ok:false,error:"房間已滿。"};
      seat=available.seat;
      setHumanSeat(state,seat,{name:playerName,clientId,connected:true});
      engine.log(playerName+" 加入房間，座位 "+(seat+1)+"。","network_join",{seat});
    }else{
      setHumanSeat(state,seat,{name:playerName,clientId,connected:true});
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
  renderStockMarket(
    document.getElementById("stockMarketGrid"),
    state,
    currentLocalSeat(),
    {
      onBuy:(stockId,shares)=>dispatchAction({type:"buy_stock",stockId,shares}),
      onSell:(stockId,shares)=>dispatchAction({type:"sell_stock",stockId,shares})
    }
  );
}

function renderNetworkUi(){
  const statusBar=document.getElementById("networkStatusBar");
  if(network.mode==="host"){
    statusBar.textContent="房主｜房號 "+network.roomCode+"｜未滿座位由 AI 補位";
  }else if(network.mode==="guest"){
    statusBar.textContent="已連線｜房號 "+network.roomCode+"｜座位 "+(currentLocalSeat()+1);
  }else{
    statusBar.textContent="單機模式｜1 真人 + 3 AI";
  }

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

function renderAll(){
  uiContext.networkMode=network.mode;
  render(state,{
    localSeat:currentLocalSeat(),
    networkMode:network.mode
  });
  renderStocks();
  renderNetworkUi();
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

function openFeature(name){
  const meta={
    stock:["股票市場","每次換到下一位玩家時全市場重新漲跌；遊戲進行中可隨時自由買賣。"],
    property:["我的房產","查看地產、區域完成度、收租與升級。"],
    item:["策略道具","符合使用條件時會主動提示。"],
    info:["遊戲資訊","目前格子與事件紀錄。"]
  }[name];
  if(!meta)return;

  document.getElementById("featureDialogTitle").textContent=meta[0];
  document.getElementById("featureDialogSubtitle").textContent=meta[1];
  const headerArt=document.getElementById("featureDialogHeaderArt");
  if(headerArt)headerArt.src=UI_ASSETS.headers[name]??UI_ASSETS.headers.info;
  document.querySelectorAll("[data-feature-panel]").forEach(panel=>{
    panel.classList.toggle("active",panel.dataset.featurePanel===name);
  });
  renderAll();
  if(!featureDialog.open)featureDialog.showModal();
}

document.getElementById("rollButton").addEventListener("click",()=>dispatchAction({type:"roll"}));
document.getElementById("confirmPurchaseButton").addEventListener("click",()=>dispatchAction({type:"buy_property"}));
document.getElementById("declinePurchaseButton").addEventListener("click",()=>dispatchAction({type:"decline_property"}));
document.getElementById("endTurnButton").addEventListener("click",()=>dispatchAction({type:"end_turn"}));

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

document.getElementById("openNetworkButton").addEventListener("click",()=>{
  renderNetworkUi();
  if(!networkDialog.open)networkDialog.showModal();
});
document.getElementById("closeNetworkDialog").addEventListener("click",()=>networkDialog.close());
networkDialog.addEventListener("click",event=>{
  if(event.target===networkDialog)networkDialog.close();
});

document.getElementById("startSoloButton").addEventListener("click",async()=>{
  await network.close(true);
  clearNetworkSession();
  uiContext.localSeat=0;
  uiContext.networkMode="offline";
  state=createInitialState();
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
    await network.host({roomCode:code,playerName:name});
    uiContext.localSeat=0;
    const next=createLobbyState(name,getOrCreateClientId());
    next.network.roomCode=code;
    state=next;
    resetToastTracker(state);
    engine.replaceState(state);
    document.getElementById("networkRoomCode").value=code;
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
    const result=await network.join({roomCode:code,playerName:name});
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
        playerName:saved.playerName
      });
      const snapshot=loadHostSnapshot(saved.roomCode);
      state=hydrateState(snapshot??createLobbyState(saved.playerName,saved.clientId));
      state.network.roomCode=saved.roomCode;
      setHumanSeat(state,0,{
        name:saved.playerName,
        clientId:saved.clientId,
        connected:true
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
        playerName:saved.playerName
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
