import{BOARD_TILES,CORNER_INDEXES,boardPlacement}from"../data/board.js";
import{CENTER_BACKGROUND,TILE_ART}from"../data/assets.js";
function money(value){return"$"+Math.round(value).toLocaleString()}
export function mountStaticBoard(boardElement){
BOARD_TILES.forEach((tile,index)=>{
const placement=boardPlacement(index),node=document.createElement("div");
node.className="tile "+placement.orientation+(CORNER_INDEXES.includes(index)?" corner":"");
node.dataset.index=String(index);node.style.gridRow=String(placement.row);node.style.gridColumn=String(placement.col);
const artPath=TILE_ART[tile.name];
if(artPath){const img=document.createElement("img");img.className="tile-art";img.alt="";img.src=artPath;img.onload=()=>node.classList.add("has-art");img.onerror=()=>img.remove();node.appendChild(img)}
const fallback=document.createElement("div");fallback.className="tile__fallback-name";fallback.textContent=tile.name;node.appendChild(fallback);
const dynamic=document.createElement("div");dynamic.className="tile__dynamic";dynamic.innerHTML='<span class="tile__price"></span><span class="tile__owner"></span>';node.appendChild(dynamic);
const tokens=document.createElement("div");tokens.className="tile__tokens";node.appendChild(tokens);boardElement.appendChild(node)
});
const center=document.getElementById("centerStage"),centerImage=document.getElementById("centerBackground");
centerImage.src=CENTER_BACKGROUND;centerImage.onload=()=>center.classList.add("has-art");centerImage.onerror=()=>centerImage.remove()
}
export function render(state){
document.getElementById("roundValue").textContent=state.round;
document.getElementById("diceValue").textContent=state.dice?(state.dice.d1+" + "+state.dice.d2+" = "+state.dice.total):"—";
const players=document.getElementById("players");
players.innerHTML=state.players.map((p,index)=>'<article class="player-card '+(index===state.currentPlayer?"active":"")+'"><h3>'+p.name+(index===state.currentPlayer?" 👑":"")+'</h3><div class="player-stats"><span>現金<b>'+money(p.cash)+'</b></span><span>地產<b>'+p.properties.length+'</b></span><span>位置<b>#'+(p.position+1)+'</b></span></div></article>').join("");
document.querySelectorAll(".tile").forEach((node,index)=>{
const tile=state.tiles[index],price=node.querySelector(".tile__price"),owner=node.querySelector(".tile__owner"),tokens=node.querySelector(".tile__tokens");
price.textContent=tile.type==="property"?(tile.owner==null?money(tile.price):"租 "+money(Math.round(tile.rent*(1+(tile.level||0)*.65)))):"";
if(tile.owner==null)owner.style.display="none";else{owner.style.display="block";owner.style.background=state.players[tile.owner].color}
tokens.innerHTML=state.players.filter(player=>!player.bankrupt&&player.position===index).map(player=>'<i class="token" title="'+player.name+'" style="background:'+player.color+'"></i>').join("")
});
const current=state.players[state.currentPlayer],tile=state.tiles[current.position];
document.getElementById("currentTileInfo").innerHTML='<strong>#'+tile.number+" "+tile.name+"</strong><br>"+(tile.type==="property"?(tile.group+"<br>售價 "+money(tile.price)+"｜基礎租金 "+money(tile.rent)):"特殊事件格");
document.getElementById("statusText").textContent=state.phase==="await-roll"?(current.name+" 的回合，請擲骰。"):(state.pendingPurchase!=null?("是否購買「"+state.tiles[state.pendingPurchase].name+"」？"):(current.name+" 已完成移動。"));
document.getElementById("eventLog").innerHTML=state.events.map(event=>'<div class="event-entry">'+event.text+"</div>").join("");
document.getElementById("rollButton").disabled=state.phase!=="await-roll";
const pending=state.pendingPurchase!=null?state.tiles[state.pendingPurchase]:null;
document.getElementById("buyButton").disabled=!(pending&&pending.owner==null&&current.cash>=pending.price);
document.getElementById("endTurnButton").disabled=state.phase!=="landed"
}
