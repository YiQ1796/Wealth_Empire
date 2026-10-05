import{
  BOARD_TILES,
  CORNER_INDEXES,
  GROUP_ORDER,
  MAX_PROPERTY_LEVEL,
  boardPlacement,
  groupRentMultiplier
}from"../data/board.js";
import{CENTER_BACKGROUND,TILE_ART_BY_INDEX}from"../data/assets.js";
import{UI_ASSETS}from"../data/ui-assets.js";
import{groupProgress,propertyValue,rentFor,upgradeCost}from"../core/property-economy.js";

function money(value){return"$"+Math.round(value).toLocaleString()}

function badge(path,label,className=""){
  return'<img class="state-badge '+className+'" src="'+path+'" alt="'+label+'" title="'+label+'">';
}

function regionBadge(group){
  const path=UI_ASSETS.badges.regions[group];
  return path?'<img class="region-badge" src="'+path+'" alt="'+group+'">':"";
}

function houseMarkup(ownerPlayer,level){
  if(!ownerPlayer)return"";
  const characterIndex=Number.isInteger(ownerPlayer.characterIndex)?ownerPlayer.characterIndex:ownerPlayer.seat;
  const path=UI_ASSETS.houses[characterIndex];
  const count=Math.max(1,Math.min(3,(Number(level)||0)+1));
  return Array.from({length:count},(_,index)=>
    '<img class="property-house property-house--'+(index+1)+'" src="'+path+'" alt="" aria-hidden="true">'
  ).join("");
}

function playerCharacter(playerOrIndex,stateName="idle"){
  const characterIndex=typeof playerOrIndex==="object"
    ? (Number.isInteger(playerOrIndex.characterIndex)?playerOrIndex.characterIndex:playerOrIndex.seat)
    : Number(playerOrIndex);
  return UI_ASSETS.characters[characterIndex]?.[stateName]??UI_ASSETS.characters[characterIndex]?.idle??"";
}

export function characterAsset(playerOrIndex,stateName="idle"){
  return playerCharacter(playerOrIndex,stateName);
}

export function mountStaticBoard(boardElement){
  BOARD_TILES.forEach((tile,index)=>{
    const placement=boardPlacement(index);
    const node=document.createElement("div");
    node.className="tile "+placement.orientation+(CORNER_INDEXES.includes(index)?" corner":"");
    node.dataset.index=String(index);
    node.style.gridRow=String(placement.row);
    node.style.gridColumn=String(placement.col);
    if(tile.type==="property"){
      node.classList.add("tile--property");
      node.tabIndex=0;
      node.setAttribute("role","button");
      node.setAttribute("aria-label","查看地產資訊："+tile.name);
    }

    const img=document.createElement("img");
    img.className="tile-art";
    img.alt="";
    img.src=TILE_ART_BY_INDEX[index];
    img.onload=()=>node.classList.add("has-art");
    img.onerror=()=>{
      node.classList.add("asset-error");
      img.remove();
    };
    node.appendChild(img);

    const fallback=document.createElement("div");
    fallback.className="tile__fallback-name";
    fallback.textContent=tile.name;
    node.appendChild(fallback);

    const houses=document.createElement("div");
    houses.className="tile__houses";
    node.appendChild(houses);

    const badges=document.createElement("div");
    badges.className="tile__badges";
    node.appendChild(badges);

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
    const multiplier=groupRentMultiplier(group);
    const multiplierLabel="×"+multiplier.toFixed(multiplier%1===0?0:2).replace(/0$/,"");
    return '<article class="region-card '+(progress.complete?"complete":"")+'">'+
      regionBadge(group)+
      '<div class="region-card__copy"><strong>'+group+'</strong>'+
      '<small>'+(progress.complete
        ?"完成連區｜過路費 "+multiplierLabel
        :"集滿 "+progress.total+" 塊｜過路費 "+multiplierLabel)+'</small></div>'+
      '<span>'+progress.owned+' / '+progress.total+'</span>'+
      (progress.complete?badge(UI_ASSETS.badges.regionBonus,"連區完成 "+multiplierLabel,"region-bonus-badge"):"")+
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
    : '<div class="empty-state empty-state--visual"><img src="'+UI_ASSETS.modal.emptyData+'" alt=""><span>目前尚無過路費紀錄。</span></div>';

  container.innerHTML=summary+history;
}

function renderProperties(state,viewerPlayer,canControl){
  renderRegionSummary(state,viewerPlayer);
  renderRentHistory(state,viewerPlayer);

  const container=document.getElementById("propertyTabList");
  if(!container)return;

  if(viewerPlayer.properties.length===0){
    container.innerHTML='<div class="empty-state empty-state--visual"><img src="'+UI_ASSETS.modal.emptyData+'" alt=""><span>目前尚未持有地產。</span></div>';
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
      regionBadge(tile.group)+
      '<div class="property-row__main">'+
        '<div class="property-row__title"><strong>'+tile.name+'</strong><em>LV.'+tile.level+'</em></div>'+
        '<span>'+tile.group+'｜區域 '+progress.owned+'/'+progress.total+'</span>'+
        '<small>資產 '+money(value)+'｜目前過路費 '+money(rent)+'</small>'+
        '<div class="property-row__badges">'+
          (progress.complete?badge(
            UI_ASSETS.badges.regionBonus,
            "連區完成 ×"+groupRentMultiplier(tile.group).toFixed(
              groupRentMultiplier(tile.group)%1===0?0:2
            ).replace(/0$/,"")
          ):"")+
          (maxLevel?badge(UI_ASSETS.badges.propertyMax,"房產滿級")+badge(UI_ASSETS.badges.noAcquisition,"不可強制收購"):"")+
        '</div>'+
      '</div>'+
      '<button class="property-upgrade" data-upgrade-property="'+tileIndex+'" '+(disabled?'disabled':'')+'>'+buttonText+'</button>'+
    '</article>';
  }).join("");
}

export function render(state,{localSeat=0,networkMode="offline"}={}){
  document.getElementById("roundValue").textContent=state.round;
  const diceFacesValue=document.getElementById("diceFacesValue");
  const diceTotalValue=document.getElementById("diceTotalValue");
  if(state.dice){
    diceFacesValue.textContent="🎲 "+state.dice.d1+" + "+state.dice.d2;
    diceTotalValue.textContent="= "+state.dice.total;
  }else{
    diceFacesValue.textContent="🎲 —";
    diceTotalValue.textContent="= —";
  }

  const localPlayer=state.players[localSeat]??state.players[0];
  const canControl=networkMode!=="guest"||localPlayer.kind==="human";

  const players=document.getElementById("players");
  players.innerHTML=state.players.map((player,index)=>{
    const kindAsset=player.kind==="ai"?UI_ASSETS.badges.ai:UI_ASSETS.badges.player;
    const statusBadge=player.kind==="ai"
      ? '<img class="player-type-badge" src="'+kindAsset+'" alt="AI">'
      : '<img class="player-type-badge" src="'+kindAsset+'" alt="真人">';
    const thinkingBadge=player.kind==="ai"&&index===state.currentPlayer&&state.gameStatus==="playing"
      ? '<img class="player-thinking-badge" src="'+UI_ASSETS.badges.thinking+'" alt="AI思考中" title="AI思考中">'
      : "";
    const offlineLabel=player.connected===false?'<span class="player-offline-label">離線</span>':"";
    const civicBadges=[
      player.taxEventShield?'<span class="player-civic-badge player-civic-badge--tax">稅務抵免</span>':"",
      player.medicalMoveShield?'<span class="player-civic-badge player-civic-badge--hospital">醫療保護</span>':"",
      Number(player.courtShieldUntilRound)>=Number(state.round)?'<span class="player-civic-badge player-civic-badge--court">法院保全 R'+player.courtShieldUntilRound+'</span>':""
    ].join("");
    return '<article class="player-card '+(index===state.currentPlayer?"active":"")+'">'+
      '<img class="player-pawn" data-player-avatar="'+index+'" src="'+playerCharacter(player,"idle")+'" alt="">'+
      '<div class="player-card__body">'+
        '<h3>'+player.name+(index===state.currentPlayer?" 👑":"")+statusBadge+thinkingBadge+offlineLabel+'</h3>'+
        '<div class="player-stats">'+
          '<span>現金 <b>'+money(player.cash)+'</b></span>'+
          '<span>地產 <b>'+player.properties.length+'</b></span>'+
          '<span>位置 <b>#'+(player.position+1)+'</b></span>'+
        '</div>'+
        (civicBadges?'<div class="player-civic-badges">'+civicBadges+'</div>':"")+
      '</div>'+
    '</article>';
  }).join("");

  document.querySelectorAll(".tile").forEach((node,index)=>{
    const tile=state.tiles[index];
    const houses=node.querySelector(".tile__houses");
    const badges=node.querySelector(".tile__badges");
    const tokens=node.querySelector(".tile__tokens");

    if(tile.owner==null){
      node.classList.remove("tile--owned");
      node.style.removeProperty("--owner-color");
      node.removeAttribute("data-owner-seat");
      houses.innerHTML="";
      badges.innerHTML="";
    }else{
      const ownerPlayer=state.players[tile.owner];
      node.classList.add("tile--owned");
      node.style.setProperty("--owner-color",ownerPlayer?.color??"#377bd1");
      node.dataset.ownerSeat=String(tile.owner);
      houses.innerHTML=houseMarkup(ownerPlayer,tile.level);
      badges.innerHTML=tile.level>=MAX_PROPERTY_LEVEL
        ? badge(UI_ASSETS.badges.noAcquisition,"不可強制收購","tile-no-acquisition")
        : "";
    }

    tokens.innerHTML=state.players
      .filter(player=>!player.bankrupt&&player.position===index)
      .map(player=>'<img class="pawn-token" data-board-player="'+player.seat+'" src="'+playerCharacter(player,"idle")+'" alt="" title="'+player.name+'">')
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
          (owner
            ? "<br>持有者 "+owner.name+
              (groupBonus
                ? "｜連區 ×"+groupRentMultiplier(tile.group).toFixed(
                    groupRentMultiplier(tile.group)%1===0?0:2
                  ).replace(/0$/,"")
                : "")
            : "")
        : "特殊事件格");
  }

  const statusText=document.getElementById("statusText");
  if(statusText){
    statusText.textContent=
      state.gameStatus==="lobby"
        ? "多人房間等待中，房主開始後未滿座位由 AI 補位。"
        : state.phase==="minigame"
          ? "都會挑戰進行中，等待所有玩家完成。"
          : state.phase==="transport"
            ? current.name+" 正在選擇交通轉乘目的地。"
          : state.phase==="acquisition"
            ? current.name+" 正在收購中心選擇目標地產。"
          : state.phase==="urban"
            ? current.name+" 正在城市更新局選擇重新部署位置。"
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

  const rollDisabled=!isLocalTurn||state.phase!=="await-roll";
  document.getElementById("rollButton").disabled=rollDisabled;
  const mobileRollButton=document.getElementById("mobileRollButton");
  if(mobileRollButton)mobileRollButton.disabled=rollDisabled;

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
