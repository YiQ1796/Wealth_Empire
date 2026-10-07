import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const network=readFileSync(new URL("../js/core/network.js",import.meta.url),"utf8");

assert.match(html,/財富帝國 V20 Alpha 32\.3\.1/);
assert.match(html,/alpha32-222/);
assert.match(html,/id="networkLobbyCard"/);
assert.match(html,/id="networkLobbyStartButton"/);
assert.match(html,/id="networkLobbyManageButton"/);
assert.match(html,/連線成功後會直接回到棋盤/);

assert.match(main,/function uniqueLobbyPlayerName/);
assert.match(main,/const displayName=existing\?\.name\?\?uniqueLobbyPlayerName/);
assert.match(main,/prewarmNetworkTransport/);
assert.match(main,/if\(networkDialog\.open\)networkDialog\.close\(\)/);
assert.match(main,/function startRoomGameFromUi/);
assert.match(main,/networkLobbyStartButton/);
assert.match(main,/networkLobbyManageButton/);
assert.match(main,/const activeRoomPlaying=connected&&state\.gameStatus==="playing"&&Boolean\(state\.network\?\.roomCode\)/);
assert.match(main,/if\(activeRoomPlaying&&networkDialog\.open\)networkDialog\.close\(\)/);
assert.match(main,/if\(createButton\)createButton\.disabled=connected/);
assert.match(main,/if\(joinButton\)joinButton\.disabled=connected/);

assert.match(network,/RELAY_PREF_KEY/);
assert.match(network,/orderedRelayBrokerUrls/);
assert.match(network,/rememberRelayBroker/);
assert.match(network,/RELAY_CONNECT_TIMEOUT_MS=6000/);
assert.match(network,/RELAY_HOST_TIMEOUT_MS=7000/);
assert.match(network,/RELAY_JOIN_TIMEOUT_MS=8000/);
assert.match(network,/PEER_JOIN_TIMEOUT_MS=9000/);
assert.match(network,/export function prewarmNetworkTransport/);

assert.match(css,/V20 Alpha 32\.3\.1 — connected players return to the board/);
assert.match(css,/\.network-lobby-card\[hidden\]/);

console.log("V20 Alpha32.3.1 entry + friend lobby regression PASS");
