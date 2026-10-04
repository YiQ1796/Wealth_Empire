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

document.querySelectorAll("[data-dialog]").forEach(button=>{
  button.addEventListener("click",()=>{
    const dialog=document.getElementById(button.dataset.dialog);
    if(dialog&&!dialog.open)dialog.showModal();
  });
});

document.querySelectorAll("[data-close-dialog]").forEach(button=>{
  button.addEventListener("click",()=>{
    const dialog=button.closest("dialog");
    if(dialog?.open)dialog.close();
  });
});

document.querySelectorAll("dialog").forEach(dialog=>{
  dialog.addEventListener("click",event=>{
    if(event.target===dialog)dialog.close();
  });
});

window.__WEALTH_V20__=Object.freeze({
  version:state.version,
  getState:()=>state
});
