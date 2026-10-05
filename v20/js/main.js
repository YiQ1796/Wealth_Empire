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
import{mountStaticBoard,render}from"./ui/render.js";
import{renderStockMarket}from"./ui/stock-render.js";
import{MinigameUI}from"./ui/minigame-ui.js";

const board=document.getElementById("board");
mountStaticBoard(board);

let state=createInitialState();
let aiTimer=null;
const disconnectTimers=new Map();
const uiContext={
  localSeat:0,
  networkMode:"offline"
};

const featureDialog=document.getElementById("featureDialog");
const networkDialog=document.getElementById("networkDialog");
const purchaseDialog=document.getElementById("purchaseDialog");

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
    return '<div class="network-seat-row">'+
      '<span style="--player-color:'+player.color+'"></span>'+
      '<strong>座位 '+(player.seat+1)+"｜"+player.name+'</strong>'+
      '<em>'+status+'</em>'+
    '</div>';
  }).join("");

  const startButton=document.getElementById("startRoomGameButton");
  startButton.disabled=!(network.mode==="host"&&state.gameStatus==="lobby");

  const leaveButton=document.getElementById("leaveRoomButton");
  leaveButton.disabled=network.mode==="offline";

  const roomInput=document.getElementById("networkRoomCode");
  if(network.roomCode)roomInput.value=network.roomCode;
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
  },650);
}

function openFeature(name){
  const meta={
    stock:["股票市場","每個 ROUND 全市場重新漲跌；自己的回合可自由買賣。"],
    property:["我的房產","查看地產、區域完成度、收租與升級。"],
    item:["策略道具","符合使用條件時會主動提示。"],
    info:["遊戲資訊","目前格子與事件紀錄。"]
  }[name];
  if(!meta)return;

  document.getElementById("featureDialogTitle").textContent=meta[0];
  document.getElementById("featureDialogSubtitle").textContent=meta[1];
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
    engine.replaceState(state);
    document.getElementById("networkRoomCode").value=code;
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
    const result=await network.join({roomCode:code,playerName:name});
    uiContext.localSeat=result.seat;
    uiContext.networkMode="guest";
    renderAll();
  }catch(error){
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
  engine.replaceState(state);
  setNetworkStatus("已離開連線，回到單機模式。","info");
});

setInterval(()=>{
  if(network.mode!=="guest"&&state.phase==="minigame"){
    engine.tick(Date.now());
  }
},500);

async function restorePreviousSession(){
  const saved=loadNetworkSession();
  if(!saved){
    renderAll();
    scheduleAi();
    return;
  }

  document.getElementById("networkPlayerName").value=saved.playerName;
  document.getElementById("networkRoomCode").value=saved.roomCode;
  setNetworkStatus("偵測到上一個房間，正在嘗試自動恢復…");

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
      engine.replaceState(state);
      setNetworkStatus("房主狀態已恢復，房號 "+saved.roomCode+"。","success");
      return;
    }

    if(saved.mode==="guest"){
      const result=await network.join({
        roomCode:saved.roomCode,
        playerName:saved.playerName
      });
      uiContext.localSeat=result.seat;
      uiContext.networkMode="guest";
      renderAll();
      return;
    }
  }catch(error){
    setNetworkStatus(
      "自動恢復失敗，可在連線視窗重新嘗試："+(error?.message??"unknown"),
      "warning"
    );
    uiContext.networkMode="offline";
    renderAll();
    scheduleAi();
  }
}

renderAll();
restorePreviousSession();

window.__WEALTH_V20__=Object.freeze({
  get version(){return state.version},
  getState:()=>state,
  getNetworkMode:()=>network.mode
});
