import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{buyStock,sellStock,canTradeStock}from"../js/core/stock-market.js";

const state=createInitialState();
state.gameStatus="playing";
state.phase="await-roll";
state.currentPlayer=0;

const seat=1;
const player=state.players[seat];
player.kind="human";
player.connected=true;
player.cash=50000;

const stock=state.market.stocks[0];
assert.equal(canTradeStock(state,seat),true,"non-current human player must be able to trade stocks");

const cashBefore=player.cash;
const buy=buyStock(state,seat,stock.id,3);
assert.equal(buy.ok,true,"non-current player buy must succeed");
assert.equal(player.portfolio[stock.id].shares,3);
assert.equal(player.cash,cashBefore-stock.price*3);

const sell=sellStock(state,seat,stock.id,2);
assert.equal(sell.ok,true,"non-current player sell must succeed");
assert.equal(player.portfolio[stock.id].shares,1);

state.phase="world_choice";
assert.equal(canTradeStock(state,seat),true,"pending world decisions must not block anytime stock trading");

state.phase="acquisition";
assert.equal(canTradeStock(state,seat),true,"acquisition decisions must not block anytime stock trading");

state.phase="minigame";
assert.equal(canTradeStock(state,seat),false,"minigames temporarily lock stock trading");

state.phase="finished";
assert.equal(canTradeStock(state,seat),false,"finished games block stock trading");

console.log("V20 Alpha32.4.0 anytime stock trading regression PASS");
