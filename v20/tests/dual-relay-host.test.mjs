import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import{PeerNetwork}from"../js/core/network.js";

const source=readFileSync(new URL("../js/core/network.js",import.meta.url),"utf8");

assert.match(source,/Promise\.allSettled/);
assert.match(source,/this\.hostRelayClients=new Map\(\)/);
assert.match(source,/this\.hostRelayClients\.set\(brokerUrl,client\)/);
assert.ok(source.includes('const relayKey=brokerUrl+"|"+clientId;'));
assert.match(source,/雙 WSS 中繼已就緒/);
assert.match(source,/P2P 同步作為第三層備援/);

let disconnectCount=0;
const network=new PeerNetwork({
  onJoin:()=>({ok:true,seat:1,state:{players:[]}}),
  onDisconnect:()=>{disconnectCount+=1}
});
network.mode="host";
network.roomCode="123456";

const previous={
  relay:true,
  relayKey:"broker-a|guest-a",
  open:true,
  metadata:{seat:1,clientId:"guest-a"},
  close(){
    network.disconnectRelayConnection(this);
  }
};
network.connections.set(1,previous);
network.relayConnectionsByClient.set(previous.relayKey,previous);

const sent=[];
const replacement={
  relay:true,
  relayKey:"broker-b|guest-a",
  open:true,
  metadata:null,
  send(message){sent.push(message)},
  close(){
    network.disconnectRelayConnection(this);
  }
};

network.handleHostMessage(replacement,{
  type:"join_request",
  clientId:"guest-a",
  playerName:"好友",
  characterIndex:1
});

assert.equal(network.connections.get(1),replacement);
assert.equal(disconnectCount,0,"replacing one relay path must not mark the player disconnected");
assert.equal(sent[0]?.type,"join_ack");
assert.equal(sent[0]?.seat,1);

console.log("V20 Alpha 32.3.7 dual relay host replacement regression PASS");
