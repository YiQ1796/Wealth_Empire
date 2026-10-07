import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{propertyValue}from"../js/core/property-economy.js";
import{
  advanceWorldRound,
  bankReturnAmount,
  isMarketItemBlocked,
  marketCircuitBreakerActive,
  recordGovernmentContractAction,
  resolveExtendedEventEffect,
  resolveWorldChoice,
  sectorVolatilityMultiplier,
  transportWorldStatus,
  worldRentMultiplier,
  worldStatusSummary
}from"../js/core/world-events.js";
import{CHANCE_EVENTS,FATE_EVENTS}from"../js/data/special-events.js";
import{CIVIC_EVENT_POOLS}from"../js/data/civic-events.js";

function sequenceRandom(values){
  let index=0;
  return()=>{
    const value=values[Math.min(index,values.length-1)]??0;
    index+=1;
    return value;
  };
}
function event(name,id=name){return{id,name,description:name,rarity:"common"}}

const requiredChance=[
  "chance_city_economy_cycle","chance_property_maintenance_choice","chance_region_development_grant",
  "chance_transport_day","chance_hot_property_market","chance_tourism_season","chance_city_festival",
  "chance_government_contract","chance_lease_contract"
];
const requiredFate=[
  "fate_bank_rate_shift","fate_tech_subsidy","fate_financial_turbulence",
  "fate_property_revaluation","fate_market_circuit_breaker"
];
for(const id of requiredChance)assert.ok(CHANCE_EVENTS.some(item=>item.id===id),"missing chance event "+id);
for(const id of requiredFate)assert.ok(FATE_EVENTS.some(item=>item.id===id),"missing fate event "+id);
assert.ok(CIVIC_EVENT_POOLS.market.some(item=>item.id==="market_sector_news"));
assert.ok(CIVIC_EVENT_POOLS.market.some(item=>item.id==="market_dividend_season"));

{
  const state=createInitialState();
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"world_rent_cycle"},event("城市景氣循環"),()=>.9);
  assert.equal(result.kind,"world_rent_cycle");
  assert.equal(worldRentMultiplier(state,"海港區"),1.15);
  assert.ok(worldStatusSummary(state).some(text=>text.includes("城市繁榮")));
}

{
  const state=createInitialState();
  const before=state.market.stocks.map(stock=>stock.price);
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"sector_news"},event("產業新聞"),sequenceRandom([0,.9]));
  assert.ok(result.sector);
  assert.ok(result.movers.length>=1);
  assert.ok(state.market.stocks.some((stock,index)=>stock.price!==before[index]));
}

{
  const state=createInitialState();
  state.players[0].portfolio.TECH={shares:10,avgCost:100,realizedPnl:0};
  const cashBefore=state.players[0].cash;
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"dividend_season"},event("股息季"),()=>0);
  assert.equal(result.kind,"dividend_season");
  assert.ok(state.players[0].cash>cashBefore);
}

{
  const state=createInitialState();
  const tileIndex=state.tiles.findIndex(tile=>tile.type==="property");
  state.tiles[tileIndex].owner=0;
  state.players[0].properties.push(tileIndex);
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"property_maintenance_choice"},event("房產維修抉擇"),()=>0);
  assert.ok(result.pendingChoice);
  state.phase="world_choice";
  assert.equal(resolveWorldChoice(state,0,"defer_maintenance").ok,true);
  assert.equal(state.tiles[tileIndex].rentPenaltyCharges,1);
  assert.equal(state.tiles[tileIndex].rentPenaltyMultiplier,.70);
}

{
  const state=createInitialState();
  const group="海港區";
  for(let index=0;index<state.tiles.length;index++){
    if(state.tiles[index].type==="property"&&state.tiles[index].group===group){
      state.tiles[index].owner=0;
      state.players[0].properties.push(index);
    }
  }
  const permitsBefore=state.players[0].developmentPermits;
  const cashBefore=state.players[0].cash;
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"region_development_grant"},event("連區發展補助"),()=>0);
  assert.equal(result.group,group);
  assert.equal(state.players[0].cash,cashBefore+1200);
  assert.equal(state.players[0].developmentPermits,permitsBefore+1);
}

{
  const state=createInitialState();
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"transport_day"},event("交通營運日"),()=>.9);
  assert.equal(result.mode,"free_day");
  assert.equal(transportWorldStatus(state).mode,"free_day");
}

{
  const state=createInitialState();
  resolveExtendedEventEffect(state,state.players[0],{kind:"bank_rate_shift"},event("利率決策"),()=>.9);
  assert.equal(bankReturnAmount(state,5000,6000),6500);
}

{
  const state=createInitialState();
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"hot_property_market"},event("房市熱區"),()=>0);
  assert.equal(result.group,"海港區");
  assert.equal(worldRentMultiplier(state,"海港區"),1.20);
}

{
  const state=createInitialState();
  resolveExtendedEventEffect(state,state.players[0],{kind:"tourism_season"},event("觀光旺季"),()=>0);
  assert.equal(worldRentMultiplier(state,"觀光區"),1.25);
}

{
  const state=createInitialState();
  const tech=state.market.stocks.find(stock=>stock.id==="TECH");
  const chip=state.market.stocks.find(stock=>stock.id==="CHIP");
  const beforeTech=tech.price;
  const beforeChip=chip.price;
  resolveExtendedEventEffect(state,state.players[0],{kind:"tech_subsidy"},event("科技補助潮"),()=>0);
  assert.equal(worldRentMultiplier(state,"科技區"),1.15);
  assert.ok(tech.price>beforeTech);
  assert.ok(chip.price>beforeChip);
}

{
  const state=createInitialState();
  resolveExtendedEventEffect(state,state.players[0],{kind:"financial_turbulence"},event("金融震盪"),()=>0);
  assert.equal(worldRentMultiplier(state,"金融區"),.85);
  assert.equal(sectorVolatilityMultiplier(state,"金融"),1.8);
}

{
  const state=createInitialState();
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"city_festival"},event("城市大型活動"),()=>.9);
  assert.equal(result.group,"觀光區");
  assert.equal(worldRentMultiplier(state,"觀光區"),1.20);
}

{
  const state=createInitialState();
  const player=state.players[0];
  const cashBefore=player.cash;
  const result=resolveExtendedEventEffect(state,player,{kind:"government_contract"},event("政府標案"),()=>0);
  assert.ok(result.pendingChoice);
  state.phase="world_choice";
  assert.equal(resolveWorldChoice(state,0,"accept_contract").ok,true);
  assert.equal(player.cash,cashBefore-700);
  const completed=recordGovernmentContractAction(state,0,"buy_property");
  assert.equal(completed.completed,true);
  assert.equal(player.cash,cashBefore-700+2400);
  assert.equal(player.governmentContract,null);
}

{
  const state=createInitialState();
  const group="海港區";
  const target=state.tiles.find(tile=>tile.type==="property"&&tile.group===group);
  const before=propertyValue(target);
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"property_revaluation"},event("房價重估"),sequenceRandom([0,.9]));
  assert.equal(result.group,group);
  assert.ok(propertyValue(target)>before);
}

{
  const state=createInitialState();
  resolveExtendedEventEffect(state,state.players[0],{kind:"market_circuit_breaker"},event("市場熔斷"),()=>0);
  assert.equal(marketCircuitBreakerActive(state),true);
  assert.equal(isMarketItemBlocked(state,"stock_boost"),true);
  assert.equal(isMarketItemBlocked(state,"stock_drop"),true);
  assert.equal(isMarketItemBlocked(state,"remote_dice"),false);
}

{
  const state=createInitialState();
  const tileIndex=state.tiles.findIndex(tile=>tile.type==="property");
  state.tiles[tileIndex].owner=0;
  state.players[0].properties.push(tileIndex);
  const cashBefore=state.players[0].cash;
  const result=resolveExtendedEventEffect(state,state.players[0],{kind:"lease_contract"},event("租賃契約"),()=>0);
  assert.ok(result.pendingChoice);
  state.phase="world_choice";
  assert.equal(resolveWorldChoice(state,0,"sign_lease").ok,true);
  assert.equal(state.players[0].cash,cashBefore-600);
  assert.equal(state.tiles[tileIndex].leaseBonusCharges,2);
  assert.equal(state.tiles[tileIndex].leaseBonusMultiplier,1.15);
}

{
  const state=createInitialState();
  resolveExtendedEventEffect(state,state.players[0],{kind:"world_rent_cycle"},event("城市景氣循環"),()=>.9);
  state.round=3;
  advanceWorldRound(state);
  assert.equal(worldRentMultiplier(state,"海港區"),1);
}

console.log("V20 Alpha 32.4.0 world events P1-P3 test PASS");
