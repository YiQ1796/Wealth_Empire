import{BOARD_TILES,BOARD_VERSION,MAX_ROUNDS}from"../data/board.js";
const PLAYER_COLORS=["#377bd1","#e44f55","#25a978","#8a63d2"];
function createPlayer(seat,name){return{seat,name,color:PLAYER_COLORS[seat],cash:45600,position:0,properties:[],bankrupt:false}}
export function createInitialState(){
return{
version:BOARD_VERSION,round:1,maxRounds:MAX_ROUNDS,currentPlayer:0,phase:"await-roll",dice:null,pendingPurchase:null,
players:[createPlayer(0,"玩家1"),createPlayer(1,"玩家2"),createPlayer(2,"玩家3"),createPlayer(3,"玩家4")],
tiles:BOARD_TILES.map(tile=>({...tile,owner:null,level:0})),
events:[{id:1,text:"V20 Clean Rebuild 已啟動。"}],nextEventId:2
};
}
