import assert from"node:assert/strict";
import{createInitialState,hydrateState}from"../js/core/state.js";
import{grantItem,inventoryCount,listValidTargets,useItem}from"../js/core/items.js";
import{rentFor}from"../js/core/property-economy.js";
import{normalizeRemoteAction}from"../js/core/network.js";
import{GameEngine}from"../js/core/game.js";
import{CHANCE_EVENTS,FATE_EVENTS}from"../js/data/special-events.js";

const rewardedItems=new Set(
  [...CHANCE_EVENTS,...FATE_EVENTS]
    .filter(event=>event.effect?.kind==="grant_item")
    .map(event=>event.effect.itemId)
);
assert.ok(rewardedItems.size>=5,"chance/fate pools must award at least five strategy-item types");

const state=createInitialState();
state.gameStatus="playing";
state.currentPlayer=0;
state.phase="await-roll";
const player=state.players[0];

state.tiles[1].owner=0;
player.properties=[1];
state.tiles[2].owner=1;
state.players[1].properties=[2];

assert.equal(grantItem(state,0,"rent_boost",1).ok,true);
assert.equal(grantItem(state,0,"remote_dice",1).ok,true);
assert.equal(grantItem(state,0,"stock_boost",1).ok,true);
assert.equal(grantItem(state,0,"stock_drop",1).ok,true);
assert.equal(grantItem(state,0,"rent_block",1).ok,true);
assert.equal(inventoryCount(player,"rent_boost"),1);

const overflowState=createInitialState();
overflowState.players[0].inventory={
  rent_boost:9,
  rent_burst:9,
  remote_dice:9,
  stock_boost:9,
  stock_drop:9,
  rent_block:9,
  property_guard:9
};
const overflowHydrated=hydrateState(JSON.parse(JSON.stringify(overflowState)));
assert.ok(
  Object.values(overflowHydrated.players[0].inventory).reduce((sum,count)=>sum+count,0)<=6,
  "hydration must enforce the total six-item inventory cap"
);

const baseRent=rentFor(state,state.tiles[1]);
const rentBoost=useItem(state,0,"rent_boost",{tileIndex:1});
assert.equal(rentBoost.ok,true);
assert.equal(state.tiles[1].permanentRentBoost,0.2);
assert.equal(rentFor(state,state.tiles[1]),Math.round(baseRent*1.2));

const dice=useItem(state,0,"remote_dice",{value:11});
assert.equal(dice.ok,true);
assert.equal(player.forcedDiceTotal,11);

const stock=state.market.stocks[0];
const beforeStock=stock.price;
const stockUp=useItem(state,0,"stock_boost",{stockId:stock.id});
assert.equal(stockUp.ok,true);
assert.ok(stock.price>beforeStock);

const blockTargets=listValidTargets(state,0,"rent_block");
assert.ok(blockTargets.some(target=>Number(target.value)===2));
const block=useItem(state,0,"rent_block",{tileIndex:2});
assert.equal(block.ok,true);
assert.equal(state.tiles[2].rentBlockedCharges,1);

const saved=JSON.parse(JSON.stringify(state));
const restored=hydrateState(saved);
assert.equal(restored.players[0].forcedDiceTotal,11);
assert.equal(restored.tiles[1].permanentRentBoost,0.2);
assert.equal(restored.tiles[2].rentBlockedCharges,1);

// Rent block must prevent payment without consuming the payer's active rent insurance.
restored.players[0].position=2;
restored.players[0].rentInsuranceActive=true;
restored.currentPlayer=0;
restored.phase="landed";
const restoredEngine=new GameEngine(restored,()=>{});
const ownerCashBefore=restored.players[1].cash;
restoredEngine.resolveLanding(restored.players[0]);
assert.equal(restored.players[1].cash,ownerCashBefore);
assert.equal(restored.players[0].rentInsuranceActive,true);
assert.equal(restored.tiles[2].rentBlockedCharges,0);

// Remote dice is authoritative state and is consumed by the next legal roll.
restored.players[0].forcedDiceTotal=11;
restored.players[0].position=0;
restored.currentPlayer=0;
restored.phase="await-roll";
assert.equal(restoredEngine.roll(0),true);
assert.equal(restored.dice.total,11);
assert.equal(restored.players[0].forcedDiceTotal,null);

const remote=normalizeRemoteAction({
  type:"item_use",
  itemId:"rent_block",
  target:{tileIndex:2}
});
assert.deepEqual(remote,{
  type:"item_use",
  itemId:"rent_block",
  target:{tileIndex:2}
});

console.log("V20 Alpha32 strategy items core PASS");
