
(function(){
  "use strict";

  const PLAN_B_VERSION="19.9.39";
  const MONOPOLY_BONUS=1.25;
  const BOARD_STOCK_IMPACT_CAP=0.06;
  const RENT_BOOST_MULT=1.20;

  window.WealthPlanB={
    version:PLAN_B_VERSION,
    monopolyBonus:MONOPOLY_BONUS,
    stockImpactCap:BOARD_STOCK_IMPACT_CAP
  };

  const GROUP_STOCK_MAP={
    "海港區":"SHIP",
    "商業區":"RETL",
    "科技區":"TECH",
    "住宅區":"LAND",
    "金融區":"BANK",
    "娛樂區":"FUN",
    "豪宅區":"LAND",
    "帝王區":"BANK"
  };

  const MARKET_EVENTS=[
    {
      name:"房市熱潮",duration:3,rentMult:1.12,buildMult:1.05,stockBias:0,
      sectorBias:{LAND:.06,RETL:.025},
      groupRentMult:{},
      desc:"房產租金小幅上升，地產與零售類股票偏強。"
    },
    {
      name:"科技熱潮",duration:2,rentMult:1,buildMult:1.05,stockBias:0,
      sectorBias:{TECH:.08,CHIP:.06},
      groupRentMult:{"科技區":1.18},
      desc:"科技區租金提高，科技與半導體股票偏強。"
    },
    {
      name:"經濟衰退",duration:2,rentMult:.92,buildMult:.82,stockBias:-.035,
      sectorBias:{LAND:-.02,RETL:-.03,FUN:-.03},
      groupRentMult:{},
      desc:"股票承壓，但房產升級費用下降，形成反向投資機會。"
    },
    {
      name:"能源危機",duration:2,rentMult:1,buildMult:1.03,stockBias:-.008,
      sectorBias:{ENER:.09,SHIP:-.055,RETL:-.025},
      groupRentMult:{"海港區":.92},
      desc:"能源類股票偏強，運輸與商業承壓。"
    },
    {
      name:"觀光旺季",duration:3,rentMult:1,buildMult:1,stockBias:.006,
      sectorBias:{FUN:.065,RETL:.045,SHIP:.035},
      groupRentMult:{"娛樂區":1.16,"商業區":1.12,"海港區":1.10},
      desc:"娛樂、商業、海港相關收益與股票偏強。"
    }
  ];

  let localHedgePromptKey="";

  const base={
    renderControls:window.renderControls,
    handlePending:window.handlePending,
    hostAction:window.hostAction,
    resolveLanding:window.resolveLanding,
    payRent:window.payRent,
    broadcast:window.broadcast,
    upgradeProperty:window.upgradeProperty,
    liquidate:window.liquidate,
    nextTurn:window.nextTurn
  };

  function money(v){return "$"+Math.round(Number(v)||0).toLocaleString();}
  function hasState(){return typeof state!=="undefined"&&!!state;}

  function ensurePlayerPlanB(p){
    if(!p)return;
    ["reroll","fixedStep","stockHedge","rentBoost"].forEach(function(k){
      if(!Number.isFinite(Number(p[k])))p[k]=0;
    });
    p.stats=p.stats||{};
    if(!Number.isFinite(Number(p.stats.minCash)))p.stats.minCash=Number(p.cash||0);
    if(!Number.isFinite(Number(p.stats.maxCash)))p.stats.maxCash=Number(p.cash||0);
    if(!Number.isFinite(Number(p.stats.forcedLiquidations)))p.stats.forcedLiquidations=0;
    if(!Number.isFinite(Number(p.stats.monopoliesCompleted)))p.stats.monopoliesCompleted=0;
    if(!Number.isFinite(Number(p.stats.boardStockEvents)))p.stats.boardStockEvents=0;
    p.planB=p.planB||{};
  }

  function normalizeRemovedMiniGames(){
    if(!hasState()||!Array.isArray(state.tiles))return;
    state.tiles.forEach(function(t){
      if(!t)return;
      if(t.type==="wheel"||t.name==="30格連消轉盤"){
        t.type="reaction";
        t.name="綠燈反應王";
        t.group=null;t.price=0;t.rent=0;t.owner=null;t.level=0;t.mortgaged=false;
      }else if(t.type==="noodle"||t.name==="吃麵大賽"){
        t.type="rps";
        t.name="猜拳擂台";
        t.group=null;t.price=0;t.rent=0;t.owner=null;t.level=0;t.mortgaged=false;
      }
    });
  }

  function ensurePlanBState(){
    if(!hasState())return;
    state.planB=state.planB||{};
    state.monopolyOwners=state.monopolyOwners||{};
    state.planB.stockImpactByRound=state.planB.stockImpactByRound||{};
    (state.players||[]).forEach(ensurePlayerPlanB);
    normalizeRemovedMiniGames();
  }

  Object.assign(STRATEGY_ITEM_DEFS,{
    reroll:{
      name:"重新擲骰券",icon:"↻",
      desc:"擲骰後、移動前主動詢問；可放棄原點數重新擲一次。"
    },
    fixedStep:{
      name:"指定步數券",icon:"1–6",
      desc:"自己的回合擲骰前主動詢問；可指定 1～6 步移動。"
    },
    stockHedge:{
      name:"股票避險券",icon:"盾",
      desc:"負面市場事件期間主動詢問；啟用後降低下一次市場更新的持股損失。"
    },
    rentBoost:{
      name:"租金增幅券",icon:"+租",
      desc:"對手即將踩入自己的高租金地產時主動詢問；本次租金提高 20%，但有上限。"
    }
  });

  function groupNames(){
    if(!hasState())return [];
    return Array.from(new Set(state.tiles.filter(function(t){return t&&t.type==="property"&&t.group;}).map(function(t){return t.group;})));
  }

  function monopolyOwner(group){
    const tiles=groupTiles(group);
    if(!tiles.length)return null;
    const owner=tiles[0].owner;
    if(owner==null)return null;
    return tiles.every(function(t){return t.owner===owner;})?owner:null;
  }

  function eventRentMultiplier(t){
    const ev=state&&state.cityEvent?state.cityEvent:null;
    if(!ev)return 1;
    let mult=Number(ev.rentMult||1);
    if(ev.groupRentMult&&t&&t.group&&Number(ev.groupRentMult[t.group]))mult*=Number(ev.groupRentMult[t.group]);
    return mult;
  }

  window.propertyRentAmount=function(t,level,opts){
    opts=opts||{};
    const requireOwner=opts.requireOwner!==false;
    if(!t||t.type!=="property"||t.mortgaged)return 0;
    if(requireOwner&&t.owner==null)return 0;
    const lv=Math.max(0,Math.min(PROPERTY_MAX_LEVEL,Number(level)||0));
    const levelMult=[1,2,4][lv];
    const monopolyMult=t.owner!=null&&monopoly(t.owner,t.group)?MONOPOLY_BONUS:1;
    return Math.max(0,Math.round((t.rent||0)*levelMult*PROPERTY_RENT_BOOST*monopolyMult*eventRentMultiplier(t)));
  };

  window.rentAtLevel=function(t,level){
    if(!t||t.mortgaged||t.owner==null)return 0;
    if(t.type==="station")return rentFor(t);
    return propertyRentAmount(t,level);
  };

  window.rentFor=function(t){
    if(!t||t.mortgaged||t.owner==null)return 0;
    if(t.type==="property")return propertyRentAmount(t,t.level);
    if(t.type==="station"){
      const o=state.players[t.owner];
      const n=o.properties.map(function(id){return state.tiles[id];}).filter(function(x){return x&&x.type==="station"&&!x.mortgaged;}).length;
      return Math.max(0,Math.round((t.rent||0)*Math.pow(2,Math.max(0,n-1))*Number(state.cityEvent&&state.cityEvent.rentMult||1)));
    }
    return 0;
  };

  function setStockPriceByImpact(code,pct,reason,actorSeat){
    if(!hasState()||!state.stocks||!state.stocks[code])return 0;
    state.planB=state.planB||{};
    state.planB.stockImpactByRound=state.planB.stockImpactByRound||{};
    const roundKey=String(state.round||0);
    const roundMap=state.planB.stockImpactByRound[roundKey]||(state.planB.stockImpactByRound[roundKey]={});
    const used=Number(roundMap[code]||0);
    const remaining=Math.max(0,BOARD_STOCK_IMPACT_CAP-Math.abs(used));
    if(remaining<=0)return 0;
    const applied=Math.max(-remaining,Math.min(remaining,Number(pct)||0));
    if(!applied)return 0;
    const st=state.stocks[code];
    st.prev=st.price;
    st.price=Math.max(20,Math.round(st.price*(1+applied)));
    st.history=Array.isArray(st.history)?st.history:[st.price];
    st.history.push(st.price);
    st.history=st.history.slice(-24);
    roundMap[code]=used+applied;
    if(actorSeat!=null&&state.players[actorSeat]){
      ensurePlayerPlanB(state.players[actorSeat]);
      state.players[actorSeat].planB.stockTradeLockedRound=state.round;
      state.players[actorSeat].stats.boardStockEvents++;
    }
    addEvent("board_stock_link",
      reason+"，"+state.stocks[code].name+" "+(applied>=0?"上漲 ":"下跌 ")+Math.abs(applied*100).toFixed(1)+"%。",
      {code:code,pct:applied,reason:reason,seat:actorSeat,title:"棋盤 × 股票"});
    return applied;
  }

  function refreshMonopolies(){
    if(!hasState())return;
    ensurePlanBState();
    groupNames().forEach(function(group){
      const nextOwner=monopolyOwner(group);
      const prevRaw=state.monopolyOwners[group];
      const prevOwner=prevRaw==null?null:Number(prevRaw);
      if(nextOwner===prevOwner)return;
      state.monopolyOwners[group]=nextOwner;
      if(nextOwner!=null){
        const p=state.players[nextOwner];
        ensurePlayerPlanB(p);
        p.stats.monopoliesCompleted++;
        addEvent("monopoly",
          p.name+" 完成「"+group+"」區域壟斷，該區地產租金獲得 +25% Bonus。",
          {seat:nextOwner,group:group,bonus:MONOPOLY_BONUS,title:"區域壟斷"});
        const code=GROUP_STOCK_MAP[group];
        if(code)setStockPriceByImpact(code,.04,group+" 完成壟斷",nextOwner);
      }else if(prevOwner!=null&&state.players[prevOwner]){
        addEvent("monopoly_lost",
          state.players[prevOwner].name+" 失去「"+group+"」完整持有，壟斷 Bonus 已取消。",
          {seat:prevOwner,group:group,title:"壟斷失效"});
      }
    });
  }

  window.broadcast=function(){
    ensurePlanBState();
    refreshMonopolies();
    return base.broadcast.apply(this,arguments);
  };

  window.upgradeProperty=function(p,id,useItem){
    const t=state.tiles[id];
    const beforeCash=Number(p.cash||0);
    const beforeLevel=Number(t&&t.level||0);
    const result=base.upgradeProperty.call(this,p,id,useItem);
    const spent=Math.max(0,beforeCash-Number(p.cash||0));
    if(t){
      t.buildInvested=Number(t.buildInvested||0)+spent;
      if(Number(t.level||0)>beforeLevel){
        const code=GROUP_STOCK_MAP[t.group];
        if(code)setStockPriceByImpact(code,.012,t.group+"地產升級",p.seat);
      }
    }
    return result;
  };

  function recentRentEvents(seat){
    if(!hasState())return [];
    return (state.events||[]).filter(function(e){
      return e&&e.kind==="rent"&&e.data&&Number(e.data.owner)===Number(seat);
    }).slice(-5).reverse();
  }

  function propertyUpgradeAllowedNow(t){
    const me=state.players[mySeat];
    if(!me||!t)return false;
    if(canOpenUpgradeCenter())return true;
    const pending=state.pending;
    return !!(pending&&pending.type==="own"&&pending.seat===mySeat&&Number(pending.tile)===Number(t.id));
  }

  window.canRequestPropertyUpgrade=function(id){
    if(!hasState())return false;
    const t=state.tiles[Number(id)];
    const modal=document.getElementById("modal");
    if(!modal||!modal.classList.contains("property-manage-modal"))return false;
    return propertyUpgradeAllowedNow(t);
  };

  window.requestPropertyUpgrade=function(id,useItem){
    if(!canRequestPropertyUpgrade(id)){
      toast("升級只能從「我的房產」進行；請先開啟我的房產。");
      return;
    }
    const me=state.players[mySeat],t=state.tiles[Number(id)];
    if(!me||!t)return;
    const cost=buildCost(t);
    if(useItem==null&&strategyItemCount(me,"freeBuild")>0){
      const actions=[["使用免費建築許可","success",function(){requestPropertyUpgrade(id,true);}]];
      if(me.cash>=cost)actions.push(["不用道具，支付升級費","warn",function(){requestPropertyUpgrade(id,false);}]);
      actions.push(["返回我的房產","ghost",openProperties]);
      showModal("要使用策略道具嗎？",
        '<div class="strategy-context-prompt"><b>免費建築許可 ×'+strategyItemCount(me,"freeBuild")+
        '</b><span>「'+t.name+'」本次升級原價 <b>'+money(cost)+'</b>，使用後為 <b>$0</b>。</span></div>',
        actions);
      return;
    }
    closeModal();
    sendAction("upgrade",{tile:Number(id),useItem:!!useItem,context:"property_center"});
  };

  window.openUpgradeCenter=function(){openProperties();};

  window.openProperties=function(){
    if(!hasState())return;
    ensurePlanBState();
    const me=state.players[mySeat];
    if(!me)return;
    const props=(me.properties||[]).map(function(id){return state.tiles[id];}).filter(Boolean);
    const currentValue=props.reduce(function(sum,t){return sum+propertyMarketValue(t);},0);
    const purchaseValue=props.reduce(function(sum,t){return sum+Number(t.price||0);},0);
    const buildInvested=props.reduce(function(sum,t){return sum+Number(t.buildInvested||0);},0);
    const rentTotal=Number(me.stats&&me.stats.rentReceived||0);
    const regions=groupNames().map(function(group){
      const all=groupTiles(group);
      const owned=all.filter(function(t){return t.owner===me.seat;});
      const missing=all.filter(function(t){return t.owner!==me.seat;});
      const complete=all.length>0&&owned.length===all.length;
      return '<div class="planb-region-card '+(complete?'complete':'')+'">'+
        '<div class="planb-region-head"><b>'+group+'</b><span>'+owned.length+' / '+all.length+(complete?'｜壟斷 +25%':'')+'</span></div>'+
        '<div class="planb-region-missing">'+(complete?'已完成全部地產':('缺少：'+(missing.map(function(t){return t.name;}).join("、")||"—")))+'</div>'+
      '</div>';
    }).join("");

    const rows=props.map(function(t){
      const isProp=t.type==="property";
      const complete=isProp&&monopoly(me.seat,t.group);
      const maxed=!isProp||t.level>=PROPERTY_MAX_LEVEL;
      const currentRent=rentFor(t);
      const nextRent=isProp&&!maxed?rentAtLevel(t,t.level+1):currentRent;
      const cost=isProp&&!maxed?buildCost(t):0;
      const invested=Number(t.buildInvested||0);
      const estimated=propertyMarketValue(t);
      const canNow=isProp&&!maxed&&propertyUpgradeAllowedNow(t);
      const canCheck=isProp?canUpgrade(me,t):[false,"交通設施不能升級"];
      const ok=!!canCheck[0];
      return '<div class="planb-property-card '+(complete?'monopoly':'')+'">'+
        '<div class="planb-property-card-head"><div><div class="planb-property-name">'+t.name+'</div>'+
        '<div class="planb-property-group">'+(t.group||"交通設施")+(complete?' <span class="planb-monopoly-chip">壟斷 +25%</span>':'')+'</div></div>'+
        '<div class="planb-property-level">'+(isProp?propertyLevelName(t.level):"交通設施")+'</div></div>'+
        '<div class="planb-property-values">'+
          '<div><span>購入價</span><b>'+money(t.price)+'</b></div>'+
          '<div><span>建設投入</span><b>'+money(invested)+'</b></div>'+
          '<div><span>目前估值</span><b>'+money(estimated)+'</b></div>'+
        '</div>'+
        '<div class="planb-property-rent">目前過路費 <b>'+money(currentRent)+'</b>'+
          (isProp&&!maxed?'｜下一級 <b>'+money(nextRent)+'</b>｜升級費 <b>'+money(cost)+'</b>':'')+
        '</div>'+
        '<div class="planb-property-actions">'+
          (isProp&&!maxed?
            '<button class="warn" '+((!canNow||!ok)?'disabled':'')+' onclick="requestPropertyUpgrade('+t.id+')">'+(ok?(canNow?'升級至 Lv.'+(t.level+1):'目前不能升級'):'無法升級')+'</button>':
            '<span class="planb-property-max">'+(isProp?'已達最高 Lv.2':'不可升級')+'</span>')+
        '</div>'+
      '</div>';
    }).join("")||'<div class="hub-rule">目前尚未持有地產。</div>';

    const rents=recentRentEvents(me.seat);
    const rentHtml=rents.length?rents.map(function(e){
      const tile=state.tiles[e.data.tile];
      return '<div class="planb-rent-row"><span>'+((tile&&tile.name)||"地產")+'｜'+(e.text||"收租")+'</span><b>+'+money(e.data.amount||0)+'</b></div>';
    }).join(""):'<div class="hub-rule">本局目前還沒有收租紀錄。</div>';

    const pendingOwn=state.pending&&state.pending.type==="own"&&state.pending.seat===mySeat;
    const rule=pendingOwn?
      "你剛停在自己的地產；若要升級，請在此頁操作。完成升級後會結束本回合。":
      "所有房產查看與升級都集中在這裡；最高仍為 Lv.2。";

    const body=
      '<div class="hub-rule">'+rule+(strategyItemCount(me,"freeBuild")?'<br><b>免費建築許可 ×'+strategyItemCount(me,"freeBuild")+'：按升級時主動詢問。</b>':'')+'</div>'+
      '<div class="planb-property-summary">'+
        '<div class="planb-summary-card"><span>購入總額</span><b>'+money(purchaseValue)+'</b></div>'+
        '<div class="planb-summary-card"><span>建設投入</span><b>'+money(buildInvested)+'</b></div>'+
        '<div class="planb-summary-card"><span>目前估值</span><b>'+money(currentValue)+'</b></div>'+
        '<div class="planb-summary-card"><span>本局收租</span><b>'+money(rentTotal)+'</b></div>'+
      '</div>'+
      '<div class="planb-region-grid">'+regions+'</div>'+
      '<div class="planb-property-list">'+rows+'</div>'+
      '<div class="hub-rule" style="margin-top:10px"><b>近期收租紀錄</b></div>'+
      '<div class="planb-rent-log">'+rentHtml+'</div>';

    const actions=[];
    if(pendingOwn)actions.push(["本回合不升級","ghost",function(){sendAction("skip_upgrade");}]);
    actions.push(["關閉","ghost",closeModal]);
    showModal("我的房產",body,actions);
    document.getElementById("modal")&&document.getElementById("modal").classList.add("property-manage-modal");
  };

  function beginMoveAfterDice(p,d1,d2){
    state.pending=null;
    broadcast();
    setTimeout(function(){
      if(!state||state.status!=="playing"||state.current!==p.seat)return;
      movePlayer(p,d1+d2);
      resolveLanding(p);
      broadcast();
    },450);
  }

  window.planBRollAction=function(){
    if(!hasState()){sendAction("roll");return;}
    ensurePlanBState();
    const me=state.players[mySeat];
    if(!me||state.status!=="playing"||state.current!==mySeat||state.rolled||state.pending||state.groupGame){
      sendAction("roll");return;
    }
    if(strategyItemCount(me,"fixedStep")<=0){sendAction("roll");return;}
    let buttons="";
    for(let i=1;i<=6;i++){
      buttons+='<button class="primary" onclick="closeModal();sendAction(\'fixed_move\',{steps:'+i+'})">'+i+'</button>';
    }
    showModal("要使用指定步數券嗎？",
      '<div class="hub-rule">指定步數券 ×'+strategyItemCount(me,"fixedStep")+'。選擇 1～6 步後直接移動；也可以保留道具正常擲骰。</div>'+
      '<div class="planb-prompt-number-grid">'+buttons+'</div>',
      [["正常擲骰，不使用","ghost",function(){closeModal();sendAction("roll");}],["取消","ghost",closeModal]]);
  };

  function setupForeignPropertyPending(p,t,rentBoostMult){
    const rent=Math.round(rentFor(t)*(rentBoostMult||1));
    const force=canForceAcquire(p,t);
    state.pending={
      type:"foreign_property",seat:p.seat,tile:t.id,
      rent:rent,forcePrice:forcedAcquisitionPrice(t),
      canForce:force[0],forceReason:force[1],
      rentBoostMult:rentBoostMult||1
    };
    if(p.ai)aiForeignPropertyDecision(p,t);
  }

  window.resolveLanding=function(p){
    ensurePlanBState();
    const t=state.tiles[p.pos];
    if(!t)return base.resolveLanding.apply(this,arguments);

    if(t.type==="rps"){
      addEvent("land",p.name+" 抵達「"+t.name+"」。",{seat:p.seat,tile:t.id});
      startGroupGame("rps",p.seat,t.id);return;
    }
    if(t.type==="reaction"){
      addEvent("land",p.name+" 抵達「"+t.name+"」。",{seat:p.seat,tile:t.id});
      startGroupGame("reaction",p.seat,t.id);return;
    }

    if(["property","station"].includes(t.type)){
      addEvent("land",p.name+" 抵達「"+t.name+"」。",{seat:p.seat,tile:t.id});
      if(t.owner==null){
        state.pending={type:"buy",seat:p.seat,tile:t.id};
        if(p.ai)aiBuyDecision(p,t);
        return;
      }
      if(t.owner===p.seat){
        const cr=canUpgrade(p,t);
        state.pending={type:"own",seat:p.seat,tile:t.id,can_upgrade:cr[0],reason:cr[1]};
        if(p.ai){
          if(cr[0]&&p.cash-buildCost(t)>6000&&Math.random()<.48)upgradeProperty(p,t.id,(p.freeBuild||0)>0);
          state.pending=null;nextTurn();
        }
        return;
      }
      const owner=state.players[t.owner];
      const baseRent=rentFor(t);
      if(t.type==="property"&&!p.ai&&owner&&!owner.ai&&strategyItemCount(owner,"rentBoost")>0&&baseRent>=1200){
        state.pending={
          type:"rent_boost_choice",payer:p.seat,owner:owner.seat,tile:t.id,
          baseRent:baseRent,boostedRent:Math.min(baseRent+3000,Math.round(baseRent*RENT_BOOST_MULT))
        };
        broadcast();
        return;
      }
      if(t.type==="property"&&owner&&owner.ai&&strategyItemCount(owner,"rentBoost")>0&&baseRent>=1800&&Math.random()<.35){
        owner.rentBoost=Math.max(0,strategyItemCount(owner,"rentBoost")-1);
        addEvent("strategy_item_use",owner.name+" 使用租金增幅券。",{seat:owner.seat,item:"rentBoost",tile:t.id,title:"租金增幅券"});
        setupForeignPropertyPending(p,t,RENT_BOOST_MULT);return;
      }
      setupForeignPropertyPending(p,t,1);return;
    }

    return base.resolveLanding.apply(this,arguments);
  };

  window.payRent=function(p,t,useItem){
    const o=state.players[t.owner];
    let r=rentFor(t);
    const pending=state.pending;
    if(pending&&pending.type==="foreign_property"&&Number(pending.tile)===Number(t.id)&&Number(pending.rentBoostMult||1)>1){
      r=Math.min(r+3000,Math.round(r*Number(pending.rentBoostMult)));
    }
    let playerPay=r,insurancePay=0;
    if(useItem){
      if(strategyItemCount(p,"rentShield")<=0)throw Error("你沒有租金護盾");
      playerPay=Math.ceil(r*.5);insurancePay=r-playerPay;
      p.rentShield=Math.max(0,strategyItemCount(p,"rentShield")-1);
    }
    p.cash-=playerPay;o.cash+=r;
    p.stats.rentPaid+=playerPay;o.stats.rentReceived+=r;
    p.stats.largestRent=Math.max(p.stats.largestRent,r);o.stats.largestRent=Math.max(o.stats.largestRent,r);
    addEvent("rent",
      insurancePay>0?
        p.name+" 主動使用租金護盾：自己支付 "+money(playerPay)+"，保險補貼 "+money(insurancePay)+" 給 "+o.name+"。":
        p.name+" 支付 "+o.name+" 過路費 "+money(r)+"。",
      {payer:p.seat,owner:o.seat,amount:r,playerPay:playerPay,insurancePay:insurancePay,tile:t.id,usedItem:insurancePay>0});
    liquidate(p);
  };

  window.handlePending=function(){
    if(!hasState())return base.handlePending.apply(this,arguments);
    ensurePlanBState();
    const p=state.pending;
    if(!p)return base.handlePending.apply(this,arguments);

    if(p.type==="reroll_choice"){
      if(p.seat!==mySeat){closeModal();return;}
      const me=state.players[mySeat];
      showModal("要使用重新擲骰券嗎？",
        '<div class="hub-rule">本次擲出 <b>'+p.d1+' + '+p.d2+' = '+(p.d1+p.d2)+'</b>。重新擲骰券 ×'+strategyItemCount(me,"reroll")+'；使用後會放棄這組點數。</div>',
        [["使用重新擲骰券","warn",function(){sendAction("reroll_use");}],["保留道具，用原點數","primary",function(){sendAction("reroll_keep");}]]);
      return;
    }

    if(p.type==="rent_boost_choice"){
      if(p.owner===mySeat){
        const tile=state.tiles[p.tile];
        showModal("要使用租金增幅券嗎？",
          '<div class="hub-rule">對手即將踩入「<b>'+tile.name+'</b>」。原租金 <b>'+money(p.baseRent)+'</b>，使用後本次提高為 <b>'+money(p.boostedRent)+'</b>；上限額外 +$3,000。</div>',
          [["使用租金增幅券","warn",function(){sendAction("rent_boost_use");}],["保留道具","ghost",function(){sendAction("rent_boost_skip");}]]);
      }else if(p.payer===mySeat){
        showModal("等待地主決定",'<div class="planb-waiting-card">地主正在決定是否使用租金增幅券，請稍候。</div>',[]);
      }else closeModal();
      return;
    }

    if(p.type==="own"){
      if(p.seat!==mySeat){closeModal();return;}
      const t=state.tiles[p.tile];
      showModal("自己的房產",
        '<div class="hub-rule">你停在自己的「<b>'+t.name+'</b>」。所有升級統一從「我的房產」處理，不再使用獨立升級彈窗。</div>'+
        '<div class="planb-property-values"><div><span>目前等級</span><b>'+propertyLevelName(t.level)+'</b></div><div><span>目前過路費</span><b>'+money(rentFor(t))+'</b></div><div><span>區域</span><b>'+(t.group||"交通設施")+'</b></div></div>',
        [["開啟我的房產","primary",openProperties],["本回合不升級","ghost",function(){sendAction("skip_upgrade");}]]);
      return;
    }

    return base.handlePending.apply(this,arguments);
  };

  window.hostAction=function(seat,msg){
    ensurePlanBState();
    const p=state.players[seat],cur=state.players[state.current];

    if(msg.action==="trade_offer"||msg.action==="trade_accept"||msg.action==="trade_reject"){
      throw Error("玩家自由交易已取消");
    }

    if(msg.action==="roll"){
      if(state.status!=="playing")throw Error("遊戲尚未開始");
      if(cur.seat!==seat)throw Error("還沒輪到你");
      if(state.rolled||state.pending||state.groupGame)throw Error("本回合現在不能擲骰");
      const d1=1+Math.floor(Math.random()*6),d2=1+Math.floor(Math.random()*6);
      state.rolled=true;
      addEvent("roll",p.name+" 擲出 "+d1+"+"+d2+"="+(d1+d2)+"。",{seat:seat,d1:d1,d2:d2});
      if(!p.ai&&strategyItemCount(p,"reroll")>0){
        state.pending={type:"reroll_choice",seat:seat,d1:d1,d2:d2};
        broadcast();return;
      }
      if(p.ai&&strategyItemCount(p,"reroll")>0&&(d1+d2)<=5&&Math.random()<.55){
        p.reroll=Math.max(0,strategyItemCount(p,"reroll")-1);
        const nd1=1+Math.floor(Math.random()*6),nd2=1+Math.floor(Math.random()*6);
        addEvent("strategy_item_use",p.name+" 使用重新擲骰券，改為 "+nd1+"+"+nd2+"="+(nd1+nd2)+"。",{seat:seat,item:"reroll",title:"重新擲骰券"});
        beginMoveAfterDice(p,nd1,nd2);return;
      }
      beginMoveAfterDice(p,d1,d2);return;
    }

    if(msg.action==="reroll_use"||msg.action==="reroll_keep"){
      const q=state.pending;
      if(!q||q.type!=="reroll_choice"||q.seat!==seat)throw Error("目前沒有重新擲骰選擇");
      if(msg.action==="reroll_use"){
        if(strategyItemCount(p,"reroll")<=0)throw Error("你沒有重新擲骰券");
        p.reroll=Math.max(0,strategyItemCount(p,"reroll")-1);
        const d1=1+Math.floor(Math.random()*6),d2=1+Math.floor(Math.random()*6);
        addEvent("strategy_item_use",p.name+" 使用重新擲骰券，改為 "+d1+"+"+d2+"="+(d1+d2)+"。",{seat:seat,item:"reroll",title:"重新擲骰券"});
        beginMoveAfterDice(p,d1,d2);
      }else{
        addEvent("strategy_item_keep",p.name+" 保留重新擲骰券，使用原點數 "+q.d1+"+"+q.d2+"。",{seat:seat,item:"reroll"});
        beginMoveAfterDice(p,q.d1,q.d2);
      }
      return;
    }

    if(msg.action==="fixed_move"){
      if(state.status!=="playing"||cur.seat!==seat||state.rolled||state.pending||state.groupGame)throw Error("目前不能使用指定步數券");
      if(strategyItemCount(p,"fixedStep")<=0)throw Error("你沒有指定步數券");
      const steps=Math.max(1,Math.min(6,Number(msg.steps)||0));
      p.fixedStep=Math.max(0,strategyItemCount(p,"fixedStep")-1);
      state.rolled=true;
      addEvent("strategy_item_use",p.name+" 使用指定步數券，指定前進 "+steps+" 格。",{seat:seat,item:"fixedStep",steps:steps,title:"指定步數券"});
      broadcast();
      setTimeout(function(){movePlayer(p,steps);resolveLanding(p);broadcast();},350);
      return;
    }

    if(msg.action==="rent_boost_use"||msg.action==="rent_boost_skip"){
      const q=state.pending;
      if(!q||q.type!=="rent_boost_choice"||q.owner!==seat)throw Error("目前沒有租金增幅選擇");
      const payer=state.players[q.payer],t=state.tiles[q.tile];
      if(msg.action==="rent_boost_use"){
        if(strategyItemCount(p,"rentBoost")<=0)throw Error("你沒有租金增幅券");
        p.rentBoost=Math.max(0,strategyItemCount(p,"rentBoost")-1);
        addEvent("strategy_item_use",p.name+" 對「"+t.name+"」使用租金增幅券。",{seat:seat,item:"rentBoost",tile:t.id,title:"租金增幅券"});
        setupForeignPropertyPending(payer,t,RENT_BOOST_MULT);
      }else setupForeignPropertyPending(payer,t,1);
      broadcast();return;
    }

    if(msg.action==="activate_stock_hedge"){
      if(cur.seat!==seat||state.rolled||state.pending||state.groupGame)throw Error("只能在自己的回合、擲骰前使用股票避險券");
      if(strategyItemCount(p,"stockHedge")<=0)throw Error("你沒有股票避險券");
      if(stockValue(p)<=0)throw Error("目前沒有持股");
      p.stockHedge=Math.max(0,strategyItemCount(p,"stockHedge")-1);
      p.marketHedge=1;
      p.planB.hedgePromptRound=state.round;
      addEvent("strategy_item_use",p.name+" 啟用股票避險券，保護下一次市場更新。",{seat:seat,item:"stockHedge",title:"股票避險券"});
      broadcast();return;
    }

    if(msg.action==="upgrade"){
      const id=Number(msg.tile);
      const fromLanding=state.pending&&state.pending.type==="own"&&state.pending.seat===seat&&Number(state.pending.tile)===id;
      const preRoll=cur.seat===seat&&!state.rolled&&!state.pending&&!state.groupGame;
      if(msg.context!=="property_center")throw Error("升級必須從「我的房產」進行");
      if(!preRoll&&!fromLanding)throw Error("目前不能升級地產");
      upgradeProperty(p,id,!!msg.useItem);
      if(fromLanding){state.pending=null;nextTurn();}else broadcast();
      return;
    }

    if((msg.action==="buy_stock"||msg.action==="sell_stock")&&p.planB&&p.planB.stockTradeLockedRound===state.round){
      throw Error("你本回合剛造成棋盤產業價格變動，為避免自買自拉套利，本回合不能再交易股票");
    }

    return base.hostAction.apply(this,arguments);
  };

  function marketEventEffectsText(ev){
    if(!ev||ev.name==="正常景氣")return "目前沒有特殊市場事件。";
    return ev.desc+"｜持續至 ROUND "+ev.until;
  }

  window.cityEventTick=function(){
    ensurePlanBState();
    const current=state.cityEvent;
    if(current&&current.name&&current.name!=="正常景氣"&&Number(current.until||0)>=state.round)return;
    if(current&&current.name&&current.name!=="正常景氣"&&Number(current.until||0)<state.round){
      addEvent("market_event_end","市場事件「"+current.name+"」已結束。",{name:current.name,title:"市場事件結束"});
      state.cityEvent={name:"正常景氣",rentMult:1,buildMult:1,stockBias:0,sectorBias:{},groupRentMult:{},startBonus:0,until:state.round};
    }
    if(state.round<3||state.round%3!==0)return;
    const picked=MARKET_EVENTS[Math.floor(Math.random()*MARKET_EVENTS.length)];
    state.cityEvent={
      name:picked.name,
      rentMult:picked.rentMult,
      buildMult:picked.buildMult,
      stockBias:picked.stockBias,
      sectorBias:Object.assign({},picked.sectorBias),
      groupRentMult:Object.assign({},picked.groupRentMult),
      startBonus:0,
      desc:picked.desc,
      startRound:state.round,
      until:state.round+picked.duration-1
    };
    addEvent("market_event_start","市場事件：「"+picked.name+"」— "+picked.desc,{event:Object.assign({},state.cityEvent),title:"市場事件"});
  };

  window.marketTick=function(){
    ensurePlanBState();
    const ev=state.cityEvent||{};
    const globalBias=Number(ev.stockBias||0);
    const sectorBias=ev.sectorBias||{};
    const hedgeBefore={};
    state.players.filter(Boolean).forEach(function(p){
      if((p.marketHedge||0)>0)hedgeBefore[p.seat]=stockValue(p);
    });
    const shocks=[];
    Object.entries(state.stocks).forEach(function(entry){
      const code=entry[0],st=entry[1];
      const def=STOCK_DEFS[code]||{vol:.07,drift:0};
      st.prev=st.price;
      let move=globalBias+Number(sectorBias[code]||0)+Number(def.drift||0)+((Math.random()*2-1)*Number(def.vol||.07));
      if(Math.random()<.18){
        const shock=(Math.random()<.5?-1:1)*(.04+Math.random()*.08);
        move+=shock;shocks.push({code:code,shock:shock});
      }
      move=Math.max(-.20,Math.min(.20,move));
      st.price=Math.max(20,Math.round(st.price*(1+move)));
      st.history=Array.isArray(st.history)?st.history:[st.price];
      st.history.push(st.price);st.history=st.history.slice(-24);
    });
    state.players.filter(Boolean).forEach(function(p){
      if((p.marketHedge||0)<=0)return;
      const before=Number(hedgeBefore[p.seat]||0),after=stockValue(p),loss=Math.max(0,before-after);
      const refund=Math.min(3500,Math.round(loss*.55));
      p.marketHedge=0;
      if(refund>0){
        p.cash+=refund;p.stats.marketOpBenefit=(p.stats.marketOpBenefit||0)+refund;
        addEvent("market_operation_benefit",p.name+" 的避險保護生效，補貼 "+money(refund)+"。",{seat:p.seat,amount:refund,title:"股票避險",before:before,after:after});
      }
    });
    if(shocks.length){
      shocks.sort(function(a,b){return Math.abs(b.shock)-Math.abs(a.shock);});
      const top=shocks[0];
      addEvent("market","個股消息："+state.stocks[top.code].name+" 本輪出現較大波動。",{code:top.code,shock:top.shock});
    }else addEvent("market","新一輪股票市場完成更新。");
  };

  function maybePromptStockHedge(){
    if(!hasState())return;
    const me=state.players&&state.players[mySeat];
    if(!me||me.ai||state.status!=="playing"||state.current!==mySeat||state.rolled||state.pending||state.groupGame)return;
    const ev=state.cityEvent||{};
    const negative=Number(ev.stockBias||0)<0||Object.values(ev.sectorBias||{}).some(function(v){return Number(v)<-.025;});
    if(!negative||stockValue(me)<=0||strategyItemCount(me,"stockHedge")<=0||(me.marketHedge||0)>0)return;
    const promptKey=String(roomCode||"")+"|"+String(state.round)+"|"+String(mySeat)+"|"+String(ev.name||"");
    if(localHedgePromptKey===promptKey)return;
    localHedgePromptKey=promptKey;
    showModal("負面市場事件：要使用股票避險券嗎？",
      '<div class="planb-market-event"><strong>'+ev.name+'</strong><span>'+marketEventEffectsText(ev)+'</span></div>'+
      '<div class="hub-rule">股票避險券 ×'+strategyItemCount(me,"stockHedge")+'。使用後會保護下一次市場更新的持股損失；拒絕不消耗。</div>',
      [["使用避險券","success",function(){sendAction("activate_stock_hedge");}],["保留道具","ghost",closeModal]]);
  }

  window.renderControls=function(){
    const result=base.renderControls.apply(this,arguments);
    ensurePlanBState();
    setTimeout(maybePromptStockHedge,0);
    return result;
  };

  window.planBStockAction=function(action,code){
    const input=document.getElementById("planb_q_"+code);
    const qty=Math.max(1,parseInt(input&&input.value||"1",10));
    sendAction(action,{code:code,qty:qty});
  };

  window.openMarketOperations=function(){
    if(!hasState())return;
    ensurePlanBState();
    const me=state.players[mySeat];
    if(!me)return;
    const ev=state.cityEvent||{name:"正常景氣"};
    let totalValue=0,totalCost=0;
    const stockRows=Object.entries(state.stocks).map(function(entry){
      const code=entry[0],st=entry[1],h=me.stocks&&me.stocks[code]||{qty:0,avg:0};
      const qty=Number(h.qty||0),avg=Number(h.avg||0),value=qty*st.price,cost=qty*avg,pnl=value-cost;
      totalValue+=value;totalCost+=cost;
      return '<div class="planb-stock-row">'+
        '<div class="planb-stock-top"><div class="planb-stock-name">'+st.name+' <span class="planb-item-badge">'+code+'</span></div><div class="planb-stock-price">'+st.price+'</div></div>'+
        '<div class="planb-stock-meta">持股 '+qty+'｜均價 '+(avg?avg.toFixed(1):"—")+'｜未實現 '+(pnl>=0?"+":"")+money(pnl)+'</div>'+
        '<div class="planb-stock-actions"><input id="planb_q_'+code+'" type="number" min="1" value="1">'+
          '<button class="success" onclick="planBStockAction(\'buy_stock\',\''+code+'\')">買</button>'+
          '<button class="danger" onclick="planBStockAction(\'sell_stock\',\''+code+'\')" '+(qty<=0?'disabled':'')+'>賣</button>'+
        '</div>'+
      '</div>';
    }).join("");

    const totalPnl=totalValue-totalCost;
    const can=marketOperationCanAct(me),coupon=strategyItemCount(me,"marketCoupon");
    const cards=Object.entries(MARKET_OPERATION_DEFS).map(function(entry){
      const key=entry[0],d=entry[1],active=(me[d.flag]||0)>0,cashNeed=coupon?marketOperationCost(d,true):d.cost;
      const blocked=active||!can||me.cash<cashNeed||(key==="hedge"&&stockValue(me)<=0);
      return '<div class="market-op-card '+(active?'active':'')+'"><div class="market-op-icon">'+d.icon+'</div><div class="market-op-name">'+d.name+'</div>'+
        '<div class="market-op-desc">'+d.desc+'</div><div class="market-op-cost">'+(active?'等待觸發':(coupon?'原價 '+money(d.cost)+'｜有折抵券':'費用 '+money(d.cost)))+'</div>'+
        '<button class="primary" '+(blocked?'disabled':'')+' onclick="requestMarketOperation(\''+key+'\')">'+(active?'已啟用':(!can?'本 ROUND 已使用':'啟用操作'))+'</button></div>';
    }).join("");

    const body=
      '<div class="planb-market-event"><strong>'+ev.name+'</strong><span>'+marketEventEffectsText(ev)+'</span></div>'+
      '<div class="planb-portfolio-grid">'+
        '<div><span>現金</span><b>'+money(me.cash)+'</b></div>'+
        '<div><span>持股市值</span><b>'+money(totalValue)+'</b></div>'+
        '<div><span>未實現損益</span><b>'+(totalPnl>=0?"+":"")+money(totalPnl)+'</b></div>'+
        '<div><span>已實現損益</span><b>'+((me.realizedPnl||0)>=0?"+":"")+money(me.realizedPnl||0)+'</b></div>'+
      '</div>'+
      '<div class="hub-rule">股票交易、當前市場狀態與策略型市場操作集中在同一入口。股票仍只能在自己的回合、擲骰前交易。</div>'+
      '<div class="planb-stock-compact">'+stockRows+'</div>'+
      '<div class="market-op-status">本 ROUND 市場操作：<b>'+((me.lastMarketOpRound||-99)===state.round?'已使用':'尚未使用')+'</b>'+(coupon?'｜折抵券 ×'+coupon:'')+'</div>'+
      '<div class="market-op-grid">'+cards+'</div>';
    showModal("市場操作",body,[["關閉","ghost",closeModal]]);
    document.getElementById("modal")&&document.getElementById("modal").classList.add("market-ops-modal");
  };

  window.liquidate=function(p){
    ensurePlayerPlanB(p);
    const forced=Number(p.cash||0)<0;
    if(forced)p.stats.forcedLiquidations++;
    const result=base.liquidate.apply(this,arguments);
    p.stats.minCash=Math.min(Number(p.stats.minCash),Number(p.cash||0));
    p.stats.maxCash=Math.max(Number(p.stats.maxCash),Number(p.cash||0));
    return result;
  };

  window.nextTurn=function(){
    const result=base.nextTurn.apply(this,arguments);
    if(hasState()){
      ensurePlanBState();
      state.players.filter(Boolean).forEach(function(p){
        p.stats.minCash=Math.min(Number(p.stats.minCash),Number(p.cash||0));
        p.stats.maxCash=Math.max(Number(p.stats.maxCash),Number(p.cash||0));
      });
    }
    return result;
  };

  ensurePlanBState();
})();
