import{BOARD_TILES,BOARD_VERSION,MAX_ROUNDS}from"../data/board.js";
import{assignAiProfile,aiDisplayName}from"./ai.js";
import{createInitialMarket}from"./stock-market.js";
import{normalizeInventory}from"./items.js";

export const PLAYER_COLORS=Object.freeze(["#377bd1","#e44f55","#25a978","#8a63d2"]);

export function createPlayer(seat,name,kind="ai"){
  return{
    seat,
    name:name||(kind==="ai"?aiDisplayName(seat):"玩家"+(seat+1)),
    kind,
    aiProfile:kind==="ai"?assignAiProfile(seat):null,
    clientId:null,
    connected:true,
    characterIndex:seat,
    color:PLAYER_COLORS[seat],
    cash:45600,
    position:0,
    properties:[],
    portfolio:{},
    inventory:{},
    rentPaid:0,
    rentReceived:0,
    taxEventShield:false,
    medicalMoveShield:false,
    courtShieldUntilRound:0,
    centralBankDeposit:null,
    centralMission:null,
    centralMissionUsedRound:0,
    rentInsuranceActive:false,
    rentInsuranceUsedRound:0,
    centralTransitUsedRound:0,
    centralDevelopmentUsedRound:0,
    developmentPermits:0,
    propertyProtectionPermits:0,
    forcedDiceTotal:null,
    bankrupt:false
  };
}

export function createInitialState(){
  return{
    version:BOARD_VERSION,
    gameStatus:"playing",
    round:1,
    maxRounds:MAX_ROUNDS,
    currentPlayer:0,
    phase:"await-roll",
    turnToken:1,
    aiPreparedTurnToken:null,
    dice:null,
    pendingPurchase:null,
    pendingUpgrade:null,
    pendingTransport:null,
    pendingAcquisition:null,
    pendingUrban:null,
    minigame:null,
    minigameHistory:[],
    lastMinigame:null,
    specialEventHistory:[],
    market:createInitialMarket(),
    network:{
      roomCode:null,
      hostSeat:0
    },
    players:[
      createPlayer(0,"玩家1","human"),
      createPlayer(1,null,"ai"),
      createPlayer(2,null,"ai"),
      createPlayer(3,null,"ai")
    ],
    tiles:BOARD_TILES.map(tile=>({...tile,owner:null,level:0})),
    events:[{
      id:1,
      kind:"system",
      text:"V20 Alpha 31：特殊格事件池擴充、稀有事件與地產保全經營整合。",
      data:{},
      round:1
    }],
    nextEventId:2
  };
}

export function createLobbyState(hostName="玩家1",hostClientId=null){
  const state=createInitialState();
  state.gameStatus="lobby";
  state.phase="lobby";
  state.players[0].name=hostName||"玩家1";
  state.players[0].clientId=hostClientId;
  state.players[0].connected=true;
  return state;
}

export function hydrateState(raw){
  if(!raw||typeof raw!=="object")return createInitialState();
  const fallback=createInitialState();
  const state={...fallback,...raw};

  state.players=fallback.players.map((base,seat)=>{
    const saved=raw.players?.[seat]??{};
    return{
      ...base,
      ...saved,
      seat,
      characterIndex:Number.isInteger(saved.characterIndex)&&saved.characterIndex>=0&&saved.characterIndex<PLAYER_COLORS.length
        ? saved.characterIndex
        : seat,
      color:PLAYER_COLORS[
        Number.isInteger(saved.characterIndex)&&saved.characterIndex>=0&&saved.characterIndex<PLAYER_COLORS.length
          ? saved.characterIndex
          : seat
      ],
      portfolio:saved.portfolio??{},
      inventory:normalizeInventory(saved.inventory),
      forcedDiceTotal:Number.isInteger(Number(saved.forcedDiceTotal))&&Number(saved.forcedDiceTotal)>=2&&Number(saved.forcedDiceTotal)<=12
        ? Number(saved.forcedDiceTotal)
        : null,
      taxEventShield:Boolean(saved.taxEventShield),
      medicalMoveShield:Boolean(saved.medicalMoveShield),
      courtShieldUntilRound:Math.max(0,Number(saved.courtShieldUntilRound)||0),
      centralBankDeposit:saved.centralBankDeposit&&typeof saved.centralBankDeposit==="object"
        ? saved.centralBankDeposit
        : null,
      centralMission:saved.centralMission&&typeof saved.centralMission==="object"
        ? saved.centralMission
        : null,
      centralMissionUsedRound:Math.max(0,Number(saved.centralMissionUsedRound)||0),
      rentInsuranceActive:Boolean(saved.rentInsuranceActive),
      rentInsuranceUsedRound:Math.max(0,Number(saved.rentInsuranceUsedRound)||0),
      centralTransitUsedRound:Math.max(0,Number(saved.centralTransitUsedRound)||0),
      centralDevelopmentUsedRound:Math.max(0,Number(saved.centralDevelopmentUsedRound)||0),
      developmentPermits:Math.max(0,Math.min(3,Math.floor(Number(saved.developmentPermits)||0))),
      propertyProtectionPermits:Math.max(0,Math.min(2,Math.floor(Number(saved.propertyProtectionPermits)||0)))
    };
  });

  state.tiles=fallback.tiles.map((base,index)=>{
    const saved=raw.tiles?.[index]??{};
    return{
      ...base,
      ...saved,
      acquisitionProtectedUntilRound:Math.max(0,Number(saved.acquisitionProtectedUntilRound)||0),
      permanentRentBoost:Math.max(0,Math.min(0.2,Number(saved.permanentRentBoost)||0)),
      rentBurstCharges:Math.max(0,Math.min(1,Math.floor(Number(saved.rentBurstCharges)||0))),
      rentBlockedCharges:Math.max(0,Math.min(1,Math.floor(Number(saved.rentBlockedCharges)||0)))
    };
  });
  state.market=raw.market??createInitialMarket();
  state.events=Array.isArray(raw.events)?raw.events:fallback.events;
  state.minigameHistory=Array.isArray(raw.minigameHistory)?raw.minigameHistory:[];
  state.specialEventHistory=Array.isArray(raw.specialEventHistory)?raw.specialEventHistory:[];
  state.pendingUpgrade=Number.isInteger(raw.pendingUpgrade)?raw.pendingUpgrade:null;
  state.pendingTransport=raw.pendingTransport&&typeof raw.pendingTransport==="object"?raw.pendingTransport:null;
  state.pendingAcquisition=raw.pendingAcquisition&&typeof raw.pendingAcquisition==="object"?raw.pendingAcquisition:null;
  state.pendingUrban=raw.pendingUrban&&typeof raw.pendingUrban==="object"?raw.pendingUrban:null;
  state.turnToken=Math.max(1,Number(raw.turnToken)||1);
  state.version=BOARD_VERSION;
  return state;
}

export function setPlayerCharacter(state,seat,characterIndex){
  const target=state.players?.[Number(seat)];
  const nextIndex=Math.floor(Number(characterIndex));
  if(!target||!Number.isInteger(nextIndex)||nextIndex<0||nextIndex>=PLAYER_COLORS.length)return false;

  const previousIndex=Number.isInteger(target.characterIndex)?target.characterIndex:target.seat;
  if(previousIndex===nextIndex){
    target.characterIndex=nextIndex;
    target.color=PLAYER_COLORS[nextIndex];
    return true;
  }

  const other=state.players.find(player=>player.seat!==target.seat&&player.characterIndex===nextIndex);
  if(other){
    other.characterIndex=previousIndex;
    other.color=PLAYER_COLORS[previousIndex];
  }

  target.characterIndex=nextIndex;
  target.color=PLAYER_COLORS[nextIndex];
  return true;
}

export function setHumanSeat(state,seat,{name,clientId,connected=true,characterIndex=null}={}){
  const player=state.players[seat];
  if(!player)return false;
  if(characterIndex!=null)setPlayerCharacter(state,seat,characterIndex);
  player.kind="human";
  player.aiProfile=null;
  player.name=(name||player.name||"玩家"+(seat+1)).slice(0,20);
  player.clientId=clientId??player.clientId;
  player.connected=connected;
  return true;
}

export function setAiSeat(state,seat){
  const player=state.players[seat];
  if(!player)return false;
  player.kind="ai";
  player.aiProfile=assignAiProfile(seat);
  player.clientId=null;
  player.connected=true;
  if(!player.name||player.name.startsWith("玩家"))player.name=aiDisplayName(seat);
  return true;
}
