import{MINIGAME_BY_ID}from"../data/minigames.js";

function hash(value){
  let h=2166136261;
  for(const ch of String(value)){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

function rng(seed){
  let value=seed>>>0;
  return()=>{
    value+=0x6D2B79F5;
    let t=value;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return((t^t>>>14)>>>0)/4294967296;
  };
}

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function escapeHtml(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function handValue(cards){
  let total=0;
  let aces=0;
  for(const card of cards){
    if(card.rank==="A"){
      total+=11;
      aces++;
    }else if(["K","Q","J"].includes(card.rank)){
      total+=10;
    }else{
      total+=Number(card.rank);
    }
  }
  while(total>21&&aces>0){
    total-=10;
    aces--;
  }
  return total;
}

export class MinigameUI{
  constructor({dialog,arena,title,subtitle,timer,scoreboard,onSubmit}){
    this.dialog=dialog;
    this.arena=arena;
    this.title=title;
    this.subtitle=subtitle;
    this.timer=timer;
    this.scoreboard=scoreboard;
    this.onSubmit=onSubmit;
    this.sessionKey=null;
    this.localSeat=null;
    this.score=0;
    this.finished=false;
    this.cleanupFns=[];
    this.tickTimer=null;
  }

  cleanup(){
    for(const fn of this.cleanupFns.splice(0)){
      try{fn()}catch{}
    }
    if(this.tickTimer){
      clearInterval(this.tickTimer);
      this.tickTimer=null;
    }
  }

  registerTimer(timer,type="timeout"){
    this.cleanupFns.push(()=>{
      if(type==="interval")clearInterval(timer);
      else clearTimeout(timer);
    });
    return timer;
  }

  resetScrollPosition(){
    const modal=this.dialog?.querySelector(".minigame-modal");
    if(!modal)return;
    modal.scrollTop=0;
    setTimeout(()=>{modal.scrollTop=0},0);
  }

  close(){
    this.cleanup();
    this.sessionKey=null;
    if(this.dialog?.open)this.dialog.close();
  }

  sync(state,localSeat){
    const session=state.minigame;
    if(!session)return;

    const definition=MINIGAME_BY_ID[session.id];
    if(!definition)return;

    const key=session.id+":"+session.seed+":"+session.startedAt;
    this.localSeat=localSeat;
    this.renderScoreboard(state);

    if(session.status==="completed"){
      if(this.sessionKey===key||this.dialog?.open){
        this.cleanup();
        this.sessionKey=key;
        this.renderCompleted(state,definition);
        if(!this.dialog.open)this.dialog.showModal();
        this.resetScrollPosition();
      }
      return;
    }

    const player=state.players?.[localSeat];
    const alreadySubmitted=Boolean(session.results?.[String(localSeat)]);
    if(!player||player.kind!=="human"||alreadySubmitted){
      if(this.sessionKey===key&&this.dialog.open)this.renderWaiting(definition);
      return;
    }

    if(this.sessionKey!==key){
      this.cleanup();
      this.sessionKey=key;
      this.score=0;
      this.finished=false;
      this.title.textContent=definition.name;
      this.subtitle.textContent=definition.description;
      this.startDeadlineTimer(session);
      this.startGame(definition,session);
      if(!this.dialog.open)this.dialog.showModal();
      this.resetScrollPosition();
    }
  }

  renderScoreboard(state){
    if(!this.scoreboard)return;
    const session=state.minigame;
    const rankings=session?.status==="completed"?session.rankings:null;
    this.scoreboard.innerHTML=state.players.map(player=>{
      const result=session?.results?.[String(player.seat)];
      const rank=rankings?.find(item=>item.seat===player.seat);
      const suffix=rank
        ? "#"+rank.rank+"｜"+rank.score+" 分｜+$"+rank.reward.toLocaleString()
        : result
          ? session?.id==="auction"
            ? "已暗標 ✓"
            : result.score+" 分 ✓"
          : player.kind==="ai"
            ? session?.id==="auction"?"AI 已暗標":"AI 已完成"
            : "進行中";
      return '<div class="minigame-score-row">'+
        '<span style="--player-color:'+player.color+'"></span>'+
        '<strong>'+escapeHtml(player.name)+'</strong>'+
        '<em>'+suffix+'</em>'+
      '</div>';
    }).join("");
  }

  startDeadlineTimer(session){
    const update=()=>{
      const remaining=Math.max(0,session.deadline-Date.now());
      this.timer.textContent=(remaining/1000).toFixed(1)+" 秒";
      if(remaining<=0&&!this.finished)this.finish({timeout:true,game:session.id},2500);
    };
    update();
    this.tickTimer=setInterval(update,100);
  }

  renderWaiting(definition){
    this.title.textContent=definition.name;
    this.subtitle.textContent="結果已送出，等待其他玩家完成。";
    this.arena.innerHTML='<div class="minigame-waiting"><strong>已完成</strong><span>等待其他玩家。</span></div>';
  }

  renderCompleted(state,definition){
    this.title.textContent=definition.name+"｜結算";
    if(definition.id==="auction"&&state.minigame?.auction){
      const auction=state.minigame.auction;
      const winner=state.players?.[auction.winnerSeat];
      this.subtitle.textContent="商品實際價值 $"+auction.value.toLocaleString()+
        "｜最高標 $"+auction.winningBid.toLocaleString()+
        (winner?"｜得標："+winner.name:"");
    }else{
      this.subtitle.textContent="依這款遊戲自己的規則計分，再統一排名發放獎金。";
    }
    this.timer.textContent="已結算";
    const rankings=state.minigame?.rankings??[];
    this.arena.innerHTML='<div class="minigame-ranking">'+rankings.map(item=>{
      const player=state.players[item.seat];
      return '<div class="minigame-ranking-row">'+
        '<b>#'+item.rank+'</b>'+
        '<strong>'+escapeHtml(player?.name??("玩家"+(item.seat+1)))+'</strong>'+
        '<span>'+item.score.toLocaleString()+' 分</span>'+
        '<em>+$'+item.reward.toLocaleString()+'</em>'+
      '</div>';
    }).join("")+
    '<button type="button" class="minigame-done-button" data-minigame-close>關閉</button></div>';
    this.arena.querySelector("[data-minigame-close]")?.addEventListener("click",()=>this.close(),{once:true});
  }

  startGame(definition,session){
    const starters={
      horse:()=>this.startHorse(session),
      treasure:()=>this.startTreasure(session),
      rps:()=>this.startRps(session),
      blackjack:()=>this.startBlackjack(session),
      plinko:()=>this.startPlinko(session),
      auction:()=>this.startAuction(session),
      snail:()=>this.startSnail(session),
      highlow:()=>this.startHighLow(session)
    };
    starters[definition.id]?.();
  }

  finish(detail={},score=this.score){
    if(this.finished)return;
    this.finished=true;
    this.cleanup();
    const finalScore=clamp(Math.round(Number(score)||0),0,10000);

    // Render the provisional waiting state BEFORE dispatching the result.
    // In solo/host games dispatch is synchronous and can finalize immediately;
    // rendering waiting afterwards would overwrite the completed ranking + close button.
    this.arena.innerHTML='<div class="minigame-waiting"><strong>'+finalScore.toLocaleString()+' 分</strong><span>結果已送出，等待其他玩家。</span></div>';
    this.onSubmit?.({score:finalScore,detail});
  }

  randomFor(session,salt){
    return rng(hash(session.seed+":"+this.localSeat+":"+salt));
  }

  sharedRandomFor(session,salt){
    return rng(hash(session.seed+":"+salt));
  }

  sharedRaceOrder(session,gameId){
    const random=this.sharedRandomFor(session,gameId+":shared-ranking");
    return[0,1,2,3]
      .map(index=>({index,value:random()}))
      .sort((a,b)=>b.value-a.value)
      .map(entry=>entry.index);
  }

  bindChoiceButtons(selector,handler){
    this.arena.querySelectorAll(selector).forEach(button=>{
      const listener=()=>handler(button);
      button.addEventListener("click",listener);
      this.cleanupFns.push(()=>button.removeEventListener("click",listener));
    });
  }

  applyRaceEffect(runnerIndex,effect,label,durationMs=900){
    const runner=this.arena.querySelector('[data-runner="'+runnerIndex+'"]');
    const fx=this.arena.querySelector('[data-race-fx="'+runnerIndex+'"]');
    if(!runner)return;

    const className="race-runner--fx-"+effect;
    runner.classList.add(className);
    if(fx){
      fx.textContent=label;
      fx.dataset.effect=effect;
      fx.style.left=runner.style.left||"8px";
      fx.classList.add("show");
    }

    const timer=setTimeout(()=>{
      runner.classList.remove(className);
      if(fx){
        fx.classList.remove("show");
        fx.textContent="";
        delete fx.dataset.effect;
      }
    },durationMs);
    this.cleanupFns.push(()=>clearTimeout(timer));
  }

  runContinuousRace({
    session,
    gameId,
    racers,
    pick,
    order,
    durationMs,
    eventPlan,
    eventMessageSelector,
    eventFeedSelector=null,
    scoreTable
  }){
    const startedAt=performance.now();
    const states=racers.map((_,index)=>({
      progress:0,
      baseSpeed:9.1+(3-order.indexOf(index))*0.24,
      multiplier:1,
      multiplierUntil:0,
      pauseUntil:0,
      dragUntil:0,
      transientOffset:0
    }));
    const feed=[];
    let eventIndex=0;
    let lastTime=startedAt;
    let rafId=0;
    let finished=false;

    const pushMessage=(text,effectTarget=null,effect=null)=>{
      const message=this.arena.querySelector(eventMessageSelector);
      if(message)message.textContent=text;
      if(eventFeedSelector){
        feed.unshift(text);
        feed.splice(5);
        const node=this.arena.querySelector(eventFeedSelector);
        if(node)node.innerHTML=feed.map(item=>'<span>'+escapeHtml(item)+'</span>').join("");
      }
      if(effectTarget!=null&&effect){
        this.applyRaceEffect(effectTarget,effect.kind,effect.label,effect.durationMs);
      }
    };

    const finishTargets=order.map((_,rank)=>100-rank*5);
    const targetForIndex=index=>finishTargets[order.indexOf(index)];

    const frame=now=>{
      if(finished)return;
      const elapsed=now-startedAt;
      const dt=Math.min(0.05,Math.max(0,(now-lastTime)/1000));
      lastTime=now;

      while(eventIndex<eventPlan.length&&elapsed>=eventPlan[eventIndex].atMs){
        const event=eventPlan[eventIndex++];
        const state=states[event.target];
        event.apply(state,elapsed);
        pushMessage(event.text,event.target,event.effect);
      }

      for(let index=0;index<states.length;index++){
        const state=states[index];
        let speed=state.baseSpeed;
        if(elapsed<state.pauseUntil)speed=0;
        if(elapsed<state.dragUntil)speed*=0.48;
        if(elapsed<state.multiplierUntil)speed*=state.multiplier;

        state.progress=Math.max(0,state.progress+speed*dt);
        if(Math.abs(state.transientOffset)>0.02){
          state.progress+=state.transientOffset*dt*1.8;
          state.transientOffset*=Math.pow(0.16,dt);
        }

        const finalStretch=Math.max(0,(elapsed-(durationMs-1500))/1500);
        if(finalStretch>0){
          const target=targetForIndex(index);
          const easing=Math.min(1,dt*(2.2+finalStretch*4.5));
          state.progress+= (target-state.progress)*easing;
        }

        state.progress=clamp(state.progress,0,100);
        const runner=this.arena.querySelector('[data-runner="'+index+'"]');
        if(runner){
          runner.style.left=(2+state.progress*0.9)+"%";
          runner.dataset.progress=state.progress.toFixed(2);
        }
      }

      if(elapsed>=durationMs){
        finished=true;
        for(let index=0;index<states.length;index++){
          states[index].progress=targetForIndex(index);
          const runner=this.arena.querySelector('[data-runner="'+index+'"]');
          if(runner)runner.style.left=(2+states[index].progress*0.9)+"%";
        }

        const place=order.indexOf(pick)+1;
        const score=scoreTable[place-1]??scoreTable.at(-1)??3000;
        pushMessage((pick+1)+" 號最終第 "+place+" 名！");
        const timer=setTimeout(()=>{
          this.finish({
            game:gameId,
            pick,
            place,
            ranking:order,
            sharedRace:true,
            continuous:true,
            events:feed
          },score);
        },950);
        this.cleanupFns.push(()=>clearTimeout(timer));
        return;
      }

      rafId=requestAnimationFrame(frame);
    };

    rafId=requestAnimationFrame(frame);
    this.cleanupFns.push(()=>cancelAnimationFrame(rafId));
  }

  startHorse(session){
    const random=this.sharedRandomFor(session,"horse-events-v2");
    const order=this.sharedRaceOrder(session,"horse");
    const horses=[
      {name:"閃電",icon:"🐎"},
      {name:"烈焰",icon:"🏇"},
      {name:"黑曜",icon:"🐴"},
      {name:"金星",icon:"🎠"}
    ];
    this.arena.innerHTML=
      '<div class="race-game horse-race-game"><div class="race-intro"><strong>先下注一匹馬</strong><span>這次是連續直線賽跑，途中會有爆發、泥地與最後衝刺。</span></div>'+
      '<div class="race-pick-grid">'+horses.map((horse,index)=>
        '<button type="button" class="race-pick" data-horse="'+index+'"><span>'+horse.icon+'</span><strong>'+(index+1)+' 號 '+horse.name+'</strong></button>'
      ).join("")+'</div></div>';

    this.bindChoiceButtons("[data-horse]",button=>{
      const pick=Number(button.dataset.horse);
      this.runHorseRace(session,random,horses,pick,order);
    });
  }

  runHorseRace(session,random,horses,pick,order){
    this.arena.innerHTML=
      '<div class="race-game horse-race-game">'+
      '<div class="race-status"><strong>你下注 '+(pick+1)+' 號 '+horses[pick].name+'</strong><span data-race-message>閘門開啟，直線開跑！</span></div>'+
      '<div class="race-lanes">'+horses.map((horse,index)=>
        '<div class="race-lane race-lane--horse">'+
          '<div class="race-lane__label">'+(index+1)+' '+horse.name+'</div>'+
          '<div class="race-track race-track--horse">'+
            '<span class="race-track__speed-lines" aria-hidden="true"></span>'+
            '<span class="race-runner race-runner--horse" data-runner="'+index+'" style="left:2%">'+horse.icon+'</span>'+
            '<span class="race-event-fx" data-race-fx="'+index+'"></span><i></i>'+
          '</div>'+
        '</div>'
      ).join("")+'</div></div>';

    const eventTypes=[
      {
        key:"sprint",label:"💨 爆發衝刺",text:"突然爆發衝刺！",
        apply:(state,elapsed)=>{state.multiplier=1.85;state.multiplierUntil=elapsed+950;},
        durationMs:950
      },
      {
        key:"mud",label:"💦 泥地減速",text:"踩進泥地，速度被拖慢！",
        apply:(state,elapsed)=>{state.dragUntil=elapsed+900;},
        durationMs:900
      },
      {
        key:"stumble",label:"💫 步伐踉蹌",text:"步伐踉蹌，短暫失速！",
        apply:(state,elapsed)=>{state.pauseUntil=elapsed+520;},
        durationMs:650
      },
      {
        key:"cheer",label:"✨ 觀眾歡呼",text:"聽到全場歡呼，越跑越快！",
        apply:(state,elapsed)=>{state.multiplier=1.45;state.multiplierUntil=elapsed+1250;},
        durationMs:1200
      },
      {
        key:"kick",label:"🔥 最後衝刺",text:"進入最後直線，全力加速！",
        apply:(state,elapsed)=>{state.multiplier=1.7;state.multiplierUntil=elapsed+1100;state.transientOffset+=1.4;},
        durationMs:1100
      }
    ];

    const eventPlan=Array.from({length:6},(_,index)=>{
      const type=eventTypes[Math.floor(random()*eventTypes.length)];
      const target=Math.floor(random()*horses.length);
      return{
        atMs:1000+index*850+Math.floor(random()*320),
        target,
        text:(target+1)+" 號"+type.text,
        effect:{kind:type.key,label:type.label,durationMs:type.durationMs},
        apply:type.apply
      };
    }).sort((a,b)=>a.atMs-b.atMs);

    this.runContinuousRace({
      session,
      gameId:"horse",
      racers:horses,
      pick,
      order,
      durationMs:7200,
      eventPlan,
      eventMessageSelector:"[data-race-message]",
      scoreTable:[9500,7600,5600,3600]
    });
  }

  startSnail(session){
    const random=this.sharedRandomFor(session,"snail-events-v2");
    const order=this.sharedRaceOrder(session,"snail");
    const snails=[
      {name:"阿慢",icon:"🐌"},
      {name:"黏黏",icon:"🐌"},
      {name:"衝衝",icon:"🐌"},
      {name:"寶仔",icon:"🐌"}
    ];
    this.arena.innerHTML=
      '<div class="race-game snail-game"><div class="race-intro"><strong>下注一隻瘋狂蝸牛</strong><span>蝸牛會一路連續爬行，但途中什麼荒謬事情都可能發生。</span></div>'+
      '<div class="race-pick-grid">'+snails.map((snail,index)=>
        '<button type="button" class="race-pick" data-snail="'+index+'"><span>'+snail.icon+'</span><strong>'+(index+1)+' 號 '+snail.name+'</strong></button>'
      ).join("")+'</div></div>';

    this.bindChoiceButtons("[data-snail]",button=>{
      const pick=Number(button.dataset.snail);
      this.runSnailRace(session,random,snails,pick,order);
    });
  }

  runSnailRace(session,random,snails,pick,order){
    this.arena.innerHTML=
      '<div class="race-game snail-game">'+
      '<div class="race-status"><strong>你下注 '+(pick+1)+' 號 '+snails[pick].name+'</strong><span data-snail-message>蝸牛們開始直線蠕動！</span></div>'+
      '<div class="race-lanes">'+snails.map((snail,index)=>
        '<div class="race-lane race-lane--snail">'+
          '<div class="race-lane__label">'+(index+1)+' '+snail.name+'</div>'+
          '<div class="race-track race-track--snail">'+
            '<span class="race-runner race-runner--snail" data-runner="'+index+'" style="left:2%">'+snail.icon+'</span>'+
            '<span class="race-event-fx" data-race-fx="'+index+'"></span><i></i>'+
          '</div>'+
        '</div>'
      ).join("")+'</div><div class="snail-event-feed" data-snail-feed></div></div>';

    const events=[
      {
        key:"fall",label:"💫 跌倒",text:"跌倒了！原地暈一下。",
        apply:(state,elapsed)=>{state.pauseUntil=elapsed+720;},
        durationMs:780
      },
      {
        key:"rocket",label:"🚀 火箭",text:"偷偷坐上火箭，直接暴衝！",
        apply:(state,elapsed)=>{state.transientOffset+=7;state.multiplier=2.15;state.multiplierUntil=elapsed+1000;},
        durationMs:1050
      },
      {
        key:"heart",label:"😍 分心",text:"看到帥哥分心，完全忘記在比賽！",
        apply:(state,elapsed)=>{state.pauseUntil=elapsed+900;},
        durationMs:950
      },
      {
        key:"fart",label:"💨 放屁衝鋒",text:"放屁衝鋒，突然噴射加速！",
        apply:(state,elapsed)=>{state.transientOffset+=4.5;state.multiplier=1.9;state.multiplierUntil=elapsed+850;},
        durationMs:900
      },
      {
        key:"oil",label:"🛢️ 踩到油",text:"踩到油一路滑行，速度暴增！",
        apply:(state,elapsed)=>{state.transientOffset+=3.5;state.multiplier=1.65;state.multiplierUntil=elapsed+900;},
        durationMs:900
      },
      {
        key:"slip",label:"🫨 打滑",text:"踩到油卻打滑，倒退又停住！",
        apply:(state,elapsed)=>{state.transientOffset-=2.2;state.pauseUntil=elapsed+620;},
        durationMs:760
      },
      {
        key:"treasure",label:"💎 發現寶物",text:"看到地上有寶物，停下來研究！",
        apply:(state,elapsed)=>{state.pauseUntil=elapsed+1050;},
        durationMs:1100
      },
      {
        key:"cheat",label:"🥸 作弊偷跑",text:"趁裁判不注意作弊偷跑！",
        apply:state=>{state.transientOffset+=7.5;},
        durationMs:850
      }
    ];

    const eventPlan=Array.from({length:8},(_,index)=>{
      const type=events[Math.floor(random()*events.length)];
      const target=Math.floor(random()*snails.length);
      return{
        atMs:700+index*720+Math.floor(random()*260),
        target,
        text:(target+1)+" 號"+type.text,
        effect:{kind:type.key,label:type.label,durationMs:type.durationMs},
        apply:type.apply
      };
    }).sort((a,b)=>a.atMs-b.atMs);

    this.runContinuousRace({
      session,
      gameId:"snail",
      racers:snails,
      pick,
      order,
      durationMs:7600,
      eventPlan,
      eventMessageSelector:"[data-snail-message]",
      eventFeedSelector:"[data-snail-feed]",
      scoreTable:[9600,7600,5400,3400]
    });
  }

  startHighLow(session){
    const random=this.randomFor(session,"highlow");
    this.arena.innerHTML=
      '<div class="decision-game highlow-game">'+
        '<div class="decision-summary"><strong>高低骰對決</strong><span>猜兩顆骰子的總和：小 2–6｜7 平手｜大 8–12</span></div>'+
        '<div class="highlow-dice" data-highlow-dice>🎲 🎲</div>'+
        '<div class="decision-actions">'+
          '<button type="button" data-highlow="low">猜小 2–6</button>'+
          '<button type="button" data-highlow="high">猜大 8–12</button>'+
        '</div>'+
      '</div>';

    this.bindChoiceButtons("[data-highlow]",button=>{
      const pick=button.dataset.highlow;
      this.arena.querySelectorAll("[data-highlow]").forEach(choice=>{choice.disabled=true;});
      const d1=1+Math.floor(random()*6);
      const d2=1+Math.floor(random()*6);
      const total=d1+d2;
      const outcome=total===7?"tie":total<=6?"low":"high";
      const won=outcome===pick;
      const dice=this.arena.querySelector("[data-highlow-dice]");
      if(dice){
        dice.textContent="🎲 "+d1+" + 🎲 "+d2+" = "+total;
        dice.classList.add(won?"win":outcome==="tie"?"tie":"lose");
      }
      const score=outcome==="tie"?5600:won?9000:2600;
      this.registerTimer(setTimeout(()=>{
        this.finish({game:"highlow",pick,d1,d2,total,outcome,won},score);
      },900));
    });
  }

  startTreasure(session){
    const random=this.randomFor(session,"treasure");
    let opened=0;
    let bank=0;

    const render=()=>{
      const trapChance=Math.min(0.48,0.06+opened*0.09);
      this.arena.innerHTML=
        '<div class="decision-game"><div class="decision-summary"><strong>目前保住 '+bank.toLocaleString()+' 分</strong><span>已開 '+opened+' 箱｜下一箱陷阱風險約 '+Math.round(trapChance*100)+'%</span></div>'+
        '<div class="treasure-chest">🎁</div><div class="decision-actions">'+
        '<button type="button" data-open-chest>繼續開下一箱</button>'+
        '<button type="button" data-cash-out '+(opened===0?"disabled":"")+'>收手保住分數</button></div></div>';

      const openButton=this.arena.querySelector("[data-open-chest]");
      const cashButton=this.arena.querySelector("[data-cash-out]");
      openButton?.addEventListener("click",()=>{
        opened++;
        if(random()<trapChance){
          const kept=Math.max(800,Math.round(bank*0.3));
          this.finish({game:"treasure",opened,trapped:true,bankBeforeTrap:bank},kept);
          return;
        }
        bank+=1100+Math.floor(random()*1300);
        if(opened>=5){
          this.finish({game:"treasure",opened,trapped:false,forcedCashout:true},Math.min(9800,bank));
          return;
        }
        render();
      },{once:true});
      cashButton?.addEventListener("click",()=>{
        this.finish({game:"treasure",opened,trapped:false,cashout:true},Math.min(9800,bank+1000));
      },{once:true});
    };
    render();
  }

  startRps(session){
    const random=this.randomFor(session,"rps");
    const choices=[
      {id:"rock",label:"石頭",icon:"✊"},
      {id:"paper",label:"布",icon:"✋"},
      {id:"scissors",label:"剪刀",icon:"✌️"}
    ];
    let round=1;
    let wins=0;
    let losses=0;
    let ties=0;
    const beats={rock:"scissors",scissors:"paper",paper:"rock"};

    const render=message=>{
      this.arena.innerHTML=
        '<div class="decision-game"><div class="decision-summary"><strong>第 '+round+' 局｜你 '+wins+' : '+losses+' 對手</strong><span>'+(message||"出拳！")+'</span></div>'+
        '<div class="rps-grid">'+choices.map(choice=>
          '<button type="button" data-rps="'+choice.id+'"><span>'+choice.icon+'</span><strong>'+choice.label+'</strong></button>'
        ).join("")+'</div></div>';

      this.bindChoiceButtons("[data-rps]",button=>{
        const mine=button.dataset.rps;
        const opponent=choices[Math.floor(random()*choices.length)].id;
        if(mine===opponent)ties++;
        else if(beats[mine]===opponent)wins++;
        else losses++;
        const mineLabel=choices.find(choice=>choice.id===mine);
        const oppLabel=choices.find(choice=>choice.id===opponent);
        const resultText=mine===opponent?"平手":beats[mine]===opponent?"你贏了":"你輸了";
        if(round>=3||wins>=2||losses>=2){
          const score=clamp(1800+wins*3000+ties*1400-losses*150,0,9800);
          this.finish({game:"rps",wins,losses,ties},score);
          return;
        }
        round++;
        render(mineLabel.icon+" 對 "+oppLabel.icon+"｜"+resultText);
      });
    };
    render();
  }

  startBlackjack(session){
    const random=this.randomFor(session,"blackjack");
    const ranks=["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
    const suits=["♠","♥","♦","♣"];
    const draw=()=>({rank:ranks[Math.floor(random()*ranks.length)],suit:suits[Math.floor(random()*suits.length)]});
    const player=[draw(),draw()];
    const dealer=[draw(),draw()];
    let dealerRevealed=false;

    const cardText=card=>card.rank+card.suit;
    const finishHand=()=>{
      dealerRevealed=true;
      while(handValue(dealer)<17)dealer.push(draw());
      const playerValue=handValue(player);
      const dealerValue=handValue(dealer);
      const bust=playerValue>21;
      const dealerBust=dealerValue>21;
      const win=!bust&&(dealerBust||playerValue>dealerValue);
      const tie=!bust&&!dealerBust&&playerValue===dealerValue;
      const score=win?9400:tie?5900:bust?1600:3000;
      this.finish({game:"blackjack",playerValue,dealerValue,bust,dealerBust,win,tie},score);
    };

    const render=()=>{
      const value=handValue(player);
      this.arena.innerHTML=
        '<div class="decision-game blackjack-game">'+
        '<div class="card-hand"><span>莊家</span><strong>'+cardText(dealer[0])+' '+(dealerRevealed?cardText(dealer[1]):"🂠")+'</strong></div>'+
        '<div class="card-hand card-hand--player"><span>你的牌｜'+value+' 點</span><strong>'+player.map(cardText).join("　")+'</strong></div>'+
        '<div class="decision-actions"><button type="button" data-hit>要牌</button><button type="button" data-stand>停牌</button></div></div>';

      this.arena.querySelector("[data-hit]")?.addEventListener("click",()=>{
        player.push(draw());
        if(handValue(player)>21){
          finishHand();
          return;
        }
        render();
      },{once:true});
      this.arena.querySelector("[data-stand]")?.addEventListener("click",finishHand,{once:true});
    };
    render();
  }

  startPlinko(session){
    const random=this.randomFor(session,"plinko");
    const lanes=[1,2,3,4,5];
    this.arena.innerHTML=
      '<div class="plinko-game"><div class="race-intro"><strong>選擇彈珠落點</strong><span>落下後會一路撞擊釘子，最後進入倍率槽。</span></div>'+
      '<div class="plinko-drop-grid">'+lanes.map(lane=>'<button type="button" data-plinko="'+lane+'">落點 '+lane+'</button>').join("")+'</div></div>';

    this.bindChoiceButtons("[data-plinko]",button=>{
      const lane=Number(button.dataset.plinko);
      this.runPlinko(random,lane);
    });
  }

  runPlinko(random,lane){
    const multipliers=[0.5,1,2,5,10,5,2,1,0.5];
    let slot=(lane-1)*2;
    let row=0;
    this.arena.innerHTML=
      '<div class="plinko-game"><div class="plinko-board"><span class="plinko-ball" data-plinko-ball style="left:'+((slot/8)*92+4)+'%">●</span>'+
      Array.from({length:7},(_,index)=>'<div class="plinko-row">•　•　•　•　•　•</div>').join("")+
      '<div class="plinko-slots">'+multipliers.map(value=>'<b>×'+value+'</b>').join("")+'</div></div><div class="plinko-status" data-plinko-status>彈珠開始掉落…</div></div>';

    const interval=this.registerTimer(setInterval(()=>{
      row++;
      slot=clamp(slot+(random()<0.5?-1:1),0,8);
      const ball=this.arena.querySelector("[data-plinko-ball]");
      if(ball){
        ball.style.left=((slot/8)*92+4)+"%";
        ball.style.top=Math.min(76,8+row*9)+"%";
      }
      if(row>=7){
        clearInterval(interval);
        const multiplier=multipliers[slot];
        const score=clamp(Math.round(1200+multiplier*850),0,9800);
        const status=this.arena.querySelector("[data-plinko-status]");
        if(status)status.textContent="落入 ×"+multiplier+" 倍率槽！";
        this.registerTimer(setTimeout(()=>this.finish({game:"plinko",lane,slot,multiplier},score),800));
      }
    },420),"interval");
  }

  startAuction(session){
    const random=this.sharedRandomFor(session,"auction-item");
    const items=[
      {name:"神秘古董",icon:"🏺"},
      {name:"限量名錶",icon:"⌚"},
      {name:"稀有藝術品",icon:"🖼️"},
      {name:"城市金庫券",icon:"🎫"}
    ];
    const item=items[Math.floor(random()*items.length)];
    const bids=[1000,2000,3000,4000,5000,6000];

    this.arena.innerHTML=
      '<div class="decision-game auction-game"><div class="auction-item"><span>'+item.icon+'</span><strong>'+item.name+'</strong><small>真實價值未知</small></div>'+
      '<div class="luck-hint">三名對手也正在暗標。出太低搶不到，出太高即使得標也可能虧。</div>'+
      '<div class="auction-bids">'+bids.map(bid=>'<button type="button" data-bid="'+bid+'">$'+bid.toLocaleString()+'</button>').join("")+'</div></div>';

    this.bindChoiceButtons("[data-bid]",button=>{
      const bid=Number(button.dataset.bid);
      this.finish({game:"auction",item:item.name,bid,sharedAuction:true},0);
    });
  }
}
