const SESSION_KEY="wealth_empire_v20_network_session";
const CLIENT_KEY="wealth_empire_v20_client_id";
const HOST_STATE_PREFIX="wealth_empire_v20_host_state_";
const PEER_PREFIX="wealth-empire-v20-";
const RELAY_BROKER_URL="wss://broker.emqx.io:8084/mqtt";
const RELAY_PROTOCOL="v20";
const RELAY_HEARTBEAT_MS=7000;
const RELAY_STALE_MS=35000;
const ROOM_RE=/^\d{6}$/;

let mqttLibraryPromise=null;

export const NETWORK_ACTION_TYPES=Object.freeze([
  "roll",
  "buy_property",
  "decline_property",
  "upgrade_property",
  "buy_stock",
  "sell_stock",
  "minigame_result",
  "transport_travel",
  "transport_skip",
  "acquisition_buy",
  "acquisition_skip",
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
export function sanitizeCharacterIndex(value){
  const index=Math.floor(Number(value));
  return Number.isInteger(index)&&index>=0&&index<4?index:0;
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

  if(raw.type==="transport_travel"){
    const destinationIndex=Math.floor(Number(raw.destinationIndex));
    if(!Number.isFinite(destinationIndex)||destinationIndex<0||destinationIndex>43)return null;
    action.destinationIndex=destinationIndex;
  }

  if(raw.type==="acquisition_buy"){
    const tileIndex=Math.floor(Number(raw.tileIndex));
    if(!Number.isFinite(tileIndex)||tileIndex<0||tileIndex>43)return null;
    action.tileIndex=tileIndex;
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
    characterIndex:sanitizeCharacterIndex(session.characterIndex),
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

function relayBase(roomCode){
  return"wealth-empire/"+RELAY_PROTOCOL+"/"+roomCode;
}

function relayRandomId(prefix){
  try{
    const bytes=new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return prefix+"-"+Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  }catch{
    return prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,10);
  }
}

async function loadMqttLibrary(){
  if(typeof window!=="undefined"&&window.mqtt)return window.mqtt;
  if(mqttLibraryPromise)return mqttLibraryPromise;

  const sources=[
    "https://cdn.jsdelivr.net/npm/mqtt@5.14.1/dist/mqtt.min.js",
    "https://unpkg.com/mqtt@5.14.1/dist/mqtt.min.js"
  ];

  mqttLibraryPromise=new Promise((resolve,reject)=>{
    let index=0;
    const tryNext=()=>{
      if(window.mqtt){
        resolve(window.mqtt);
        return;
      }
      if(index>=sources.length){
        mqttLibraryPromise=null;
        reject(new Error("relay_library_failed"));
        return;
      }
      const script=document.createElement("script");
      script.src=sources[index++];
      script.async=true;
      script.onload=()=>window.mqtt?resolve(window.mqtt):tryNext();
      script.onerror=tryNext;
      document.head.appendChild(script);
    };
    tryNext();
  });
  return mqttLibraryPromise;
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
    this.transport="offline";
    this.peer=null;
    this.roomCode=null;
    this.localSeat=0;
    this.playerName="玩家1";
    this.characterIndex=0;
    this.clientId=getOrCreateClientId();
    this.hostConnection=null;
    this.connections=new Map();

    this.relayClient=null;
    this.relayConnectionsByClient=new Map();
    this.relayHeartbeatTimer=null;
    this.relayWatchdogTimer=null;
    this.relayLastHostActivity=0;
  }

  status(text,kind="info"){
    this.onStatus({
      text,
      kind,
      mode:this.mode,
      transport:this.transport,
      roomCode:this.roomCode,
      seat:this.localSeat
    });
  }

  async loadPeer(){
    const module=await import("https://cdn.jsdelivr.net/npm/peerjs@1.5.5/+esm");
    return module.Peer??module.default;
  }

  async openPeer(id=null,retries=3){
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
          const timer=setTimeout(()=>reject(new Error("peer_timeout")),9000);
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

  async host({roomCode=createRoomCode(),playerName="玩家1",characterIndex=0}={}){
    await this.close(false);
    const code=sanitizeRoomCode(roomCode);
    if(!code)throw new Error("invalid_room_code");

    this.mode="host";
    this.roomCode=code;
    this.localSeat=0;
    this.playerName=sanitizePlayerName(playerName);
    this.characterIndex=sanitizeCharacterIndex(characterIndex);

    try{
      await this.startHostRelay();
      this.transport="relay";
      this.startHostPeer().catch(()=>{});
      this.status("房間已建立，房號 "+code+"。目前使用 WSS 中繼，可跨不同網路與手機 NAT；P2P 同步作為備援。","success");
    }catch(relayError){
      this.cleanupRelayTransport();
      this.status("WSS 中繼暫時不可用，正在切換 P2P 備援。","warning");
      await this.startHostPeer();
      this.transport="peer";
      this.status("房間已建立，房號 "+code+"。目前使用 P2P 備援。","success");
    }

    saveNetworkSession({
      mode:"host",
      roomCode:code,
      playerName:this.playerName,
      characterIndex:this.characterIndex,
      clientId:this.clientId,
      seat:0
    });
    return{roomCode:code,seat:0,transport:this.transport};
  }

  async startHostRelay(){
    const mqtt=await loadMqttLibrary();
    const base=relayBase(this.roomCode);
    const client=mqtt.connect(RELAY_BROKER_URL,{
      clientId:relayRandomId("we-host-"+this.roomCode),
      clean:true,
      connectTimeout:8000,
      reconnectPeriod:1800,
      keepalive:15,
      protocolVersion:4
    });
    this.relayClient=client;

    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("relay_timeout")),10000);
      let settled=false;

      client.on("connect",()=>{
        if(this.relayClient!==client)return;
        client.subscribe(base+"/guest/+",{qos:0},error=>{
          if(error){
            if(!settled){
              settled=true;
              clearTimeout(timer);
              reject(error);
            }
            return;
          }
          if(!settled){
            settled=true;
            clearTimeout(timer);
            resolve();
          }
        });
      });
      client.on("error",error=>{
        if(!settled){
          settled=true;
          clearTimeout(timer);
          reject(error);
        }
      });
    });

    client.on("message",(topic,raw)=>{
      if(this.relayClient!==client||this.mode!=="host")return;
      try{
        const clientId=String(topic).split("/").pop();
        const envelope=JSON.parse(raw.toString());
        const message=envelope?.payload??envelope;
        if(!clientId||!message||typeof message!=="object")return;
        const connection=this.getRelayHostConnection(clientId,base);
        connection.lastSeen=Date.now();
        if(message.type==="relay_disconnect"){
          this.disconnectRelayConnection(connection);
          return;
        }
        this.handleHostMessage(connection,message);
      }catch{}
    });

    client.on("offline",()=>this.status("WSS 中繼暫時離線，系統正在自動重連。","warning"));
    client.on("reconnect",()=>this.status("WSS 中繼正在重新連線…","warning"));
    client.on("connect",()=>{
      if(this.mode==="host"){
        client.subscribe(base+"/guest/+",{qos:0},()=>{});
      }
    });

    clearInterval(this.relayWatchdogTimer);
    this.relayWatchdogTimer=setInterval(()=>{
      if(this.mode!=="host")return;
      const now=Date.now();
      for(const connection of this.relayConnectionsByClient.values()){
        if(connection.open&&now-connection.lastSeen>RELAY_STALE_MS){
          this.disconnectRelayConnection(connection);
        }
      }
    },7000);
  }

  getRelayHostConnection(clientId,base){
    let connection=this.relayConnectionsByClient.get(clientId);
    if(connection){
      connection.open=true;
      return connection;
    }

    connection={
      relay:true,
      open:true,
      clientId,
      metadata:null,
      lastSeen:Date.now(),
      send:message=>{
        if(!this.relayClient?.connected)throw new Error("relay_not_connected");
        this.relayClient.publish(
          base+"/host/"+clientId,
          JSON.stringify({payload:message,ts:Date.now()}),
          {qos:0,retain:false}
        );
      },
      close:()=>this.disconnectRelayConnection(connection)
    };
    this.relayConnectionsByClient.set(clientId,connection);
    return connection;
  }

  disconnectRelayConnection(connection){
    if(!connection?.open)return;
    connection.open=false;
    this.relayConnectionsByClient.delete(connection.clientId);
    const seat=connection.metadata?.seat;
    const clientId=connection.metadata?.clientId;
    if(Number.isInteger(seat)&&this.connections.get(seat)===connection){
      this.connections.delete(seat);
      this.onDisconnect({seat,clientId});
    }
  }

  async startHostPeer(){
    this.peer=await this.openPeer(peerIdForRoom(this.roomCode),5);
    this.peer.on("connection",connection=>this.handleIncomingConnection(connection));
    this.peer.on("disconnected",()=>this.status("P2P signaling 暫時中斷。","warning"));
    this.peer.on("error",error=>this.status("P2P 連線錯誤："+(error?.type??"unknown"),"error"));
  }

  handleIncomingConnection(connection){
    connection.on("data",message=>this.handleHostMessage(connection,message));
    connection.on("error",()=>{});
  }

  handleHostMessage(connection,message){
    if(!message||typeof message!=="object")return;

    if(message.type==="join_request"){
      const clientId=String(message.clientId??connection.clientId??"").slice(0,80);
      const playerName=sanitizePlayerName(message.playerName);
      const characterIndex=sanitizeCharacterIndex(message.characterIndex);
      if(!clientId){
        connection.send({type:"join_reject",error:"invalid_client"});
        return;
      }

      if(connection.metadata?.seat!=null&&connection.metadata.clientId===clientId){
        const seat=connection.metadata.seat;
        connection.send({
          type:"join_ack",
          seat,
          roomCode:this.roomCode,
          state:cloneForWire(this.lastBroadcastState??{})
        });
        return;
      }

      const response=this.onJoin({clientId,playerName,characterIndex});
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

      if(!connection.relay){
        connection.on("close",()=>{
          if(this.connections.get(seat)===connection)this.connections.delete(seat);
          this.onDisconnect({seat,clientId});
        });
      }
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

  async join({roomCode,playerName="玩家",characterIndex=0}={}){
    await this.close(false);
    const code=sanitizeRoomCode(roomCode);
    if(!code)throw new Error("invalid_room_code");

    this.mode="guest";
    this.roomCode=code;
    this.playerName=sanitizePlayerName(playerName);
    this.characterIndex=sanitizeCharacterIndex(characterIndex);

    try{
      const result=await this.joinViaRelay();
      this.transport="relay";
      return result;
    }catch(relayError){
      this.cleanupRelayTransport();
      this.status("WSS 中繼暫時不可用，正在切換 P2P 備援。","warning");
      const result=await this.joinViaPeer();
      this.transport="peer";
      return result;
    }
  }

  async joinViaRelay(){
    const mqtt=await loadMqttLibrary();
    const base=relayBase(this.roomCode);
    const relayId=relayRandomId("we-guest-"+this.roomCode);
    const client=mqtt.connect(RELAY_BROKER_URL,{
      clientId:relayId,
      clean:true,
      connectTimeout:8000,
      reconnectPeriod:1800,
      keepalive:15,
      protocolVersion:4,
      will:{
        topic:base+"/guest/"+this.clientId,
        payload:JSON.stringify({payload:{type:"relay_disconnect"},ts:Date.now()}),
        qos:0,
        retain:false
      }
    });
    this.relayClient=client;

    const connection={
      relay:true,
      open:false,
      send:message=>{
        if(!client.connected)throw new Error("relay_not_connected");
        client.publish(
          base+"/guest/"+this.clientId,
          JSON.stringify({payload:message,ts:Date.now()}),
          {qos:0,retain:false}
        );
      },
      close:()=>{connection.open=false}
    };
    this.hostConnection=connection;

    const sendPresence=()=>{
      if(!connection.open)return;
      try{
        connection.send({
          type:"join_request",
          clientId:this.clientId,
          playerName:this.playerName,
          characterIndex:this.characterIndex
        });
      }catch{}
    };

    const result=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error("relay_join_timeout")),12000);
      let settled=false;

      client.on("connect",()=>{
        if(this.relayClient!==client)return;
        client.subscribe(base+"/host/"+this.clientId,{qos:0},error=>{
          if(error){
            if(!settled){
              settled=true;
              clearTimeout(timer);
              reject(error);
            }
            return;
          }
          connection.open=true;
          sendPresence();
        });
      });

      client.on("message",(topic,raw)=>{
        if(this.relayClient!==client||this.mode!=="guest")return;
        try{
          const envelope=JSON.parse(raw.toString());
          const message=envelope?.payload??envelope;
          if(!message||typeof message!=="object")return;
          this.relayLastHostActivity=Date.now();

          if(message.type==="join_ack"){
            this.localSeat=Number(message.seat);
            saveNetworkSession({
              mode:"guest",
              roomCode:this.roomCode,
              playerName:this.playerName,
              characterIndex:this.characterIndex,
              clientId:this.clientId,
              seat:this.localSeat
            });
            this.onState(message.state);
            this.status("已加入房間 "+this.roomCode+"，座位 "+(this.localSeat+1)+"，使用 WSS 中繼。","success");
            if(!settled){
              settled=true;
              clearTimeout(timer);
              resolve({seat:this.localSeat,state:message.state,transport:"relay"});
            }
            return;
          }

          if(message.type==="join_reject"){
            if(!settled){
              settled=true;
              clearTimeout(timer);
              reject(new Error(message.error??"join_rejected"));
            }
            return;
          }

          if(message.type==="state"){
            this.onState(message.state);
          }
        }catch{}
      });

      client.on("error",error=>{
        if(!settled){
          settled=true;
          clearTimeout(timer);
          reject(error);
        }
      });
    });

    clearInterval(this.relayHeartbeatTimer);
    this.relayHeartbeatTimer=setInterval(()=>{
      if(this.mode!=="guest"||!connection.open)return;
      sendPresence();
    },RELAY_HEARTBEAT_MS);

    return result;
  }

  async joinViaPeer(){
    this.peer=await this.openPeer(null,2);
    const connection=this.peer.connect(peerIdForRoom(this.roomCode),{
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
          playerName:this.playerName,
          characterIndex:this.characterIndex
        });
      });
      connection.on("data",message=>{
        if(message?.type==="join_ack"){
          clearTimeout(timer);
          this.localSeat=Number(message.seat);
          saveNetworkSession({
            mode:"guest",
            roomCode:this.roomCode,
            playerName:this.playerName,
            clientId:this.clientId,
            seat:this.localSeat
          });
          this.onState(message.state);
          this.status("已加入房間 "+this.roomCode+"，座位 "+(this.localSeat+1)+"，使用 P2P。","success");
          resolve({seat:this.localSeat,state:message.state,transport:"peer"});
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
        this.status("與房主 P2P 連線中斷，可重新整理自動恢復。","warning");
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
    this.lastBroadcastState=cloneForWire(state);
    const message={type:"state",state:this.lastBroadcastState};
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

  cleanupRelayTransport(){
    clearInterval(this.relayHeartbeatTimer);
    clearInterval(this.relayWatchdogTimer);
    this.relayHeartbeatTimer=null;
    this.relayWatchdogTimer=null;

    if(this.relayClient){
      try{this.relayClient.end(true)}catch{}
      this.relayClient=null;
    }

    this.relayConnectionsByClient.clear();
    if(this.hostConnection?.relay){
      try{this.hostConnection.close()}catch{}
      this.hostConnection=null;
    }
  }

  async close(clearSession=true){
    clearInterval(this.relayHeartbeatTimer);
    clearInterval(this.relayWatchdogTimer);
    this.relayHeartbeatTimer=null;
    this.relayWatchdogTimer=null;

    if(this.mode==="guest"&&this.hostConnection?.relay&&this.hostConnection.open){
      try{this.hostConnection.send({type:"relay_disconnect"})}catch{}
    }

    for(const connection of this.connections.values()){
      try{connection.close()}catch{}
    }
    this.connections.clear();
    this.relayConnectionsByClient.clear();

    if(this.hostConnection){
      try{this.hostConnection.close()}catch{}
      this.hostConnection=null;
    }

    if(this.relayClient){
      try{this.relayClient.end(true)}catch{}
      this.relayClient=null;
    }

    if(this.peer){
      try{this.peer.destroy()}catch{}
      this.peer=null;
    }

    this.mode="offline";
    this.transport="offline";
    this.roomCode=null;
    this.localSeat=0;
    if(clearSession)clearNetworkSession();
  }
}
