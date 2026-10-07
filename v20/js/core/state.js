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
    portLogistics:null,
    governmentContract:null,
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
    pendingStrategicChoice:null,
    strategicEffects:{
      globalRent:{multiplier:1,untilRound:0,label:""},
      groupRents:{},
      bank:{multiplier:1,untilRound:0,label:""},
      transport:{blockedNodeIndex:null,blockedUntilRound:0,freeUntilRound:0,freeDayBonus:0},
      marketItemLockUntilRound:0
    },
    minigame:null,
    minigameHistory:[],
    lastMinigame:null,
    specialEventHistory:[],
    market:createInitialMarket(),
    network:{
      roomCode:null,
      hostSeat:0,
      hostClientId:null
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
      text:"V20 Alpha 32：策略道具正式實裝，加入 inventory、效果、AI、事件掉落與多人同步。",
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
  state.network.hostSeat=0;
  state.network.hostClientId=hostClientId;
  return state;
}

export function hydrateState(raw){
  if(!raw||typeof raw!=="object")return createInitialState();
  const fallback=createInitialState();
  const state={...fallback,...raw};
  state.network={...fallback.network,...(raw.network??{})};

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
      portLogistics:saved.portLogistics&&typeof saved.portLogistics==="object"&&Number(saved.portLogistics.remainingCharges)>0
        ?{
            group:String(saved.portLogistics.group??""),
            remainingCharges:Math.max(0,Math.min(2,Math.floor(Number(saved.portLogistics.remainingCharges)||0))),
            bonus:Math.max(0,Math.min(0.15,Number(saved.portLogistics.bonus)||0.15))
          }
        :null,
      governmentContract:saved.governmentContract&&typeof saved.governmentContract==="object"
        ?{
            action:String(saved.governmentContract.action??""),
            dueRound:Math.max(0,Number(saved.governmentContract.dueRound)||0),
            reward:Math.max(0,Number(saved.governmentContract.reward)||0),
            investment:Math.max(0,Number(saved.governmentContract.investment)||0),
            acceptedRound:Math.max(0,Number(saved.governmentContract.acceptedRound)||0)
          }
        :null,
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
      rentBlockedCharges:Math.max(0,Math.min(1,Math.floor(Number(saved.rentBlockedCharges)||0))),
      maintenanceRentPenaltyCharges:Math.max(0,Math.min(1,Math.floor(Number(saved.maintenanceRentPenaltyCharges)||0))),
      maintenanceRentMultiplier:Math.max(0.7,Math.min(1,Number(saved.maintenanceRentMultiplier)||1)),
      leaseRentBoostCharges:Math.max(0,Math.min(2,Math.floor(Number(saved.leaseRentBoostCharges)||0))),
      leaseRentBonus:Math.max(0,Math.min(0.15,Number(saved.leaseRentBonus)||0)),
      temporaryValueMultiplier:Math.max(0.5,Math.min(1.5,Number(saved.temporaryValueMultiplier)||1)),
      temporaryValueUntilRound:Math.max(0,Number(saved.temporaryValueUntilRound)||0)
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
  state.pendingStrategicChoice=raw.pendingStrategicChoice&&typeof raw.pendingStrategicChoice==="object"
    ?raw.pendingStrategicChoice
    :null;
  const rawEffects=raw.strategicEffects&&typeof raw.strategicEffects==="object"?raw.strategicEffects:{};
  state.strategicEffects={
    globalRent:{
      multiplier:Number(rawEffects.globalRent?.multiplier)||1,
      untilRound:Math.max(0,Number(rawEffects.globalRent?.untilRound)||0),
      label:String(rawEffects.globalRent?.label??"")
    },
    groupRents:rawEffects.groupRents&&typeof rawEffects.groupRents==="object"?rawEffects.groupRents:{},
    bank:{
      multiplier:Number(rawEffects.bank?.multiplier)||1,
      untilRound:Math.max(0,Number(rawEffects.bank?.untilRound)||0),
      label:String(rawEffects.bank?.label??"")
    },
    transport:{
      blockedNodeIndex:Number.isInteger(Number(rawEffects.transport?.blockedNodeIndex))
        ?Number(rawEffects.transport.blockedNodeIndex)
        :null,
      blockedUntilRound:Math.max(0,Number(rawEffects.transport?.blockedUntilRound)||0),
      freeUntilRound:Math.max(0,Number(rawEffects.transport?.freeUntilRound)||0),
      freeDayBonus:Math.max(0,Number(rawEffects.transport?.freeDayBonus)||0)
    },
    marketItemLockUntilRound:Math.max(0,Number(rawEffects.marketItemLockUntilRound)||0)
  };
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
