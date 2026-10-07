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
import{groupProgress,propertyValue,rentBreakdown,rentFor,upgradeCost}from"../core/property-economy.js?v=alpha32-240";
import{canUseDevelopmentPermit,canUsePropertyProtectionPermit}from"../core/property-events.js";
import{itemUiSummary,renderStrategyItems}from"./item-render.js";
import{playerAssetRankings}from"../core/player-assets.js?v=alpha32-240";

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
        ?"完成連區｜本區過路費已套用 "+multiplierLabel
        :"集滿 "+progress.total+" 塊即可啟用過路費 "+multiplierLabel)+'</small></div>'+
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

function renderPropertyEventActions(state,viewerPlayer,canControl){
  const container=document.getElementById("propertyEventActions");
  if(!container)return;
  const permits=Math.max(0,Math.floor(Number(viewerPlayer.developmentPermits)||0));
  const protectionPermits=Math.max(0,Math.floor(Number(viewerPlayer.propertyProtectionPermits)||0));
  const eligibleUpgrade=(viewerPlayer.properties??[])
    .filter(index=>{
      const tile=state.tiles?.[index];
      return tile?.type==="property"&&tile.owner===viewerPlayer.seat&&tile.level<MAX_PROPERTY_LEVEL;
    }).length;
  const eligibleProtection=(viewerPlayer.properties??[])
    .filter(index=>{
      const tile=state.tiles?.[index];
      return(
        tile?.type==="property"&&
        tile.owner===viewerPlayer.seat&&
        tile.level<MAX_PROPERTY_LEVEL&&
        Number(tile.acquisitionProtectedUntilRound)<Number(state.round)
      );
    }).length;
  const ownTurn=Boolean(
    canControl&&
    state.gameStatus==="playing"&&
    state.currentPlayer===viewerPlayer.seat
  );

  const developmentCard=
    '<article class="property-event-card '+(permits>0?"active":"")+'">'+
      '<div><strong>建案許可 ×'+permits+'</strong>'+
      '<small>'+(permits>0
        ?'可在下方指定一塊未滿級地產免費升級 1 級。'
        :'可由機會、命運或特殊格事件取得；一般升級規則不變。')+'</small></div>'+
      '<span>'+(permits>0
        ? eligibleUpgrade>0
          ? ownTurn?'可操作 '+eligibleUpgrade+' 塊':'等待自己的回合'
          :'目前沒有可升級地產'
        :'尚未取得')+'</span>'+
    '</article>';

  const protectionCard=
    '<article class="property-event-card property-event-card--protection '+(protectionPermits>0?"active":"")+'">'+
      '<div><strong>產權保全券 ×'+protectionPermits+'</strong>'+
      '<small>'+(protectionPermits>0
        ?'可指定一塊未滿級地產，保護 2 ROUND 不被強制收購。'
        :'可由法院、城市更新、收購中心或拍賣行事件取得。')+'</small></div>'+
      '<span>'+(protectionPermits>0
        ? eligibleProtection>0
          ? ownTurn?'可保護 '+eligibleProtection+' 塊':'等待自己的回合'
          :'目前沒有可保護地產'
        :'尚未取得')+'</span>'+
    '</article>';

  container.innerHTML=developmentCard+protectionCard;
}

function renderProperties(state,viewerPlayer,canControl){
  renderPropertyEventActions(state,viewerPlayer,canControl);
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
    const rentDetail=rentBreakdown(state,tile);
    const rent=rentDetail.finalRent;
    const value=propertyValue(tile);
    const cost=upgradeCost(tile);
    const progress=groupProgress(state,viewerPlayer.seat,tile.group);
    const maxLevel=tile.level>=MAX_PROPERTY_LEVEL;
    const canAfford=viewerPlayer.cash>=cost;
    const landedForUpgrade=Boolean(
      canControl&&
      state.currentPlayer===viewerPlayer.seat&&
      state.pendingUpgrade===tileIndex&&
      viewerPlayer.position===tileIndex&&
      state.phase==="landed"
    );
    const upgradeStatus=maxLevel
      ?"已滿級"
      : landedForUpgrade
        ?"本回合可升級 "+money(cost)
        : canAfford
          ?"需再次走到此地產"
          :"升級費 "+money(cost)+"｜現金不足";

    const permits=Math.max(0,Math.floor(Number(viewerPlayer.developmentPermits)||0));
    const permitUsable=permits>0&&canUseDevelopmentPermit(state,viewerPlayer.seat,tileIndex);
    const permitButton=permits>0&&!maxLevel
      ?'<button class="property-permit-upgrade" data-property-permit-upgrade="'+tileIndex+'" '+(permitUsable?'':'disabled')+'>'+
        (permitUsable?'使用建案許可':'特殊升級待命')+'</button>'
      :"";

    const protectionPermits=Math.max(0,Math.floor(Number(viewerPlayer.propertyProtectionPermits)||0));
    const protectedUntil=Math.max(0,Number(tile.acquisitionProtectedUntilRound)||0);
    const isProtected=protectedUntil>=Number(state.round);
    const protectionUsable=protectionPermits>0&&canUsePropertyProtectionPermit(state,viewerPlayer.seat,tileIndex);
    const protectionButton=protectionPermits>0&&!maxLevel&&!isProtected
      ?'<button class="property-protection-action" data-property-protection="'+tileIndex+'" '+(protectionUsable?'':'disabled')+'>'+
        (protectionUsable?'啟用產權保全':'產權保全待命')+'</button>'
      :"";

    return '<article class="property-row">'+
      regionBadge(tile.group)+
      '<div class="property-row__main">'+
        '<div class="property-row__title"><strong>'+tile.name+'</strong><em>LV.'+tile.level+'</em></div>'+
        '<span>'+tile.group+'｜區域 '+progress.owned+'/'+progress.total+'</span>'+
        '<small>資產 '+money(value)+'｜目前過路費 '+money(rent)+'</small>'+
        (progress.complete
          ?'<small class="property-rent-breakdown">基本 '+money(rentDetail.baseRent)+
            ' → LV.'+tile.level+' '+money(rentDetail.beforeGroupRent)+
            ' → 連區 ×'+rentDetail.groupMultiplier+
            '（+'+money(rentDetail.groupBonus)+'）→ 最終 '+money(rentDetail.finalRent)+'</small>'
          :"")+
        '<div class="property-row__badges">'+
          (progress.complete?badge(
            UI_ASSETS.badges.regionBonus,
            "連區完成 ×"+groupRentMultiplier(tile.group).toFixed(
              groupRentMultiplier(tile.group)%1===0?0:2
            ).replace(/0$/,"")
          ):"")+
          (maxLevel?badge(UI_ASSETS.badges.propertyMax,"房產滿級")+badge(UI_ASSETS.badges.noAcquisition,"不可強制收購"):"")+
          (isProtected?'<span class="property-protection-badge">保全至 R'+protectedUntil+'</span>':"")+
        '</div>'+
      '</div>'+
      '<div class="property-row__actions">'+
        '<span class="property-upgrade property-upgrade--status '+(landedForUpgrade?"ready":"")+'">'+upgradeStatus+'</span>'+
        permitButton+
        protectionButton+
      '</div>'+
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

  renderStrategyItems(state,localPlayer,{canControl});
  const itemSummary=itemUiSummary(state,localPlayer);
  document.querySelectorAll('[data-feature="item"]').forEach(button=>{
    button.classList.toggle("has-item-action",itemSummary.usable.length>0);
    button.classList.toggle("has-item-count",itemSummary.count>0);
    if(itemSummary.count>0)button.dataset.itemCount=String(itemSummary.count);
    else delete button.dataset.itemCount;
    if(itemSummary.usable.length>0)button.setAttribute("aria-label","策略道具：目前有 "+itemSummary.usable.length+" 種可使用");
    else button.removeAttribute("aria-label");
  });

  const propertyPermits=Math.max(0,Math.floor(Number(localPlayer.developmentPermits)||0));
  const propertyProtectionPermits=Math.max(0,Math.floor(Number(localPlayer.propertyProtectionPermits)||0));
  const propertyActionCount=propertyPermits+propertyProtectionPermits;
  document.querySelectorAll('[data-feature="property"]').forEach(button=>{
    button.classList.toggle("has-property-action",propertyActionCount>0);
    if(propertyActionCount>0)button.dataset.propertyActionCount=String(propertyActionCount);
    else delete button.dataset.propertyActionCount;
  });

  const players=document.getElementById("players");
  const assetRankingBySeat=new Map(
    playerAssetRankings(state).map(entry=>[entry.seat,entry])
  );
  players.innerHTML=state.players.map((player,index)=>{
    const ranking=assetRankingBySeat.get(player.seat);
    const assets=ranking?.assets??{cash:0,properties:0,stocks:0,bankDeposit:0,total:0};
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
    const tileName=state.tiles?.[player.position]?.name??("第 "+(player.position+1)+" 格");
    const totalShares=Object.values(player.portfolio??{})
      .reduce((sum,position)=>sum+Math.max(0,Math.floor(Number(position?.shares)||0)),0);
    const completedRegions=GROUP_ORDER
      .filter(group=>groupProgress(state,player.seat,group).complete).length;
    return '<article class="player-card '+(index===state.currentPlayer?"active":"")+
      ' '+(ranking?.rank===1?"player-card--wealth-leader":"")+
      '" style="--player-accent:'+(player.color??"#377bd1")+'">'+
      '<img class="player-pawn" data-player-avatar="'+index+'" src="'+playerCharacter(player,"idle")+'" alt="">'+
      '<div class="player-card__body">'+
        '<div class="player-card__headline">'+
          '<h3>'+player.name+(index===state.currentPlayer?" 👑":"")+statusBadge+thinkingBadge+offlineLabel+'</h3>'+
          '<span class="player-rank-badge player-rank-badge--'+(ranking?.rank??4)+'">#'+(ranking?.rank??"—")+'</span>'+
        '</div>'+
        '<div class="player-stats">'+
          '<span>現金 <b>'+money(player.cash)+'</b></span>'+
          '<span>地產 <b>'+player.properties.length+'</b></span>'+
          '<span>位置 <b>#'+(player.position+1)+'</b></span>'+
        '</div>'+
        '<div class="player-wealth">'+
          '<strong>總資產 '+money(assets.total)+'</strong>'+
          '<small>現金 '+money(assets.cash)+'｜地產 '+money(assets.properties)+'｜股票 '+money(assets.stocks)+
            (assets.bankDeposit>0?'｜定存 '+money(assets.bankDeposit):"")+'</small>'+
        '</div>'+
        '<div class="player-card__details">'+
          '<span>所在地 <b>'+tileName+'</b></span>'+
          '<span>持股 <b>'+totalShares+' 股</b></span>'+
          '<span>完整連區 <b>'+completedRegions+'</b></span>'+
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
      node.classList.remove("tile--owned","tile--region-complete");
      node.style.removeProperty("--owner-color");
      node.removeAttribute("data-owner-seat");
      node.removeAttribute("data-region-bonus");
      houses.innerHTML="";
      badges.innerHTML="";
    }else{
      const ownerPlayer=state.players[tile.owner];
      const completeRegion=Boolean(
        tile.type==="property"&&groupProgress(state,tile.owner,tile.group).complete
      );
      node.classList.add("tile--owned");
      node.classList.toggle("tile--region-complete",completeRegion);
      node.style.setProperty("--owner-color",ownerPlayer?.color??"#377bd1");
      node.dataset.ownerSeat=String(tile.owner);
      if(completeRegion){
        node.dataset.regionBonus="×"+groupRentMultiplier(tile.group);
      }else{
        node.removeAttribute("data-region-bonus");
      }
      houses.innerHTML=houseMarkup(ownerPlayer,tile.level);
      const titleProtected=Number(tile.acquisitionProtectedUntilRound)>=Number(state.round);
      badges.innerHTML=tile.level>=MAX_PROPERTY_LEVEL
        ? badge(UI_ASSETS.badges.noAcquisition,"滿級保護｜不可強制收購","tile-no-acquisition")
        : titleProtected
          ? badge(UI_ASSETS.badges.noAcquisition,"產權保全至 ROUND "+tile.acquisitionProtectedUntilRound,"tile-no-acquisition")
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
    const currentRent=tile.type==="property"?rentBreakdown(state,tile):null;
    currentTileInfo.innerHTML=
      '<strong>#'+tile.number+" "+tile.name+"</strong><br>"+
      (tile.type==="property"
        ? tile.group+"<br>售價 "+money(tile.price)+"｜目前過路費 "+money(currentRent.finalRent)+
          (owner
            ? "<br>持有者 "+owner.name+
              (groupBonus
                ? "｜連區 ×"+currentRent.groupMultiplier+
                  "（+"+money(currentRent.groupBonus)+"）"
                : "")
            : "")
        : "特殊事件格");
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

  const pendingUpgrade=state.pendingUpgrade!=null?state.tiles[state.pendingUpgrade]:null;
  const upgradeDialog=document.getElementById("upgradeDialog");
  const confirmUpgradeButton=document.getElementById("confirmUpgradeButton");
  const shouldShowUpgrade=Boolean(
    isLocalTurn&&
    pendingUpgrade&&
    pendingUpgrade.owner===current.seat&&
    current.position===state.pendingUpgrade&&
    state.phase==="landed"
  );

  if(shouldShowUpgrade){
    const cost=upgradeCost(pendingUpgrade);
    const canUpgradeNow=current.cash>=cost&&pendingUpgrade.level<MAX_PROPERTY_LEVEL;
    document.getElementById("upgradeTitle").textContent="是否升級「"+pendingUpgrade.name+"」？";
    document.getElementById("upgradeSubtitle").textContent="再次走到自己的地產｜LV."+pendingUpgrade.level+" → LV."+(pendingUpgrade.level+1);
    document.getElementById("upgradePrice").textContent=money(cost);
    document.getElementById("upgradeCash").textContent=money(current.cash);
    confirmUpgradeButton.disabled=!canUpgradeNow;
    confirmUpgradeButton.textContent=canUpgradeNow?"升級":"現金不足";
    if(!upgradeDialog.open)upgradeDialog.showModal();
  }else if(upgradeDialog?.open){
    upgradeDialog.close();
  }

  const endTurnDisabled=
    !isLocalTurn||
    state.phase!=="landed"||
    state.pendingPurchase!=null||
    state.pendingUpgrade!=null;
  document.getElementById("endTurnButton").disabled=endTurnDisabled;
  const desktopEndTurnButton=document.getElementById("desktopEndTurnButton");
  if(desktopEndTurnButton)desktopEndTurnButton.disabled=endTurnDisabled;

  renderProperties(state,localPlayer,canControl);
}
