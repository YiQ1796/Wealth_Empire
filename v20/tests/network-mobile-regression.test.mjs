import fs from"node:fs";
import assert from"node:assert/strict";

const network=fs.readFileSync(new URL("../js/core/network.js",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../js/main.js",import.meta.url),"utf8");

assert.match(network,/RELAY_BROKER_URLS=Object\.freeze\(\[/);
assert.match(network,/broker\.emqx\.io:8084\/mqtt/);
assert.match(network,/broker\.hivemq\.com:8884\/mqtt/);
assert.match(network,/function orderedRelayBrokerUrls\(\)/);
assert.match(network,/Promise\.allSettled/);
assert.match(network,/brokerUrls\.map\(brokerUrl=>this\.startHostRelay\(brokerUrl\)\)/);
assert.match(network,/this\.hostRelayClients=new Map\(\)/);
assert.match(network,/this\.hostRelayClients\.set\(brokerUrl,client\)/);
assert.ok(network.includes('const relayKey=brokerUrl+"|"+clientId;'));
assert.match(network,/connection\.send\(\{type:"ping",at:Date\.now\(\)\}\)/);
assert.match(network,/this\.roomCode=createRoomCode\(\)/);
assert.match(network,/const finalCode=this\.roomCode/);
assert.match(main,/const finalCode=result\.roomCode/);
assert.match(main,/lobbyState\.network\.roomCode=code/);
assert.match(main,/state\.network\.roomCode=finalCode/);
assert.match(main,/\.\/core\/network\.js\?v=alpha32-224/);
assert.match(network,/this\.connections\.set\(seat,connection\);[\s\S]*?if\(previous&&previous!==connection\)/);

const heartbeatStart=network.indexOf("this.relayHeartbeatTimer=setInterval");
assert.ok(heartbeatStart>=0);
const heartbeatBlock=network.slice(heartbeatStart,heartbeatStart+360);
assert.doesNotMatch(
  heartbeatBlock,
  /sendPresence\(\)/,
  "post-join relay heartbeat must ping instead of repeatedly re-sending join_request"
);

console.log("V20 Alpha 32.3.5 dual-relay regression test PASS");
