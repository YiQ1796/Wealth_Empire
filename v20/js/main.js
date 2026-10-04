import{createInitialState}from"./core/state.js";
import{GameEngine}from"./core/game.js";
import{mountStaticBoard,render}from"./ui/render.js";
import{renderStockMarket}from"./ui/stock-render.js";

const state=createInitialState();
const engine=new GameEngine(state,render);

mountStaticBoard(document.getElementById("board"));
renderStockMarket(document.getElementById("stockTabGrid"));
render(state);

document.getElementById("rollButton").addEventListener("click",()=>engine.roll());
document.getElementById("confirmPurchaseButton").addEventListener("click",()=>engine.buyCurrentProperty());
document.getElementById("declinePurchaseButton").addEventListener("click",()=>engine.declineCurrentProperty());
document.getElementById("endTurnButton").addEventListener("click",()=>engine.endTurn());

document.getElementById("propertyTabList").addEventListener("click",event=>{
  const button=event.target.closest("[data-upgrade-property]");
  if(!button)return;
  engine.upgradeProperty(Number(button.dataset.upgradeProperty));
});

document.querySelectorAll(".feature-tab").forEach(button=>{
  button.addEventListener("click",()=>{
    const target=button.dataset.tab;
    document.querySelectorAll(".feature-tab").forEach(tab=>{
      const active=tab===button;
      tab.classList.toggle("active",active);
      tab.setAttribute("aria-selected",String(active));
    });
    document.querySelectorAll(".feature-pane").forEach(pane=>{
      pane.classList.toggle("active",pane.dataset.pane===target);
    });
  });
});

const purchaseDialog=document.getElementById("purchaseDialog");
purchaseDialog.addEventListener("cancel",event=>event.preventDefault());

window.__WEALTH_V20__=Object.freeze({
  version:state.version,
  getState:()=>state
});
