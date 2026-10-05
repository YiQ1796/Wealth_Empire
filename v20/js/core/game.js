import{shouldBuyProperty,chooseStockOrders,chooseUpgrade}from"./ai.js";
import{fillAiMinigameResults,finalizeMinigame,startMinigame,submitMinigameResult as submitGameResult}from"./minigames.js";
import{canUpgradeProperty,ownsCompleteGroup,rentFor,upgradeCost}from"./property-economy.js";
import{GROUP_SIZES,groupRentMultiplier}from"../data/board.js";
import{advanceStockMarket,buyStock as executeBuyStock,getMarketStock,sellStock as executeSellStock}from"./stock-market.js";
import{resolveSpecialEvent}from"./special-events.js";
import{canUseTransport,chooseAiTransportDestination,createPendingTransport,transportNode}from"./transport.js";
import{chooseAiAcquisition,createPendingAcquisition,executeAcquisition}from"./acquisition-center.js";
import{applyCourt,applyHospital,applyMarketEvent,applyTaxOffice,canUseUrban,chooseAiUrbanDestination,createPendingUrban}from"./civic-specials.js";

export class GameEngine{
  constructor(state,onChange){
    this.state=state;
    this.onChange=onChange;
  }

  replaceState(nextState){
    this.state=nextState;
    this.notify();
  }

  get currentPlayer(){return this.state.players[this.state.currentPlayer]}

  isCurrentSeat(seat){
    return Number(seat)===this.state.currentPlayer;
  }

  log(text,kind="info",data={}){
    this.state.events.unshift({
      id:this.state.nextEventId++,
      kind,
      text,
      data,
      round:this.state.round
    });
    this.state.events=this.state.events.slice(0,80);
  }

  notify(){if(this.onChange)this.onChange(this.state)}

  startGame(seat=0){
    if(this.state.gameStatus!=="lobby"||Number(seat)!==0)return false;
    this.state.gameStatus="playing";
    this.state.phase="await-roll";
    this.state.currentPlayer=0;
    this.state.turnToken+=1;
    this.log("房間開始遊戲，未加入的位置由 AI 玩家補位。","system");
    this.notify();
    return true;
  }

  roll(seat=this.state.currentPlayer,forcedDice=null){
    if(
      this.state.gameStatus!=="playing"||
      this.state.phase!=="await-roll"||
      !this.isCurrentSeat(seat)
    )return false;

    const d1=forcedDice?.d1??1+Math.floor(Math.random()*6);
    const d2=forcedDice?.d2??1+Math.floor(Math.random()*6);
    const total=d1+d2;
    this.state.dice={d1,d2,total};

    const player=this.currentPlayer;
    const from=player.position;
    let passedStart=false;
    const path=[];
    for(let i=0;i<total;i++){
      player.position=(player.position+1)%this.state.tiles.length;
      path.push(player.position);
      if(player.position===0)passedStart=true;
    }

    if(passedStart){
      player.cash+=2500;
      this.log(player.name+" 通過起點，獲得 $2,500。","cash",{seat:player.seat,amount:2500});
    }

    this.log(
      player.name+" 擲出 "+d1+" + "+d2+" = "+total+"，從第 "+(from+1)+" 格移動到第 "+(player.position+1)+" 格。",
      "move",
      {seat:player.seat,from,to:player.position,path,d1,d2,total}
    );
    this.resolveLanding(player);
    this.notify();
    return true;
  }

  resolveLanding(player,{specialChainDepth=0}={}){
    this.state.pendingPurchase=null;
    this.state.pendingTransport=null;
    this.state.pendingAcquisition=null;
    this.state.pendingUrban=null;
    const tile=this.state.tiles[player.position];

    if(tile.type==="property"){
      if(tile.owner==null){
        this.state.pendingPurchase=player.position;
        this.state.phase="landed";
        this.log(player.name+" 抵達「"+tile.name+"」，可選擇購買。","property_offer",{seat:player.seat,tile:player.position});
        return;
      }

      if(tile.owner!==player.seat){
        const owner=this.state.players[tile.owner];
        const rent=rentFor(this.state,tile);
        const paid=Math.min(player.cash,rent);
        player.cash-=paid;
        owner.cash+=paid;
        player.rentPaid+=paid;
        owner.rentReceived+=paid;
        this.log(
          player.name+" 支付「"+tile.name+"」過路費 "+this.formatMoney(paid)+" 給 "+owner.name+"。"+
          (ownsCompleteGroup(this.state,tile.owner,tile.group)
            ?"（連區 ×"+groupRentMultiplier(tile.group)+"）"
            :""),
          "rent",
          {
            payerSeat:player.seat,
            payerName:player.name,
            ownerSeat:owner.seat,
            ownerName:owner.name,
            tile:player.position,
            tileName:tile.name,
            amount:paid,
            requested:rent,
            group:tile.group,
            payerCashAfter:player.cash,
            ownerCashAfter:owner.cash
          }
        );
        if(paid<rent){
          this.log(player.name+" 現金不足，實際支付可用現金 "+this.formatMoney(paid)+"。","warning",{seat:player.seat});
        }
      }else{
        this.log(player.name+" 回到自己的「"+tile.name+"」。","property_owned",{seat:player.seat,tile:player.position});
      }

      this.state.phase="landed";
      return;
    }

    if(tile.type==="acquisition"){
      const pending=createPendingAcquisition(this.state,player.seat,player.position);
      if(!pending.options.length){
        this.state.phase="landed";
        this.log(
          player.name+" 抵達「收購中心」，目前沒有符合既有收購條件的其他玩家地產。",
          "acquisition_empty",
          {seat:player.seat,tile:player.position}
        );
        return;
      }

      this.state.pendingAcquisition=pending;
      this.state.phase="acquisition";
      this.log(
        player.name+" 抵達「收購中心」，可依既有 125% 資產估值規則選擇一塊符合條件的對手地產收購。",
        "acquisition_offer",
        {
          seat:player.seat,
          playerName:player.name,
          tile:player.position,
          optionCount:pending.options.length
        }
      );
      return;
    }

    if(tile.type==="station"){
      const pending=createPendingTransport(this.state,player);
      if(!pending){
        this.state.phase="landed";
        this.log(player.name+" 抵達「"+tile.name+"」，但交通節點資料不完整。","warning",{seat:player.seat,tile:player.position});
        return;
      }
      this.state.pendingTransport=pending;
      this.state.phase="transport";
      this.log(
        player.name+" 抵達「"+tile.name+"」，可免費轉乘至其他交通節點，或留在原地。",
        "transport_offer",
        {
          seat:player.seat,
          playerName:player.name,
          sourceIndex:pending.sourceIndex,
          sourceName:tile.name,
          destinationIndexes:pending.destinationIndexes
        }
      );
      return;
    }

    if(tile.type==="highlow"||tile.type==="horse"||tile.type==="auction"){
      const forcedGameId=tile.type==="horse"
        ?"horse"
        : tile.type==="auction"
          ?"auction"
          :"highlow";
      const session=startMinigame(this.state,player.seat,Date.now(),forcedGameId);
      fillAiMinigameResults(this.state);
      this.log(
        player.name+" 觸發都會挑戰："+session.id+"。",
        "minigame_start",
        {seat:player.seat,gameId:session.id,tileType:tile.type}
      );
      this.tryFinalizeMinigame();
      return;
    }

    if(tile.type==="tax"||tile.type==="court"||tile.type==="hospital"||tile.type==="market"){
      this.state.phase="landed";
      const result=tile.type==="tax"
        ?applyTaxOffice(this.state,player)
        :tile.type==="court"
          ?applyCourt(this.state,player)
          :tile.type==="hospital"
            ?applyHospital(this.state,player)
            :applyMarketEvent(this.state,player);
      this.log(
        player.name+"｜"+result.title+"："+result.text,
        tile.type==="market"?"market_tick":"special_grid",
        {
          seat:player.seat,
          playerName:player.name,
          type:tile.type,
          untilRound:result.untilRound,
          tick:result.tick,
          movers:result.movers??[]
        }
      );
      return;
    }

    if(tile.type==="urban"){
      const pending=createPendingUrban(this.state,player);
      if(!pending){
        this.state.phase="landed";
        this.log(player.name+" 抵達「城市更新局」，但目前沒有自己持有的地產可重新部署。","urban_empty",{seat:player.seat});
        return;
      }
      this.state.pendingUrban=pending;
      this.state.phase="urban";
      this.log(
        player.name+" 抵達「城市更新局」，可選擇一塊自己的地產作為重新部署位置。",
        "urban_offer",
        {seat:player.seat,sourceIndex:pending.sourceIndex,destinationIndexes:pending.destinationIndexes}
      );
      return;
    }

    if(tile.type==="chance"||tile.type==="fate"){
      this.state.phase="landed";
      if(specialChainDepth>0){
        this.log(
          player.name+" 因事件移動抵達「"+tile.name+"」，本次不連續抽第二張事件。",
          "event",
          {seat:player.seat,tile:player.position,type:tile.type,chainStopped:true}
        );
        return;
      }

      const resolved=resolveSpecialEvent(this.state,player,tile.type);
      if(!resolved){
        this.log(player.name+" 抵達「"+tile.name+"」，但事件池目前無可用事件。","warning",{seat:player.seat,type:tile.type});
        return;
      }

      const isChance=tile.type==="chance";
      const label=isChance?"機會":"命運";
      const effectText=resolved.blockedBy==="tax"
        ?"稅務抵免生效，本次負面金錢事件取消"
        :resolved.blockedBy==="hospital"
          ?"醫療保護生效，本次後退事件取消"
        :resolved.kind==="cash"
        ? (resolved.amount>=0
          ?"獲得 "+this.formatMoney(resolved.amount)
          :"支付 "+this.formatMoney(Math.abs(resolved.amount)))
        : resolved.kind==="move"
          ? ((resolved.delta>=0?"前進 ":"後退 ")+Math.abs(resolved.delta)+" 格")
          : "沒有額外效果";

      this.log(
        player.name+"｜"+label+"「"+resolved.event.name+"」："+resolved.event.description+"（"+effectText+"）",
        "special_event",
        {
          seat:player.seat,
          playerName:player.name,
          type:tile.type,
          eventId:resolved.event.id,
          eventName:resolved.event.name,
          effectKind:resolved.kind,
          amount:resolved.amount,
          delta:resolved.delta,
          from:resolved.from,
          to:resolved.to,
          cashAfter:resolved.cashAfter,
          blockedBy:resolved.blockedBy??null
        }
      );

      if(resolved.moved){
        this.resolveLanding(player,{specialChainDepth:specialChainDepth+1});
      }
      return;
    }

    this.state.phase="landed";
    const eventText={
      start:"回到起點。",
      tax:"抵達稅務局。",
      market:"抵達股市事件格。本回合仍可自由買賣股票。",
      court:"抵達法院。",
      hospital:"抵達醫療中心。",
      urban:"抵達城市更新局。"
    }[tile.type]||"觸發特殊事件。";
    this.log(player.name+" 抵達「"+tile.name+"」："+eventText,"event",{seat:player.seat,tile:player.position,type:tile.type});
  }

  useUrban(destinationIndex,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)||!canUseUrban(this.state,seat,destinationIndex))return false;
    const player=this.currentPlayer;
    const from=player.position;
    const to=Number(destinationIndex);
    player.position=to;
    this.state.pendingUrban=null;
    this.state.phase="landed";
    this.log(
      player.name+" 透過城市更新局重新部署到自己的「"+this.state.tiles[to].name+"」。",
      "move",
      {seat:player.seat,from,to,path:[to],urban:true}
    );
    this.log(
      player.name+" 完成城市更新重新部署。",
      "urban_complete",
      {seat:player.seat,playerName:player.name,from,to,tileName:this.state.tiles[to].name}
    );
    this.notify();
    return true;
  }

  skipUrban(seat=this.state.currentPlayer){
    const pending=this.state.pendingUrban;
    if(!this.isCurrentSeat(seat)||this.state.phase!=="urban"||!pending||pending.seat!==Number(seat))return false;
    this.state.pendingUrban=null;
    this.state.phase="landed";
    this.log(this.currentPlayer.name+" 放棄城市更新重新部署。","urban_skip",{seat:this.currentPlayer.seat});
    this.notify();
    return true;
  }

  acquireFromCenter(tileIndex,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)){
      return false;
    }

    const result=executeAcquisition(this.state,seat,tileIndex);
    if(!result.ok){
      this.log("目前無法收購這塊地產。","warning",{seat,tileIndex:Number(tileIndex)});
      this.notify();
      return false;
    }

    const buyer=this.state.players[seat];
    const seller=this.state.players[result.previousOwnerSeat];
    this.state.pendingAcquisition=null;
    this.state.phase="landed";

    this.log(
      buyer.name+" 透過收購中心以 "+this.formatMoney(result.offer)+" 收購「"+result.tileName+
        "」，原持有人 "+(seller?.name??result.previousOwnerName)+"。",
      "property_acquisition",
      {
        seat,
        buyerSeat:seat,
        buyerName:buyer.name,
        sellerSeat:result.previousOwnerSeat,
        sellerName:seller?.name??result.previousOwnerName,
        tile:Number(tileIndex),
        tileName:result.tileName,
        group:result.group,
        level:result.level,
        amount:result.offer,
        buyerCashAfter:result.buyerCashAfter,
        sellerCashAfter:result.sellerCashAfter
      }
    );
    this.notify();
    return true;
  }

  skipAcquisition(seat=this.state.currentPlayer){
    const pending=this.state.pendingAcquisition;
    if(
      !this.isCurrentSeat(seat)||
      this.state.phase!=="acquisition"||
      !pending||
      pending.seat!==Number(seat)
    )return false;

    this.state.pendingAcquisition=null;
    this.state.phase="landed";
    this.log(
      this.currentPlayer.name+" 選擇不使用收購中心。",
      "acquisition_skip",
      {seat:this.currentPlayer.seat}
    );
    this.notify();
    return true;
  }

  useTransport(destinationIndex,seat=this.state.currentPlayer){
    const player=this.currentPlayer;
    if(!this.isCurrentSeat(seat)||!canUseTransport(this.state,seat,destinationIndex)){
      this.log("目前無法使用這條交通路線。","warning",{seat,destinationIndex:Number(destinationIndex)});
      this.notify();
      return false;
    }

    const pending=this.state.pendingTransport;
    const sourceIndex=pending.sourceIndex;
    const destination=Number(destinationIndex);
    const sourceNode=transportNode(sourceIndex);
    const destinationNode=transportNode(destination);

    player.position=destination;
    this.state.pendingTransport=null;
    this.state.phase="landed";

    this.log(
      player.name+" 從「"+(sourceNode?.name??("第 "+(sourceIndex+1)+" 格"))+"」轉乘至「"+
        (destinationNode?.name??("第 "+(destination+1)+" 格"))+"」。",
      "move",
      {
        seat:player.seat,
        from:sourceIndex,
        to:destination,
        path:[destination],
        transport:true
      }
    );
    this.log(
      player.name+" 完成免費轉乘，本次抵達交通節點不再連續觸發第二次交通。",
      "transport_complete",
      {
        seat:player.seat,
        playerName:player.name,
        sourceIndex,
        sourceName:sourceNode?.name??"",
        destinationIndex:destination,
        destinationName:destinationNode?.name??""
      }
    );
    this.notify();
    return true;
  }

  skipTransport(seat=this.state.currentPlayer){
    const pending=this.state.pendingTransport;
    if(
      !this.isCurrentSeat(seat)||
      this.state.phase!=="transport"||
      !pending||
      pending.seat!==Number(seat)
    )return false;

    const sourceNode=transportNode(pending.sourceIndex);
    this.state.pendingTransport=null;
    this.state.phase="landed";
    this.log(
      this.currentPlayer.name+" 選擇留在「"+(sourceNode?.name??"交通設施")+"」，不進行轉乘。",
      "transport_skip",
      {seat:this.currentPlayer.seat,sourceIndex:pending.sourceIndex,sourceName:sourceNode?.name??""}
    );
    this.notify();
    return true;
  }

  buyCurrentProperty(seat=this.state.currentPlayer){
    const tileIndex=this.state.pendingPurchase;
    const player=this.currentPlayer;
    if(!this.isCurrentSeat(seat)||tileIndex==null){
      this.log("目前沒有可購買的地產。","warning");
      this.notify();
      return false;
    }

    const tile=this.state.tiles[tileIndex];
    const canBuy=
      this.state.phase==="landed"&&
      player.position===tileIndex&&
      tile?.type==="property"&&
      tile.owner==null&&
      player.cash>=tile.price;

    if(!canBuy){
      this.log("目前無法購買這塊地產。","warning",{seat:player.seat,tile:tileIndex});
      this.notify();
      return false;
    }

    player.cash-=tile.price;
    if(!player.properties.includes(tileIndex))player.properties.push(tileIndex);
    tile.owner=player.seat;
    this.state.pendingPurchase=null;
    this.log(
      player.name+" 以 "+this.formatMoney(tile.price)+" 購買「"+tile.name+"」。",
      "property_buy",
      {
        seat:player.seat,
        playerName:player.name,
        tile:tileIndex,
        tileName:tile.name,
        amount:tile.price,
        group:tile.group,
        cashAfter:player.cash
      }
    );

    if(ownsCompleteGroup(this.state,player.seat,tile.group)){
      const total=GROUP_SIZES[tile.group]??0;
      const multiplier=groupRentMultiplier(tile.group);
      this.log(
        player.name+" 已完成「"+tile.group+"」"+total+"/"+total+" 地產，該區過路費提升至 ×"+multiplier+"。",
        "group_complete",
        {seat:player.seat,group:tile.group,total,multiplier}
      );
    }

    this.notify();
    return true;
  }

  declineCurrentProperty(seat=this.state.currentPlayer){
    const tileIndex=this.state.pendingPurchase;
    if(!this.isCurrentSeat(seat)||tileIndex==null)return false;
    const tile=this.state.tiles[tileIndex];
    this.state.pendingPurchase=null;
    this.log(this.currentPlayer.name+" 放棄購買「"+tile.name+"」。","property_decline",{seat:this.currentPlayer.seat,tile:tileIndex});
    this.notify();
    return true;
  }

  upgradeProperty(tileIndex,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat))return false;
    const player=this.currentPlayer;
    const tile=this.state.tiles[Number(tileIndex)];
    const cost=tile?upgradeCost(tile):0;
    const validPhase=["await-roll","landed"].includes(this.state.phase)&&this.state.pendingPurchase==null;
    const canUpgrade=Boolean(
      validPhase&&
      canUpgradeProperty(player.seat,tile)&&
      player.cash>=cost
    );

    if(!canUpgrade){
      this.log("目前無法升級這塊地產。","warning",{seat:player.seat,tile:Number(tileIndex)});
      this.notify();
      return false;
    }

    player.cash-=cost;
    tile.level+=1;
    const rentAfter=rentFor(this.state,tile);
    this.log(
      player.name+" 花費 "+this.formatMoney(cost)+" 將「"+tile.name+"」升級至 LV."+tile.level+"，目前過路費 "+this.formatMoney(rentAfter)+"。",
      "property_upgrade",
      {
        seat:player.seat,
        playerName:player.name,
        tile:Number(tileIndex),
        tileName:tile.name,
        group:tile.group,
        level:tile.level,
        amount:cost,
        rentAfter,
        cashAfter:player.cash
      }
    );
    this.notify();
    return true;
  }

  buyStock(stockId,shares,seat=this.state.currentPlayer){
    const result=executeBuyStock(this.state,seat,stockId,shares);
    if(!result.ok){
      const reason={
        cash:"現金不足。",
        trade_locked:"目前正在小遊戲或結算中，暫時不能交易股票。",
        invalid:"股票交易數量不正確。"
      }[result.reason]??"目前無法買進股票。";
      this.log(reason,"warning",{seat,stockId});
      this.notify();
      return false;
    }
    const stock=getMarketStock(this.state,stockId);
    this.log(
      this.state.players[seat].name+" 買進「"+(stock?.name??stockId)+"」"+result.quantity+" 股，共 "+this.formatMoney(result.total)+"。",
      "stock_buy",
      {
        seat,
        playerName:this.state.players[seat].name,
        stockId,
        stockName:stock?.name??stockId,
        shares:result.quantity,
        total:result.total,
        price:result.price,
        holdingShares:result.holding.shares,
        avgCost:result.holding.avgCost,
        cashAfter:this.state.players[seat].cash
      }
    );
    this.notify();
    return true;
  }

  sellStock(stockId,shares,seat=this.state.currentPlayer){
    const result=executeSellStock(this.state,seat,stockId,shares);
    if(!result.ok){
      const reason={
        shares:"持股數量不足。",
        trade_locked:"目前正在小遊戲或結算中，暫時不能交易股票。",
        invalid:"股票交易數量不正確。"
      }[result.reason]??"目前無法賣出股票。";
      this.log(reason,"warning",{seat,stockId});
      this.notify();
      return false;
    }
    const stock=getMarketStock(this.state,stockId);
    this.log(
      this.state.players[seat].name+" 賣出「"+(stock?.name??stockId)+"」"+result.quantity+" 股，共 "+this.formatMoney(result.total)+"，已實現損益 "+this.formatSignedMoney(result.realized)+"。",
      "stock_sell",
      {
        seat,
        playerName:this.state.players[seat].name,
        stockId,
        stockName:stock?.name??stockId,
        shares:result.quantity,
        total:result.total,
        price:result.price,
        realized:result.realized,
        holdingShares:result.holding.shares,
        cashAfter:this.state.players[seat].cash
      }
    );
    this.notify();
    return true;
  }

  submitMinigameResult(seat,result){
    const submitted=submitGameResult(this.state,seat,result);
    if(!submitted.ok)return false;
    if(this.state.minigame?.id==="auction"){
      this.log(
        this.state.players[seat].name+" 已提交拍賣暗標，等待其他玩家開標。",
        "minigame_result",
        {seat,gameId:"auction",submitted:true}
      );
    }else{
      this.log(
        this.state.players[seat].name+" 已完成小遊戲，得分 "+submitted.score+"。",
        "minigame_result",
        {seat,score:submitted.score,gameId:this.state.minigame?.id}
      );
    }
    this.tryFinalizeMinigame();
    this.notify();
    return true;
  }

  tryFinalizeMinigame(now=Date.now()){
    const completed=finalizeMinigame(this.state,now);
    if(!completed)return false;
    const summary=completed.rankings
      .map(item=>"#"+item.rank+" "+this.state.players[item.seat].name+" "+item.score+" 分 / +"+this.formatMoney(item.reward))
      .join("；");
    this.log(completed.game.name+" 結算："+summary,"minigame_complete",{gameId:completed.game.id,rankings:completed.rankings});
    return true;
  }

  tick(now=Date.now()){
    if(this.state.phase==="minigame"&&this.tryFinalizeMinigame(now)){
      this.notify();
      return true;
    }
    return false;
  }

  prepareAiTurn(){
    const player=this.currentPlayer;
    if(player.kind!=="ai"||this.state.aiPreparedTurnToken===this.state.turnToken)return false;
    this.state.aiPreparedTurnToken=this.state.turnToken;

    for(const order of chooseStockOrders(this.state,player.seat)){
      if(order.type==="buy")this.buyStock(order.stockId,order.shares,player.seat);
      if(order.type==="sell")this.sellStock(order.stockId,order.shares,player.seat);
    }

    const upgradeIndex=chooseUpgrade(this.state,player.seat);
    if(upgradeIndex!=null)this.upgradeProperty(upgradeIndex,player.seat);
    return true;
  }

  runAiStep(){
    if(this.state.gameStatus!=="playing")return false;
    const player=this.currentPlayer;
    if(player.kind!=="ai")return false;

    if(this.state.phase==="await-roll"){
      this.prepareAiTurn();
      return this.roll(player.seat);
    }

    if(this.state.phase==="transport"){
      const destinationIndex=chooseAiTransportDestination(this.state,player.seat);
      if(destinationIndex!=null)return this.useTransport(destinationIndex,player.seat);
      return this.skipTransport(player.seat);
    }

    if(this.state.phase==="acquisition"){
      const tileIndex=chooseAiAcquisition(this.state,player.seat);
      if(tileIndex!=null)return this.acquireFromCenter(tileIndex,player.seat);
      return this.skipAcquisition(player.seat);
    }

    if(this.state.phase==="urban"){
      const tileIndex=chooseAiUrbanDestination(this.state,player.seat);
      if(tileIndex!=null)return this.useUrban(tileIndex,player.seat);
      return this.skipUrban(player.seat);
    }

    if(this.state.phase==="landed"&&this.state.pendingPurchase!=null){
      const tile=this.state.tiles[this.state.pendingPurchase];
      if(shouldBuyProperty(this.state,player.seat,tile)){
        this.buyCurrentProperty(player.seat);
      }else{
        this.declineCurrentProperty(player.seat);
      }
      return true;
    }

    if(this.state.phase==="landed"){
      return this.endTurn(player.seat);
    }

    if(this.state.phase==="minigame"){
      fillAiMinigameResults(this.state);
      if(this.tryFinalizeMinigame()){
        this.notify();
        return true;
      }
    }

    return false;
  }

  endTurn(seat=this.state.currentPlayer){
    if(
      !this.isCurrentSeat(seat)||
      this.state.phase!=="landed"||
      this.state.pendingPurchase!=null||
      this.state.pendingTransport!=null||
      this.state.pendingAcquisition!=null||
      this.state.pendingUrban!=null
    )return false;

    const previousSeat=this.state.currentPlayer;
    let nextSeat=previousSeat;
    do{
      nextSeat=(nextSeat+1)%this.state.players.length;
    }while(this.state.players[nextSeat].bankrupt&&nextSeat!==previousSeat);

    const wrapped=nextSeat<=previousSeat;
    this.state.currentPlayer=nextSeat;
    if(wrapped){
      if(this.state.round>=this.state.maxRounds){
        this.state.gameStatus="finished";
        this.state.phase="finished";
        this.state.turnToken+=1;
        this.state.aiPreparedTurnToken=null;
        this.state.dice=null;
        this.log("第 "+this.state.maxRounds+" ROUND 已完成，遊戲正式結束。","game_complete",{round:this.state.round});
        this.notify();
        return true;
      }
      this.state.round+=1;
    }

    advanceStockMarket(this.state,{
      round:this.state.round,
      nextSeat
    });
    const movers=[...this.state.market.stocks]
      .sort((a,b)=>Math.abs(b.changePercent)-Math.abs(a.changePercent))
      .slice(0,3)
      .map(stock=>stock.name+" "+(stock.changePercent>0?"+":"")+stock.changePercent.toFixed(1)+"%")
      .join("、");
    this.log(
      "市場更新｜輪到 "+this.state.players[nextSeat].name+"：全市場重新漲跌，"+movers+"。",
      "market_tick",
      {
        round:this.state.round,
        seat:nextSeat,
        playerName:this.state.players[nextSeat].name,
        tick:this.state.market.tick,
        movers:[...this.state.market.stocks]
          .sort((a,b)=>Math.abs(b.changePercent)-Math.abs(a.changePercent))
          .slice(0,3)
          .map(stock=>({name:stock.name,changePercent:stock.changePercent}))
      }
    );

    this.state.turnToken+=1;
    this.state.aiPreparedTurnToken=null;
    this.state.dice=null;
    this.state.phase="await-roll";
    this.notify();
    return true;
  }

  formatMoney(value){return"$"+Math.round(value).toLocaleString()}
  formatSignedMoney(value){
    const rounded=Math.round(value);
    return(rounded>=0?"+":"-")+"$"+Math.abs(rounded).toLocaleString();
  }
}
