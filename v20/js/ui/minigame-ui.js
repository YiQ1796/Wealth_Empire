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

function shuffle(values,random){
  const result=[...values];
  for(let i=result.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
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
            ? "AI 已選擇"
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
      if(remaining<=0&&!this.finished)this.finish({timeout:true});
    };
    update();
    this.tickTimer=setInterval(update,100);
  }

  renderWaiting(definition){
    this.title.textContent=definition.name;
    this.subtitle.textContent="結果已送出，等待其他玩家完成。";
    this.arena.innerHTML='<div class="minigame-waiting"><strong>已完成</strong><span>你的結果已送出，等待其他玩家。</span></div>';
  }

  renderCompleted(state,definition){
    this.title.textContent=definition.name+"｜結算";
    this.subtitle.textContent="這輪以運氣為主，名次越高獎金越多。";
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
      courier:()=>this.startCourier(session),
      vault:()=>this.startVault(session),
      tower:()=>this.startTower(session),
      memory:()=>this.startMemory(session),
      route:()=>this.startRoute(session),
      district:()=>this.startDistrict(session)
    };
    starters[definition.id]?.();
  }

  finish(detail={}){
    if(this.finished)return;
    this.finished=true;
    this.cleanup();
    const finalScore=clamp(Math.round(this.score),0,10000);
    this.onSubmit?.({score:finalScore,detail});
    this.arena.innerHTML='<div class="minigame-waiting"><strong>'+finalScore.toLocaleString()+' 分</strong><span>結果已送出，等待其他玩家。</span></div>';
  }

  randomFor(session,salt){
    return rng(hash(session.seed+":"+this.localSeat+":"+salt));
  }

  bindChoiceButtons(selector,handler){
    this.arena.querySelectorAll(selector).forEach(button=>{
      const listener=()=>handler(button);
      button.addEventListener("click",listener);
      this.cleanupFns.push(()=>button.removeEventListener("click",listener));
    });
  }

  showRoundResult({message,nextLabel="下一輪",onNext}){
    const result=this.arena.querySelector("[data-luck-result]");
    const actions=this.arena.querySelector("[data-luck-next]");
    if(result)result.innerHTML=message;
    if(actions){
      actions.innerHTML='<button type="button" class="luck-next-button">'+nextLabel+'</button>';
      const button=actions.querySelector("button");
      button.addEventListener("click",onNext,{once:true});
    }
    this.arena.querySelectorAll("[data-choice]").forEach(button=>button.disabled=true);
  }

  startCourier(session){
    const random=this.randomFor(session,"courier");
    let round=1;
    const totalRounds=4;
    const routes={
      safe:{label:"安全大道",icon:"🚦",note:"穩定報酬",resolve:()=>850+Math.floor(random()*551)},
      fast:{label:"快速道路",icon:"🏎️",note:"70% 高報酬",resolve:()=>random()<0.70?1800+Math.floor(random()*501):350+Math.floor(random()*301)},
      secret:{label:"神秘捷徑",icon:"🎁",note:"42% 大獎",resolve:()=>random()<0.42?2600+Math.floor(random()*601):100+Math.floor(random()*301)}
    };

    const renderRound=()=>{
      this.arena.innerHTML=
        '<div class="luck-game">'+
          '<div class="luck-round"><strong>第 '+round+' / '+totalRounds+' 趟</strong><span>累計 '+Math.round(this.score).toLocaleString()+' 分</span></div>'+
          '<div class="luck-hint">選一條路。安全路穩定，捷徑可能暴賺，也可能只拿到小獎。</div>'+
          '<div class="luck-choice-grid luck-choice-grid--3">'+
            Object.entries(routes).map(([id,route])=>
              '<button type="button" class="luck-choice" data-choice="'+id+'">'+
                '<span class="luck-choice__icon">'+route.icon+'</span>'+
                '<strong>'+route.label+'</strong><small>'+route.note+'</small>'+
              '</button>'
            ).join("")+
          '</div>'+
          '<div class="luck-result" data-luck-result></div>'+
          '<div class="luck-next" data-luck-next></div>'+
        '</div>';

      this.bindChoiceButtons("[data-choice]",button=>{
        const route=routes[button.dataset.choice];
        const gained=route.resolve();
        this.score+=gained;
        const isLast=round>=totalRounds;
        this.showRoundResult({
          message:'<b>'+route.icon+' '+route.label+'</b><span>本趟獲得 '+gained.toLocaleString()+' 分</span>',
          nextLabel:isLast?"送出結果":"下一趟",
          onNext:()=>{
            if(isLast)this.finish({game:"courier",rounds:totalRounds});
            else{round++;renderRound()}
          }
        });
      });
    };
    renderRound();
  }

  startVault(session){
    const random=this.randomFor(session,"vault");
    let round=1;
    const totalRounds=3;

    const renderRound=()=>{
      const rewards=shuffle([2800,2000,1500,1000,500,0],random);
      this.arena.innerHTML=
        '<div class="luck-game">'+
          '<div class="luck-round"><strong>第 '+round+' / '+totalRounds+' 輪</strong><span>累計 '+Math.round(this.score).toLocaleString()+' 分</span></div>'+
          '<div class="luck-hint">6 個金庫只有打開後才知道獎勵，完全靠手氣。</div>'+
          '<div class="vault-pick-grid">'+
            rewards.map((_,index)=>'<button type="button" class="vault-pick" data-choice="'+index+'">🔒<strong>金庫 '+(index+1)+'</strong><small>?</small></button>').join("")+
          '</div>'+
          '<div class="luck-result" data-luck-result></div>'+
          '<div class="luck-next" data-luck-next></div>'+
        '</div>';

      this.bindChoiceButtons("[data-choice]",button=>{
        const picked=Number(button.dataset.choice);
        const gained=rewards[picked];
        this.score+=gained;
        this.arena.querySelectorAll(".vault-pick").forEach((node,index)=>{
          node.querySelector("small").textContent=rewards[index].toLocaleString()+" 分";
          if(index===picked)node.classList.add("selected");
        });
        const isLast=round>=totalRounds;
        this.showRoundResult({
          message:'<b>🔓 金庫 '+(picked+1)+'</b><span>抽到 '+gained.toLocaleString()+' 分</span>',
          nextLabel:isLast?"送出結果":"下一輪",
          onNext:()=>{
            if(isLast)this.finish({game:"vault",rounds:totalRounds});
            else{round++;renderRound()}
          }
        });
      });
    };
    renderRound();
  }

  startTower(session){
    const random=this.randomFor(session,"tower");
    let round=1;
    const totalRounds=4;

    const renderRound=()=>{
      this.arena.innerHTML=
        '<div class="luck-game">'+
          '<div class="luck-round"><strong>第 '+round+' / '+totalRounds+' 輪</strong><span>累計 '+Math.round(this.score).toLocaleString()+' 分</span></div>'+
          '<div class="luck-hint">先猜 1～6 樓，再擲幸運骰。猜中最高分，差一格也有高分。</div>'+
          '<div class="floor-pick-grid">'+
            [1,2,3,4,5,6].map(value=>'<button type="button" class="floor-pick" data-choice="'+value+'">'+value+' 樓</button>').join("")+
          '</div>'+
          '<div class="luck-result" data-luck-result></div>'+
          '<div class="luck-next" data-luck-next></div>'+
        '</div>';

      this.bindChoiceButtons("[data-choice]",button=>{
        const guess=Number(button.dataset.choice);
        const die=1+Math.floor(random()*6);
        const distance=Math.abs(guess-die);
        const gained=distance===0?2400:distance===1?1650:distance===2?1050:500;
        this.score+=gained;
        const isLast=round>=totalRounds;
        this.showRoundResult({
          message:'<b>🎲 骰出 '+die+' 樓</b><span>你猜 '+guess+' 樓，本輪 '+gained.toLocaleString()+' 分</span>',
          nextLabel:isLast?"送出結果":"再猜一次",
          onNext:()=>{
            if(isLast)this.finish({game:"tower",rounds:totalRounds});
            else{round++;renderRound()}
          }
        });
      });
    };
    renderRound();
  }

  startMemory(session){
    const random=this.randomFor(session,"memory");
    const rewards=shuffle([3200,2600,2200,1800,1400,900,500,0],random);
    const picked=new Set();

    const render=()=>{
      this.arena.innerHTML=
        '<div class="luck-game">'+
          '<div class="luck-round"><strong>命運翻牌 '+picked.size+' / 3</strong><span>累計 '+Math.round(this.score).toLocaleString()+' 分</span></div>'+
          '<div class="luck-hint">8 張命運卡挑 3 張。可能抽到大獎，也可能抽到空卡。</div>'+
          '<div class="fate-card-grid">'+
            rewards.map((reward,index)=>{
              const chosen=picked.has(index);
              return '<button type="button" class="fate-card '+(chosen?"selected":"")+'" data-choice="'+index+'" '+(chosen?"disabled":"")+'>'+
                (chosen?'<strong>'+reward.toLocaleString()+'</strong><small>分</small>':'<strong>?</strong><small>命運卡</small>')+
              '</button>';
            }).join("")+
          '</div>'+
          '<div class="luck-result" data-luck-result></div>'+
          '<div class="luck-next" data-luck-next></div>'+
        '</div>';

      this.bindChoiceButtons("[data-choice]",button=>{
        const index=Number(button.dataset.choice);
        if(picked.has(index))return;
        picked.add(index);
        const gained=rewards[index];
        this.score+=gained;
        const done=picked.size>=3;
        this.showRoundResult({
          message:'<b>🃏 翻出 '+gained.toLocaleString()+' 分</b><span>目前累計 '+Math.round(this.score).toLocaleString()+' 分</span>',
          nextLabel:done?"送出結果":"再翻一張",
          onNext:()=>{
            if(done)this.finish({game:"memory",picked:[...picked]});
            else render();
          }
        });
      });
    };
    render();
  }

  startRoute(session){
    const random=this.randomFor(session,"route");
    let round=1;
    const totalRounds=4;
    const paths={
      safe:{label:"安全路線",icon:"🚌",note:"穩定、小波動",resolve:()=>900+Math.floor(random()*501)},
      balanced:{label:"均衡路線",icon:"🚕",note:"65% 高報酬",resolve:()=>random()<0.65?1700+Math.floor(random()*601):500+Math.floor(random()*301)},
      risky:{label:"冒險路線",icon:"🚀",note:"38% 超高報酬",resolve:()=>random()<0.38?2800+Math.floor(random()*701):100+Math.floor(random()*301)}
    };

    const renderRound=()=>{
      this.arena.innerHTML=
        '<div class="luck-game">'+
          '<div class="luck-round"><strong>第 '+round+' / '+totalRounds+' 站</strong><span>累計 '+Math.round(this.score).toLocaleString()+' 分</span></div>'+
          '<div class="luck-hint">城市道路充滿隨機事件。自己選風險，但結果交給運氣。</div>'+
          '<div class="luck-choice-grid luck-choice-grid--3">'+
            Object.entries(paths).map(([id,path])=>
              '<button type="button" class="luck-choice" data-choice="'+id+'">'+
                '<span class="luck-choice__icon">'+path.icon+'</span>'+
                '<strong>'+path.label+'</strong><small>'+path.note+'</small>'+
              '</button>'
            ).join("")+
          '</div>'+
          '<div class="luck-result" data-luck-result></div>'+
          '<div class="luck-next" data-luck-next></div>'+
        '</div>';

      this.bindChoiceButtons("[data-choice]",button=>{
        const path=paths[button.dataset.choice];
        const gained=path.resolve();
        this.score+=gained;
        const isLast=round>=totalRounds;
        this.showRoundResult({
          message:'<b>'+path.icon+' '+path.label+'</b><span>城市事件結算：+'+gained.toLocaleString()+' 分</span>',
          nextLabel:isLast?"送出結果":"前往下一站",
          onNext:()=>{
            if(isLast)this.finish({game:"route",rounds:totalRounds});
            else{round++;renderRound()}
          }
        });
      });
    };
    renderRound();
  }

  startDistrict(session){
    const random=this.randomFor(session,"district");
    let round=1;
    const totalRounds=3;
    const plans={
      safe:{label:"保守投資",icon:"🏦",note:"跌幅小、上漲也有限",base:1500,factor:220,floor:850},
      balanced:{label:"均衡投資",icon:"🏙️",note:"風險與報酬平均",base:1750,factor:430,floor:350},
      aggressive:{label:"高風險投資",icon:"📈",note:"大漲大賺，大跌也很痛",base:1950,factor:820,floor:0}
    };
    const marketLabels={[-2]:"重挫",[-1]:"下跌",[0]:"盤整",[1]:"上漲",[2]:"大漲"};

    const renderRound=()=>{
      this.arena.innerHTML=
        '<div class="luck-game">'+
          '<div class="luck-round"><strong>第 '+round+' / '+totalRounds+' 次開盤</strong><span>累計 '+Math.round(this.score).toLocaleString()+' 分</span></div>'+
          '<div class="luck-hint">先選投資風格，再隨機開出市場走勢。高風險可能一口氣拉開差距。</div>'+
          '<div class="luck-choice-grid luck-choice-grid--3">'+
            Object.entries(plans).map(([id,plan])=>
              '<button type="button" class="luck-choice" data-choice="'+id+'">'+
                '<span class="luck-choice__icon">'+plan.icon+'</span>'+
                '<strong>'+plan.label+'</strong><small>'+plan.note+'</small>'+
              '</button>'
            ).join("")+
          '</div>'+
          '<div class="luck-result" data-luck-result></div>'+
          '<div class="luck-next" data-luck-next></div>'+
        '</div>';

      this.bindChoiceButtons("[data-choice]",button=>{
        const plan=plans[button.dataset.choice];
        const shift=Math.floor(random()*5)-2;
        const noise=Math.floor((random()-0.5)*240);
        const gained=Math.max(plan.floor,Math.round(plan.base+shift*plan.factor+noise));
        this.score+=gained;
        const isLast=round>=totalRounds;
        this.showRoundResult({
          message:'<b>'+plan.icon+' 市場'+marketLabels[shift]+'</b><span>'+plan.label+' 本輪獲得 '+gained.toLocaleString()+' 分</span>',
          nextLabel:isLast?"送出結果":"下一次開盤",
          onNext:()=>{
            if(isLast)this.finish({game:"district",rounds:totalRounds});
            else{round++;renderRound()}
          }
        });
      });
    };
    renderRound();
  }
}
