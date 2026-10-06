import fs from"node:fs";
import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{GameEngine}from"../js/core/game.js";
import{
  CENTRAL_FEATURES,
  CENTRAL_TEST_TUNING
}from"../js/data/central-features.js";
import{
  applyRentInsurance,
  centralFacilityStatus,
  settleBankDeposits
}from"../js/core/central-features.js";
import{normalizeRemoteAction}from"../js/core/network.js";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");

assert.equal(CENTRAL_FEATURES.length,5);
assert.deepEqual(
  CENTRAL_FEATURES.map(feature=>feature.id),
  ["bank","mission","transit","insurance","development"]
);
assert.doesNotMatch(html,/都會核心/,"old center text render source must stay removed");
for(const id of["bank","mission","transit","insurance","development"]){
  assert.match(html,new RegExp('data-central-facility="'+id+'"'));
}
for(const asset of[
  "CENTRAL_BANK.webp",
  "CENTRAL_MISSION.webp",
  "CENTRAL_TRANSIT.webp",
  "CENTRAL_INSURANCE.webp",
  "CENTRAL_DEVELOPMENT.webp"
]){
  const path=new URL("../assets/center-v1/"+asset,import.meta.url);
  assert.equal(fs.existsSync(path),true,"missing materialized central building "+asset);
  assert.ok(fs.statSync(path).size>0,"empty central building "+asset);
}

assert.deepEqual(
  CENTRAL_TEST_TUNING.bankPlans.map(plan=>[plan.principal,plan.returnAmount]),
  [[5000,6000],[10000,12000],[20000,23000]]
);

for(const plan of CENTRAL_TEST_TUNING.bankPlans){
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const player=state.players[0];
  const cashBefore=player.cash;

  assert.equal(centralFacilityStatus(state,0,"bank"),"ready");
  assert.equal(engine.centralBankDeposit(0,plan.principal),true);
  assert.equal(player.cash,cashBefore-plan.principal);
  assert.ok(player.centralBankDeposit);
  assert.equal(player.centralBankDeposit.principal,plan.principal);
  assert.equal(player.centralBankDeposit.returnAmount,plan.returnAmount);
  assert.equal(player.centralBankDeposit.maturesRound,state.round+CENTRAL_TEST_TUNING.bankRounds);

  state.round=player.centralBankDeposit.maturesRound;
  const settled=settleBankDeposits(state);
  assert.equal(settled.length,1);
  assert.equal(player.centralBankDeposit,null);
  assert.equal(
    player.cash,
    cashBefore-plan.principal+plan.returnAmount
  );
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const player=state.players[0];
  const stock=state.market.stocks[0];
  const before=player.cash;

  assert.equal(engine.centralAcceptMission("buy_stock",0),true);
  assert.equal(player.centralMission?.id,"buy_stock");
  assert.equal(engine.buyStock(stock.id,1,0),true);
  assert.equal(player.centralMission,null);
  assert.equal(player.centralMissionUsedRound,state.round);
  assert.ok(
    state.events.some(event=>event.kind==="central_mission_complete"),
    "mission completion must create a completion event"
  );
  assert.equal(
    player.cash,
    before-stock.price+CENTRAL_TEST_TUNING.missionReward
  );
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const player=state.players[0];

  assert.equal(engine.centralActivateInsurance(0),true);
  assert.equal(player.rentInsuranceActive,true);
  const insured=applyRentInsurance(player,1000);
  assert.equal(insured.protected,true);
  assert.equal(insured.rent,Math.round(1000*CENTRAL_TEST_TUNING.insuranceRentMultiplier));
  assert.equal(player.rentInsuranceActive,false);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const player=state.players[0];
  const from=player.position;
  assert.equal(engine.centralTransit(3,0),true);
  assert.equal(player.centralTransitUsedRound,state.round);
  assert.equal(player.position,(from+3)%state.tiles.length);
  assert.ok(
    state.events.some(event=>event.kind==="move"&&event.data?.centralTransit===true),
    "central transit must create a real move event"
  );
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const player=state.players[0];
  const tileIndex=state.tiles.findIndex(tile=>tile.type==="property");
  assert.ok(tileIndex>=0);
  state.tiles[tileIndex].owner=0;
  player.properties.push(tileIndex);
  player.cash=999999;

  assert.equal(engine.centralDevelopmentUpgrade(tileIndex,0),true);
  assert.equal(state.tiles[tileIndex].level,1);
  assert.equal(player.centralDevelopmentUsedRound,state.round);
  assert.ok(state.events.some(event=>event.kind==="central_development"));
}

assert.deepEqual(
  normalizeRemoteAction({type:"central_bank_deposit",principal:5000}),
  {type:"central_bank_deposit",principal:5000}
);
assert.deepEqual(
  normalizeRemoteAction({type:"central_bank_deposit",principal:10000}),
  {type:"central_bank_deposit",principal:10000}
);
assert.deepEqual(
  normalizeRemoteAction({type:"central_bank_deposit",principal:20000}),
  {type:"central_bank_deposit",principal:20000}
);
assert.equal(normalizeRemoteAction({type:"central_bank_deposit",principal:7000}),null);
assert.deepEqual(normalizeRemoteAction({type:"central_insurance"}),{type:"central_insurance"});
assert.deepEqual(normalizeRemoteAction({type:"central_transit",distance:6}),{type:"central_transit",distance:6});
assert.equal(normalizeRemoteAction({type:"central_transit",distance:5}),null);
assert.deepEqual(
  normalizeRemoteAction({type:"central_mission_accept",missionId:"buy_property"}),
  {type:"central_mission_accept",missionId:"buy_property"}
);

console.log("V20 Alpha 29 central five facilities test PASS");
