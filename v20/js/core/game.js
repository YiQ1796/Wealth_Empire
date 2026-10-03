export class GameEngine{
constructor(state,onChange){this.state=state;this.onChange=onChange}
get currentPlayer(){return this.state.players[this.state.currentPlayer]}
log(text){this.state.events.unshift({id:this.state.nextEventId++,text});this.state.events=this.state.events.slice(0,40)}
notify(){if(this.onChange)this.onChange(this.state)}
roll(){
if(this.state.phase!=="await-roll")return;
const d1=1+Math.floor(Math.random()*6),d2=1+Math.floor(Math.random()*6),total=d1+d2;
this.state.dice={d1,d2,total};
const player=this.currentPlayer,from=player.position;
let passedStart=false;
for(let i=0;i<total;i++){player.position=(player.position+1)%this.state.tiles.length;if(player.position===0)passedStart=true}
if(passedStart){player.cash+=2500;this.log(player.name+" 通過起點，獲得 $2,500。")}
this.log(player.name+" 擲出 "+d1+" + "+d2+" = "+total+"，從第 "+(from+1)+" 格移動到第 "+(player.position+1)+" 格。");
this.resolveLanding(player);this.notify()
}
resolveLanding(player){
const tile=this.state.tiles[player.position];
if(tile.type==="property"){
if(tile.owner==null){this.state.pendingPurchase=tile.number-1;this.state.phase="landed";this.log(player.name+" 抵達「"+tile.name+"」，可選擇購買。");return}
if(tile.owner!==player.seat){const owner=this.state.players[tile.owner],rent=this.rentFor(tile),paid=Math.min(player.cash,rent);player.cash-=paid;owner.cash+=paid;this.log(player.name+" 支付「"+tile.name+"」租金 $"+paid.toLocaleString()+" 給 "+owner.name+"。")}
else this.log(player.name+" 回到自己的「"+tile.name+"」。");
this.state.phase="landed";return
}
this.state.phase="landed";
const eventText={start:"回到起點。",investment:"觸發投資機遇事件池。",chance:"觸發機會廣場事件池。",market:"觸發市場風雲事件池。",fate:"觸發命運廣場事件池。",group:"觸發全民同樂事件池。",entertainment:"觸發娛樂廣場事件池。",strategy:"觸發策略奇遇事件池。"}[tile.type]||"觸發特殊事件。";
this.log(player.name+" 抵達「"+tile.name+"」："+eventText)
}
rentFor(tile){return Math.round(tile.rent*(1+Math.max(0,tile.level||0)*0.65))}
buyCurrentProperty(){
const tileIndex=this.state.pendingPurchase;if(tileIndex==null)return false;
const tile=this.state.tiles[tileIndex],player=this.currentPlayer;if(tile.owner!=null||player.cash<tile.price)return false;
player.cash-=tile.price;player.properties.push(tileIndex);tile.owner=player.seat;this.state.pendingPurchase=null;
this.log(player.name+" 以 $"+tile.price.toLocaleString()+" 購買「"+tile.name+"」。");this.notify();return true
}
endTurn(){
if(!["landed","await-roll"].includes(this.state.phase))return;
this.state.pendingPurchase=null;this.state.currentPlayer=(this.state.currentPlayer+1)%this.state.players.length;
if(this.state.currentPlayer===0)this.state.round=Math.min(this.state.maxRounds,this.state.round+1);
this.state.dice=null;this.state.phase="await-roll";this.notify()
}
}
