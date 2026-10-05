import{
  BOARD_TILES,
  CORNER_INDEXES,
  GROUP_ORDER,
  MAX_PROPERTY_LEVEL,
  boardPlacement
}from"../data/board.js";
import{CENTER_BACKGROUND,TILE_ART_BY_NAME}from"../data/assets.js";
import{UI_ASSETS}from"../data/ui-assets.js";
import{groupProgress,propertyValue,rentFor,upgradeCost}from"../core/property-economy.js";

function money(value){return"$"+Math.round(value).toLocaleString()}

export function mountStaticBoard(boardElement){
  BOARD_TILES.forEach((tile,index)=>{
    const placement=boardPlacement(index);
    const node=document.createElement("div");
    node.className="tile "+placement.orientation+(CORNER_INDEXES.includes(index)?" corner":"");
    node.dataset.index=String(index);
    node.style.gridRow=String(placement.row);
    node.style.gridColumn=String(placement.col);

    const art=TILE_ART_BY_NAME[tile.name];
    if(art?.path&&art.orientation===placement.orientation){
      const img=document.createElement("img");
      img.className="tile-art";
      img.alt="";
      img.src=art.path;
      img.onload=()=>node.classList.add("has-art");
      img.onerror=()=>img.remove();
      node.appendChild(img);
    }

    const fallback=document.createElement("div");
    fallback.className="tile__fallback-name";
    fallback.textContent=tile.name;
    node.appendChild(fallback);

    const dynamic=document.createElement("div");
    dynamic.className="tile__dynamic";
    dynamic.innerHTML='<span class="tile__price"></span><span class="tile__level"></span><span class="tile__owner"></span>';
    node.appendChild(dynamic);

    const tokens=document.createElement("div");
    tokens.className="tile__tokens";
    node.appendChild(tokens);
    boardElement.appendChild(node);
  });

  const center=document.getElementById("centerStage");
  const centerImage=document.getElementById("centerBackground");
  centerImage.src=CENTER_BACKGROUND;
  centerImage.onload=()=>center.classList.add("has-art");
  centerImage.onerror=()=>centerImage.remove();
}

function renderRegionSummary(state,currentPlayer){
  const container=document.getElementById("propertyRegionSummary");
  if(!container)return;

  container.innerHTML=GROUP_ORDER.map(group=>{
    const progress=groupProgress(state,currentPlayer.seat,group);
    return '<article class="region-card '+(progress.complete?"complete":"")+'">'+
      '<strong>'+group+'</strong>'+
      '<span>'+progress.owned+' / '+progress.total+'</span>'+
      '<small>'+(progress.complete?"過路費 +25%":"集滿 3 塊啟動加成")+'</small>'+
    '</article>';
  }).join("");
}

function renderRentHistory(state,currentPlayer){
  const container=document.getElementById("propertyRentHistory");
  if(!container)return;

  const related=state.events
    .filter(event=>event.kind==="rent"&&(event.data?.ownerSeat===currentPlayer.seat||event.data?.payerSeat===currentPlayer.seat))
    .slice(0,5);

  const summary='<div class="rent-totals">'+
    '<span>累計收租 <b>'+money(currentPlayer.rentReceived||0)+'</b></span>'+
    '<span>累計支付 <b>'+money(currentPlayer.rentPaid||0)+'</b></span>'+
  '</div>';

  const history=related.length
    ? related.map(event=>'<div class="rent-history-row">'+event.text+'</div>').join("")
    : '<div class="empty-state empty-state--compact">目前尚無過路費紀錄。</div>';

  container.innerHTML=summary+history;
}

function renderProperties(state,viewerPlayer,canControl){
  renderRegionSummary(state,viewerPlayer);
  renderRentHistory(state,viewerPlayer);

  const container=document.getElementById("propertyTabList");
  if(!container)return;

  if(viewerPlayer.properties.length===0){
    container.innerHTML='<div class="empty-state">目前尚未持有地產。</div>';
    return;
  }

  container.innerHTML=viewerPlayer.properties.map(tileIndex=>{
    const tile=state.tiles[tileIndex];
    if(!tile)return"";
    const rent=rentFor(state,tile);
    const value=propertyValue(tile);
    const cost=upgradeCost(tile);
    const progress=groupProgress(state,viewerPlayer.seat,tile.group);
    const maxLevel=tile.level>=MAX_PROPERTY_LEVEL;
    const canAfford=viewerPlayer.cash>=cost;
    const canUse=
      canControl&&
      state.currentPlayer===viewerPlayer.seat&&
      state.pendingPurchase==null&&
      ["await-roll","landed"].includes(state.phase);
    const disabled=maxLevel||!canAfford||!canUse;
    const buttonText=maxLevel?"已滿級":canAfford?"升級 "+money(cost):"現金不足";

    return '<article class="property-row">'+
      '<div class="property-row__main">'+
        '<div class="property-row__title"><strong>'+tile.name+'</strong><em>LV.'+tile.level+'</em></div>'+
        '<span>'+tile.group+'｜區域 '+progress.owned+'/'+progress.total+(progress.complete?'｜<b class="region-bonus">+25%</b>':'')+'</span>'+
        '<small>資產 '+money(value)+'｜目前過路費 '+money(rent)+'</small>'+
      '</div>'+
      '<button class="property-upgrade" data-upgrade-property="'+tileIndex+'" '+(disabled?'disabled':'')+'>'+buttonText+'</button>'+
    '</article>';
  }).join("");
}

export function render(state,{localSeat=0,networkMode="offline"}={}){
  document.getElementById("roundValue").textContent=state.round;
  document.getElementById("diceValue").textContent=state.dice
    ? state.dice.d1+" + "+state.dice.d2+" = "+state.dice.total
    : "—";

  const localPlayer=state.players[localSeat]??state.players[0];
  const canControl=networkMode!=="guest"||localPlayer.kind==="human";

  const players=document.getElementById("players");
  players.innerHTML=state.players.map((player,index)=>{
    const kindLabel=player.kind==="ai"
      ? '<span class="player-kind player-kind--ai">AI</span>'
      : '<span class="player-kind '+(player.connected===false?"player-kind--offline":"player-kind--human")+'">'+(player.connected===false?"離線":"真人")+'</span>';
    return '<article class="player-card '+(index===state.currentPlayer?"active":"")+'">'+
      '<img class="player-pawn" src="'+UI_ASSETS.pawns[index]+'" alt="">'+
      '<div class="player-card__body">'+
        '<h3>'+player.name+(index===state.currentPlayer?" 👑":"")+kindLabel+'</h3>'+
        '<div class="player-stats">'+
          '<span>現金 <b>'+money(player.cash)+'</b></span>'+
          '<span>地產 <b>'+player.properties.length+'</b></span>'+
          '<span>位置 <b>#'+(player.position+1)+'</b></span>'+
        '</div>'+
      '</div>'+
    '</article>';
  }).join("");

  document.querySelectorAll(".tile").forEach((node,index)=>{
    const tile=state.tiles[index];
    const price=node.querySelector(".tile__price");
    const level=node.querySelector(".tile__level");
    const owner=node.querySelector(".tile__owner");
    const tokens=node.querySelector(".tile__tokens");

    price.textContent=tile.type==="property"
      ? (tile.owner==null?money(tile.price):"租 "+money(rentFor(state,tile)))
      : "";

    level.textContent=tile.type==="property"&&tile.level>0?"LV."+tile.level:"";
    level.style.display=level.textContent?"inline-flex":"none";

    if(tile.owner==null){
      owner.style.display="none";
    }else{
      owner.style.display="block";
      owner.style.background=state.players[tile.owner].color;
    }

    tokens.innerHTML=state.players
      .filter(player=>!player.bankrupt&&player.position===index)
      .map(player=>'<img class="pawn-token" src="'+UI_ASSETS.pawns[player.seat]+'" alt="" title="'+player.name+'">')
      .join("");
  });

  const current=state.players[state.currentPlayer];
  const tile=state.tiles[current.position];
  const owner=tile.owner!=null?state.players[tile.owner]:null;
  const groupBonus=tile.type==="property"&&owner
    ? groupProgress(state,owner.seat,tile.group).complete
    : false;

  const currentTileInfo=document.getElementById("currentTileInfo");
  if(currentTileInfo){
    currentTileInfo.innerHTML=
      '<strong>#'+tile.number+" "+tile.name+"</strong><br>"+
      (tile.type==="property"
        ? tile.group+"<br>售價 "+money(tile.price)+"｜目前過路費 "+money(rentFor(state,tile))+
          (owner?"<br>持有者 "+owner.name+(groupBonus?"｜區域完成 +25%":""):"")
        : "特殊事件格");
  }

  const statusText=document.getElementById("statusText");
  if(statusText){
    statusText.textContent=
      state.gameStatus==="lobby"
        ? "多人房間等待中，房主開始後未滿座位由 AI 補位。"
        : state.phase==="minigame"
          ? "都會挑戰進行中，等待所有玩家完成。"
          : state.phase==="await-roll"
            ? current.name+" 的回合，請擲骰。"
            : state.pendingPurchase!=null
              ? current.name+" 正在決定是否購買「"+state.tiles[state.pendingPurchase].name+"」。"
              : current.name+" 已完成移動。";
  }

  const eventLog=document.getElementById("eventLog");
  if(eventLog){
    eventLog.innerHTML=state.events
      .map(event=>'<div class="event-entry event-entry--'+event.kind+'">'+event.text+"</div>")
      .join("");
  }

  const isLocalTurn=
    state.gameStatus==="playing"&&
    state.currentPlayer===localSeat&&
    current.kind==="human"&&
    current.connected!==false;

  document.getElementById("rollButton").disabled=
    !isLocalTurn||state.phase!=="await-roll";

  const pending=state.pendingPurchase!=null?state.tiles[state.pendingPurchase]:null;
  const canBuy=Boolean(
    isLocalTurn&&
    pending&&
    pending.type==="property"&&
    pending.owner==null&&
    current.position===state.pendingPurchase&&
    current.cash>=pending.price&&
    state.phase==="landed"
  );

  const purchaseDialog=document.getElementById("purchaseDialog");
  const confirmPurchaseButton=document.getElementById("confirmPurchaseButton");
  const shouldShowPurchase=Boolean(
    isLocalTurn&&
    pending&&
    state.phase==="landed"
  );

  if(shouldShowPurchase){
    document.getElementById("purchaseTitle").textContent="是否購買「"+pending.name+"」？";
    document.getElementById("purchaseSubtitle").textContent=pending.group+"｜第 "+pending.number+" 格";
    document.getElementById("purchasePrice").textContent=money(pending.price);
    document.getElementById("purchaseCash").textContent=money(current.cash);
    confirmPurchaseButton.disabled=!canBuy;
    confirmPurchaseButton.textContent=canBuy?"購買":"現金不足";
    if(!purchaseDialog.open)purchaseDialog.showModal();
  }else if(purchaseDialog.open){
    purchaseDialog.close();
  }

  document.getElementById("endTurnButton").disabled=
    !isLocalTurn||
    state.phase!=="landed"||
    state.pendingPurchase!=null;

  renderProperties(state,localPlayer,canControl);
}
