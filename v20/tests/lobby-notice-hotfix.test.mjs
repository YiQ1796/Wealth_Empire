import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import{createLobbyState,hydrateState,setHumanSeat}from"../js/core/state.js";
import{GameEngine}from"../js/core/game.js";

const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");

const lobby=createLobbyState("房主","host-client");
lobby.network.roomCode="236677";
setHumanSeat(lobby,1,{name:"好友",clientId:"guest-client",connected:true,characterIndex:1});
assert.equal(lobby.gameStatus,"lobby");
assert.equal(lobby.phase,"lobby");
assert.equal(lobby.players[0].kind,"human");
assert.equal(lobby.players[1].kind,"human");
assert.equal(lobby.players[2].kind,"ai");
assert.equal(lobby.players[3].kind,"ai");
assert.equal(lobby.network.hostSeat,0);
assert.equal(lobby.network.hostClientId,"host-client");

const hydrated=hydrateState(JSON.parse(JSON.stringify(lobby)));
assert.equal(hydrated.network.hostClientId,"host-client");
assert.equal(hydrated.players[1].kind,"human");

let notified=0;
const engine=new GameEngine(hydrated,()=>{notified+=1});
assert.equal(engine.startGame(0),true);
assert.equal(hydrated.gameStatus,"playing");
assert.equal(hydrated.phase,"await-roll");
assert.equal(hydrated.currentPlayer,0);
assert.ok(notified>0);

assert.match(main,/function isLocalRoomHost\(\)/);
assert.match(main,/function canStartRoomGame\(\)/);
assert.match(main,/const started=engine\.startGame\(hostSeat\)/);
assert.match(main,/好友與 AI 補位已同步進入棋盤/);
assert.doesNotMatch(main,/action-toast__divider-mask/);
assert.match(main,/action-toast__card-bg/);
assert.match(main,/function noticeCardSources\(config\)/);

assert.match(css,/V20 Alpha 32\.3 — single-surface notifications/);
assert.match(css,/\.action-toast\.leaving/);
assert.match(css,/\.action-toast__card-bg,[\s\S]*?display:none!important/);
assert.match(css,/overflow:hidden!important/);
assert.match(html,/財富帝國 V20 Alpha 32\.3/);
assert.match(html,/alpha32-232/);

console.log("V20 Alpha32.3.11 lobby start and notification frame regression PASS");
