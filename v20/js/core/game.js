import{shouldBuyProperty,chooseStockOrders,chooseUpgrade}from"./ai.js";
import{fillAiMinigameResults,finalizeMinigame,startMinigame,submitMinigameResult as submitGameResult}from"./minigames.js";
import{canUpgradeProperty,ownsCompleteGroup,rentBreakdown,rentFor,upgradeCost}from"./property-economy.js?v=alpha32-227";
import{GROUP_SIZES,groupRentMultiplier}from"../data/board.js";
import{advanceStockMarket,buyStock as executeBuyStock,getMarketStock,sellStock as executeSellStock}from"./stock-market.js";
import{playerAssetRankings}from"./player-assets.js?v=alpha32-228";
import{resolveSpecialEvent}from"./special-events.js";
import{canUseTransportAction,chooseAiTransportAction,createPendingTransport,transportNode}from"./transport.js";
import{chooseAiAcquisition,createPendingAcquisition,executeAcquisition}from"./acquisition-center.js?v=alpha32-226";
import{canUseUrban,chooseAiUrbanDestination,createPendingUrban,resolveCivicEvent}from"./civic-specials.js?v=alpha32-226";
import{
  acceptMission,
  activateInsurance,
  applyRentInsurance,
  buildForwardPath,
  canAcceptMission,
  canActivateInsurance,
  canOpenBankDeposit,
  canUseCentralDevelopment,
  canUseCentralTransit,
  markCentralDevelopmentUsed,
  markCentralTransitUsed,
  recordMissionAction,
  settleBankDeposits,
  startBankDeposit
}from"./central-features.js";
import{canUseDevelopmentPermit,canUsePropertyProtectionPermit,eligibleOwnedPropertyIndexes,eligibleProtectionPropertyIndexes,grantDevelopmentPermits,useDevelopmentPermit,usePropertyProtectionPermit}from"./property-events.js";
import{chooseAiItemAction,useItem as executeItemUse}from"./items.js";
import{advanceWorldRound,applyDirectStockMove,chooseAiWorldChoice,recordGovernmentContractAction,resolveWorldChoice as executeWorldChoice}from"./world-events.js";

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

    const player=this.currentPlayer;
    const forcedTotal=forcedDice==null
      ? Math.max(0,Math.floor(Number(player.forcedDiceTotal)||0))
      : 0;
    const itemForcedDice=forcedTotal>=2&&forcedTotal<=12
      ? {
          d1:Math.max(1,Math.min(6,forcedTotal-1)),
          d2:forcedTotal-Math.max(1,Math.min(6,forcedTotal-1))
        }
      : null;
    const diceSource=forcedDice??itemForcedDice;
    const d1=diceSource?.d1??1+Math.floor(Math.random()*6);
    const d2=diceSource?.d2??1+Math.floor(Math.random()*6);
    const total=d1+d2;
    if(itemForcedDice)player.forcedDiceTotal=null;
    this.state.dice={d1,d2,total};
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
    this.state.pendingUpgrade=null;
    this.state.pendingTransport=null;
    this.state.pendingAcquisition=null;
    this.state.pendingUrban=null;
    this.state.pendingWorldChoice=null;
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
        const rentDetail=rentBreakdown(this.state,tile);
        let requestedRent=rentDetail.finalRent;
        let strategyRentEffect=null;
        if(Math.floor(Number(tile.rentBlockedCharges)||0)>0){
          tile.rentBlockedCharges=Math.max(0,Math.floor(Number(tile.rentBlockedCharges)||0)-1);
          requestedRent=0;
          strategyRentEffect="rent_block";
        }else if(Math.floor(Number(tile.rentBurstCharges)||0)>0){
          tile.rentBurstCharges=Math.max(0,Math.floor(Number(tile.rentBurstCharges)||0)-1);
          requestedRent=Math.round(requestedRent*2);
          strategyRentEffect="rent_burst";
        }
        if(requestedRent>0){
          if(Math.floor(Number(tile.leaseBonusCharges)||0)>0){
            tile.leaseBonusCharges=Math.max(0,Math.floor(Number(tile.leaseBonusCharges)||0)-1);
          }
          if(Math.floor(Number(tile.rentPenaltyCharges)||0)>0){
            tile.rentPenaltyCharges=Math.max(0,Math.floor(Number(tile.rentPenaltyCharges)||0)-1);
          }
        }
        const insurance=requestedRent>0
          ? applyRentInsurance(player,requestedRent)
          : {rent:0,discount:0,protected:false};
        const rent=insurance.rent;
        const paid=Math.min(player.cash,rent);
        player.cash-=paid;
        owner.cash+=paid;
        player.rentPaid+=paid;
        owner.rentReceived+=paid;
        const regionMessage=rentDetail.completeGroup
          ?"（"+tile.group+"連區 ×"+rentDetail.groupMultiplier+
            "：連區加成 +"+this.formatMoney(rentDetail.groupBonus)+
            "，連區後 "+this.formatMoney(rentDetail.finalRent)+"）"
          :"";
        const extraRentEffects=[
          rentDetail.leaseMultiplier>1?"租賃契約 ×"+rentDetail.leaseMultiplier.toFixed(2):"",
          rentDetail.maintenanceMultiplier<1?"維修延後 ×"+rentDetail.maintenanceMultiplier.toFixed(2):"",
          Math.abs(rentDetail.worldMultiplier-1)>.001?"城市事件 ×"+rentDetail.worldMultiplier.toFixed(2):""
        ].filter(Boolean);
        const extraRentMessage=extraRentEffects.length?"（"+extraRentEffects.join("、")+"）":"";
        const rentMessage=strategyRentEffect==="rent_block"
          ? player.name+" 踩到「"+tile.name+"」，租金封鎖卡生效，本次免收過路費。"+
            regionMessage
          : player.name+" 支付「"+tile.name+"」過路費 "+this.formatMoney(paid)+" 給 "+owner.name+"。"+
            regionMessage+
            (strategyRentEffect==="rent_burst"?"（過路費爆發 ×2）":"")+
            extraRentMessage;
        this.log(
          rentMessage,
          "rent",
          {
            payerSeat:player.seat,
            payerName:player.name,
            ownerSeat:owner.seat,
            ownerName:owner.name,
            tile:player.position,
            tileName:tile.name,
            amount:paid,
            requested:requestedRent,
            discount:insurance.discount,
            insured:insurance.protected,
            group:tile.group,
            payerCashAfter:player.cash,
            ownerCashAfter:owner.cash,
            strategyRentEffect,
            rentBreakdown:{
              baseRent:rentDetail.baseRent,
              levelRent:rentDetail.levelRent,
              beforeGroupRent:rentDetail.beforeGroupRent,
              groupMultiplier:rentDetail.groupMultiplier,
              groupBonus:rentDetail.groupBonus,
              leaseMultiplier:rentDetail.leaseMultiplier,
              maintenanceMultiplier:rentDetail.maintenanceMultiplier,
              worldMultiplier:rentDetail.worldMultiplier,
              finalRent:rentDetail.finalRent,
              completeGroup:rentDetail.completeGroup
            }
          }
        );
        if(insurance.protected){
          this.log(
            player.name+" 的租金保險生效，本次原租金 "+this.formatMoney(requestedRent)+
              "，減壓後為 "+this.formatMoney(rent)+"。",
            "central_insurance_used",
            {seat:player.seat,requested:requestedRent,amount:rent,discount:insurance.discount}
          );
        }
        if(paid<rent){
          this.log(player.name+" 現金不足，實際支付可用現金 "+this.formatMoney(paid)+"。","warning",{seat:player.seat});
        }

        const landingAcquisition=createPendingAcquisition(
          this.state,
          player.seat,
          player.position,
          {tileIndexes:[player.position],source:"landing"}
        );
        if(landingAcquisition.options.length){
          const option=landingAcquisition.options[0];
          this.state.pendingAcquisition=landingAcquisition;
          this.state.phase="acquisition";
          this.log(
            player.name+" 踩到未滿級的對手地產「"+tile.name+"」，支付過路費後取得強制收購權；是否收購由玩家決定，對手不能拒絕。"+
              (option.affordable
                ?" 可用 "+this.formatMoney(option.offer)+" 收購。"
                :" 目前現金不足，仍可查看報價後放棄。"),
            "acquisition_offer",
            {
              seat:player.seat,
              playerName:player.name,
              tile:player.position,
              tileName:tile.name,
              source:"landing",
              optionCount:1,
              offer:option.offer,
              affordable:option.affordable
            }
          );
          return;
        }
      }else{
        const cost=upgradeCost(tile);
        const upgradeable=canUpgradeProperty(player.seat,tile);
        const affordable=player.cash>=cost;
        if(upgradeable&&affordable){
          this.state.pendingUpgrade=player.position;
          this.log(
            player.name+" 再次走到自己的「"+tile.name+"」，可選擇升級。",
            "property_upgrade_offer",
            {seat:player.seat,tile:player.position,tileName:tile.name,level:tile.level,cost}
          );
        }else if(!upgradeable){
          this.log(player.name+" 回到自己的「"+tile.name+"」，目前已無法再升級。","property_owned",{seat:player.seat,tile:player.position});
        }else{
          this.log(
            player.name+" 回到自己的「"+tile.name+"」，但目前現金不足以升級。",
            "property_owned",
            {seat:player.seat,tile:player.position,tileName:tile.name,cost,cash:player.cash}
          );
        }
      }

      this.state.phase="landed";
      return;
    }

    if(tile.type==="acquisition"){
      const result=resolveCivicEvent(this.state,player,"acquisition");
      if(!result){
        this.state.phase="landed";
        this.log(player.name+" 抵達「收購中心」，但事件池目前無可用事件。","warning",{seat:player.seat,type:"acquisition"});
        return;
      }

      if(result.kind==="acquisition_offer"){
        const pending=createPendingAcquisition(this.state,player.seat,player.position);
        if(!pending.options.length){
          player.cash+=600;
          this.state.phase="landed";
          this.log(
            player.name+"｜收購中心「"+result.event.name+"」：目前沒有符合收購條件的地產，改領市場調查補助 $600。",
            "special_grid",
            {seat:player.seat,type:"acquisition",eventId:result.event.id,rarity:result.rarity,amount:600,cashAfter:player.cash,fallback:"no_acquisition_target"}
          );
          return;
        }

        this.state.pendingAcquisition=pending;
        this.state.phase="acquisition";
        this.log(
          player.name+"｜"+(result.rarity==="rare"?"【稀有】":"")+"收購中心「"+result.event.name+"」：可依既有 125% 資產估值規則選擇一塊符合條件的對手地產收購。",
          "acquisition_offer",
          {
            seat:player.seat,
            playerName:player.name,
            tile:player.position,
            eventId:result.event.id,
            rarity:result.rarity,
            optionCount:pending.options.length
          }
        );
        return;
      }

      this.state.phase="landed";
      this.log(
        player.name+"｜"+(result.rarity==="rare"?"【稀有】":"")+"收購中心「"+result.event.name+"」："+
          result.event.description+"（"+this.describeEventEffect(result)+"）",
        "special_grid",
        {
          seat:player.seat,
          playerName:player.name,
          type:"acquisition",
          eventId:result.event.id,
          eventName:result.event.name,
          rarity:result.rarity,
          effectKind:result.kind,
          amount:result.amount,
          property:result.property,
          permitDelta:result.permitDelta,
          permitsTotal:result.permitsTotal,
          protectionPermitDelta:result.protectionPermitDelta,
          protectionPermitsTotal:result.protectionPermitsTotal
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

    if(tile.type==="auction"){
      const result=resolveCivicEvent(this.state,player,"auction");
      if(!result){
        this.state.phase="landed";
        this.log(player.name+" 抵達「地產拍賣行」，但事件池目前無可用事件。","warning",{seat:player.seat,type:"auction"});
        return;
      }

      if(result.kind==="auction_game"){
        const session=startMinigame(this.state,player.seat,Date.now(),"auction");
        fillAiMinigameResults(this.state);
        this.log(
          player.name+"｜"+(result.rarity==="rare"?"【稀有】":"")+"地產拍賣行「"+result.event.name+"」：進入 "+session.name+"。",
          "minigame_start",
          {seat:player.seat,gameId:session.id,tileType:"auction",eventId:result.event.id,rarity:result.rarity}
        );
        this.tryFinalizeMinigame();
        return;
      }

      this.state.phase="landed";
      this.log(
        player.name+"｜"+(result.rarity==="rare"?"【稀有】":"")+"地產拍賣行「"+result.event.name+"」："+
          result.event.description+"（"+this.describeEventEffect(result)+"）",
        "special_grid",
        {
          seat:player.seat,
          playerName:player.name,
          type:"auction",
          eventId:result.event.id,
          eventName:result.event.name,
          rarity:result.rarity,
          effectKind:result.kind,
          amount:result.amount,
          property:result.property,
          permitDelta:result.permitDelta,
          permitsTotal:result.permitsTotal,
          protectionPermitDelta:result.protectionPermitDelta,
          protectionPermitsTotal:result.protectionPermitsTotal
        }
      );
      return;
    }

    if(tile.type==="highlow"||tile.type==="horse"){
      const forcedGameId=tile.type==="horse"?"horse":"highlow";
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
      const result=resolveCivicEvent(this.state,player,tile.type);
      if(!result){
        this.log(player.name+" 抵達「"+tile.name+"」，但事件池目前無可用事件。","warning",{seat:player.seat,type:tile.type});
        return;
      }
      const rare=result.rarity==="rare";
      this.log(
        player.name+"｜"+(rare?"【稀有】":"")+tile.name+"「"+result.event.name+"」："+result.event.description+
          "（"+this.describeEventEffect(result)+"）",
        tile.type==="market"?"market_tick":"special_grid",
        {
          seat:player.seat,
          playerName:player.name,
          type:tile.type,
          eventId:result.event.id,
          eventName:result.event.name,
          rarity:result.rarity,
          effectKind:result.kind,
          amount:result.amount,
          property:result.property,
          permitDelta:result.permitDelta,
          permitsTotal:result.permitsTotal,
          protectionPermitDelta:result.protectionPermitDelta,
          protectionPermitsTotal:result.protectionPermitsTotal,
          untilRound:result.untilRound,
          tick:result.tick,
          movers:result.movers??[]
        }
      );
      return;
    }

    if(tile.type==="urban"){
      const result=resolveCivicEvent(this.state,player,"urban");
      if(!result){
        this.state.phase="landed";
        this.log(player.name+" 抵達「城市更新局」，但事件池目前無可用事件。","warning",{seat:player.seat,type:"urban"});
        return;
      }

      if(result.kind==="urban_redeploy"){
        const pending=createPendingUrban(this.state,player);
        if(pending){
          this.state.pendingUrban=pending;
          this.state.phase="urban";
          this.log(
            player.name+"｜城市更新局「"+result.event.name+"」：可選擇一塊自己的地產作為重新部署位置。",
            "urban_offer",
            {
              seat:player.seat,
              eventId:result.event.id,
              rarity:result.rarity,
              sourceIndex:pending.sourceIndex,
              destinationIndexes:pending.destinationIndexes
            }
          );
          return;
        }
        player.cash+=700;
        this.state.phase="landed";
        this.log(
          player.name+"｜城市更新局「重新部署」：目前沒有自己的地產，改領更新補助 $700。",
          "special_grid",
          {seat:player.seat,type:"urban",fallback:"no_property",amount:700,cashAfter:player.cash}
        );
        return;
      }

      this.state.phase="landed";
      this.log(
        player.name+"｜"+(result.rarity==="rare"?"【稀有】":"")+"城市更新局「"+result.event.name+"」："+
          result.event.description+"（"+this.describeEventEffect(result)+"）",
        "special_grid",
        {
          seat:player.seat,
          playerName:player.name,
          type:"urban",
          eventId:result.event.id,
          eventName:result.event.name,
          rarity:result.rarity,
          effectKind:result.kind,
          amount:result.amount,
          property:result.property,
          permitDelta:result.permitDelta,
          permitsTotal:result.permitsTotal,
          protectionPermitDelta:result.protectionPermitDelta,
          protectionPermitsTotal:result.protectionPermitsTotal
        }
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
      const effectText=this.describeEventEffect(resolved);

      this.log(
        player.name+"｜"+(resolved.rarity==="rare"?"【稀有】":"")+label+"「"+resolved.event.name+"」："+resolved.event.description+"（"+effectText+"）",
        "special_event",
        {
          seat:player.seat,
          playerName:player.name,
          type:tile.type,
          eventId:resolved.event.id,
          eventName:resolved.event.name,
          rarity:resolved.rarity,
          effectKind:resolved.kind,
          property:resolved.property,
          permitDelta:resolved.permitDelta,
          permitsTotal:resolved.permitsTotal,
          protectionPermitDelta:resolved.protectionPermitDelta,
          protectionPermitsTotal:resolved.protectionPermitsTotal,
          itemId:resolved.itemId,
          itemName:resolved.itemName,
          itemDelta:resolved.itemDelta,
          itemTotal:resolved.itemTotal,
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
      start:"回到起點。"
    }[tile.type]||"觸發特殊事件。";
    this.log(player.name+" 抵達「"+tile.name+"」："+eventText,"event",{seat:player.seat,tile:player.position,type:tile.type});
  }

  handleCentralMissionAction(seat,action){
    const result=recordMissionAction(this.state,seat,action);
    if(!result?.completed)return result;
    const player=this.state.players[Number(seat)];
    this.log(
      player.name+" 完成城市委託，獲得 "+this.formatMoney(result.reward)+"。",
      "central_mission_complete",
      {seat:Number(seat),playerName:player.name,missionId:result.missionId,reward:result.reward,cashAfter:result.cashAfter}
    );
    return result;
  }

  centralBankDeposit(seat=this.state.currentPlayer,principal=5000){
    if(!this.isCurrentSeat(seat)||!canOpenBankDeposit(this.state,seat,principal))return false;
    const result=startBankDeposit(this.state,seat,principal);
    if(!result.ok)return false;
    const player=this.state.players[Number(seat)];
    this.log(
      player.name+" 在都會銀行存入 "+this.formatMoney(result.principal)+
        "，ROUND "+result.maturesRound+" 到期返還 "+this.formatMoney(result.returnAmount)+"。",
      "central_bank_active",
      {seat:Number(seat),playerName:player.name,principal:result.principal,returnAmount:result.returnAmount,maturesRound:result.maturesRound,cashAfter:result.cashAfter}
    );
    this.notify();
    return true;
  }

  centralAcceptMission(missionId,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)||!canAcceptMission(this.state,seat,missionId))return false;
    const result=acceptMission(this.state,seat,missionId);
    if(!result.ok)return false;
    const player=this.state.players[Number(seat)];
    this.log(
      player.name+" 接受城市委託「"+missionId+"」。",
      "central_mission_active",
      {seat:Number(seat),playerName:player.name,missionId,reward:result.mission.reward}
    );
    this.notify();
    return true;
  }

  centralActivateInsurance(seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)||!canActivateInsurance(this.state,seat))return false;
    const result=activateInsurance(this.state,seat);
    if(!result.ok)return false;
    const player=this.state.players[Number(seat)];
    this.log(
      player.name+" 啟動租金保險，下一次踩到他人地產時租金壓力降低。",
      "central_insurance_active",
      {seat:Number(seat),playerName:player.name}
    );
    this.notify();
    return true;
  }

  centralTransit(distance,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)||!canUseCentralTransit(this.state,seat,distance))return false;
    const player=this.currentPlayer;
    const from=player.position;
    const path=buildForwardPath(this.state,from,Number(distance));
    const passedStart=path.includes(0);
    player.position=path.at(-1)??from;
    markCentralTransitUsed(this.state,seat);
    this.state.dice=null;

    if(passedStart){
      player.cash+=2500;
      this.log(player.name+" 搭乘快捷通車通過起點，獲得 $2,500。","cash",{seat:player.seat,amount:2500});
    }

    this.log(
      player.name+" 搭乘快捷通車前進 "+distance+" 格，從第 "+(from+1)+" 格抵達第 "+(player.position+1)+" 格。",
      "move",
      {seat:player.seat,from,to:player.position,path,centralTransit:true,distance:Number(distance)}
    );
    this.resolveLanding(player);
    this.notify();
    return true;
  }

  centralDevelopmentUpgrade(tileIndex,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)||!canUseCentralDevelopment(this.state,seat,tileIndex))return false;
    const success=this.upgradeProperty(tileIndex,seat,{source:"central_development"});
    if(!success)return false;
    markCentralDevelopmentUsed(this.state,seat);
    const player=this.state.players[Number(seat)];
    const tile=this.state.tiles[Number(tileIndex)];
    this.log(
      player.name+" 透過城市建案中心完成「"+tile.name+"」建案。",
      "central_development",
      {seat:Number(seat),playerName:player.name,tile:Number(tileIndex),tileName:tile.name,level:tile.level}
    );
    this.notify();
    return true;
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

    const acquisitionSource=this.state.pendingAcquisition?.source??"center";
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
      buyer.name+(acquisitionSource==="landing"?" 行使踩地後的強制收購權":" 透過收購中心")+
        "以 "+this.formatMoney(result.offer)+" 收購「"+result.tileName+
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

    const acquisitionSource=pending.source??"center";
    this.state.pendingAcquisition=null;
    this.state.phase="landed";
    this.log(
      this.currentPlayer.name+
        (acquisitionSource==="landing"?" 選擇不行使本次強制收購權，地產維持原持有人。":" 選擇不使用收購中心。"),
      "acquisition_skip",
      {seat:this.currentPlayer.seat,source:acquisitionSource}
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

    this.handleCentralMissionAction(player.seat,"buy_property");

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

  upgradeProperty(tileIndex,seat=this.state.currentPlayer,{source="landing"}={}){
    if(!this.isCurrentSeat(seat))return false;
    const player=this.currentPlayer;
    const index=Number(tileIndex);
    const tile=this.state.tiles[index];
    const cost=tile?upgradeCost(tile):0;
    const specialUpgrade=source==="central_development";
    const validLandingUpgrade=Boolean(
      source==="landing"&&
      this.state.phase==="landed"&&
      this.state.pendingPurchase==null&&
      this.state.pendingUpgrade===index&&
      player.position===index
    );
    const canUpgrade=Boolean(
      (specialUpgrade||validLandingUpgrade)&&
      canUpgradeProperty(player.seat,tile)&&
      player.cash>=cost
    );

    if(!canUpgrade){
      this.log("目前無法升級這塊地產。","warning",{seat:player.seat,tile:index,source});
      this.notify();
      return false;
    }

    player.cash-=cost;
    tile.level+=1;
    if(validLandingUpgrade)this.state.pendingUpgrade=null;
    const rentAfter=rentFor(this.state,tile);
    this.log(
      player.name+" 花費 "+this.formatMoney(cost)+" 將「"+tile.name+"」升級至 LV."+tile.level+"，目前過路費 "+this.formatMoney(rentAfter)+"。",
      "property_upgrade",
      {
        seat:player.seat,
        playerName:player.name,
        tile:index,
        tileName:tile.name,
        group:tile.group,
        level:tile.level,
        amount:cost,
        rentAfter,
        cashAfter:player.cash,
        source
      }
    );
    this.handleCentralMissionAction(player.seat,"upgrade_property");
    this.notify();
    return true;
  }

  declineUpgrade(seat=this.state.currentPlayer){
    const tileIndex=this.state.pendingUpgrade;
    if(
      !this.isCurrentSeat(seat)||
      this.state.phase!=="landed"||
      tileIndex==null||
      this.currentPlayer.position!==tileIndex
    )return false;
    const tile=this.state.tiles[tileIndex];
    this.state.pendingUpgrade=null;
    this.log(
      this.currentPlayer.name+" 本次不升級「"+(tile?.name??"地產")+"」。",
      "property_upgrade_decline",
      {seat:this.currentPlayer.seat,tile:tileIndex,tileName:tile?.name??"地產"}
    );
    this.notify();
    return true;
  }

  usePropertyPermit(tileIndex,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)||!canUseDevelopmentPermit(this.state,seat,tileIndex))return false;
    const result=useDevelopmentPermit(this.state,seat,tileIndex);
    if(!result.ok)return false;
    const player=this.state.players[Number(seat)];
    const tile=this.state.tiles[result.tileIndex];
    this.log(
      player.name+" 使用建案許可，將「"+tile.name+"」免費升級至 LV."+tile.level+"。",
      "property_permit_upgrade",
      {
        seat:Number(seat),
        playerName:player.name,
        tile:result.tileIndex,
        tileName:tile.name,
        group:tile.group,
        level:tile.level,
        permitsLeft:result.permitsLeft,
        rentAfter:rentFor(this.state,tile)
      }
    );
    this.handleCentralMissionAction(player.seat,"upgrade_property");
    this.notify();
    return true;
  }

  usePropertyProtection(tileIndex,seat=this.state.currentPlayer){
    if(!this.isCurrentSeat(seat)||!canUsePropertyProtectionPermit(this.state,seat,tileIndex))return false;
    const result=usePropertyProtectionPermit(this.state,seat,tileIndex);
    if(!result.ok)return false;
    const player=this.state.players[Number(seat)];
    const tile=this.state.tiles[result.tileIndex];
    this.log(
      player.name+" 使用產權保全券，保護「"+tile.name+"」至 ROUND "+result.untilRound+"，期間不可被強制收購。",
      "special_grid",
      {
        seat:Number(seat),
        playerName:player.name,
        type:"property_protection",
        eventName:"產權保全啟用",
        effectKind:"property_protection",
        tile:result.tileIndex,
        tileName:tile.name,
        group:tile.group,
        untilRound:result.untilRound,
        protectionPermitsLeft:result.permitsLeft
      }
    );
    this.notify();
    return true;
  }

  useStrategyItem(itemId,target,seat=this.state.currentPlayer){
    const result=executeItemUse(this.state,seat,itemId,target);
    if(!result.ok)return false;

    const player=this.state.players[Number(seat)];
    const effect=result.effect??{};
    let detail="效果已生效";
    if(itemId==="rent_boost")detail="「"+effect.tileName+"」永久過路費 +20%";
    if(itemId==="rent_burst")detail="「"+effect.tileName+"」下一次收租 ×2";
    if(itemId==="remote_dice")detail="下一次擲骰固定總點數 "+effect.forcedDiceTotal;
    if(itemId==="stock_boost"||itemId==="stock_drop"){
      detail="「"+effect.stockName+"」 $"+effect.previousPrice+" → $"+effect.price;
    }
    if(itemId==="rent_block")detail="封鎖「"+effect.tileName+"」下一次收租";
    if(itemId==="property_guard")detail="「"+effect.tileName+"」保全至 ROUND "+effect.untilRound;

    this.log(
      player.name+" 使用「"+result.definition.name+"」："+detail+"。",
      "item_use",
      {
        seat:Number(seat),
        playerName:player.name,
        itemId,
        itemName:result.definition.name,
        remaining:result.remaining,
        ...effect
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
    this.handleCentralMissionAction(seat,"buy_stock");
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

    const strategyItem=chooseAiItemAction(this.state,player.seat);
    if(strategyItem){
      this.useStrategyItem(strategyItem.itemId,strategyItem.target,player.seat);
    }

    if(Math.floor(Number(player.developmentPermits)||0)>0){
      const permitTarget=eligibleOwnedPropertyIndexes(this.state,player)
        .map(index=>({index,tile:this.state.tiles[index]}))
        .sort((a,b)=>
          Number(b.tile.level)-Number(a.tile.level)||
          Number(b.tile.price)-Number(a.tile.price)||
          a.index-b.index
        )[0]?.index??null;
      if(permitTarget!=null)this.usePropertyPermit(permitTarget,player.seat);
    }

    if(Math.floor(Number(player.propertyProtectionPermits)||0)>0){
      const protectionTarget=eligibleProtectionPropertyIndexes(this.state,player)
        .map(index=>({index,tile:this.state.tiles[index]}))
        .sort((a,b)=>
          Number(b.tile.price)-Number(a.tile.price)||
          Number(b.tile.level)-Number(a.tile.level)||
          a.index-b.index
        )[0]?.index??null;
      if(protectionTarget!=null)this.usePropertyProtection(protectionTarget,player.seat);
    }

    for(const order of chooseStockOrders(this.state,player.seat)){
      if(order.type==="buy")this.buyStock(order.stockId,order.shares,player.seat);
      if(order.type==="sell")this.sellStock(order.stockId,order.shares,player.seat);
    }

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

    if(this.state.phase==="landed"&&this.state.pendingUpgrade!=null){
      const upgradeIndex=chooseUpgrade(this.state,player.seat);
      if(upgradeIndex!=null)return this.upgradeProperty(upgradeIndex,player.seat);
      return this.declineUpgrade(player.seat);
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
      this.state.pendingUpgrade!=null||
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
        const assetRankings=playerAssetRankings(this.state).map(entry=>({
          rank:entry.rank,
          seat:entry.seat,
          playerName:entry.player.name,
          total:entry.assets.total,
          cash:entry.assets.cash,
          properties:entry.assets.properties,
          stocks:entry.assets.stocks,
          bankDeposit:entry.assets.bankDeposit
        }));
        const champion=assetRankings[0];
        this.log(
          "第 "+this.state.maxRounds+" ROUND 已完成，遊戲正式結束。"+
            (champion
              ?" 冠軍："+champion.playerName+"｜總資產 "+this.formatMoney(champion.total)+"。"
              :""),
          "game_complete",
          {round:this.state.round,rankings:assetRankings}
        );
        this.notify();
        return true;
      }
      this.state.round+=1;
      for(const settled of settleBankDeposits(this.state)){
        const player=this.state.players[settled.seat];
        this.log(
          player.name+" 的都會銀行定存到期，入帳 "+this.formatMoney(settled.amount)+"。",
          "central_bank_matured",
          {seat:settled.seat,playerName:player.name,amount:settled.amount,cashAfter:settled.cashAfter}
        );
      }
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
    this.state.pendingUpgrade=null;
    this.state.phase="await-roll";
    this.notify();
    return true;
  }

  describeEventEffect(result){
    if(!result)return"沒有額外效果";
    if(result.blockedBy==="tax")return"稅務抵免生效，本次負面金錢事件取消";
    if(result.blockedBy==="hospital")return"醫療保護生效，本次後退事件取消";
    if(result.kind==="cash"){
      return result.amount>=0
        ?"獲得 "+this.formatMoney(result.amount)
        :"支付 "+this.formatMoney(Math.abs(result.amount));
    }
    if(result.kind==="move"){
      return(result.delta>=0?"前進 ":"後退 ")+Math.abs(result.delta)+" 格";
    }
    if(result.kind==="grant_permit"){
      return result.permitDelta>0
        ?"獲得建案許可 ×"+result.permitDelta+"（目前 "+result.permitsTotal+" 張）"
        :"建案許可已達上限，改為替代獎勵";
    }
    if(result.kind==="grant_property_protection"){
      return result.protectionPermitDelta>0
        ?"獲得產權保全券 ×"+result.protectionPermitDelta+"（目前 "+result.protectionPermitsTotal+" 張）"
        :"產權保全券已達上限，改為替代獎勵";
    }
    if(result.kind==="grant_item"){
      return result.itemDelta>0
        ?"獲得策略道具「"+result.itemName+"」×"+result.itemDelta+"（目前 "+result.itemTotal+" 張）"
        :"策略道具已達持有上限，改為替代獎勵";
    }
    if(result.kind==="random_upgrade"&&result.property){
      return"「"+result.property.tileName+"」免費升級至 LV."+result.property.level;
    }
    if(result.kind==="tax_shield")return"取得一次稅務抵免";
    if(result.kind==="medical_shield")return"取得一次行動保護";
    if(result.kind==="dual_shield")return"同時取得行動保護與稅務抵免";
    if(result.kind==="court_shield")return"財產保全至 ROUND "+result.untilRound;
    if(result.kind==="market_tick"){
      return"市場重新報價 "+Math.max(1,Number(result.marketTicks)||1)+" 次";
    }
    if(result.kind==="urban_redeploy")return"可重新部署至自己的地產";
    if(result.kind==="acquisition_offer")return"開放本次強制收購選擇";
    if(result.kind==="auction_game")return"進入多人地產拍賣挑戰";
    if(result.kind==="property_protection")return"指定地產獲得強制收購保護";
    return"沒有額外效果";
  }

  formatMoney(value){return"$"+Math.round(value).toLocaleString()}
  formatSignedMoney(value){
    const rounded=Math.round(value);
    return(rounded>=0?"+":"-")+"$"+Math.abs(rounded).toLocaleString();
  }
}
