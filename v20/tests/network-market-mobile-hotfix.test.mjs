import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import{PeerNetwork}from"../js/core/network.js";

const networkSource=readFileSync(new URL("../js/core/network.js",import.meta.url),"utf8");
const stockSource=readFileSync(new URL("../js/ui/stock-render.js",import.meta.url),"utf8");
const cssSource=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");

assert.match(networkSource,/RELIABLE_RELAY_TYPES/);
assert.match(networkSource,/relayQos\(message\)/);
assert.match(networkSource,/actionId/);
assert.match(networkSource,/processedActionIds/);
assert.match(networkSource,/qos:1/);
assert.match(networkSource,/網路正在重新連線，請稍候再按一次/);

let actionCount=0;
const acknowledgements=[];
const net=new PeerNetwork({
  onAction:({action})=>{
    actionCount+=1;
    return action.type==="roll";
  }
});
const connection={
  metadata:{seat:1,clientId:"guest-a"},
  send:message=>acknowledgements.push(message)
};
const message={type:"action",actionId:"guest-a:test:1",action:{type:"roll"}};
net.handleHostMessage(connection,message);
net.handleHostMessage(connection,message);
assert.equal(actionCount,1,"QoS1 duplicate action must execute only once");
assert.equal(acknowledgements.length,2);
assert.equal(acknowledgements[0].accepted,true);
assert.equal(acknowledgements[1].accepted,true);

const outbound=[];
net.mode="guest";
net.hostConnection={open:true,relay:false,send:message=>outbound.push(message)};
assert.equal(net.sendAction({type:"roll"}),true);
assert.equal(outbound.length,1);
assert.equal(outbound[0].type,"action");
assert.ok(outbound[0].actionId);
assert.equal(outbound[0].action.type,"roll");

assert.match(stockSource,/stock-selection-bar/);
assert.match(stockSource,/is-active-trade/);
assert.match(stockSource,/交易股數/);
assert.match(stockSource,/預估/);
assert.match(stockSource,/scrollIntoView/);
assert.match(stockSource,/state\.currentPlayer===localSeat/);
assert.match(cssSource,/V20 Alpha 32\.3 — mobile stock scroll \+ explicit trade selection/);
assert.match(cssSource,/\.feature-modal\{[\s\S]*?overflow-y:auto/);
assert.match(cssSource,/-webkit-overflow-scrolling:touch/);
assert.match(cssSource,/\.stock-selection-bar\{[\s\S]*?position:sticky/);
assert.match(cssSource,/\.stock-trade-card\.is-active-trade/);
assert.match(html,/財富帝國 V20 Alpha 32\\.3\\.1/);
assert.match(html,/alpha32-222/);

console.log("V20 Alpha32.3.1 reliable multiplayer + mobile stock UX regression PASS");
