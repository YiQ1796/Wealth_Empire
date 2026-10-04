import{createInitialState}from"./core/state.js";
import{GameEngine}from"./core/game.js";
import{mountStaticBoard,render}from"./ui/render.js";
import{renderStockMarket}from"./ui/stock-render.js";

const state=createInitialState();
const engine=new GameEngine(state,render);

mountStaticBoard(document.getElementById("board"));
renderStockMarket(document.getElementById("stockGrid"));
render(state);

document.getElementById("rollButton").addEventListener("click",()=>engine.roll());
document.getElementById("buyButton").addEventListener("click",()=>engine.buyCurrentProperty());
document.getElementById("endTurnButton").addEventListener("click",()=>engine.endTurn());

window.__WEALTH_V20__=Object.freeze({
  version:state.version,
  getState:()=>state
});
