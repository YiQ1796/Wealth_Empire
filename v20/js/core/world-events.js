import{GROUP_ORDER,GROUP_SIZES}from"../data/board.js";

const PRICE_MIN=10;
const PRICE_MAX=9999;

function roundPrice(value){
  return Math.max(PRICE_MIN,Math.min(PRICE_MAX,Math.round(Number(value)||PRICE_MIN)));
}
function currentRound(state){return Math.max(1,Number(state?.round)||1)}
function pick(list,random=Math.random){return list[Math.floor(Math.max(0,Math.min(.999999,Number(random())||0))*list.length)]??list[0]??null}
function signedPercent(value){return(Math.round(Number(value)*1000)/10)+"%"}

export function ensureWorldEvents(state){
  const source=state.worldEvents&&typeof state.worldEvents==="object"?state.worldEvents:{};
  state.worldEvents={
    globalRent:source.globalRent??null,
    groupRent:source.groupRent&&typeof source.groupRent==="object"?source.groupRent:{},
    bankRate:source.bankRate??null,
    transport:source.transport??null,
    sectorVolatility:source.sectorVolatility&&typeof source.sectorVolatility==="object"?source.sectorVolatility:{},
    marketCircuitBreakerUntilRound:Math.max(0,Number(source.marketCircuitBreakerUntilRound)||0)
  };
  return state.worldEvents;
}

function active(effect,round){
  return Boolean(effect&&Number(effect.untilRound)>=round);
}

export function cleanupWorldEvents(state){
  const world=ensureWorldEvents(state);
  const round=currentRound(state);
  if(!active(world.globalRent,round))world.globalRent=null;
  if(!active(world.bankRate,round))world.bankRate=null;
  if(!active(world.transport,round))world.transport=null;
  for(const [group,effect] of Object.entries(world.groupRent)){
    if(!active(effect,round))delete world.groupRent[group];
  }
  for(const [sector,effect] of Object.entries(world.sectorVolatility)){
    if(!active(effect,round))delete world.sectorVolatility[sector];
  }
  if(Number(world.marketCircuitBreakerUntilRound)<round)world.marketCircuitBreakerUntilRound=0;
  return world;
}

export function worldRentMultiplier(state,group){
  const world=cleanupWorldEvents(state);
  const round=currentRound(state);
  const global=active(world.globalRent,round)?Math.max(.25,Number(world.globalRent.multiplier)||1):1;
  const regional=active(world.groupRent?.[group],round)?Math.max(.25,Number(world.groupRent[group].multiplier)||1):1;
  return global*regional;
}

export function bankReturnAmount(state,principal,baseReturn){
  const world=cleanupWorldEvents(state);
  const modifier=active(world.bankRate,currentRound(state))?Math.max(.25,Number(world.bankRate.interestMultiplier)||1):1;
  const p=Math.max(0,Math.round(Number(principal)||0));
  const base=Math.max(p,Math.round(Number(baseReturn)||p));
  const interest=Math.max(0,base-p);
  return Math.round(p+interest*modifier);
}

export function transportWorldStatus(state){
  const world=cleanupWorldEvents(state);
  return active(world.transport,currentRound(state))?world.transport:null;
}

export function sectorVolatilityMultiplier(state,sector){
  const world=cleanupWorldEvents(state);
  const effect=world.sectorVolatility?.[sector];
  return active(effect,currentRound(state))?Math.max(.5,Number(effect.multiplier)||1):1;
}

export function marketCircuitBreakerActive(state){
  const world=cleanupWorldEvents(state);
  return Number(world.marketCircuitBreakerUntilRound)>=currentRound(state);
}

export function isMarketItemBlocked(state,itemId){
  return marketCircuitBreakerActive(state)&&["stock_boost","stock_drop"].includes(String(itemId));
}

function applyStockPercent(state,stock,percent){
  if(!stock)return null;
  const previousPrice=roundPrice(stock.price);
  const next=roundPrice(previousPrice*(1+Number(percent||0)));
  stock.previousPrice=previousPrice;
  stock.price=next===previousPrice?roundPrice(previousPrice+(percent>=0?1:-1)):next;
  stock.changePercent=Math.round(((stock.price-previousPrice)/Math.max(1,previousPrice))*1000)/10;
  stock.history=[...(stock.history??[]),stock.price].slice(-40);
  return{stockId:stock.id,stockName:stock.name,previousPrice,price:stock.price,changePercent:stock.changePercent};
}

function applySectorPercent(state,sector,percent){
  return(state.market?.stocks??[])
    .filter(stock=>stock.sector===sector)
    .map(stock=>applyStockPercent(state,stock,percent))
    .filter(Boolean);
}

export function applyDirectStockMove(state,stockId,percent){
  const stock=(state.market?.stocks??[]).find(item=>item.id===String(stockId));
  return applyStockPercent(state,stock,percent);
}

function playerOwnedIndexes(state,player){
  return(player?.properties??[]).filter(index=>state.tiles?.[index]?.owner===player.seat);
}

function completedGroups(state,player){
  return GROUP_ORDER.filter(group=>{
    const groupTiles=(state.tiles??[]).filter(tile=>tile.type==="property"&&tile.group===group);
    return groupTiles.length===(GROUP_SIZES[group]??groupTiles.length)&&groupTiles.every(tile=>tile.owner===player.seat);
  });
}

function randomOwnedTile(state,player,random=Math.random){
  const indexes=playerOwnedIndexes(state,player);
  const index=pick(indexes,random);
  return Number.isInteger(index)?{index,tile:state.tiles[index]}:null;
}

function setGroupRent(state,group,multiplier,duration,name){
  const world=ensureWorldEvents(state);
  world.groupRent[group]={
    group,
    multiplier:Number(multiplier)||1,
    untilRound:currentRound(state)+Math.max(1,Number(duration)||1)-1,
    name
  };
  return world.groupRent[group];
}

function setGlobalRent(state,multiplier,duration,name){
  const world=ensureWorldEvents(state);
  world.globalRent={
    multiplier:Number(multiplier)||1,
    untilRound:currentRound(state)+Math.max(1,Number(duration)||1)-1,
    name
  };
  return world.globalRent;
}

function makeChoice(state,player,event,kind,title,description,options,meta={}){
  const pending={
    seat:player.seat,
    eventId:event.id,
    eventName:event.name,
    kind,
    title,
    description,
    options,
    meta
  };
  state.pendingWorldChoice=pending;
  return pending;
}

export function resolveExtendedEventEffect(state,player,effect,event,random=Math.random){
  if(!effect||!player)return null;
  const round=currentRound(state);
  const world=ensureWorldEvents(state);

  if(effect.kind==="world_rent_cycle"){
    const boom=Number(random())>=.5;
    const applied=setGlobalRent(state,boom?1.15:.90,boom?2:1,boom?"城市繁榮":"景氣降溫");
    return{kind:effect.kind,summary:(boom?"城市繁榮":"景氣降溫")+"｜全地產租金 "+(boom?"+15%":"-10%")+"｜至 ROUND "+applied.untilRound,worldEffect:applied};
  }

  if(effect.kind==="sector_news"){
    const sectors=[...new Set((state.market?.stocks??[]).map(stock=>stock.sector))].filter(Boolean);
    const sector=pick(sectors,random);
    const up=Number(random())>=.5;
    const percent=up ? .08:-.06;
    const movers=applySectorPercent(state,sector,percent);
    return{kind:effect.kind,sector,percent,movers,summary:sector+"產業新聞｜"+(up?"利多":"利空")+" "+signedPercent(percent)};
  }

  if(effect.kind==="dividend_season"){
    const payouts=[];
    for(const target of state.players??[]){
      let total=0;
      for(const stock of state.market?.stocks??[]){
        const shares=Math.max(0,Math.floor(Number(target.portfolio?.[stock.id]?.shares)||0));
        total+=Math.round(shares*Number(stock.price||0)*.025);
      }
      if(total>0)target.cash+=total;
      payouts.push({seat:target.seat,amount:total});
    }
    return{kind:effect.kind,payouts,summary:"股息季｜依持股市值 2.5% 發放現金股息"};
  }

  if(effect.kind==="property_maintenance_choice"){
    const target=randomOwnedTile(state,player,random);
    if(!target){
      player.cash+=300;
      return{kind:"cash",amount:300,cashAfter:player.cash,summary:"目前無持有地產，改領維護補助 $300"};
    }
    const cost=600;
    const options=[
      {id:"repair_now",label:"立即維修",description:"支付 $600，維持正常租金。",cost,enabled:player.cash>=600},
      {id:"defer_maintenance",label:"延後維修",description:"不支付現金；「"+target.tile.name+"」下一次收租 -30%。",cost:0,enabled:true}
    ];
    const pending=makeChoice(state,player,event,effect.kind,"房產維修抉擇","「"+target.tile.name+"」需要維修，請選擇處理方式。",options,{tileIndex:target.index,repairCost:600});
    return{kind:effect.kind,pendingChoice:pending,summary:"等待玩家選擇維修方案"};
  }

  if(effect.kind==="region_development_grant"){
    const groups=completedGroups(state,player);
    if(!groups.length){
      player.cash+=500;
      return{kind:"cash",amount:500,cashAfter:player.cash,summary:"尚無完整連區，改領城市發展補助 $500"};
    }
    const group=pick(groups,random);
    player.cash+=1200;
    const before=Math.max(0,Math.floor(Number(player.developmentPermits)||0));
    player.developmentPermits=Math.min(3,before+1);
    return{kind:effect.kind,group,amount:1200,permitDelta:player.developmentPermits-before,permitsTotal:player.developmentPermits,summary:group+"完整連區補助｜+$1,200＋建案許可 ×1"};
  }

  if(effect.kind==="transport_day"){
    const strike=Number(random())<.5;
    world.transport={
      mode:strike?"strike":"free_day",
      untilRound:round,
      name:strike?"交通罷工":"交通免費日"
    };
    return{kind:effect.kind,mode:world.transport.mode,untilRound:round,summary:(strike?"交通罷工：本 ROUND 四個交通樞紐暫停服務":"交通免費日：本 ROUND 交通樞紐的付費選項全部免費")};
  }

  if(effect.kind==="bank_rate_shift"){
    const high=Number(random())>=.5;
    world.bankRate={
      interestMultiplier:high?1.5:.5,
      untilRound:round,
      name:high?"升息優惠":"低利環境"
    };
    return{kind:effect.kind,interestMultiplier:world.bankRate.interestMultiplier,untilRound:round,summary:(high?"升息優惠：本 ROUND 新定存利息 ×1.5":"低利環境：本 ROUND 新定存利息 ×0.5")};
  }

  if(effect.kind==="hot_property_market"){
    const group=pick(GROUP_ORDER,random);
    const applied=setGroupRent(state,group,1.20,2,"房市熱區");
    return{kind:effect.kind,group,multiplier:1.20,untilRound:applied.untilRound,summary:group+"成為房市熱區｜租金 +20% 至 ROUND "+applied.untilRound};
  }

  if(effect.kind==="tourism_season"){
    const applied=setGroupRent(state,"觀光區",1.25,2,"觀光旺季");
    return{kind:effect.kind,group:"觀光區",multiplier:1.25,untilRound:applied.untilRound,summary:"觀光旺季｜觀光區租金 +25% 至 ROUND "+applied.untilRound};
  }

  if(effect.kind==="tech_subsidy"){
    const applied=setGroupRent(state,"科技區",1.15,2,"科技補助潮");
    const movers=[
      ...applySectorPercent(state,"科技",.06),
      ...applySectorPercent(state,"半導體",.06)
    ];
    return{kind:effect.kind,group:"科技區",movers,untilRound:applied.untilRound,summary:"科技補助潮｜科技區租金 +15%，科技／半導體股票 +6%"};
  }

  if(effect.kind==="financial_turbulence"){
    const applied=setGroupRent(state,"金融區",.85,2,"金融震盪");
    world.sectorVolatility["金融"]={multiplier:1.8,untilRound:applied.untilRound,name:"金融震盪"};
    const movers=applySectorPercent(state,"金融",-.04);
    return{kind:effect.kind,group:"金融區",movers,untilRound:applied.untilRound,summary:"金融震盪｜金融區租金 -15%，金融股波動 ×1.8"};
  }

  if(effect.kind==="city_festival"){
    const group=Number(random())>=.5?"觀光區":"商業區";
    const applied=setGroupRent(state,group,1.20,2,"城市大型活動");
    return{kind:effect.kind,group,untilRound:applied.untilRound,summary:"城市大型活動｜"+group+"租金 +20% 至 ROUND "+applied.untilRound};
  }

  if(effect.kind==="government_contract"){
    const tasks=[
      {id:"buy_property",name:"購買 1 塊地產"},
      {id:"upgrade_property",name:"完成 1 次地產升級"},
      {id:"buy_stock",name:"完成 1 次股票買進"}
    ];
    const task=pick(tasks,random);
    const options=[
      {id:"accept_contract",label:"承接標案",description:"支付 $700；2 ROUND 內"+task.name+"，完成後領 $2,400。",cost:700,enabled:player.cash>=700},
      {id:"decline_contract",label:"放棄標案",description:"不投入資金，直接略過。",cost:0,enabled:true}
    ];
    const pending=makeChoice(state,player,event,effect.kind,"政府標案",task.name+"。要不要投入 $700 承接？",options,{taskId:task.id,taskName:task.name});
    return{kind:effect.kind,pendingChoice:pending,summary:"等待玩家決定是否承接政府標案"};
  }

  if(effect.kind==="property_revaluation"){
    const group=pick(GROUP_ORDER,random);
    const up=Number(random())>=.5;
    const multiplier=up?1.10:.92;
    const changed=[];
    for(let index=0;index<(state.tiles??[]).length;index++){
      const tile=state.tiles[index];
      if(tile.type!=="property"||tile.group!==group)continue;
      const before=Math.max(.5,Number(tile.assetValueMultiplier)||1);
      tile.assetValueMultiplier=Math.max(.6,Math.min(1.6,Math.round(before*multiplier*1000)/1000));
      changed.push(index);
    }
    return{kind:effect.kind,group,multiplier,changed,summary:"房價重估｜"+group+"資產估值 "+(up?"+10%":"-8%")};
  }

  if(effect.kind==="market_circuit_breaker"){
    world.marketCircuitBreakerUntilRound=round;
    return{kind:effect.kind,untilRound:round,summary:"市場熔斷｜本 ROUND 暫停股票拉升卡／打壓卡；一般買賣不受影響"};
  }

  if(effect.kind==="lease_contract"){
    const target=randomOwnedTile(state,player,random);
    if(!target){
      player.cash+=300;
      return{kind:"cash",amount:300,cashAfter:player.cash,summary:"目前無地產可簽租約，改領仲介補助 $300"};
    }
    const options=[
      {id:"sign_lease",label:"簽租賃契約",description:"支付 $600；「"+target.tile.name+"」未來 2 次收租 +15%。",cost:600,enabled:player.cash>=600},
      {id:"decline_lease",label:"暫不簽約",description:"不支付現金，維持原租金。",cost:0,enabled:true}
    ];
    const pending=makeChoice(state,player,event,effect.kind,"租賃契約","房仲提出「"+target.tile.name+"」租賃加值方案。",options,{tileIndex:target.index});
    return{kind:effect.kind,pendingChoice:pending,summary:"等待玩家決定是否簽署租賃契約"};
  }

  return null;
}

export function resolveWorldChoice(state,seat,optionId){
  const pending=state.pendingWorldChoice;
  const player=state.players?.[Number(seat)];
  if(!pending||pending.seat!==Number(seat)||!player||state.phase!=="world_choice")return{ok:false,reason:"unavailable"};
  const option=pending.options?.find(item=>item.id===String(optionId));
  if(!option||option.enabled===false||player.cash<Math.max(0,Number(option.cost)||0))return{ok:false,reason:"option"};

  let summary="";
  if(pending.kind==="property_maintenance_choice"){
    const tile=state.tiles?.[Number(pending.meta?.tileIndex)];
    if(!tile)return{ok:false,reason:"tile"};
    if(option.id==="repair_now"){
      player.cash-=600;
      summary="已支付 $600 維修「"+tile.name+"」，租金維持正常。";
    }else{
      tile.rentPenaltyCharges=1;
      tile.rentPenaltyMultiplier=.70;
      summary="延後維修「"+tile.name+"」，下一次收租 -30%。";
    }
  }else if(pending.kind==="government_contract"){
    if(option.id==="accept_contract"){
      player.cash-=700;
      player.governmentContract={
        taskId:pending.meta.taskId,
        taskName:pending.meta.taskName,
        progress:0,
        target:1,
        reward:2400,
        acceptedRound:currentRound(state),
        expiresRound:currentRound(state)+2
      };
      summary="已投入 $700 承接標案："+pending.meta.taskName+"；期限 ROUND "+player.governmentContract.expiresRound+"。";
    }else{
      summary="放棄本次政府標案。";
    }
  }else if(pending.kind==="lease_contract"){
    const tile=state.tiles?.[Number(pending.meta?.tileIndex)];
    if(!tile)return{ok:false,reason:"tile"};
    if(option.id==="sign_lease"){
      player.cash-=600;
      tile.leaseBonusCharges=2;
      tile.leaseBonusMultiplier=1.15;
      summary="已支付 $600 簽署「"+tile.name+"」租賃契約，未來 2 次收租 +15%。";
    }else{
      summary="本次不簽署租賃契約。";
    }
  }else{
    return{ok:false,reason:"unsupported"};
  }

  state.pendingWorldChoice=null;
  state.phase="landed";
  return{ok:true,summary,optionId:option.id,kind:pending.kind,eventName:pending.eventName,cashAfter:player.cash};
}

export function chooseAiWorldChoice(state,seat){
  const pending=state.pendingWorldChoice;
  const player=state.players?.[Number(seat)];
  if(!pending||pending.seat!==Number(seat)||!player)return null;
  const enabled=(pending.options??[]).filter(option=>option.enabled!==false&&player.cash>=Math.max(0,Number(option.cost)||0));
  if(!enabled.length)return null;
  if(pending.kind==="property_maintenance_choice"){
    return enabled.find(option=>option.id==="repair_now")?.id??enabled[0].id;
  }
  if(pending.kind==="government_contract"){
    return player.cash>=5000
      ? (enabled.find(option=>option.id==="accept_contract")?.id??enabled[0].id)
      : (enabled.find(option=>option.id==="decline_contract")?.id??enabled[0].id);
  }
  if(pending.kind==="lease_contract"){
    return player.cash>=4000
      ? (enabled.find(option=>option.id==="sign_lease")?.id??enabled[0].id)
      : (enabled.find(option=>option.id==="decline_lease")?.id??enabled[0].id);
  }
  return enabled[0].id;
}

export function recordGovernmentContractAction(state,seat,action){
  const player=state.players?.[Number(seat)];
  const contract=player?.governmentContract;
  if(!contract||contract.taskId!==action)return null;
  contract.progress=Math.min(contract.target,contract.progress+1);
  if(contract.progress<contract.target)return{completed:false,contract:{...contract}};
  player.cash+=contract.reward;
  const result={completed:true,reward:contract.reward,taskName:contract.taskName,cashAfter:player.cash};
  player.governmentContract=null;
  return result;
}

export function advanceWorldRound(state){
  cleanupWorldEvents(state);
  const expiredContracts=[];
  for(const player of state.players??[]){
    const contract=player.governmentContract;
    if(contract&&currentRound(state)>Number(contract.expiresRound)){
      expiredContracts.push({seat:player.seat,taskName:contract.taskName});
      player.governmentContract=null;
    }
  }
  return{expiredContracts};
}

export function worldStatusSummary(state){
  const world=cleanupWorldEvents(state);
  const round=currentRound(state);
  const items=[];
  if(active(world.globalRent,round))items.push(world.globalRent.name+"｜全地產租金 ×"+Number(world.globalRent.multiplier).toFixed(2)+"｜至 R"+world.globalRent.untilRound);
  for(const effect of Object.values(world.groupRent)){
    if(active(effect,round))items.push(effect.name+"｜"+effect.group+"租金 ×"+Number(effect.multiplier).toFixed(2)+"｜至 R"+effect.untilRound);
  }
  if(active(world.bankRate,round))items.push(world.bankRate.name+"｜新定存利息 ×"+Number(world.bankRate.interestMultiplier).toFixed(2)+"｜R"+world.bankRate.untilRound);
  if(active(world.transport,round))items.push(world.transport.name+"｜交通樞紐｜R"+world.transport.untilRound);
  for(const [sector,effect] of Object.entries(world.sectorVolatility)){
    if(active(effect,round))items.push(effect.name+"｜"+sector+"股波動 ×"+Number(effect.multiplier).toFixed(2)+"｜至 R"+effect.untilRound);
  }
  if(Number(world.marketCircuitBreakerUntilRound)>=round)items.push("市場熔斷｜股票拉升／打壓卡停用｜R"+world.marketCircuitBreakerUntilRound);
  for(const player of state.players??[]){
    if(player.governmentContract){
      items.push(player.name+"｜政府標案："+player.governmentContract.taskName+"｜期限 R"+player.governmentContract.expiresRound);
    }
  }
  return items;
}
