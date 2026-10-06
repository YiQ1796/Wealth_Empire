const SESSION_KEY="wealth_empire_v20_network_session";
const CLIENT_KEY="wealth_empire_v20_client_id";
const HOST_STATE_PREFIX="wealth_empire_v20_host_state_";
const PEER_PREFIX="wealth-empire-v20-";
const RELAY_BROKER_URLS=Object.freeze([
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt"
]);
const RELAY_PROTOCOL="v20a28";
const RELAY_HEARTBEAT_MS=7000;
const RELAY_STALE_MS=35000;
const ROOM_RE=/^\d{6}$/;
const RELIABLE_RELAY_TYPES=new Set(["join_request","join_ack","join_reject","state","action","action_ack"]);

function relayQos(message){
  return RELIABLE_RELAY_TYPES.has(message?.type)?1:0;
}

function sanitizeActionId(value){
  return String(value??"").replace(/[^A-Za-z0-9:_-]/g,"").slice(0,96);
}

let mqttLibraryPromise=null;

export const NETWORK_ACTION_TYPES=Object.freeze([
  "roll",
  "buy_property",
  "decline_property",
  "upgrade_property",
  "property_permit_upgrade",
  "property_protection_apply",
  "item_use",
  "decline_upgrade",
  "buy_stock",
  "sell_stock",
  "minigame_result",
  "transport_travel",
  "transport_skip",
  "acquisition_buy",
  "acquisition_skip",
  "urban_move",
  "urban_skip",
  "central_bank_deposit",
  "central_mission_accept",
  "central_transit",
  "central_insurance",
  "central_development",
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

  if(raw.type==="property_permit_upgrade"||raw.type==="property_protection_apply"){
    const tileIndex=Math.floor(Number(raw.tileIndex));
    if(!Number.isFinite(tileIndex)||tileIndex<0||tileIndex>43)return null;
    action.tileIndex=tileIndex;
  }

  if(raw.type==="item_use"){
    const itemId=String(raw.itemId??"").replace(/[^a-z0-9_]/g,"").slice(0,40);
    if(!itemId)return null;
    const source=raw.target&&typeof raw.target==="object"?raw.target:{};
    const target={};
    if(source.tileIndex!=null){
      const tileIndex=Math.floor(Number(source.tileIndex));
      if(!Number.isFinite(tileIndex)||tileIndex<0||tileIndex>43)return null;
      target.tileIndex=tileIndex;
    }
    if(source.stockId!=null){
      const stockId=String(source.stockId).replace(/[^A-Za-z0-9_-]/g,"").slice(0,24);
      if(!stockId)return null;
      target.stockId=stockId;
    }
    if(source.value!=null){
      const value=Math.floor(Number(source.value));
      if(!Number.isFinite(value)||value<2||value>12)return null;
      target.value=value;
    }
    if(Object.keys(target).length!==1)return null;
    action.itemId=itemId;
    action.target=target;
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

  if(raw.type==="urban_move"){
    const destinationIndex=Math.floor(Number(raw.destinationIndex));
    if(!Number.isFinite(destinationIndex)||destinationIndex<0||destinationIndex>43)return null;
    action.destinationIndex=destinationIndex;
  }

  if(raw.type==="central_bank_deposit"){
    const principal=Math.round(Number(raw.principal??5000));
    if(![5000,10000,20000].includes(principal))return null;
    action.principal=principal;
  }

  if(raw.type==="central_mission_accept"){
    const missionId=String(raw.missionId??"");
    if(!["buy_property","upgrade_property","buy_stock"].includes(missionId))return null;
    action.missionId=missionId;
  }

  if(raw.type==="central_transit"){
    const distance=Math.floor(Number(raw.distance));
    if(![3,6,9].includes(distance))return null;
    action.distance=distance;
  }

  if(raw.type==="central_development"){
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
    this.actionCounter=0;
    this.processedActionIds=new Map();

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
      let peer=null;
      try{
        peer=new Peer(id||undefined,{
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
        try{peer?.destroy()}catch{}
        const type=String(error?.type??error?.message??"peer_error");
        const idBusy=type.includes("unavailable")||type.includes("is taken")||type.includes("unavailable-id");
        if(id&&idBusy&&attempt<=retries){
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

    let relayConnected=false;
    let relayError=null;
    for(const brokerUrl of RELAY_BROKER_URLS){
      try{
        await this.startHostRelay(brokerUrl);
        relayConnected=true;
        break;
      }catch(error){
        relayError=error;
        this.cleanupRelayTransport();
      }
    }

    if(relayConnected){
      this.transport="relay";
      this.startHostPeer().catch(()=>{});
      this.status("房間已建立，房號 "+this.roomCode+"。目前使用 WSS 中繼，可跨不同網路與手機 NAT；P2P 同步作為備援。","success");
    }else{
      this.status("WSS 中繼暫時不可用，正在切換 P2P 備援。","warning");
      let peerError=relayError;
      for(let attempt=0;attempt<4;attempt++){
        try{
          await this.startHostPeer();
          peerError=null;
          break;
        }catch(error){
          peerError=error;
          const message=String(error?.message??error?.type??"");
          if(!/taken|unavailable|ID/i.test(message)||attempt===3)break;
          this.roomCode=createRoomCode();
        }
      }
      if(peerError)throw peerError;
      this.transport="peer";
      this.status("房間已建立，房號 "+this.roomCode+"。目前使用 P2P 備援。","success");
    }

    const finalCode=this.roomCode;
    saveNetworkSession({
      mode:"host",
      roomCode:finalCode,
      playerName:this.playerName,
      characterIndex:this.characterIndex,
      clientId:this.clientId,
      seat:0
    });
    return{roomCode:finalCode,seat:0,transport:this.transport};
  }

  async startHostRelay(brokerUrl=RELAY_BROKER_URLS[0]){
    const mqtt=await loadMqttLibrary();
    const base=relayBase(this.roomCode);
    const client=mqtt.connect(brokerUrl,{
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
        client.subscribe(base+"/guest/+",{qos:1},error=>{
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
        client.subscribe(base+"/guest/+",{qos:1},()=>{});
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
          {qos:relayQos(message),retain:false}
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
      const actionId=sanitizeActionId(message.actionId);
      const dedupeKey=clientId&&actionId?clientId+":"+actionId:"";

      if(dedupeKey&&this.processedActionIds.has(dedupeKey)){
        try{connection.send({type:"action_ack",actionId,accepted:this.processedActionIds.get(dedupeKey)})}catch{}
        return;
      }

      let accepted=false;
      if(Number.isInteger(seat)&&action){
        accepted=this.onAction({seat,clientId,action})!==false;
      }

      if(dedupeKey){
        this.processedActionIds.set(dedupeKey,accepted);
        while(this.processedActionIds.size>240){
          const first=this.processedActionIds.keys().next().value;
          this.processedActionIds.delete(first);
        }
        try{connection.send({type:"action_ack",actionId,accepted})}catch{}
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

    let relayError=null;
    for(const brokerUrl of RELAY_BROKER_URLS){
      try{
        const result=await this.joinViaRelay(brokerUrl);
        this.transport="relay";
        return result;
      }catch(error){
        relayError=error;
        this.cleanupRelayTransport();
      }
    }

    this.status("WSS 中繼暫時不可用，正在切換 P2P 備援。","warning");
    try{
      const result=await this.joinViaPeer();
      this.transport="peer";
      return result;
    }catch(peerError){
      const relayMessage=relayError?.message??"relay_unavailable";
      const peerMessage=peerError?.message??peerError?.type??"peer_unavailable";
      throw new Error("relay="+relayMessage+"; peer="+peerMessage);
    }
  }

  async joinViaRelay(brokerUrl=RELAY_BROKER_URLS[0]){
    const mqtt=await loadMqttLibrary();
    const base=relayBase(this.roomCode);
    const relayId=relayRandomId("we-guest-"+this.roomCode);
    const client=mqtt.connect(brokerUrl,{
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
          {qos:relayQos(message),retain:false}
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
      let presenceRetryTimer=null;
      const finish=callback=>value=>{
        if(presenceRetryTimer)clearInterval(presenceRetryTimer);
        callback(value);
      };
      const timer=setTimeout(()=>{
        if(presenceRetryTimer)clearInterval(presenceRetryTimer);
        reject(new Error("relay_join_timeout"));
      },15000);
      let settled=false;

      const startPresenceRetry=()=>{
        if(presenceRetryTimer)clearInterval(presenceRetryTimer);
        presenceRetryTimer=setInterval(()=>{
          if(!settled&&connection.open)sendPresence();
        },1400);
      };

      client.on("connect",()=>{
        if(this.relayClient!==client)return;
        client.subscribe(base+"/host/"+this.clientId,{qos:1},error=>{
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
          startPresenceRetry();
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
              if(presenceRetryTimer)clearInterval(presenceRetryTimer);
              resolve({seat:this.localSeat,state:message.state,transport:"relay"});
            }
            return;
          }

          if(message.type==="join_reject"){
            if(!settled){
              settled=true;
              clearTimeout(timer);
              if(presenceRetryTimer)clearInterval(presenceRetryTimer);
              reject(new Error(message.error??"join_rejected"));
            }
            return;
          }

          if(message.type==="state"){
            this.onState(message.state);
            return;
          }

          if(message.type==="action_ack"){
            if(message.accepted===false){
              this.status("房主未接受這次操作，畫面正在重新同步。","warning");
            }
            return;
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
      try{connection.send({type:"ping",at:Date.now()})}catch{}
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
    if(this.mode!=="guest"||!this.hostConnection?.open){
      this.status("目前尚未連回房主，操作沒有送出。","warning");
      return false;
    }
    if(this.hostConnection.relay&&this.relayClient?.connected!==true){
      this.status("網路正在重新連線，請稍候再按一次。","warning");
      return false;
    }
    const normalized=normalizeRemoteAction(action);
    if(!normalized)return false;
    const actionId=this.clientId+":"+Date.now().toString(36)+":"+(++this.actionCounter).toString(36);
    try{
      this.hostConnection.send({type:"action",actionId,action:normalized});
      return true;
    }catch{
      this.status("操作送出失敗，系統正在重新連線。","warning");
      return false;
    }
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
