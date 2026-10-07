import{
  CENTRAL_FEATURE_BY_ID,
  CENTRAL_MISSION_BY_ID,
  CENTRAL_TEST_TUNING
}from"../data/central-features.js";
import{bankReturnAmount}from"./world-events.js?v=alpha32-233";
import{canUpgradeProperty,upgradeCost}from"./property-economy.js?v=alpha32-233";

function currentRound(state){
  return Math.max(1,Number(state?.round)||1);
}

function bankPlan(principal){
  const amount=Math.round(Number(principal)||0);
  return CENTRAL_TEST_TUNING.bankPlans.find(plan=>plan.principal===amount)??null;
}

function minimumBankPrincipal(){
  return Math.min(...CENTRAL_TEST_TUNING.bankPlans.map(plan=>plan.principal));
}

export function centralFeatureDefinition(id){
  return CENTRAL_FEATURE_BY_ID[id]??null;
}

export function canUseCentralBase(state,seat){
  const player=state?.players?.[Number(seat)];
  return Boolean(
    player&&
    !player.bankrupt&&
    state.gameStatus==="playing"&&
    state.currentPlayer===Number(seat)&&
    state.phase==="await-roll"
  );
}

export function centralFacilityStatus(state,seat,id){
  const player=state?.players?.[Number(seat)];
  if(!player||!CENTRAL_FEATURE_BY_ID[id])return"cooldown";
  const round=currentRound(state);

  if(id==="bank"){
    if(player.centralBankDeposit)return"active";
    return canUseCentralBase(state,seat)&&player.cash>=minimumBankPrincipal()
      ?"ready"
      :"cooldown";
  }
  if(id==="mission"){
    if(player.centralMission)return"active";
    return canUseCentralBase(state,seat)&&Number(player.centralMissionUsedRound)!==round
      ?"ready"
      :"cooldown";
  }
  if(id==="insurance"){
    if(player.rentInsuranceActive)return"active";
    return canUseCentralBase(state,seat)&&Number(player.rentInsuranceUsedRound)!==round
      ?"ready"
      :"cooldown";
  }
  if(id==="transit"){
    return canUseCentralBase(state,seat)&&Number(player.centralTransitUsedRound)!==round
      ?"ready"
      :"cooldown";
  }
  if(id==="development"){
    const hasTarget=(player.properties??[]).some(index=>{
      const tile=state.tiles?.[index];
      return canUpgradeProperty(player.seat,tile)&&player.cash>=upgradeCost(tile);
    });
    return canUseCentralBase(state,seat)&&Number(player.centralDevelopmentUsedRound)!==round&&hasTarget
      ?"ready"
      :"cooldown";
  }
  return"cooldown";
}

export function canOpenBankDeposit(state,seat,principal=minimumBankPrincipal()){
  const player=state?.players?.[Number(seat)];
  const plan=bankPlan(principal);
  return Boolean(
    plan&&
    canUseCentralBase(state,seat)&&
    !player.centralBankDeposit&&
    player.cash>=plan.principal
  );
}

export function startBankDeposit(state,seat,principal=minimumBankPrincipal()){
  const plan=bankPlan(principal);
  if(!plan||!canOpenBankDeposit(state,seat,plan.principal))return{ok:false,reason:"unavailable"};
  const player=state.players[Number(seat)];
  const round=currentRound(state);
  player.cash-=plan.principal;
  const adjustedReturn=bankReturnAmount(state,plan.principal,plan.returnAmount);
  player.centralBankDeposit={
    principal:plan.principal,
    returnAmount:adjustedReturn,
    baseReturnAmount:plan.returnAmount,
    startedRound:round,
    maturesRound:round+CENTRAL_TEST_TUNING.bankRounds
  };
  return{
    ok:true,
    seat:Number(seat),
    ...player.centralBankDeposit,
    cashAfter:player.cash
  };
}

export function settleBankDeposits(state){
  const round=currentRound(state);
  const settled=[];
  for(const player of state.players??[]){
    const deposit=player.centralBankDeposit;
    if(!deposit||round<Number(deposit.maturesRound))continue;
    const amount=Math.max(0,Math.round(Number(deposit.returnAmount)||0));
    player.cash+=amount;
    player.centralBankDeposit=null;
    settled.push({seat:player.seat,amount,cashAfter:player.cash});
  }
  return settled;
}

export function canAcceptMission(state,seat,missionId){
  const player=state?.players?.[Number(seat)];
  return Boolean(
    canUseCentralBase(state,seat)&&
    player&&!player.centralMission&&
    Number(player.centralMissionUsedRound)!==currentRound(state)&&
    CENTRAL_MISSION_BY_ID[missionId]
  );
}

export function acceptMission(state,seat,missionId){
  if(!canAcceptMission(state,seat,missionId))return{ok:false,reason:"unavailable"};
  const mission=CENTRAL_MISSION_BY_ID[missionId];
  const player=state.players[Number(seat)];
  player.centralMission={
    id:mission.id,
    progress:0,
    target:mission.target,
    reward:CENTRAL_TEST_TUNING.missionReward,
    acceptedRound:currentRound(state)
  };
  return{ok:true,seat:Number(seat),mission:player.centralMission};
}

export function recordMissionAction(state,seat,action){
  const player=state?.players?.[Number(seat)];
  const mission=player?.centralMission;
  if(!mission||mission.id!==action)return null;
  mission.progress=Math.min(mission.target,mission.progress+1);
  if(mission.progress<mission.target){
    return{completed:false,mission:{...mission}};
  }
  const reward=Math.max(0,Math.round(Number(mission.reward)||0));
  player.cash+=reward;
  player.centralMission=null;
  player.centralMissionUsedRound=currentRound(state);
  return{
    completed:true,
    missionId:mission.id,
    reward,
    cashAfter:player.cash
  };
}

export function canActivateInsurance(state,seat){
  const player=state?.players?.[Number(seat)];
  return Boolean(
    canUseCentralBase(state,seat)&&
    player&&!player.rentInsuranceActive&&
    Number(player.rentInsuranceUsedRound)!==currentRound(state)
  );
}

export function activateInsurance(state,seat){
  if(!canActivateInsurance(state,seat))return{ok:false,reason:"unavailable"};
  const player=state.players[Number(seat)];
  player.rentInsuranceActive=true;
  player.rentInsuranceUsedRound=currentRound(state);
  return{ok:true,seat:Number(seat)};
}

export function applyRentInsurance(player,rent){
  const requested=Math.max(0,Math.round(Number(rent)||0));
  if(!player?.rentInsuranceActive){
    return{rent:requested,discount:0,protected:false};
  }
  const reduced=Math.max(0,Math.round(requested*CENTRAL_TEST_TUNING.insuranceRentMultiplier));
  player.rentInsuranceActive=false;
  return{
    rent:reduced,
    discount:requested-reduced,
    protected:true
  };
}

export function canUseCentralTransit(state,seat,distance){
  const player=state?.players?.[Number(seat)];
  const value=Math.floor(Number(distance));
  return Boolean(
    canUseCentralBase(state,seat)&&
    Number(player.centralTransitUsedRound)!==currentRound(state)&&
    CENTRAL_TEST_TUNING.transitDistances.includes(value)
  );
}

export function buildForwardPath(state,position,distance){
  const size=Math.max(1,state.tiles?.length??44);
  const path=[];
  let current=Number(position)||0;
  for(let step=0;step<distance;step++){
    current=(current+1)%size;
    path.push(current);
  }
  return path;
}

export function markCentralTransitUsed(state,seat){
  const player=state?.players?.[Number(seat)];
  if(player)player.centralTransitUsedRound=currentRound(state);
}

export function centralDevelopmentOptions(state,seat){
  const player=state?.players?.[Number(seat)];
  if(!player)return[];
  return(player.properties??[])
    .map(index=>({index,tile:state.tiles?.[index]}))
    .filter(({tile})=>canUpgradeProperty(player.seat,tile))
    .map(({index,tile})=>({
      tileIndex:index,
      tileName:tile.name,
      group:tile.group,
      level:tile.level,
      cost:upgradeCost(tile),
      affordable:player.cash>=upgradeCost(tile)
    }));
}

export function canUseCentralDevelopment(state,seat,tileIndex){
  const player=state?.players?.[Number(seat)];
  const tile=state?.tiles?.[Number(tileIndex)];
  return Boolean(
    canUseCentralBase(state,seat)&&
    player&&
    Number(player.centralDevelopmentUsedRound)!==currentRound(state)&&
    canUpgradeProperty(player.seat,tile)&&
    player.cash>=upgradeCost(tile)
  );
}

export function markCentralDevelopmentUsed(state,seat){
  const player=state?.players?.[Number(seat)];
  if(player)player.centralDevelopmentUsedRound=currentRound(state);
}
