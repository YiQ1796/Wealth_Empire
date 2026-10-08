import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{propertyValue}from"../js/core/property-economy.js";
import{playerAssetBreakdown,playerAssetRankings}from"../js/core/player-assets.js";

const state=createInitialState();
const player0=state.players[0];
const player1=state.players[1];

const propertyIndex=state.tiles.findIndex(tile=>tile.type==="property");
const property=state.tiles[propertyIndex];
property.owner=0;
property.level=1;
player0.properties=[propertyIndex];

const stock=state.market.stocks[0];
player0.portfolio[stock.id]={shares:10,avgCost:stock.price,realizedPnl:0};
player0.centralBankDeposit={principal:12000,returnAmount:12600,startedRound:1,maturesRound:3};

const breakdown=playerAssetBreakdown(state,player0);
assert.equal(breakdown.cash,player0.cash);
assert.equal(breakdown.properties,propertyValue(property));
assert.equal(breakdown.stocks,10*stock.price);
assert.equal(breakdown.bankDeposit,12000,"bank deposit must remain separately visible");
assert.equal(
  breakdown.total,
  breakdown.cash+breakdown.properties+breakdown.stocks
);

// Cash alone cannot win against a higher combined asset valuation.
player1.cash=breakdown.cash+1;
assert.equal(playerAssetRankings(state)[0].seat,0);
player1.cash=breakdown.total+1;
const rankings=playerAssetRankings(state);
assert.equal(rankings[0].seat,1);
assert.equal(rankings[0].rank,1);
assert.equal(rankings.find(entry=>entry.seat===0)?.rank,2);

console.log("V20 cash + property + quoted-stock ranking regression PASS");
