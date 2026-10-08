import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{GameEngine}from"../js/core/game.js";
import{canUseTransport,createPendingTransport}from"../js/core/transport.js";

function readyTransportAt(index){
  const state=createInitialState();
  state.players[0].position=index;
  state.phase="transport";
  state.pendingTransport=createPendingTransport(state,state.players[0]);
  return state;
}

const airportState=readyTransportAt(13);
const shortcuts=airportState.pendingTransport.destinationIndexes;
assert.equal(airportState.pendingTransport.kind,"airport");
assert.equal(shortcuts.length,8,"preserve the eight property-region shortcuts");

// Every other tile, including non-property and transport tiles, is a valid destination.
for(const index of [0,1,10,14,32,43]){
  assert.equal(canUseTransport(airportState,0,index),true,"airport tile "+index);
}
for(const index of [-1,13,44,1.5,NaN,Infinity]){
  assert.equal(canUseTransport(airportState,0,index),false,"invalid tile "+index);
}
assert.equal(canUseTransport(airportState,1,14),false,"cannot move another seat");
airportState.players[0].cash=airportState.pendingTransport.fee-1;
assert.equal(canUseTransport(airportState,0,14),false,"fee is required");
airportState.players[0].cash=45600;

// Flight into an unowned property must resolve normal landing/purchase,
// deduct the fee once, and leave the other traffic rules unchanged.
const engine=new GameEngine(airportState);
const cost=airportState.pendingTransport.fee;
assert.equal(engine.useTransport(14,0),true);
assert.equal(airportState.players[0].position,14);
assert.equal(airportState.players[0].cash,45600-cost);
assert.equal(airportState.pendingPurchase,14);
assert.equal(airportState.pendingTransport,null);
assert.ok(airportState.events.some(event=>event.kind==="transport_complete"));

const stationState=readyTransportAt(10);
assert.equal(stationState.pendingTransport.kind,"station");
assert.equal(canUseTransport(stationState,0,13),true);
assert.equal(canUseTransport(stationState,0,14),false,
  "central station must not gain unrestricted travel");

// A saved transport choice containing only the eight original shortcuts
// still permits selecting a different tile on the new client.
const restoredState=readyTransportAt(13);
restoredState.pendingTransport.destinationIndexes=shortcuts.slice();
assert.equal(canUseTransport(restoredState,0,1),true);

console.log("V20 airport direct-board travel + eight shortcuts regression PASS");
