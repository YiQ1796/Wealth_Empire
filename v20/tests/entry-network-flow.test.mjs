import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const network=readFileSync(new URL("../js/core/network.js",import.meta.url),"utf8");

assert.match(html,/財富帝國 V20 Alpha 32\.3\.8/);
assert.match(html,/alpha32-229/);
assert.match(html,/id="networkLobbyCard"/);
assert.match(html,/id="networkLobbyStartButton"/);
assert.match(html,/id="networkLobbyManageButton"/);
assert.match(html,/id="networkDialogTitle"/);
assert.match(html,/id="networkDialogDescription"/);

assert.match(main,/function uniqueLobbyPlayerName/);
assert.match(main,/const displayName=existing\?\.name\?\?uniqueLobbyPlayerName/);
assert.match(main,/prewarmNetworkTransport/);
assert.match(main,/function startRoomGameFromUi/);
assert.match(main,/networkLobbyStartButton/);
assert.match(main,/networkLobbyManageButton/);
assert.match(main,/const activeRoomPlaying=connected&&state\.gameStatus==="playing"&&Boolean\(state\.network\?\.roomCode\)/);
assert.match(main,/if\(activeRoomPlaying&&networkDialog\.open\)networkDialog\.close\(\)/);

const createStart=main.indexOf('document.getElementById("createRoomButton").addEventListener');
const joinStart=main.indexOf('document.getElementById("joinRoomButton").addEventListener');
assert.ok(createStart>=0&&joinStart>createStart);
const createBlock=main.slice(createStart,joinStart);
assert.ok(
  createBlock.indexOf("const lobbyState=createLobbyState")<
  createBlock.indexOf("await network.host"),
  "host must enter lobby state before opening network transports"
);
assert.match(createBlock,/正在等待好友加入/);
assert.match(createBlock,/if\(!networkDialog\.open\)networkDialog\.showModal\(\)/);
assert.doesNotMatch(createBlock,/networkDialog\.close\(\)/);

const joinEnd=main.indexOf("function startRoomGameFromUi",joinStart);
const joinBlock=main.slice(joinStart,joinEnd);
assert.match(joinBlock,/if\(state\.gameStatus==="playing"\)/);
assert.match(joinBlock,/等待房主開始遊戲/);
assert.match(joinBlock,/networkDialog\.showModal\(\)/);

assert.doesNotMatch(network,/"start_game"/);
assert.doesNotMatch(main,/case"start_game"/);

assert.match(network,/RELAY_PREF_KEY/);
assert.match(network,/orderedRelayBrokerUrls/);
assert.match(network,/rememberRelayBroker/);
assert.match(network,/RELAY_CONNECT_TIMEOUT_MS=6000/);
assert.match(network,/RELAY_HOST_TIMEOUT_MS=7000/);
assert.match(network,/RELAY_JOIN_TIMEOUT_MS=8000/);
assert.match(network,/PEER_JOIN_TIMEOUT_MS=9000/);
assert.match(network,/export function prewarmNetworkTransport/);

assert.match(css,/V20 Alpha 32\.3\.3 — connected players can minimize the waiting room/);
assert.match(css,/V20 Alpha 32\.3\.3 — the connection dialog becomes a real waiting room/);
assert.match(css,/\.network-dialog\.is-room-lobby \.network-form-grid/);
assert.match(css,/\.network-lobby-card\[hidden\]/);

console.log("V20 Alpha32.3.8 explicit friend lobby regression PASS");
