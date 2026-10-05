import assert from"node:assert/strict";
import{createInitialState,setPlayerCharacter}from"../js/core/state.js";
import{TILE_ART_BY_INDEX}from"../js/data/assets.js";
import{UI_ASSETS}from"../js/data/ui-assets.js";
import{GameEngine}from"../js/core/game.js";
import{chooseUpgrade,shouldBuyProperty}from"../js/core/ai.js";
import{advanceStockMarket,buyStock,getHolding,sellStock}from"../js/core/stock-market.js";
import{fillAiMinigameResults,finalizeMinigame,startMinigame,submitMinigameResult}from"../js/core/minigames.js";
import{createRoomCode,normalizeRemoteAction,sanitizePlayerName,sanitizeRoomCode}from"../js/core/network.js";
import{resolveSpecialEvent}from"../js/core/special-events.js";
import{MINIGAME_DEFINITIONS}from"../js/data/minigames.js";
import{TRANSPORT_NODE_INDEXES}from"../js/data/transport.js";

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
  assert.equal(setPlayerCharacter(state,0,3),true);
  assert.equal(state.players[0].characterIndex,3);
  assert.equal(state.players[0].color,"#8a63d2");
  assert.equal(state.players[3].characterIndex,0,"character selection must keep all four characters unique");
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
    .filter(entry=>entry.tile.type==="property"&&entry.tile.group==="商業區");

  assert.equal(groupTiles.length,4,"AI completion test uses a 4-tile region");
  for(const entry of groupTiles.slice(0,3)){
    entry.tile.owner=0;
    state.players[0].properties.push(entry.index);
  }
  const target=groupTiles[3].tile;
  state.players[0].cash=50000;
  assert.equal(shouldBuyProperty(state,0,target),true);

  target.owner=0;
  state.players[0].properties.push(groupTiles[3].index);
  assert.notEqual(chooseUpgrade(state,0),null);
}

{
  const state=createInitialState();
  const humanCash=state.players[0].cash;
  const session=startMinigame(state,0,1000,"snail");
  assert.equal(session.id,"snail");
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
  const state=createInitialState();
  const player=state.players[0];
  const cashBefore=player.cash;
  const chance=resolveSpecialEvent(state,player,"chance",()=>0);
  assert.equal(chance.event.id,"chance_bonus");
  assert.equal(chance.amount,1200);
  assert.equal(player.cash,cashBefore+1200);
  assert.equal(state.specialEventHistory.at(-1).type,"chance");

  const fate=resolveSpecialEvent(state,player,"fate",()=>0);
  assert.equal(fate.event.id,"fate_patron");
  assert.equal(fate.amount,1500);
  assert.equal(state.specialEventHistory.at(-1).type,"fate");
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
  assert.deepEqual(
    normalizeRemoteAction({type:"transport_travel",destinationIndex:32}),
    {type:"transport_travel",destinationIndex:32}
  );
  assert.equal(normalizeRemoteAction({type:"transport_travel",destinationIndex:44}),null);
  assert.deepEqual(normalizeRemoteAction({type:"transport_skip"}),{type:"transport_skip"});
  assert.deepEqual(
    normalizeRemoteAction({type:"acquisition_buy",tileIndex:2}),
    {type:"acquisition_buy",tileIndex:2}
  );
  assert.equal(normalizeRemoteAction({type:"acquisition_buy",tileIndex:44}),null);
  assert.deepEqual(normalizeRemoteAction({type:"acquisition_skip"}),{type:"acquisition_skip"});
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
  const acquisitionIndex=state.tiles.findIndex(tile=>tile.type==="acquisition");
  const targetIndex=state.tiles.findIndex(tile=>tile.type==="property");
  assert.ok(acquisitionIndex>0&&targetIndex>0);

  state.tiles[targetIndex].owner=1;
  state.players[1].properties.push(targetIndex);
  state.players[0].cash=50000;
  state.players[0].position=(acquisitionIndex-2+state.tiles.length)%state.tiles.length;

  const sellerCashBefore=state.players[1].cash;
  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.players[0].position,acquisitionIndex);
  assert.equal(state.phase,"acquisition","acquisition center must open a real decision phase");
  const option=state.pendingAcquisition.options.find(entry=>entry.tileIndex===targetIndex);
  assert.ok(option);
  assert.equal(option.offer,Math.round((state.tiles[targetIndex].price)*1.25));
  assert.equal(engine.endTurn(0),false,"acquisition decision cannot be skipped by ending turn");

  const buyerCashBefore=state.players[0].cash;
  assert.equal(engine.acquireFromCenter(targetIndex,0),true);
  assert.equal(state.phase,"landed");
  assert.equal(state.pendingAcquisition,null);
  assert.equal(state.tiles[targetIndex].owner,0);
  assert.equal(state.players[0].cash,buyerCashBefore-option.offer);
  assert.equal(state.players[1].cash,sellerCashBefore+option.offer);
  assert.ok(state.players[0].properties.includes(targetIndex));
  assert.equal(state.players[1].properties.includes(targetIndex),false);
  assert.equal(state.events[0].kind,"property_acquisition");
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const acquisitionIndex=state.tiles.findIndex(tile=>tile.type==="acquisition");
  state.players[0].position=(acquisitionIndex-2+state.tiles.length)%state.tiles.length;
  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.phase,"landed","acquisition center without eligible opponent property must not deadlock");
  assert.equal(state.pendingAcquisition,null);
  assert.equal(state.events[0].kind,"acquisition_empty");
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const stationIndex=TRANSPORT_NODE_INDEXES[0];
  state.players[0].position=(stationIndex-2+state.tiles.length)%state.tiles.length;

  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.players[0].position,stationIndex);
  assert.equal(state.phase,"transport","station tile must enter the transport decision phase");
  assert.equal(state.pendingTransport?.sourceIndex,stationIndex);
  assert.deepEqual(
    state.pendingTransport?.destinationIndexes,
    TRANSPORT_NODE_INDEXES.filter(index=>index!==stationIndex)
  );
  assert.equal(engine.endTurn(0),false,"transport decision cannot be skipped by ending the turn");

  const destinationIndex=state.pendingTransport.destinationIndexes[0];
  assert.equal(engine.useTransport(destinationIndex,0),true);
  assert.equal(state.players[0].position,destinationIndex);
  assert.equal(state.phase,"landed");
  assert.equal(state.pendingTransport,null);
  assert.equal(state.events[0].kind,"transport_complete");
  assert.equal(
    state.events.some(event=>event.kind==="transport_offer"),
    true,
    "station landing must log a transport offer"
  );
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const stationIndex=TRANSPORT_NODE_INDEXES[1];
  state.players[0].position=(stationIndex-2+state.tiles.length)%state.tiles.length;
  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.phase,"transport");
  assert.equal(engine.skipTransport(0),true);
  assert.equal(state.players[0].position,stationIndex);
  assert.equal(state.phase,"landed");
  assert.equal(state.pendingTransport,null);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const bridgeIndex=43;
  assert.equal(state.tiles[bridgeIndex].name,"跨海大橋");
  assert.equal(state.tiles[bridgeIndex].type,"station");
  state.players[0].position=41;
  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.players[0].position,bridgeIndex);
  assert.equal(state.phase,"transport","cross-sea bridge must trigger the transport system");
  assert.equal(state.pendingTransport.sourceIndex,bridgeIndex);
  assert.equal(state.pendingTransport.destinationIndexes.includes(bridgeIndex),false);
  assert.equal(state.pendingTransport.destinationIndexes.length,3);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  state.currentPlayer=1;
  const stationIndex=TRANSPORT_NODE_INDEXES[2];
  state.players[1].position=(stationIndex-2+state.tiles.length)%state.tiles.length;
  assert.equal(engine.roll(1,{d1:1,d2:1}),true);
  assert.equal(state.phase,"transport");
  assert.equal(engine.runAiStep(),true,"AI must resolve its own transport decision");
  assert.equal(state.phase,"landed");
  assert.equal(state.pendingTransport,null);
  assert.ok(TRANSPORT_NODE_INDEXES.includes(state.players[1].position));
  assert.notEqual(state.players[1].position,stationIndex);
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const highLowIndex=state.tiles.findIndex(tile=>tile.type==="highlow");
  assert.ok(highLowIndex>0,"high-low tile must exist");
  state.players[0].position=(highLowIndex-2+state.tiles.length)%state.tiles.length;
  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.players[0].position,highLowIndex);
  assert.equal(state.phase,"minigame","high-low tile must route into the replacement minigame system");
  assert.ok(MINIGAME_DEFINITIONS.some(game=>game.id===state.minigame.id));
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const horseIndex=state.tiles.findIndex(tile=>tile.type==="horse");
  assert.ok(horseIndex>0,"horse tile must exist");
  state.players[0].position=(horseIndex-2+state.tiles.length)%state.tiles.length;
  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.players[0].position,horseIndex);
  assert.equal(state.phase,"minigame");
  assert.equal(state.minigame.id,"horse","horse tile must always open the horse race");
}

{
  const state=createInitialState();
  const engine=new GameEngine(state,()=>{});
  const auctionIndex=state.tiles.findIndex(tile=>tile.type==="auction");
  state.players[0].position=(auctionIndex-2+state.tiles.length)%state.tiles.length;
  assert.equal(engine.roll(0,{d1:1,d2:1}),true);
  assert.equal(state.phase,"minigame");
  assert.equal(state.minigame.id,"auction","auction tile must open the auction minigame");
}

assert.deepEqual(
  MINIGAME_DEFINITIONS.map(game=>game.id),
  ["horse","treasure","rps","blackjack","plinko","auction","snail"]
);

{
  const state=createInitialState();
  const session=startMinigame(state,0,2000,"auction");
  fillAiMinigameResults(state);
  assert.equal(submitMinigameResult(state,0,{score:0,detail:{bid:6000}}).ok,true);
  const result=finalizeMinigame(state,2100);
  assert.ok(result);
  assert.equal(session.auction.bids.length,4);
  assert.equal(session.auction.winnerSeat,0,"seat 0 must win ties at the maximum legal bid");
  assert.ok(session.auction.value>=1800&&session.auction.value<=6000);
  assert.ok(session.results["0"].score>0,"auction score must be host-resolved after all bids arrive");
}

console.log("V20 Alpha 26 gameplay systems test PASS");
