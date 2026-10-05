import assert from"node:assert/strict";
import{BOARD_TILES,GROUP_ORDER,MAX_PROPERTY_LEVEL,boardPlacement}from"../js/data/board.js";
import{createInitialState}from"../js/core/state.js";
import{GameEngine}from"../js/core/game.js";
import{canForceAcquireProperty,groupProgress,rentFor,upgradeCost}from"../js/core/property-economy.js";

assert.equal(BOARD_TILES.length,44,"board must contain exactly 44 tiles");

const properties=BOARD_TILES.filter(tile=>tile.type==="property");
assert.equal(properties.length,24,"board must contain exactly 24 properties");
assert.equal(GROUP_ORDER.length,8,"board must contain exactly 8 property groups");

for(const group of GROUP_ORDER){
  assert.equal(
    properties.filter(tile=>tile.group===group).length,
    3,
    group+" must contain exactly 3 properties"
  );
}

const occupied=new Set();
BOARD_TILES.forEach((tile,index)=>{
  const placement=boardPlacement(index);
  const key=placement.row+":"+placement.col;
  assert.equal(occupied.has(key),false,"duplicate board grid position at "+key);
  occupied.add(key);
});
assert.equal(occupied.size,44,"all 44 tiles must have unique grid positions");

const state=createInitialState();
const engine=new GameEngine(state,()=>{});
const buyer=state.players[0];
const firstGroup=GROUP_ORDER[0];
const firstGroupIndexes=state.tiles
  .map((tile,index)=>({tile,index}))
  .filter(entry=>entry.tile.type==="property"&&entry.tile.group===firstGroup)
  .map(entry=>entry.index);

for(const tileIndex of firstGroupIndexes){
  buyer.position=tileIndex;
  state.currentPlayer=0;
  state.phase="landed";
  state.pendingPurchase=tileIndex;
  const tile=state.tiles[tileIndex];
  buyer.cash=Math.max(buyer.cash,tile.price+50000);
  assert.equal(engine.buyCurrentProperty(),true,"property purchase should succeed");
}

const progress=groupProgress(state,buyer.seat,firstGroup);
assert.deepEqual(progress,{owned:3,total:3,complete:true},"buying all 3 properties must complete the region");

const upgradedTile=state.tiles[firstGroupIndexes[0]];
const completeGroupBaseRent=Math.round(upgradedTile.rent*1.25);
assert.equal(rentFor(state,upgradedTile),completeGroupBaseRent,"complete group must add 25% rent");

state.phase="await-roll";
state.pendingPurchase=null;
buyer.cash=100000;
const expectedUpgradeCost=Math.round(upgradedTile.price*0.5);
assert.equal(upgradeCost(upgradedTile),expectedUpgradeCost,"upgrade cost must equal 50% of property price");

assert.equal(engine.upgradeProperty(firstGroupIndexes[0]),true,"LV0 -> LV1 upgrade should succeed");
assert.equal(upgradedTile.level,1);
assert.equal(engine.upgradeProperty(firstGroupIndexes[0]),true,"LV1 -> LV2 upgrade should succeed");
assert.equal(upgradedTile.level,MAX_PROPERTY_LEVEL);
assert.equal(canForceAcquireProperty(upgradedTile),false,"LV2 property must never be force-acquirable");
assert.equal(engine.upgradeProperty(firstGroupIndexes[0]),false,"upgrading past LV2 must be rejected");

const forceAcquireCandidate=state.tiles[firstGroupIndexes[1]];
forceAcquireCandidate.level=1;
assert.equal(canForceAcquireProperty(forceAcquireCandidate),true,"LV1 property may still be force-acquirable");
forceAcquireCandidate.level=0;
assert.equal(canForceAcquireProperty(forceAcquireCandidate),true,"LV0 owned property may still be force-acquirable");

state.currentPlayer=1;
state.phase="await-roll";
state.pendingPurchase=null;
assert.equal(
  engine.upgradeProperty(firstGroupIndexes[1]),
  false,
  "a player must not upgrade another player's property"
);

state.currentPlayer=0;
state.phase="landed";
state.pendingPurchase=firstGroupIndexes[2];
assert.equal(
  engine.upgradeProperty(firstGroupIndexes[1]),
  false,
  "property upgrades must be blocked while a purchase decision is pending"
);
state.pendingPurchase=null;

const payer=state.players[1];
state.currentPlayer=1;
state.phase="await-roll";
state.pendingPurchase=null;
payer.position=firstGroupIndexes[0];
payer.cash=100000;
const ownerCashBefore=buyer.cash;
const payerCashBefore=payer.cash;
const expectedRent=rentFor(state,upgradedTile);
const rentReceivedBefore=buyer.rentReceived;
const rentPaidBefore=payer.rentPaid;

engine.resolveLanding(payer);

assert.equal(buyer.cash,ownerCashBefore+expectedRent,"owner must receive the exact calculated rent");
assert.equal(payer.cash,payerCashBefore-expectedRent,"payer must pay the exact calculated rent");
assert.equal(buyer.rentReceived,rentReceivedBefore+expectedRent,"owner rent history total must update");
assert.equal(payer.rentPaid,rentPaidBefore+expectedRent,"payer rent history total must update");

console.log("V20 Alpha 18 property economy test PASS");
