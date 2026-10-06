import fs from"node:fs";
import assert from"node:assert/strict";
import{createInitialState,hydrateState}from"../js/core/state.js";
import{GameEngine}from"../js/core/game.js";
import{resolveSpecialEvent}from"../js/core/special-events.js";
import{resolveCivicEvent}from"../js/core/civic-specials.js";
import{RARE_EVENT_RATE}from"../js/core/event-picker.js";
import{
  MAX_DEVELOPMENT_PERMITS,
  grantDevelopmentPermits
}from"../js/core/property-events.js";
import{CHANCE_EVENTS,FATE_EVENTS}from"../js/data/special-events.js";
import{CIVIC_EVENT_POOLS}from"../js/data/civic-events.js";
import{normalizeRemoteAction}from"../js/core/network.js";

function sequenceRandom(values){
  let index=0;
  return()=>{
    const value=values[Math.min(index,values.length-1)]??0;
    index+=1;
    return value;
  };
}

assert.equal(RARE_EVENT_RATE,0.12,"rare-event rate must be 12%");
assert.ok(CHANCE_EVENTS.length>=17);
assert.ok(FATE_EVENTS.length>=18);
for(const type of["tax","court","hospital","market","urban"]){
  assert.ok(CIVIC_EVENT_POOLS[type].length>=6,type+" must have a varied event pool");
  assert.ok(CIVIC_EVENT_POOLS[type].some(event=>event.rarity==="rare"),type+" must include rare events");
}

{
  const state=createInitialState();
  const player=state.players[0];
  const tileIndex=state.tiles.findIndex(tile=>tile.type==="property");
  state.tiles[tileIndex].owner=0;
  player.properties.push(tileIndex);
  const cashBefore=player.cash;

  const result=resolveSpecialEvent(state,player,"chance",sequenceRandom([0.01,0,0]));
  assert.equal(result.rarity,"rare");
  assert.equal(result.event.id,"chance_rare_upgrade");
  assert.equal(result.property.tileIndex,tileIndex);
  assert.equal(state.tiles[tileIndex].level,1,"rare property event must upgrade one owned property");
  assert.equal(player.cash,cashBefore,"successful free upgrade must not charge cash");
}

{
  const state=createInitialState();
  const player=state.players[0];
  const result=resolveSpecialEvent(state,player,"chance",sequenceRandom([0.01,0.4]));
  assert.equal(result.event.id,"chance_rare_permit");
  assert.equal(result.permitDelta,1);
  assert.equal(player.developmentPermits,1);
}

{
  const state=createInitialState();
  const player=state.players[0];
  const granted=grantDevelopmentPermits(player,99);
  assert.equal(granted.total,MAX_DEVELOPMENT_PERMITS);
  assert.equal(player.developmentPermits,MAX_DEVELOPMENT_PERMITS);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const player=state.players[0];
  const tileIndex=state.tiles.findIndex(tile=>tile.type==="property");
  const tile=state.tiles[tileIndex];
  tile.owner=0;
  player.properties.push(tileIndex);
  player.developmentPermits=1;
  const cashBefore=player.cash;

  assert.equal(engine.usePropertyPermit(tileIndex,0),true);
  assert.equal(tile.level,1);
  assert.equal(player.developmentPermits,0);
  assert.equal(player.cash,cashBefore);
  assert.equal(engine.usePropertyPermit(tileIndex,0),false,"spent permit must not be reusable");
}

{
  const state=createInitialState();
  const player=state.players[0];
  const tileIndex=state.tiles.findIndex(tile=>tile.type==="property");
  state.tiles[tileIndex].owner=0;
  player.properties.push(tileIndex);

  const result=resolveCivicEvent(state,player,"urban",sequenceRandom([0.01,0,0]));
  assert.equal(result.rarity,"rare");
  assert.equal(result.event.id,"urban_rare_upgrade");
  assert.equal(state.tiles[tileIndex].level,1);
}

{
  const state=createInitialState();
  const first=resolveCivicEvent(state,state.players[0],"tax",sequenceRandom([0.5,0]));
  const second=resolveCivicEvent(state,state.players[0],"tax",sequenceRandom([0.5,0]));
  assert.notEqual(first.event.id,second.event.id,"recent civic events should not repeat immediately");
}

assert.deepEqual(
  normalizeRemoteAction({type:"property_permit_upgrade",tileIndex:2}),
  {type:"property_permit_upgrade",tileIndex:2}
);
assert.equal(normalizeRemoteAction({type:"property_permit_upgrade",tileIndex:44}),null);

{
  const hydrated=hydrateState({
    players:[{developmentPermits:99}]
  });
  assert.equal(hydrated.players[0].developmentPermits,MAX_DEVELOPMENT_PERMITS);
}

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const render=fs.readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
assert.match(html,/id="propertyEventActions"/);
assert.match(render,/data-property-permit-upgrade/);
assert.match(render,/has-property-action/);
assert.match(main,/property_permit_upgrade/);

console.log("V20 Alpha 30 event + property operations test PASS");
