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
          ? result.score+" 分 ✓"
          : player.kind==="ai"
            ? "AI 已完成"
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
      snail:()=>this.startSnail(session)
    };
    starters[definition.id]?.();
  }

  finish(detail={},score=this.score){
    if(this.finished)return;
    this.finished=true;
    this.cleanup();
    const finalScore=clamp(Math.round(Number(score)||0),0,10000);
    this.onSubmit?.({score:finalScore,detail});
    this.arena.innerHTML='<div class="minigame-waiting"><strong>'+finalScore.toLocaleString()+' 分</strong><span>結果已送出，等待其他玩家。</span></div>';
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

  startHorse(session){
    const random=this.sharedRandomFor(session,"horse-events");
    const order=this.sharedRaceOrder(session,"horse");
    const horses=[
      {name:"閃電",icon:"🐎"},
      {name:"烈焰",icon:"🏇"},
      {name:"黑曜",icon:"🐴"},
      {name:"金星",icon:"🎠"}
    ];
    this.arena.innerHTML=
      '<div class="race-game"><div class="race-intro"><strong>先下注一匹馬</strong><span>比賽開始後會實際跑完整段賽程。</span></div>'+
      '<div class="race-pick-grid">'+horses.map((horse,index)=>
        '<button type="button" class="race-pick" data-horse="'+index+'"><span>'+horse.icon+'</span><strong>'+(index+1)+' 號 '+horse.name+'</strong></button>'
      ).join("")+'</div></div>';

    this.bindChoiceButtons("[data-horse]",button=>{
      const pick=Number(button.dataset.horse);
      this.runHorseRace(random,horses,pick,order);
    });
  }

  runHorseRace(random,horses,pick,order){
    const progress=[0,0,0,0];
    let tick=0;
    this.arena.innerHTML=
      '<div class="race-game"><div class="race-status"><strong>你下注 '+(pick+1)+' 號 '+horses[pick].name+'</strong><span data-race-message>準備起跑！</span></div>'+
      '<div class="race-lanes">'+horses.map((horse,index)=>
        '<div class="race-lane"><div class="race-lane__label">'+(index+1)+' '+horse.name+'</div><div class="race-track"><span class="race-runner" data-runner="'+index+'" style="left:0%">'+horse.icon+'</span><i></i></div></div>'
      ).join("")+'</div></div>';

    const interval=this.registerTimer(setInterval(()=>{
      tick++;
      let message="全馬群持續推進";
      for(let index=0;index<horses.length;index++){
        let gain=7+Math.floor(random()*10);
        const eventRoll=random();
        if(eventRoll<0.12){
          gain+=9;
          message=(index+1)+" 號突然爆發衝刺！";
        }else if(eventRoll<0.20){
          gain=Math.max(2,gain-7);
          message=(index+1)+" 號步伐亂掉，速度下降。";
        }
        progress[index]=Math.min(100,progress[index]+gain);
        const runner=this.arena.querySelector('[data-runner="'+index+'"]');
        if(runner)runner.style.left=Math.min(92,progress[index]*0.92)+"%";
      }
      const messageNode=this.arena.querySelector("[data-race-message]");
      if(messageNode)messageNode.textContent=message;

      if(tick>=9||progress.some(value=>value>=100)){
        clearInterval(interval);
        order.forEach((runnerIndex,rank)=>{
          progress[runnerIndex]=100-rank*6;
          const runner=this.arena.querySelector('[data-runner="'+runnerIndex+'"]');
          if(runner)runner.style.left=Math.min(92,progress[runnerIndex]*0.92)+"%";
        });
        const place=order.indexOf(pick)+1;
        const score=[9500,7600,5600,3600][place-1];
        const timer=this.registerTimer(setTimeout(()=>{
          this.finish({game:"horse",pick,place,ranking:order,sharedRace:true},score);
        },900));
        void timer;
      }
    },560),"interval");
  }

  startSnail(session){
    const random=this.sharedRandomFor(session,"snail-events");
    const order=this.sharedRaceOrder(session,"snail");
    const snails=[
      {name:"阿慢",icon:"🐌"},
      {name:"黏黏",icon:"🐌"},
      {name:"衝衝",icon:"🐌"},
      {name:"寶仔",icon:"🐌"}
    ];
    this.arena.innerHTML=
      '<div class="race-game snail-game"><div class="race-intro"><strong>下注一隻瘋狂蝸牛</strong><span>牠們會在途中遇到各種荒謬突發狀況。</span></div>'+
      '<div class="race-pick-grid">'+snails.map((snail,index)=>
        '<button type="button" class="race-pick" data-snail="'+index+'"><span>'+snail.icon+'</span><strong>'+(index+1)+' 號 '+snail.name+'</strong></button>'
      ).join("")+'</div></div>';

    this.bindChoiceButtons("[data-snail]",button=>{
      const pick=Number(button.dataset.snail);
      this.runSnailRace(random,snails,pick,order);
    });
  }

  runSnailRace(random,snails,pick,order){
    const progress=[0,0,0,0];
    const stunned=[0,0,0,0];
    let tick=0;
    const eventLog=[];
    this.arena.innerHTML=
      '<div class="race-game snail-game"><div class="race-status"><strong>你下注 '+(pick+1)+' 號 '+snails[pick].name+'</strong><span data-snail-message>蝸牛們開始蠕動！</span></div>'+
      '<div class="race-lanes">'+snails.map((snail,index)=>
        '<div class="race-lane"><div class="race-lane__label">'+(index+1)+' '+snail.name+'</div><div class="race-track race-track--snail"><span class="race-runner race-runner--snail" data-runner="'+index+'" style="left:0%">'+snail.icon+'</span><i></i></div></div>'
      ).join("")+'</div><div class="snail-event-feed" data-snail-feed></div></div>';

    const pushEvent=text=>{
      eventLog.unshift(text);
      eventLog.splice(4);
      const feed=this.arena.querySelector("[data-snail-feed]");
      if(feed)feed.innerHTML=eventLog.map(item=>'<span>'+escapeHtml(item)+'</span>').join("");
      const message=this.arena.querySelector("[data-snail-message]");
      if(message)message.textContent=text;
    };

    const interval=this.registerTimer(setInterval(()=>{
      tick++;
      for(let index=0;index<snails.length;index++){
        if(stunned[index]>0){
          stunned[index]--;
          continue;
        }
        progress[index]=Math.min(100,progress[index]+3+Math.floor(random()*5));
      }

      const target=Math.floor(random()*snails.length);
      const roll=random();
      if(roll<0.11){
        stunned[target]=1;
        pushEvent((target+1)+" 號跌倒了！原地休息一下。");
      }else if(roll<0.22){
        progress[target]=Math.min(100,progress[target]+22);
        pushEvent((target+1)+" 號偷偷坐上火箭，瞬間暴衝！");
      }else if(roll<0.33){
        stunned[target]=1;
        pushEvent((target+1)+" 號看到帥哥分心，完全忘記在比賽。");
      }else if(roll<0.44){
        progress[target]=Math.min(100,progress[target]+14);
        pushEvent((target+1)+" 號放屁衝鋒，莫名其妙加速！");
      }else if(roll<0.56){
        if(random()<0.5){
          progress[target]=Math.min(100,progress[target]+12);
          pushEvent((target+1)+" 號踩到油一路滑行，意外加速！");
        }else{
          progress[target]=Math.max(0,progress[target]-5);
          stunned[target]=1;
          pushEvent((target+1)+" 號踩油打滑，倒退還停一回合！");
        }
      }else if(roll<0.68){
        stunned[target]=1;
        pushEvent((target+1)+" 號看到地上有寶物，停下來研究半天。");
      }else if(roll<0.80){
        progress[target]=Math.min(100,progress[target]+16);
        pushEvent((target+1)+" 號趁裁判不注意作弊偷跑！");
      }else{
        pushEvent("這一段沒有怪事，所有蝸牛努力蠕動。");
      }

      for(let index=0;index<snails.length;index++){
        const runner=this.arena.querySelector('[data-runner="'+index+'"]');
        if(runner)runner.style.left=Math.min(92,progress[index]*0.92)+"%";
      }

      if(tick>=12||progress.some(value=>value>=100)){
        clearInterval(interval);
        order.forEach((runnerIndex,rank)=>{
          progress[runnerIndex]=100-rank*7;
          const runner=this.arena.querySelector('[data-runner="'+runnerIndex+'"]');
          if(runner)runner.style.left=Math.min(92,progress[runnerIndex]*0.92)+"%";
        });
        const place=order.indexOf(pick)+1;
        const score=[9600,7600,5400,3400][place-1];
        this.registerTimer(setTimeout(()=>{
          this.finish({
            game:"snail",
            pick,
            place,
            events:eventLog,
            ranking:order,
            sharedRace:true
          },score);
        },1000));
      }
    },620),"interval");
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
