import assert from"node:assert/strict";
import{createInitialState}from"../js/core/state.js";
import{TILE_ART_BY_INDEX}from"../js/data/assets.js";
import{UI_ASSETS}from"../js/data/ui-assets.js";
import{GameEngine}from"../js/core/game.js";
import{chooseUpgrade,shouldBuyProperty}from"../js/core/ai.js";
import{advanceStockMarket,buyStock,getHolding,sellStock}from"../js/core/stock-market.js";
import{fillAiMinigameResults,finalizeMinigame,startMinigame,submitMinigameResult}from"../js/core/minigames.js";
import{createRoomCode,normalizeRemoteAction,sanitizePlayerName,sanitizeRoomCode}from"../js/core/network.js";

{
  assert.equal(TILE_ART_BY_INDEX.length,44);
  assert.ok(TILE_ART_BY_INDEX.every(path=>path.includes("/assets/v5/tiles/TILE_")));
  assert.equal(UI_ASSETS.characters.length,4);
  for(const character of UI_ASSETS.characters){
    assert.ok(character.idle.includes("/assets/v5/"));
    assert.ok(character.walkA.includes("/assets/v5/"));
    assert.ok(character.walkB.includes("/assets/v5/"));
    assert.ok(character.jump.includes("/assets/v5/"));
  }
  assert.equal(UI_ASSETS.houses.length,4);
  assert.ok(UI_ASSETS.modal.close.includes("MODAL_CLOSE"));
  assert.ok(UI_ASSETS.notification.cards.majorDesktop.includes("NOTIFY_CARD_MAJOR_DESKTOP"));
}

{
  const state=createInitialState();
  assert.equal(state.players[0].kind,"human");
  assert.equal(state.players[0].connected,true);
  assert.deepEqual(state.players.slice(1).map(player=>player.kind),["ai","ai","ai"]);
}

{
  const state=createInitialState();
  const before=state.market.stocks.map(stock=>stock.price);
  advanceStockMarket(state,2);
  assert.equal(state.market.round,2);
  state.market.stocks.forEach((stock,index)=>{
    assert.notEqual(stock.price,before[index],"every stock must move each round");
    assert.notEqual(stock.changePercent,0,"every stock must have non-zero round change");
    assert.equal(stock.previousPrice,before[index]);
    assert.equal(stock.history.at(-1),stock.price);
  });
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  state.currentPlayer=2;
  const stock=state.market.stocks[1];
  assert.equal(engine.buyStock(stock.id,3,0),true,"GameEngine must accept a human stock trade outside that player's turn");
  assert.equal(getHolding(state.players[0],stock.id).shares,3);
}

{
  const state=createInitialState();
  const player=state.players[0];
  const stock=state.market.stocks[0];
  const cashBefore=player.cash;
  const buy=buyStock(state,0,stock.id,10);
  assert.equal(buy.ok,true);
  assert.equal(getHolding(player,stock.id).shares,10);
  assert.equal(player.cash,cashBefore-stock.price*10);

  const sell=sellStock(state,0,stock.id,4);
  assert.equal(sell.ok,true);
  assert.equal(getHolding(player,stock.id).shares,6);

  state.currentPlayer=1;
  assert.equal(buyStock(state,0,stock.id,1).ok,true,"stock trading must remain available outside the player's own turn");

  state.phase="minigame";
  assert.equal(buyStock(state,0,stock.id,1).reason,"trade_locked");
}

{
  const state=createInitialState();
  const groupTiles=state.tiles
    .map((tile,index)=>({tile,index}))
    .filter(entry=>entry.tile.type==="property"&&entry.tile.group==="海港區");

  for(const entry of groupTiles.slice(0,2)){
    entry.tile.owner=0;
    state.players[0].properties.push(entry.index);
  }
  const target=groupTiles[2].tile;
  state.players[0].cash=50000;
  assert.equal(shouldBuyProperty(state,0,target),true);

  target.owner=0;
  state.players[0].properties.push(groupTiles[2].index);
  assert.notEqual(chooseUpgrade(state,0),null);
}

{
  const state=createInitialState();
  const humanCash=state.players[0].cash;
  const session=startMinigame(state,0,1000);
  assert.equal(state.phase,"minigame");
  fillAiMinigameResults(state);
  assert.equal(Object.keys(session.results).length,3);
  assert.equal(submitMinigameResult(state,0,{score:8800}).ok,true);
  const result=finalizeMinigame(state,1100);
  assert.ok(result);
  assert.equal(result.rankings.length,4);
  assert.equal(state.phase,"landed");
  assert.ok(state.players[0].cash>humanCash);
}

{
  assert.equal(sanitizeRoomCode("12-34 56"),"123456");
  assert.equal(sanitizeRoomCode("123"),"");
  assert.equal(createRoomCode(()=>0.123456),"123456");
  assert.equal(sanitizePlayerName("<玩家>"),"玩家");

  assert.deepEqual(
    normalizeRemoteAction({type:"buy_stock",stockId:"TECH",shares:10}),
    {type:"buy_stock",stockId:"TECH",shares:10}
  );
  assert.equal(normalizeRemoteAction({type:"buy_stock",stockId:"TECH",shares:0}),null);
  assert.deepEqual(
    normalizeRemoteAction({type:"upgrade_property",tileIndex:43}),
    {type:"upgrade_property",tileIndex:43}
  );
  assert.equal(normalizeRemoteAction({type:"upgrade_property",tileIndex:44}),null);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});

  const beforeFirstTurn=state.market.stocks.map(stock=>stock.price);
  state.currentPlayer=0;
  state.phase="landed";
  assert.equal(engine.endTurn(0),true);
  assert.equal(state.currentPlayer,1);
  assert.equal(state.round,1);
  assert.equal(state.market.tick,1);
  state.market.stocks.forEach((stock,index)=>assert.notEqual(stock.price,beforeFirstTurn[index]));

  const beforeSecondTurn=state.market.stocks.map(stock=>stock.price);
  state.phase="landed";
  assert.equal(engine.endTurn(1),true);
  assert.equal(state.currentPlayer,2);
  assert.equal(state.round,1);
  assert.equal(state.market.tick,2);
  state.market.stocks.forEach((stock,index)=>assert.notEqual(stock.price,beforeSecondTurn[index]));

  state.phase="landed";
  assert.equal(engine.endTurn(2),true);
  assert.equal(state.market.tick,3);

  state.phase="landed";
  assert.equal(engine.endTurn(3),true);
  assert.equal(state.currentPlayer,0);
  assert.equal(state.round,2);
  assert.equal(state.market.round,2);
  assert.equal(state.market.tick,4);

  const tickAfterValidTransition=state.market.tick;
  assert.equal(engine.endTurn(0),false,"invalid end-turn call must not move the stock market");
  assert.equal(state.market.tick,tickAfterValidTransition);
}

{
  const state=createInitialState();
  state.round=30;
  state.currentPlayer=3;
  state.phase="landed";
  const engine=new GameEngine(state,()=>{});
  assert.equal(engine.endTurn(3),true);
  assert.equal(state.gameStatus,"finished");
  assert.equal(state.phase,"finished");
  assert.equal(state.round,30);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  assert.equal(engine.roll(0,{d1:5,d2:5}),true);
  assert.equal(state.players[0].position,10);
  assert.equal(state.phase,"minigame","old high-low tile must route into the replacement minigame system");
  assert.ok(["courier","vault","tower","memory","route","district"].includes(state.minigame.id));
}

console.log("V20 Alpha 18 gameplay systems test PASS");
