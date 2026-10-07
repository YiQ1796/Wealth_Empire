import{GROUP_ORDER,GROUP_SIZES}from"../data/board.js";

const STOCK_HISTORY_LIMIT=40;
const CONTRACT_ACTIONS=Object.freeze([
  {id:"buy_property",label:"購買 1 塊無主地產"},
  {id:"upgrade_property",label:"完成 1 次地產升級"},
  {id:"buy_stock",label:"完成 1 次股票買進"}
]);

function currentRound(state){
  return Math.max(1,Number(state?.round)||1);
}

function ensureEffects(state){
  if(!state.strategicEffects||typeof state.strategicEffects!=="object"){
    state.strategicEffects={};
  }
  const effects=state.strategicEffects;
  effects.globalRent=effects.globalRent&&typeof effects.globalRent==="object"
    ?effects.globalRent
    :{multiplier:1,untilRound:0,label:""};
  effects.groupRents=effects.groupRents&&typeof effects.groupRents==="object"
    ?effects.groupRents
    :{};
  effects.bank=effects.bank&&typeof effects.bank==="object"
    ?effects.bank
    :{multiplier:1,untilRound:0,label:""};
  effects.transport=effects.transport&&typeof effects.transport==="object"
    ?effects.transport
    :{blockedNodeIndex:null,blockedUntilRound:0,freeUntilRound:0,freeDayBonus:0};
  effects.marketItemLockUntilRound=Math.max(0,Number(effects.marketItemLockUntilRound)||0);
  return effects;
}

function randomItem(items,random){
  if(!items.length)return null;
  return items[Math.min(items.length-1,Math.floor(random()*items.length))];
}

function applyStockPercent(stock,percent){
  if(!stock)return null;
  const previousPrice=Math.max(10,Math.round(Number(stock.price)||10));
  const nextPrice=Math.max(10,Math.min(9999,Math.round(previousPrice*(1+percent))));
  stock.previousPrice=previousPrice;
  stock.price=nextPrice===previousPrice
    ?Math.max(10,Math.min(9999,previousPrice+(percent>=0?1:-1)))
    :nextPrice;
  stock.changePercent=Math.round((((stock.price-previousPrice)/previousPrice)*100)*10)/10;
  stock.history=[...(stock.history??[]),stock.price].slice(-STOCK_HISTORY_LIMIT);
  return{stockId:stock.id,stockName:stock.name,previousPrice,price:stock.price,changePercent:stock.changePercent};
}

function setGroupRentEffect(state,group,multiplier,duration,label){
  const effects=ensureEffects(state);
  effects.groupRents[group]={
    multiplier,
    untilRound:currentRound(state)+Math.max(0,duration-1),
    label
  };
  return effects.groupRents[group];
}

function ownedCompleteGroups(state,player){
  return GROUP_ORDER.filter(group=>{
    const tiles=(state.tiles??[]).filter(tile=>tile.type==="property"&&tile.group===group);
    const required=GROUP_SIZES[group]??tiles.length;
    return required>0&&tiles.filter(tile=>tile.owner===player.seat).length===required;
  });
}

function ownedProperties(state,player){
  return(player.properties??[])
    .map(index=>({index,tile:state.tiles?.[index]}))
    .filter(entry=>entry.tile?.type==="property"&&entry.tile.owner===player.seat);
}

function createChoice(state,player,payload){
  const pending={
    seat:player.seat,
    eventId:payload.eventId,
    eventName:payload.eventName,
    choiceKind:payload.choiceKind,
    title:payload.title,
    description:payload.description,
    options:payload.options
  };
  state.pendingStrategicChoice=pending;
  return pending;
}

export function resolveStrategicEvent(state,player,event,random=Math.random){
  const id=event?.effect?.strategicId;
  if(!id||!player)return{kind:"strategic",summary:"沒有額外效果"};
  const round=currentRound(state);
  const effects=ensureEffects(state);
  const base={
    kind:"strategic",
    strategicId:id,
    summary:"",
    requiresChoice:false,
    pendingChoice:null,
    data:{}
  };

  if(id==="city_cycle"){
    const prosperity=random()>=0.42;
    effects.globalRent=prosperity
      ?{multiplier:1.15,untilRound:round+1,label:"城市繁榮"}
      :{multiplier:0.90,untilRound:round,label:"景氣降溫"};
    return{
      ...base,
      summary:prosperity?"城市繁榮：所有地產過路費 +15%，持續 2 ROUND":"景氣降溫：所有地產過路費 -10%，持續本 ROUND",
      data:{...effects.globalRent}
    };
  }

  if(id==="industry_news"){
    const sectors=[...new Set((state.market?.stocks??[]).map(stock=>stock.sector).filter(Boolean))];
    const sector=randomItem(sectors,random);
    const positive=random()>=0.45;
    const percent=positive
      ?0.06+random()*0.04
      :-(0.05+random()*0.03);
    const movers=(state.market?.stocks??[])
      .filter(stock=>stock.sector===sector)
      .map(stock=>applyStockPercent(stock,percent))
      .filter(Boolean);
    return{
      ...base,
      summary:(sector??"市場")+"產業新聞："+(positive?"利多":"利空")+"，同產業股票 "+(positive?"+":"")+Math.round(percent*1000)/10+"%",
      data:{sector,percent,movers}
    };
  }

  if(id==="dividend_season"){
    const rates={TECH:0.025,LAND:0.035,SHIP:0.04,ENER:0.04,BANK:0.045,FUN:0.03,CHIP:0.02,BIO:0.025,FOOD:0.05,RETL:0.04};
    const payouts=[];
    for(const target of state.players??[]){
      let amount=0;
      for(const stock of state.market?.stocks??[]){
        const shares=Math.max(0,Math.floor(Number(target.portfolio?.[stock.id]?.shares)||0));
        amount+=Math.round(shares*Number(stock.price||0)*(rates[stock.id]??0.03));
      }
      if(amount>0){
        target.cash+=amount;
        payouts.push({seat:target.seat,playerName:target.name,amount,cashAfter:target.cash});
      }
    }
    const total=payouts.reduce((sum,item)=>sum+item.amount,0);
    return{
      ...base,
      summary:payouts.length?"股息季發放完成，全體持股玩家合計領取 $"+total.toLocaleString():"本次無玩家持有股票，沒有股息可發放",
      data:{payouts,total}
    };
  }

  if(id==="property_maintenance_choice"){
    const target=ownedProperties(state,player)
      .sort((a,b)=>Number(b.tile.price)-Number(a.tile.price)||b.tile.level-a.tile.level)[0];
    if(!target)return{...base,summary:"目前沒有地產需要維修，本事件無額外支出"};
    const fee=900+Math.max(0,Number(target.tile.level)||0)*300;
    const pending=createChoice(state,player,{
      eventId:event.id,
      eventName:event.name,
      choiceKind:"maintenance",
      title:"房產維修抉擇",
      description:"「"+target.tile.name+"」需要維修。現在支付維修費，或讓這塊地下一次收租 -30%。",
      options:[
        {id:"pay",label:"支付維修費 $"+fee.toLocaleString(),targetValue:target.index,amount:fee,disabled:player.cash<fee},
        {id:"defer",label:"暫緩維修｜下一次收租 -30%",targetValue:target.index}
      ]
    });
    return{...base,summary:"等待玩家決定維修方式",requiresChoice:true,pendingChoice:pending,data:{tileIndex:target.index,fee}};
  }

  if(id==="region_development_subsidy"){
    const groups=ownedCompleteGroups(state,player);
    if(!groups.length)return{...base,summary:"目前尚未完成任何連區，本次補助資格未成立"};
    if(Math.floor(Number(player.developmentPermits)||0)<3){
      player.developmentPermits=Math.min(3,Math.floor(Number(player.developmentPermits)||0)+1);
      return{...base,summary:"完成連區獲得建案許可 ×1",data:{groups,permitDelta:1,permitsTotal:player.developmentPermits}};
    }
    player.cash+=1200;
    return{...base,summary:"建案許可已滿，改領連區發展補助 $1,200",data:{groups,amount:1200,cashAfter:player.cash}};
  }

  if(id==="transport_labor_day"){
    const freeDay=random()>=0.5;
    if(freeDay){
      effects.transport.freeUntilRound=round;
      effects.transport.freeDayBonus=500;
      effects.transport.blockedNodeIndex=null;
      effects.transport.blockedUntilRound=0;
      return{...base,summary:"交通免費日：本 ROUND 四大交通節點免使用費，使用後再領 $500 交通補助",data:{mode:"free",untilRound:round,bonus:500}};
    }
    const nodes=[10,13,32,43];
    const blockedNodeIndex=randomItem(nodes,random);
    effects.transport.blockedNodeIndex=blockedNodeIndex;
    effects.transport.blockedUntilRound=round;
    effects.transport.freeUntilRound=0;
    effects.transport.freeDayBonus=0;
    const tile=state.tiles?.[blockedNodeIndex];
    return{...base,summary:"交通罷工：「"+(tile?.name??"交通節點")+"」本 ROUND 暫停服務",data:{mode:"strike",blockedNodeIndex,untilRound:round}};
  }

  if(id==="interest_rate_decision"){
    const positive=random()>=0.5;
    effects.bank={
      multiplier:positive?1.10:0.90,
      untilRound:round+1,
      label:positive?"升息優惠":"利率降溫"
    };
    return{...base,summary:"下一個 ROUND 前新開定存到期金額 "+(positive?"+10%":"-10%"),data:{...effects.bank}};
  }

  if(id==="housing_hot_zone"){
    const group=randomItem(GROUP_ORDER,random);
    const effect=setGroupRentEffect(state,group,1.20,2,"房市熱區");
    return{...base,summary:"「"+group+"」成為房市熱區，過路費 +20%，持續 2 ROUND",data:{group,...effect}};
  }

  if(id==="tourism_peak"){
    const effect=setGroupRentEffect(state,"觀光區",1.25,2,"觀光旺季");
    return{...base,summary:"觀光旺季：觀光區過路費 +25%，持續 2 ROUND",data:{group:"觀光區",...effect}};
  }

  if(id==="tech_subsidy_wave"){
    const effect=setGroupRentEffect(state,"科技區",1.15,2,"科技補助潮");
    const movers=(state.market?.stocks??[])
      .filter(stock=>["科技","半導體"].includes(stock.sector))
      .map(stock=>applyStockPercent(stock,0.06))
      .filter(Boolean);
    return{...base,summary:"科技補助潮：科技區過路費 +15%，科技／半導體股票 +6%",data:{group:"科技區",...effect,movers}};
  }

  if(id==="financial_turbulence"){
    const effect=setGroupRentEffect(state,"金融區",0.85,1,"金融震盪");
    const bank=(state.market?.stocks??[]).find(stock=>stock.sector==="金融");
    const percent=random()>=0.5?0.12:-0.12;
    const mover=applyStockPercent(bank,percent);
    return{...base,summary:"金融震盪：金融區過路費 -15%，金融股本次波動 "+(percent>0?"+12%":"-12%"),data:{group:"金融區",...effect,mover}};
  }

  if(id==="city_major_event"){
    const group=random()>=0.5?"觀光區":"商業區";
    const effect=setGroupRentEffect(state,group,1.20,2,"城市大型活動");
    return{...base,summary:"城市大型活動：「"+group+"」過路費 +20%，持續 2 ROUND",data:{group,...effect}};
  }

  if(id==="government_contract"){
    const contract=randomItem(CONTRACT_ACTIONS,random);
    const investment=1500;
    const reward=3500;
    const pending=createChoice(state,player,{
      eventId:event.id,
      eventName:event.name,
      choiceKind:"government_contract",
      title:"政府標案",
      description:"投資 $1,500，並在 ROUND "+(round+2)+" 結束前完成「"+contract.label+"」，成功可領 $3,500。",
      options:[
        {id:"accept",label:"承接標案｜投資 $1,500",amount:investment,action:contract.id,disabled:player.cash<investment},
        {id:"decline",label:"放棄標案，保留現金"}
      ]
    });
    return{...base,summary:"等待玩家決定是否承接政府標案",requiresChoice:true,pendingChoice:pending,data:{action:contract.id,dueRound:round+2,investment,reward}};
  }

  if(id==="property_revaluation"){
    const group=randomItem(GROUP_ORDER,random);
    const positive=random()>=0.45;
    const multiplier=positive?1.10:0.92;
    const untilRound=round+1;
    for(const tile of state.tiles??[]){
      if(tile.type==="property"&&tile.group===group){
        tile.temporaryValueMultiplier=multiplier;
        tile.temporaryValueUntilRound=untilRound;
      }
    }
    return{...base,summary:"房價重估：「"+group+"」資產估值 "+(positive?"+10%":"-8%")+"，持續 2 ROUND",data:{group,multiplier,untilRound}};
  }

  if(id==="market_circuit_breaker"){
    effects.marketItemLockUntilRound=round;
    return{...base,summary:"市場熔斷：本 ROUND 禁止股票拉升／打壓卡，但一般股票買賣照常",data:{untilRound:round}};
  }

  if(id==="lease_contract"){
    const properties=ownedProperties(state,player);
    if(!properties.length)return{...base,summary:"目前沒有可簽租賃契約的地產"};
    const fee=1000;
    const options=properties
      .sort((a,b)=>Number(b.tile.rent)-Number(a.tile.rent)||Number(b.tile.price)-Number(a.tile.price))
      .map(({index,tile})=>({
        id:"sign",
        targetValue:index,
        label:"簽約「"+tile.name+"」｜$"+fee.toLocaleString()+"｜未來 2 次收租 +15%",
        amount:fee,
        disabled:player.cash<fee
      }));
    options.push({id:"decline",label:"不簽約，保留現金"});
    const pending=createChoice(state,player,{
      eventId:event.id,
      eventName:event.name,
      choiceKind:"lease_contract",
      title:"租賃契約",
      description:"選一塊自己的地產支付 $1,000 簽約；該地產未來 2 次成功收租 +15%。",
      options
    });
    return{...base,summary:"等待玩家選擇租賃契約目標",requiresChoice:true,pendingChoice:pending,data:{fee}};
  }

  return{...base,summary:"策略事件已觸發"};
}

export function resolvePendingStrategicChoice(state,seat,choiceId,targetValue=null){
  const pending=state.pendingStrategicChoice;
  const player=state.players?.[Number(seat)];
  if(!pending||pending.seat!==Number(seat)||!player)return{ok:false,reason:"pending"};
  const option=(pending.options??[]).find(item=>
    item.id===choiceId&&
    (item.targetValue==null||String(item.targetValue)===String(targetValue))
  );
  if(!option||option.disabled)return{ok:false,reason:"choice"};

  const round=currentRound(state);
  let result={ok:true,choiceKind:pending.choiceKind,choiceId:option.id,summary:"",data:{}};

  if(pending.choiceKind==="maintenance"){
    const tile=state.tiles?.[Number(option.targetValue)];
    if(option.id==="pay"){
      const amount=Math.max(0,Number(option.amount)||0);
      if(player.cash<amount)return{ok:false,reason:"cash"};
      player.cash-=amount;
      result={...result,summary:"已支付房產維修費 $"+amount.toLocaleString(),data:{amount:-amount,cashAfter:player.cash,tileName:tile?.name}};
    }else{
      if(tile){
        tile.maintenanceRentPenaltyCharges=1;
        tile.maintenanceRentMultiplier=0.70;
      }
      result={...result,summary:"暫緩維修：「"+(tile?.name??"地產")+"」下一次收租 -30%",data:{tileName:tile?.name}};
    }
  }else if(pending.choiceKind==="government_contract"){
    if(option.id==="accept"){
      const amount=Math.max(0,Number(option.amount)||0);
      if(player.cash<amount)return{ok:false,reason:"cash"};
      player.cash-=amount;
      player.governmentContract={
        action:option.action,
        dueRound:round+2,
        reward:3500,
        investment:amount,
        acceptedRound:round
      };
      const label=CONTRACT_ACTIONS.find(item=>item.id===option.action)?.label??option.action;
      result={...result,summary:"已承接政府標案：ROUND "+(round+2)+" 前完成「"+label+"」可領 $3,500",data:{action:option.action,dueRound:round+2,investment:amount,cashAfter:player.cash}};
    }else{
      result={...result,summary:"已放棄本次政府標案"};
    }
  }else if(pending.choiceKind==="lease_contract"){
    if(option.id==="sign"){
      const tile=state.tiles?.[Number(option.targetValue)];
      const amount=Math.max(0,Number(option.amount)||0);
      if(!tile||tile.owner!==player.seat||player.cash<amount)return{ok:false,reason:"target"};
      player.cash-=amount;
      tile.leaseRentBoostCharges=2;
      tile.leaseRentBonus=0.15;
      result={...result,summary:"「"+tile.name+"」租賃契約生效：未來 2 次成功收租 +15%",data:{tileName:tile.name,amount:-amount,cashAfter:player.cash}};
    }else{
      result={...result,summary:"已放棄本次租賃契約"};
    }
  }

  state.pendingStrategicChoice=null;
  return result;
}

export function chooseAiStrategicChoice(state,seat){
  const pending=state.pendingStrategicChoice;
  const player=state.players?.[Number(seat)];
  if(!pending||pending.seat!==Number(seat)||!player)return null;
  const enabled=(pending.options??[]).filter(option=>!option.disabled);
  if(!enabled.length)return null;

  if(pending.choiceKind==="maintenance"){
    const pay=enabled.find(option=>option.id==="pay");
    if(pay&&player.cash>=(Number(pay.amount)||0)*3)return{choiceId:"pay",targetValue:pay.targetValue};
    const defer=enabled.find(option=>option.id==="defer");
    return defer?{choiceId:"defer",targetValue:defer.targetValue}:null;
  }

  if(pending.choiceKind==="government_contract"){
    const accept=enabled.find(option=>option.id==="accept");
    if(accept&&player.cash>=6000)return{choiceId:"accept",targetValue:null};
    return{choiceId:"decline",targetValue:null};
  }

  if(pending.choiceKind==="lease_contract"){
    const sign=enabled.find(option=>option.id==="sign");
    if(sign&&player.cash>=5000)return{choiceId:"sign",targetValue:sign.targetValue};
    return{choiceId:"decline",targetValue:null};
  }

  return{choiceId:enabled[0].id,targetValue:enabled[0].targetValue??null};
}

export function recordStrategicAction(state,seat,action){
  const player=state.players?.[Number(seat)];
  const contract=player?.governmentContract;
  if(!contract||contract.action!==action)return null;
  if(currentRound(state)>Number(contract.dueRound))return null;
  const reward=Math.max(0,Math.round(Number(contract.reward)||0));
  player.cash+=reward;
  player.governmentContract=null;
  return{completed:true,seat:Number(seat),action,reward,cashAfter:player.cash};
}

export function settleStrategicRound(state){
  const round=currentRound(state);
  const effects=ensureEffects(state);
  const failures=[];

  if(Number(effects.globalRent.untilRound)<round){
    effects.globalRent={multiplier:1,untilRound:0,label:""};
  }
  for(const[group,effect]of Object.entries(effects.groupRents)){
    if(Number(effect?.untilRound)<round)delete effects.groupRents[group];
  }
  if(Number(effects.bank.untilRound)<round){
    effects.bank={multiplier:1,untilRound:0,label:""};
  }
  if(Number(effects.transport.blockedUntilRound)<round){
    effects.transport.blockedNodeIndex=null;
    effects.transport.blockedUntilRound=0;
  }
  if(Number(effects.transport.freeUntilRound)<round){
    effects.transport.freeUntilRound=0;
    effects.transport.freeDayBonus=0;
  }
  if(Number(effects.marketItemLockUntilRound)<round){
    effects.marketItemLockUntilRound=0;
  }

  for(const tile of state.tiles??[]){
    if(Number(tile.temporaryValueUntilRound||0)<round){
      tile.temporaryValueMultiplier=1;
      tile.temporaryValueUntilRound=0;
    }
  }

  for(const player of state.players??[]){
    const contract=player.governmentContract;
    if(contract&&round>Number(contract.dueRound)){
      failures.push({seat:player.seat,action:contract.action,investment:contract.investment});
      player.governmentContract=null;
    }
  }
  return failures;
}
