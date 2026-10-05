const SESSION_KEY="wealth_empire_v20_network_session";
const CLIENT_KEY="wealth_empire_v20_client_id";
const HOST_STATE_PREFIX="wealth_empire_v20_host_state_";
const PEER_PREFIX="wealth-empire-v20-";
const ROOM_RE=/^\d{6}$/;

export const NETWORK_ACTION_TYPES=Object.freeze([
  "roll",
  "buy_property",
  "decline_property",
  "upgrade_property",
  "buy_stock",
  "sell_stock",
  "minigame_result",
  "end_turn",
  "start_game"
]);

function storage(){
  try{return window.localStorage}catch{return null}
}

function safeJsonParse(value){
  try{return JSON.parse(value)}catch{return null}
}

function randomClientId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  return"client-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
}

export function getOrCreateClientId(){
  const store=storage();
  const existing=store?.getItem(CLIENT_KEY);
  if(existing)return existing;
  const id=randomClientId();
  store?.setItem(CLIENT_KEY,id);
  return id;
}

export function sanitizeRoomCode(value){
  const digits=String(value??"").replace(/\D/g,"").slice(0,6);
  return ROOM_RE.test(digits)?digits:"";
}

export function createRoomCode(random=Math.random){
  const value=Math.floor(Math.max(0,Math.min(0.999999,Number(random())||0))*1000000);
  return String(value).padStart(6,"0");
}

export function sanitizePlayerName(value){
  const name=String(value??"").trim().replace(/[<>]/g,"").slice(0,20);
  return name||"玩家";
}

export function normalizeRemoteAction(raw){
  if(!raw||typeof raw!=="object"||!NETWORK_ACTION_TYPES.includes(raw.type))return null;
  const action={type:raw.type};

  if(raw.type==="upgrade_property"){
    const tileIndex=Math.floor(Number(raw.tileIndex));
    if(!Number.isFinite(tileIndex)||tileIndex<0||tileIndex>43)return null;
    action.tileIndex=tileIndex;
  }

  if(raw.type==="buy_stock"||raw.type==="sell_stock"){
    const stockId=String(raw.stockId??"").replace(/[^A-Z]/g,"").slice(0,8);
    const shares=Math.floor(Number(raw.shares));
    if(!stockId||!Number.isFinite(shares)||shares<1||shares>9999)return null;
    action.stockId=stockId;
    action.shares=shares;
  }

  if(raw.type==="minigame_result"){
    const score=Math.max(0,Math.min(10000,Math.round(Number(raw.score)||0)));
    const detail=raw.detail&&typeof raw.detail==="object"?raw.detail:{};
    action.score=score;
    action.detail=detail;
  }

  return action;
}

export function saveNetworkSession(session){
  storage()?.setItem(SESSION_KEY,JSON.stringify(session));
}

export function loadNetworkSession(){
  const session=safeJsonParse(storage()?.getItem(SESSION_KEY));
  if(!session||!["host","guest"].includes(session.mode))return null;
  const roomCode=sanitizeRoomCode(session.roomCode);
  if(!roomCode)return null;
  return{
    mode:session.mode,
    roomCode,
    playerName:sanitizePlayerName(session.playerName),
    clientId:String(session.clientId||getOrCreateClientId()),
    seat:Number.isInteger(session.seat)?session.seat:null
  };
}

export function clearNetworkSession(){
  storage()?.removeItem(SESSION_KEY);
}

export function saveHostSnapshot(roomCode,state){
  const code=sanitizeRoomCode(roomCode);
  if(!code)return false;
  storage()?.setItem(HOST_STATE_PREFIX+code,JSON.stringify(state));
  return true;
}

export function loadHostSnapshot(roomCode){
  const code=sanitizeRoomCode(roomCode);
  if(!code)return null;
  return safeJsonParse(storage()?.getItem(HOST_STATE_PREFIX+code));
}

function cloneForWire(value){
  return JSON.parse(JSON.stringify(value));
}

function peerIdForRoom(roomCode){
  return PEER_PREFIX+roomCode;
}

export class PeerNetwork{
  constructor({
    onStatus=()=>{},
    onState=()=>{},
    onJoin=()=>({ok:false,error:"join_not_supported"}),
    onAction=()=>{},
    onDisconnect=()=>{}
  }={}){
    this.onStatus=onStatus;
    this.onState=onState;
    this.onJoin=onJoin;
    this.onAction=onAction;
    this.onDisconnect=onDisconnect;
    this.mode="offline";
    this.peer=null;
    this.roomCode=null;
    this.localSeat=0;
    this.playerName="玩家1";
    this.clientId=getOrCreateClientId();
    this.hostConnection=null;
    this.connections=new Map();
  }

  status(text,kind="info"){
    this.onStatus({text,kind,mode:this.mode,roomCode:this.roomCode,seat:this.localSeat});
  }

  async loadPeer(){
    const module=await import("https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm");
    return module.Peer??module.default;
  }

  async openPeer(id=null,retries=5){
    const Peer=await this.loadPeer();
    let attempt=0;
    while(attempt<=retries){
      attempt++;
      try{
        const peer=new Peer(id||undefined,{
          host:"0.peerjs.com",
          port:443,
          path:"/",
          secure:true,
          debug:1
        });
        await new Promise((resolve,reject)=>{
          const timer=setTimeout(()=>reject(new Error("peer_timeout")),10000);
          peer.once("open",()=>{
            clearTimeout(timer);
            resolve();
          });
          peer.once("error",error=>{
            clearTimeout(timer);
            reject(error);
          });
        });
        return peer;
      }catch(error){
        const type=error?.type??error?.message??"peer_error";
        if(id&&String(type).includes("unavailable")&&attempt<=retries){
          await new Promise(resolve=>setTimeout(resolve,1200*attempt));
          continue;
        }
        throw error;
      }
    }
    throw new Error("peer_unavailable");
  }

  async host({roomCode=createRoomCode(),playerName="玩家1"}={}){
    await this.close(false);
    const code=sanitizeRoomCode(roomCode);
    if(!code)throw new Error("invalid_room_code");

    this.mode="host";
    this.roomCode=code;
    this.localSeat=0;
    this.playerName=sanitizePlayerName(playerName);
    this.peer=await this.openPeer(peerIdForRoom(code),6);
    this.peer.on("connection",connection=>this.handleIncomingConnection(connection));
    this.peer.on("disconnected",()=>this.status("連線服務暫時中斷，正在嘗試恢復。","warning"));
    this.peer.on("error",error=>this.status("房間連線錯誤："+(error?.type??"unknown"),"error"));

    saveNetworkSession({
      mode:"host",
      roomCode:code,
      playerName:this.playerName,
      clientId:this.clientId,
      seat:0
    });
    this.status("房間已建立，房號 "+code+"。","success");
    return{roomCode:code,seat:0};
  }

  handleIncomingConnection(connection){
    connection.on("data",message=>this.handleHostMessage(connection,message));
    connection.on("error",()=>{});
  }

  handleHostMessage(connection,message){
    if(!message||typeof message!=="object")return;

    if(message.type==="join_request"){
      const clientId=String(message.clientId??"").slice(0,80);
      const playerName=sanitizePlayerName(message.playerName);
      if(!clientId){
        connection.send({type:"join_reject",error:"invalid_client"});
        return;
      }

      const response=this.onJoin({clientId,playerName});
      if(!response?.ok){
        connection.send({type:"join_reject",error:response?.error??"room_unavailable"});
        return;
      }

      const seat=Number(response.seat);
      connection.metadata={seat,clientId};
      const previous=this.connections.get(seat);
      if(previous&&previous!==connection){
        try{previous.close()}catch{}
      }
      this.connections.set(seat,connection);

      connection.send({
        type:"join_ack",
        seat,
        roomCode:this.roomCode,
        state:cloneForWire(response.state)
      });

      connection.on("close",()=>{
        if(this.connections.get(seat)===connection)this.connections.delete(seat);
        this.onDisconnect({seat,clientId});
      });
      this.status(playerName+" 已加入座位 "+(seat+1)+"。","success");
      return;
    }

    if(message.type==="action"){
      const seat=connection.metadata?.seat;
      const clientId=connection.metadata?.clientId;
      const action=normalizeRemoteAction(message.action);
      if(Number.isInteger(seat)&&action){
        this.onAction({seat,clientId,action});
      }
      return;
    }

    if(message.type==="ping"){
      connection.send({type:"pong",at:Date.now()});
    }
  }

  async join({roomCode,playerName="玩家"}={}){
    await this.close(false);
    const code=sanitizeRoomCode(roomCode);
    if(!code)throw new Error("invalid_room_code");

    this.mode="guest";
    this.roomCode=code;
    this.playerName=sanitizePlayerName(playerName);
    this.peer=await this.openPeer(null,2);

    const connection=this.peer.connect(peerIdForRoom(code),{
      reliable:true,
      serialization:"json"
    });
    this.hostConnection=connection;

    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("join_timeout")),12000);
      connection.on("open",()=>{
        connection.send({
          type:"join_request",
          clientId:this.clientId,
          playerName:this.playerName
        });
      });
      connection.on("data",message=>{
        if(message?.type==="join_ack"){
          clearTimeout(timer);
          this.localSeat=Number(message.seat);
          saveNetworkSession({
            mode:"guest",
            roomCode:code,
            playerName:this.playerName,
            clientId:this.clientId,
            seat:this.localSeat
          });
          this.onState(message.state);
          this.status("已加入房間 "+code+"，座位 "+(this.localSeat+1)+"。","success");
          resolve({seat:this.localSeat,state:message.state});
          return;
        }
        if(message?.type==="join_reject"){
          clearTimeout(timer);
          reject(new Error(message.error??"join_rejected"));
          return;
        }
        if(message?.type==="state"){
          this.onState(message.state);
        }
      });
      connection.on("close",()=>{
        this.status("與房主連線中斷，可重新整理或重新連線。","warning");
      });
      connection.on("error",error=>{
        clearTimeout(timer);
        reject(error);
      });
    });

    return result;
  }

  broadcastState(state){
    if(this.mode!=="host")return;
    const message={type:"state",state:cloneForWire(state)};
    for(const connection of this.connections.values()){
      if(connection?.open){
        try{connection.send(message)}catch{}
      }
    }
  }

  sendAction(action){
    if(this.mode!=="guest"||!this.hostConnection?.open)return false;
    const normalized=normalizeRemoteAction(action);
    if(!normalized)return false;
    this.hostConnection.send({type:"action",action:normalized});
    return true;
  }

  async close(clearSession=true){
    for(const connection of this.connections.values()){
      try{connection.close()}catch{}
    }
    this.connections.clear();
    if(this.hostConnection){
      try{this.hostConnection.close()}catch{}
      this.hostConnection=null;
    }
    if(this.peer){
      try{this.peer.destroy()}catch{}
      this.peer=null;
    }
    this.mode="offline";
    this.roomCode=null;
    this.localSeat=0;
    if(clearSession)clearNetworkSession();
  }
}
