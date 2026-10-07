import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{GameEngine}from"../js/core/game.js?v=alpha32-236";

function ownedMaxPropertyLanding(state,seat=0,steps=2){
  const index=state.tiles.findIndex(tile=>tile.type==="property");
  assert.ok(index>=0,"board must contain a property");
  const tile=state.tiles[index];
  tile.owner=seat;
  tile.level=2;
  state.players[seat].properties=[index];
  state.players[seat].position=(index-steps+state.tiles.length)%state.tiles.length;
  return index;
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  ownedMaxPropertyLanding(state,0,2);

  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.phase,"landed");
  assert.equal(state.autoEndTurnSeat,0,"rolling must mark the current turn for automatic completion");
  assert.equal(engine.tryAutoEndTurn(),true,"resolved roll should end automatically");
  assert.equal(state.currentPlayer,1);
  assert.equal(state.phase,"await-roll");
  assert.equal(state.autoEndTurnSeat,null);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const index=state.tiles.findIndex(tile=>tile.type==="property");
  assert.ok(index>=0);
  state.tiles[index].owner=null;
  state.tiles[index].level=0;
  state.players[0].position=(index-2+state.tiles.length)%state.tiles.length;

  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.pendingPurchase,index);
  assert.equal(engine.tryAutoEndTurn(),false,"purchase choice must block automatic turn completion");
  assert.equal(state.currentPlayer,0);

  assert.equal(engine.declineCurrentProperty(0),true);
  assert.equal(state.pendingPurchase,null);
  assert.equal(engine.tryAutoEndTurn(),true,"turn should end after the landing choice is resolved");
  assert.equal(state.currentPlayer,1);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  ownedMaxPropertyLanding(state,0,3);

  assert.equal(engine.centralTransit(3,0),true);
  assert.equal(state.autoEndTurnSeat,0,"quick transit must mark the turn for automatic completion");
  assert.equal(state.phase,"landed");
  assert.equal(engine.tryAutoEndTurn(),true,"resolved quick transit should end automatically");
  assert.equal(state.currentPlayer,1);
  assert.equal(state.phase,"await-roll");
}

console.log("V20 automatic roll / quick-transit turn completion regression PASS");
