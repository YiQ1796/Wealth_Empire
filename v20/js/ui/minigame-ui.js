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
      }
      return;
    }

    const player=state.players?.[localSeat];
    const alreadySubmitted=Boolean(session.results?.[String(localSeat)]);
    if(!player||player.kind!=="human"||alreadySubmitted){
      if(this.sessionKey===key&&this.dialog.open){
        this.renderWaiting(definition);
      }
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
            ? "AI 計算完成"
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
      if(remaining<=0&&!this.finished){
        this.finish({timeout:true});
      }
    };
    update();
    this.tickTimer=setInterval(update,100);
  }

  renderWaiting(definition){
    this.title.textContent=definition.name;
    this.subtitle.textContent="成績已送出，等待其他玩家完成。";
    this.arena.innerHTML='<div class="minigame-waiting"><strong>已完成</strong><span>你的成績已送出，請等待其他玩家。</span></div>';
  }

  renderCompleted(state,definition){
    this.title.textContent=definition.name+"｜結算";
    this.subtitle.textContent="四名玩家皆有獎勵，名次越高獎勵越多。";
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
    const closeButton=this.arena.querySelector("[data-minigame-close]");
    closeButton?.addEventListener("click",()=>this.close(),{once:true});
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
    this.arena.innerHTML='<div class="minigame-waiting"><strong>'+finalScore.toLocaleString()+' 分</strong><span>成績已送出，等待其他玩家。</span></div>';
  }

  startCourier(session){
    const random=rng(session.seed);
    const prompts=Array.from({length:12},()=>{
      const value=random();
      return value<0.34?"left":value<0.67?"jump":"right";
    });
    let index=0;
    let combo=0;
    let openedAt=performance.now();
    let promptTimer=null;
    const labels={left:"← 左切",jump:"↑ 跳躍",right:"→ 右切"};

    this.arena.innerHTML=
      '<div class="courier-game">'+
        '<div class="courier-road"><div class="courier-lane"></div><div class="courier-lane"></div><div class="courier-lane"></div><div class="courier-prompt" data-courier-prompt></div></div>'+
        '<div class="courier-meta"><span>進度 <b data-courier-progress>1/12</b></span><span>Combo <b data-courier-combo>0</b></span><span>分數 <b data-courier-score>0</b></span></div>'+
        '<div class="minigame-actions">'+
          '<button type="button" data-courier-action="left">← 左切</button>'+
          '<button type="button" data-courier-action="jump">↑ 跳躍</button>'+
          '<button type="button" data-courier-action="right">→ 右切</button>'+
        '</div>'+
      '</div>';

    const promptNode=this.arena.querySelector("[data-courier-prompt]");
    const progressNode=this.arena.querySelector("[data-courier-progress]");
    const comboNode=this.arena.querySelector("[data-courier-combo]");
    const scoreNode=this.arena.querySelector("[data-courier-score]");

    const nextPrompt=()=>{
      if(index>=prompts.length){
        this.finish({game:"courier",combo});
        return;
      }
      openedAt=performance.now();
      promptNode.textContent=labels[prompts[index]];
      progressNode.textContent=(index+1)+"/"+prompts.length;
      promptTimer=setTimeout(()=>{
        combo=0;
        index++;
        comboNode.textContent=combo;
        nextPrompt();
      },1500);
    };

    const handleAction=event=>{
      if(this.finished||index>=prompts.length)return;
      const action=event.currentTarget.dataset.courierAction;
      const elapsed=performance.now()-openedAt;
      clearTimeout(promptTimer);
      if(action===prompts[index]){
        combo++;
        this.score+=Math.max(300,900-elapsed*0.35)+combo*45;
      }else{
        combo=0;
        this.score=Math.max(0,this.score-220);
      }
      index++;
      comboNode.textContent=combo;
      scoreNode.textContent=Math.round(this.score);
      nextPrompt();
    };

    this.arena.querySelectorAll("[data-courier-action]").forEach(button=>{
      button.addEventListener("click",handleAction);
      this.cleanupFns.push(()=>button.removeEventListener("click",handleAction));
    });
    this.cleanupFns.push(()=>clearTimeout(promptTimer));
    nextPrompt();
  }

  startVault(session){
    const random=rng(session.seed);
    let level=1;
    let needle=0;
    let direction=1;
    let lastTime=performance.now();
    let raf=0;
    let targetCenter=35+random()*30;
    let targetWidth=24;
    let speed=0.055;

    this.arena.innerHTML=
      '<div class="vault-game">'+
        '<div class="vault-ring"><div class="vault-zone" data-vault-zone></div><div class="vault-needle" data-vault-needle></div></div>'+
        '<div class="vault-meta"><span>金庫層 <b data-vault-level>1/5</b></span><span>分數 <b data-vault-score>0</b></span></div>'+
        '<button type="button" class="vault-unlock" data-vault-unlock>解鎖</button>'+
      '</div>';

    const zone=this.arena.querySelector("[data-vault-zone]");
    const needleNode=this.arena.querySelector("[data-vault-needle]");
    const levelNode=this.arena.querySelector("[data-vault-level]");
    const scoreNode=this.arena.querySelector("[data-vault-score]");
    const button=this.arena.querySelector("[data-vault-unlock]");

    const layoutTarget=()=>{
      zone.style.left=(targetCenter-targetWidth/2)+"%";
      zone.style.width=targetWidth+"%";
    };

    const animate=now=>{
      const delta=Math.min(40,now-lastTime);
      lastTime=now;
      needle+=direction*speed*delta;
      if(needle>=100){needle=100;direction=-1}
      if(needle<=0){needle=0;direction=1}
      needleNode.style.left=needle+"%";
      raf=requestAnimationFrame(animate);
    };

    const unlock=()=>{
      const distance=Math.abs(needle-targetCenter);
      const half=targetWidth/2;
      const accuracy=clamp(1-distance/Math.max(half,1),0,1);
      this.score+=accuracy>0?800+accuracy*1100:150;
      scoreNode.textContent=Math.round(this.score);
      level++;
      if(level>5){
        this.finish({game:"vault"});
        return;
      }
      targetWidth=Math.max(9,targetWidth-3.5);
      targetCenter=20+random()*60;
      speed+=0.012;
      levelNode.textContent=level+"/5";
      layoutTarget();
    };

    button.addEventListener("click",unlock);
    this.cleanupFns.push(()=>button.removeEventListener("click",unlock));
    this.cleanupFns.push(()=>cancelAnimationFrame(raf));
    layoutTarget();
    raf=requestAnimationFrame(animate);
  }

  startTower(session){
    let layer=1;
    let baseCenter=50;
    let baseWidth=76;
    let movingCenter=12;
    let direction=1;
    let speed=0.065;
    let lastTime=performance.now();
    let raf=0;

    this.arena.innerHTML=
      '<div class="tower-game">'+
        '<div class="tower-stage" data-tower-stage><div class="tower-base" data-tower-base></div><div class="tower-moving" data-tower-moving></div></div>'+
        '<div class="tower-meta"><span>樓層 <b data-tower-level>1/8</b></span><span>分數 <b data-tower-score>0</b></span></div>'+
        '<button type="button" class="tower-drop" data-tower-drop>落下樓層</button>'+
      '</div>';

    const base=this.arena.querySelector("[data-tower-base]");
    const moving=this.arena.querySelector("[data-tower-moving]");
    const levelNode=this.arena.querySelector("[data-tower-level]");
    const scoreNode=this.arena.querySelector("[data-tower-score]");
    const button=this.arena.querySelector("[data-tower-drop]");

    const renderBlocks=()=>{
      base.style.width=baseWidth+"%";
      base.style.left=(baseCenter-baseWidth/2)+"%";
      moving.style.width=baseWidth+"%";
      moving.style.left=(movingCenter-baseWidth/2)+"%";
    };

    const animate=now=>{
      const delta=Math.min(40,now-lastTime);
      lastTime=now;
      movingCenter+=direction*speed*delta;
      const half=baseWidth/2;
      if(movingCenter+half>=100){movingCenter=100-half;direction=-1}
      if(movingCenter-half<=0){movingCenter=half;direction=1}
      moving.style.left=(movingCenter-half)+"%";
      raf=requestAnimationFrame(animate);
    };

    const drop=()=>{
      const left=Math.max(baseCenter-baseWidth/2,movingCenter-baseWidth/2);
      const right=Math.min(baseCenter+baseWidth/2,movingCenter+baseWidth/2);
      const overlap=Math.max(0,right-left);
      if(overlap<=1){
        this.finish({game:"tower",collapsed:true,levels:layer-1});
        return;
      }
      const ratio=overlap/baseWidth;
      this.score+=550+ratio*650;
      baseWidth=overlap;
      baseCenter=(left+right)/2;
      movingCenter=direction>0?baseWidth/2:100-baseWidth/2;
      speed+=0.009;
      layer++;
      scoreNode.textContent=Math.round(this.score);
      if(layer>8){
        this.finish({game:"tower",levels:8});
        return;
      }
      levelNode.textContent=layer+"/8";
      renderBlocks();
    };

    button.addEventListener("click",drop);
    this.cleanupFns.push(()=>button.removeEventListener("click",drop));
    this.cleanupFns.push(()=>cancelAnimationFrame(raf));
    renderBlocks();
    raf=requestAnimationFrame(animate);
  }

  startMemory(session){
    const symbols=["🏦","🏠","📈","💰","🚇","📄","💎","🛡️"];
    const random=rng(session.seed);
    const sequence=Array.from({length:7},()=>Math.floor(random()*symbols.length));
    let index=0;
    let revealed=true;

    this.arena.innerHTML=
      '<div class="memory-game">'+
        '<div class="memory-sequence" data-memory-sequence></div>'+
        '<div class="memory-status" data-memory-status>記住順序…</div>'+
        '<div class="memory-grid" data-memory-grid></div>'+
      '</div>';

    const sequenceNode=this.arena.querySelector("[data-memory-sequence]");
    const statusNode=this.arena.querySelector("[data-memory-status]");
    const grid=this.arena.querySelector("[data-memory-grid]");
    sequenceNode.innerHTML=sequence.map(value=>'<span>'+symbols[value]+'</span>').join("");
    grid.innerHTML=symbols.map((symbol,i)=>'<button type="button" data-memory-choice="'+i+'" disabled>'+symbol+'</button>').join("");

    const beginInput=setTimeout(()=>{
      revealed=false;
      sequenceNode.innerHTML=sequence.map(()=>'<span>?</span>').join("");
      grid.querySelectorAll("button").forEach(button=>button.disabled=false);
      statusNode.textContent="依照剛才順序選擇";
    },3200);
    this.cleanupFns.push(()=>clearTimeout(beginInput));

    const choose=event=>{
      if(revealed||this.finished)return;
      const choice=Number(event.currentTarget.dataset.memoryChoice);
      if(choice===sequence[index]){
        this.score+=1200;
        sequenceNode.children[index].textContent=symbols[choice];
        index++;
        statusNode.textContent="正確 "+index+"/"+sequence.length+"｜"+Math.round(this.score)+" 分";
        if(index>=sequence.length){
          this.finish({game:"memory",correct:index});
        }
      }else{
        this.score=Math.max(0,this.score-280);
        statusNode.textContent="錯誤，請繼續｜"+Math.round(this.score)+" 分";
      }
    };

    grid.querySelectorAll("button").forEach(button=>{
      button.addEventListener("click",choose);
      this.cleanupFns.push(()=>button.removeEventListener("click",choose));
    });
  }

  startRoute(session){
    const random=rng(session.seed);
    const size=5;
    const costs=Array.from({length:size*size},(_,index)=>{
      if(index===0||index===size*size-1)return 0;
      return 1+Math.floor(random()*8);
    });
    let row=0;
    let col=0;
    let routeCost=0;
    const visited=new Set(["0:0"]);
    const started=performance.now();

    const optimal=Array.from({length:size},()=>Array(size).fill(Infinity));
    optimal[0][0]=0;
    for(let r=0;r<size;r++){
      for(let c=0;c<size;c++){
        if(r===0&&c===0)continue;
        const index=r*size+c;
        const fromTop=r>0?optimal[r-1][c]:Infinity;
        const fromLeft=c>0?optimal[r][c-1]:Infinity;
        optimal[r][c]=Math.min(fromTop,fromLeft)+costs[index];
      }
    }
    const bestCost=optimal[size-1][size-1];

    this.arena.innerHTML=
      '<div class="route-game">'+
        '<div class="route-meta"><span>目前成本 <b data-route-cost>0</b></span><span>目標：右下角</span></div>'+
        '<div class="route-grid" data-route-grid></div>'+
        '<div class="route-help">只能往右或往下選擇相鄰道路；數字越小成本越低。</div>'+
      '</div>';

    const grid=this.arena.querySelector("[data-route-grid]");
    const costNode=this.arena.querySelector("[data-route-cost]");
    grid.innerHTML=costs.map((cost,index)=>{
      const r=Math.floor(index/size);
      const c=index%size;
      const label=index===0?"起":index===size*size-1?"終":cost;
      return '<button type="button" data-route-cell="'+r+":"+c+'" '+(index===0?"disabled":"")+'>'+label+'</button>';
    }).join("");

    const updateGrid=()=>{
      grid.querySelectorAll("button").forEach(button=>{
        const [r,c]=button.dataset.routeCell.split(":").map(Number);
        const key=r+":"+c;
        button.classList.toggle("selected",visited.has(key));
        const allowed=(r===row&&c===col+1)||(r===row+1&&c===col);
        button.disabled=visited.has(key)||!allowed;
      });
    };

    const choose=event=>{
      const [nextRow,nextCol]=event.currentTarget.dataset.routeCell.split(":").map(Number);
      row=nextRow;
      col=nextCol;
      routeCost+=costs[row*size+col];
      visited.add(row+":"+col);
      costNode.textContent=routeCost;
      if(row===size-1&&col===size-1){
        const elapsed=(performance.now()-started)/1000;
        const penalty=Math.max(0,routeCost-bestCost)*500+elapsed*18;
        this.score=clamp(9500-penalty,500,9500);
        this.finish({game:"route",routeCost,bestCost});
        return;
      }
      updateGrid();
    };

    grid.querySelectorAll("button").forEach(button=>{
      button.addEventListener("click",choose);
      this.cleanupFns.push(()=>button.removeEventListener("click",choose));
    });
    updateGrid();
  }

  startDistrict(session){
    const random=rng(session.seed);
    const scenarios=[
      {name:"捷運新線開通",weights:[1.0,-0.7,1.5,1.2]},
      {name:"大型企業進駐",weights:[1.2,-0.5,0.8,1.6]},
      {name:"觀光活動爆發",weights:[1.5,-0.6,1.0,1.0]}
    ];
    let round=0;
    let total=0;

    this.arena.innerHTML=
      '<div class="district-game">'+
        '<div class="district-round" data-district-round></div>'+
        '<div class="district-options" data-district-options></div>'+
        '<div class="district-score">累計分數 <b data-district-score>0</b></div>'+
      '</div>';

    const roundNode=this.arena.querySelector("[data-district-round]");
    const optionsNode=this.arena.querySelector("[data-district-options]");
    const scoreNode=this.arena.querySelector("[data-district-score]");

    const buildRound=()=>{
      if(round>=3){
        this.score=total;
        this.finish({game:"district"});
        return;
      }
      const scenario=scenarios[round];
      const options=Array.from({length:4},(_,i)=>{
        const stats=[
          35+Math.floor(random()*65),
          25+Math.floor(random()*70),
          30+Math.floor(random()*70),
          30+Math.floor(random()*70)
        ];
        const value=
          stats[0]*scenario.weights[0]+
          stats[1]*scenario.weights[1]+
          stats[2]*scenario.weights[2]+
          stats[3]*scenario.weights[3];
        return{id:i,stats,value};
      });
      const best=Math.max(...options.map(option=>option.value));
      roundNode.innerHTML='<strong>第 '+(round+1)+'/3 輪｜'+scenario.name+'</strong><span>依條件挑選最值得投資的商圈</span>';
      optionsNode.innerHTML=options.map(option=>
        '<button type="button" data-district-id="'+option.id+'">'+
          '<strong>商圈 '+String.fromCharCode(65+option.id)+'</strong>'+
          '<span>人流 '+option.stats[0]+'</span>'+
          '<span>租金 '+option.stats[1]+'</span>'+
          '<span>交通 '+option.stats[2]+'</span>'+
          '<span>成長 '+option.stats[3]+'</span>'+
        '</button>'
      ).join("");

      const choose=event=>{
        const option=options[Number(event.currentTarget.dataset.districtId)];
        const ratio=clamp(option.value/Math.max(1,best),0,1);
        total+=Math.round(1400+ratio*1600);
        round++;
        scoreNode.textContent=total;
        buildRound();
      };

      optionsNode.querySelectorAll("button").forEach(button=>{
        button.addEventListener("click",choose,{once:true});
      });
    };

    buildRound();
  }
}
