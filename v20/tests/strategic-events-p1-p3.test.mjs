import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{CHANCE_EVENTS,FATE_EVENTS}from"../js/data/special-events.js";
import{rentBreakdown,propertyValue}from"../js/core/property-economy.js";
import{resolveStrategicEvent,resolvePendingStrategicChoice,recordStrategicAction}from"../js/core/strategic-events.js";
import{getItemUseStatus}from"../js/core/items.js";
import{startBankDeposit}from"../js/core/central-features.js";
import{normalizeRemoteAction}from"../js/core/network.js";

assert.deepEqual(
  normalizeRemoteAction({type:"strategic_choice",choiceId:"sign",targetValue:7}),
  {type:"strategic_choice",choiceId:"sign",targetValue:7}
);
assert.deepEqual(
  normalizeRemoteAction({type:"strategic_choice",choiceId:"decline",targetValue:null}),
  {type:"strategic_choice",choiceId:"decline",targetValue:null}
);

const requiredIds=[
  "city_cycle","industry_news","dividend_season","property_maintenance_choice",
  "region_development_subsidy","transport_labor_day",
  "interest_rate_decision","housing_hot_zone","tourism_peak","tech_subsidy_wave",
  "financial_turbulence","city_major_event","government_contract",
  "property_revaluation","market_circuit_breaker","lease_contract"
];
const definitions=[...CHANCE_EVENTS,...FATE_EVENTS];
for(const strategicId of requiredIds){
  assert.ok(
    definitions.some(event=>event.effect?.kind==="strategic"&&event.effect?.strategicId===strategicId),
    "missing P1-P3 strategic event "+strategicId
  );
}

function event(id,name=id){
  return{id:"test_"+id,name,description:name,effect:{kind:"strategic",strategicId:id}};
}
function fixedRandom(value){return()=>value}

// P1: city cycle must change actual rent calculation.
{
  const state=createInitialState();
  const player=state.players[0];
  const tile=state.tiles.find(entry=>entry.type==="property");
  tile.owner=0;
  player.properties=[state.tiles.indexOf(tile)];
  const before=rentBreakdown(state,tile).finalRent;
  const result=resolveStrategicEvent(state,player,event("city_cycle","城市景氣循環"),fixedRandom(0.9));
  assert.match(result.summary,/\+15%/);
  assert.equal(state.strategicEffects.globalRent.multiplier,1.15);
  assert.ok(rentBreakdown(state,tile).finalRent>before);
}

// P1: industry news moves every stock in the selected sector.
{
  const state=createInitialState();
  const player=state.players[0];
  const result=resolveStrategicEvent(state,player,event("industry_news","產業新聞"),fixedRandom(0.9));
  assert.ok(result.data.sector);
  assert.ok(result.data.movers.length>=1);
  assert.ok(result.data.movers.every(item=>item.changePercent>0));
}

// P1: dividends pay actual holders and do not create money for non-holders.
{
  const state=createInitialState();
  const player=state.players[0];
  const stock=state.market.stocks[0];
  player.portfolio[stock.id]={shares:100,avgCost:stock.price,realizedPnl:0};
  const cashBefore=player.cash;
  const result=resolveStrategicEvent(state,player,event("dividend_season","股息季"),fixedRandom(0.5));
  assert.ok(result.data.total>0);
  assert.ok(player.cash>cashBefore);
  assert.equal(result.data.payouts.some(item=>item.seat===0),true);
}

// P1: maintenance is a real choice and deferred repair changes the next rent.
{
  const state=createInitialState();
  const player=state.players[0];
  const tileIndex=state.tiles.findIndex(entry=>entry.type==="property");
  const tile=state.tiles[tileIndex];
  tile.owner=0;
  player.properties=[tileIndex];
  const result=resolveStrategicEvent(state,player,event("property_maintenance_choice","房產維修抉擇"),fixedRandom(0.5));
  assert.equal(result.requiresChoice,true);
  const choice=resolvePendingStrategicChoice(state,0,"defer",tileIndex);
  assert.equal(choice.ok,true);
  assert.equal(tile.maintenanceRentPenaltyCharges,1);
  assert.equal(rentBreakdown(state,tile).maintenanceMultiplier,0.7);
}

// P1: completed region receives a concrete subsidy.
{
  const state=createInitialState();
  const player=state.players[0];
  const group="海港區";
  const indexes=state.tiles
    .map((tile,index)=>({tile,index}))
    .filter(entry=>entry.tile.type==="property"&&entry.tile.group===group)
    .map(entry=>entry.index);
  for(const index of indexes)state.tiles[index].owner=0;
  player.properties=[...indexes];
  const result=resolveStrategicEvent(state,player,event("region_development_subsidy","連區發展補助"),fixedRandom(0.5));
  assert.equal(result.data.permitDelta,1);
  assert.equal(player.developmentPermits,1);
}

// P1: transport free day exposes a free-use bonus state.
{
  const state=createInitialState();
  const result=resolveStrategicEvent(state,state.players[0],event("transport_labor_day","交通罷工／免費日"),fixedRandom(0.9));
  assert.equal(result.data.mode,"free");
  assert.equal(state.strategicEffects.transport.freeDayBonus,500);
}

// P2: interest rate applies only to the next round.
{
  const state=createInitialState();
  const player=state.players[0];
  const result=resolveStrategicEvent(state,player,event("interest_rate_decision","利率決策"),fixedRandom(0.9));
  assert.equal(result.data.activeFromRound,2);
  const current=startBankDeposit(state,0,5000);
  assert.equal(current.returnAmount,6000,"current round deposit must not use next-round interest event");

  const state2=createInitialState();
  state2.round=2;
  state2.strategicEffects.bank={...state.strategicEffects.bank};
  const next=startBankDeposit(state2,0,5000);
  assert.equal(next.returnAmount,6600,"next round deposit must receive +10% return amount");
}

// P2: hot zones, tourism, tech and financial events all modify actual systems.
{
  const state=createInitialState();
  const player=state.players[0];
  resolveStrategicEvent(state,player,event("tourism_peak","觀光旺季"),fixedRandom(0.5));
  const tourism=state.tiles.find(tile=>tile.type==="property"&&tile.group==="觀光區");
  tourism.owner=0;
  assert.equal(rentBreakdown(state,tourism).strategicGroupMultiplier,1.25);

  const techBefore=state.market.stocks.find(stock=>stock.id==="TECH").price;
  resolveStrategicEvent(state,player,event("tech_subsidy_wave","科技補助潮"),fixedRandom(0.5));
  assert.ok(state.market.stocks.find(stock=>stock.id==="TECH").price>techBefore);

  resolveStrategicEvent(state,player,event("financial_turbulence","金融震盪"),fixedRandom(0.9));
  const finance=state.tiles.find(tile=>tile.type==="property"&&tile.group==="金融區");
  finance.owner=0;
  assert.equal(rentBreakdown(state,finance).strategicGroupMultiplier,0.85);
}

// P2: government contract is delayed and pays only after the requested action.
{
  const state=createInitialState();
  const player=state.players[0];
  player.cash=10000;
  const result=resolveStrategicEvent(state,player,event("government_contract","政府標案"),fixedRandom(0));
  assert.equal(result.requiresChoice,true);
  const accept=state.pendingStrategicChoice.options.find(option=>option.id==="accept");
  const choice=resolvePendingStrategicChoice(state,0,"accept");
  assert.equal(choice.ok,true);
  assert.ok(player.governmentContract);
  const cashAfterInvestment=player.cash;
  const completed=recordStrategicAction(state,0,accept.action);
  assert.equal(completed.completed,true);
  assert.equal(player.cash,cashAfterInvestment+3500);
}

// P3: revaluation changes property value, circuit breaker blocks only stock items,
// and lease contract produces two boosted rent charges.
{
  const state=createInitialState();
  const player=state.players[0];
  const propertyIndex=state.tiles.findIndex(tile=>tile.type==="property");
  const tile=state.tiles[propertyIndex];
  tile.owner=0;
  player.properties=[propertyIndex];

  const baseValue=propertyValue(tile);
  const revaluation=resolveStrategicEvent(state,player,event("property_revaluation","房價重估"),fixedRandom(0.9));
  const changedTile=state.tiles.find(entry=>entry.type==="property"&&entry.group===revaluation.data.group);
  assert.notEqual(propertyValue(changedTile),changedTile.price+Math.round(changedTile.price*0.5)*changedTile.level);

  player.inventory.stock_boost=1;
  resolveStrategicEvent(state,player,event("market_circuit_breaker","市場熔斷"),fixedRandom(0.5));
  assert.equal(getItemUseStatus(state,0,"stock_boost").usable,false);
  assert.match(getItemUseStatus(state,0,"stock_boost").reason,/市場熔斷/);

  state.strategicEffects.marketItemLockUntilRound=0;
  player.cash=10000;
  const lease=resolveStrategicEvent(state,player,event("lease_contract","租賃契約"),fixedRandom(0.5));
  assert.equal(lease.requiresChoice,true);
  const sign=state.pendingStrategicChoice.options.find(option=>option.id==="sign");
  assert.ok(sign);
  const signed=resolvePendingStrategicChoice(state,0,"sign",sign.targetValue);
  assert.equal(signed.ok,true);
  const leased=state.tiles[Number(sign.targetValue)];
  assert.equal(leased.leaseRentBoostCharges,2);
  assert.equal(rentBreakdown(state,leased).leaseMultiplier,1.15);
  assert.ok(propertyValue(tile)>=0&&baseValue>=0);
}

console.log("V20 Alpha32.3.13 P1-P3 strategic event regression PASS");
