import{MINIGAME_DEFINITIONS,MINIGAME_BY_ID}from"../data/minigames.js";

const RECENT_LIMIT=3;
const RESULT_MAX=10000;

function hash(value){
  let h=2166136261;
  const text=String(value);
  for(let i=0;i<text.length;i++){
    h^=text.charCodeAt(i);
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

function clampScore(value){
  return Math.max(0,Math.min(RESULT_MAX,Math.round(Number(value)||0)));
}

function scoreByPlacement(place,random){
  const base=[9000,7200,5400,3600][Math.max(0,Math.min(3,place-1))]??3000;
  return clampScore(base+Math.floor(random()*500));
}

export function chooseMinigame(state){
  const recent=new Set((state.minigameHistory??[]).slice(-RECENT_LIMIT));
  const available=MINIGAME_DEFINITIONS.filter(game=>!recent.has(game.id));
  const pool=available.length?available:MINIGAME_DEFINITIONS;
  const random=rng(hash((state.round??1)+":"+(state.nextEventId??1)+":"+(state.turnToken??0)));
  return pool[Math.floor(random()*pool.length)];
}

export function startMinigame(state,triggerSeat,now=Date.now(),forcedGameId=null){
  const forced=forcedGameId?MINIGAME_BY_ID[forcedGameId]:null;
  const game=forced??chooseMinigame(state);
  state.minigame={
    id:game.id,
    seed:hash(game.id+":"+state.round+":"+state.turnToken+":"+now),
    triggerSeat,
    startedAt:now,
    deadline:now+game.durationMs,
    status:"playing",
    results:{}
  };
  state.phase="minigame";
  state.minigameHistory=[...(state.minigameHistory??[]),game.id].slice(-16);
  return state.minigame;
}

export function submitMinigameResult(state,seat,result){
  const session=state.minigame;
  if(!session||session.status!=="playing")return{ok:false,reason:"inactive"};
  const player=state.players?.[seat];
  if(!player||player.bankrupt)return{ok:false,reason:"player"};

  const score=clampScore(result?.score);
  const detail=result?.detail&&typeof result.detail==="object"?result.detail:{};
  session.results[String(seat)]={score,detail,submittedAt:Date.now()};
  return{ok:true,score};
}

function aiSkill(player){
  const profile=player.aiProfile??"balanced";
  if(profile==="aggressive")return 0.78;
  if(profile==="cautious")return 0.72;
  return 0.75;
}

function aiHorseResult(random){
  const place=1+Math.floor(random()*4);
  return{score:scoreByPlacement(place,random),detail:{game:"horse",place,pick:1+Math.floor(random()*4)}};
}

function aiTreasureResult(random,skill){
  let bank=0;
  const targetOpens=2+Math.floor(random()*4);
  let trapped=false;
  for(let open=1;open<=targetOpens;open++){
    const trapChance=0.08+open*0.08-(skill-0.7)*0.18;
    if(random()<trapChance){
      trapped=true;
      bank=Math.max(900,Math.round(bank*0.35));
      break;
    }
    bank+=700+Math.floor(random()*1150);
  }
  return{score:clampScore(bank+1800),detail:{game:"treasure",opens:targetOpens,trapped}};
}

function aiRpsResult(random){
  let wins=0;
  let losses=0;
  let ties=0;
  for(let round=0;round<3;round++){
    const outcome=Math.floor(random()*3);
    if(outcome===0)wins++;
    else if(outcome===1)ties++;
    else losses++;
  }
  return{score:clampScore(1800+wins*2500+ties*1200),detail:{game:"rps",wins,losses,ties}};
}

function aiBlackjackResult(random,skill){
  const player=15+Math.floor(random()*8);
  const dealer=16+Math.floor(random()*7);
  const bust=player>21;
  const dealerBust=dealer>21;
  const win=!bust&&(dealerBust||player>dealer);
  const tie=!bust&&!dealerBust&&player===dealer;
  const score=win?9000:tie?5600:bust?1800:3000+Math.round((skill-0.7)*1800);
  return{score:clampScore(score),detail:{game:"blackjack",player,dealer,bust}};
}

function aiPlinkoResult(random){
  const multipliers=[0.5,1,2,5,10,5,2,1,0.5];
  const slot=Math.floor(random()*multipliers.length);
  const multiplier=multipliers[slot];
  return{score:clampScore(1200+multiplier*850),detail:{game:"plinko",slot,multiplier}};
}

function aiAuctionResult(random,skill){
  const value=1800+Math.floor(random()*4201);
  const bid=Math.round(value*(0.55+random()*0.6));
  const rivalTop=Math.round(value*(0.6+random()*0.55));
  const won=bid>=rivalTop;
  const profit=won?value-bid:0;
  const score=won
    ? 5200+profit*0.8+Math.max(0,(skill-0.7)*1500)
    : 2600+Math.max(0,value-bid)*0.15;
  return{score:clampScore(score),detail:{game:"auction",value,bid,rivalTop,won}};
}

function aiSnailResult(random){
  const place=1+Math.floor(random()*4);
  const eventCount=2+Math.floor(random()*5);
  return{score:scoreByPlacement(place,random),detail:{game:"snail",place,pick:1+Math.floor(random()*4),eventCount}};
}

export function createAiMinigameResult(state,seat){
  const session=state.minigame;
  const player=state.players[seat];
  const random=rng(hash(session.seed+":"+seat+":"+session.id));
  const skill=aiSkill(player);

  const resolvers={
    horse:()=>aiHorseResult(random),
    treasure:()=>aiTreasureResult(random,skill),
    rps:()=>aiRpsResult(random),
    blackjack:()=>aiBlackjackResult(random,skill),
    plinko:()=>aiPlinkoResult(random),
    auction:()=>aiAuctionResult(random,skill),
    snail:()=>aiSnailResult(random)
  };
  return(resolvers[session.id]??(()=>({score:5000,detail:{game:session.id}})))();
}

export function fillAiMinigameResults(state){
  if(!state.minigame||state.minigame.status!=="playing")return;
  for(const player of state.players){
    if(player.bankrupt||player.kind!=="ai")continue;
    const key=String(player.seat);
    if(!state.minigame.results[key]){
      submitMinigameResult(state,player.seat,createAiMinigameResult(state,player.seat));
    }
  }
}

export function pendingHumanSeats(state){
  if(!state.minigame||state.minigame.status!=="playing")return[];
  return state.players
    .filter(player=>!player.bankrupt&&player.kind==="human"&&!state.minigame.results[String(player.seat)])
    .map(player=>player.seat);
}

export function canFinalizeMinigame(state,now=Date.now()){
  const session=state.minigame;
  if(!session||session.status!=="playing")return false;
  return pendingHumanSeats(state).length===0||now>=session.deadline;
}

export function finalizeMinigame(state,now=Date.now()){
  const session=state.minigame;
  if(!session||session.status!=="playing")return null;

  fillAiMinigameResults(state);
  if(now>=session.deadline){
    for(const seat of pendingHumanSeats(state)){
      submitMinigameResult(state,seat,{score:2500,detail:{timeout:true,game:session.id}});
    }
  }
  if(!canFinalizeMinigame(state,now))return null;

  const entries=state.players
    .filter(player=>!player.bankrupt)
    .map(player=>({
      seat:player.seat,
      score:session.results[String(player.seat)]?.score??0
    }))
    .sort((a,b)=>b.score-a.score||a.seat-b.seat);

  const baseReward=Math.round(900+Math.max(0,(state.round??1)-1)*75);
  const multipliers=[1.8,1.3,1.0,0.7];
  const rankings=entries.map((entry,index)=>{
    const reward=Math.round(baseReward*(multipliers[index]??0.5));
    state.players[entry.seat].cash+=reward;
    return{...entry,rank:index+1,reward};
  });

  session.status="completed";
  session.completedAt=now;
  session.rankings=rankings;
  state.lastMinigame={
    id:session.id,
    rankings,
    completedAt:now
  };
  state.phase="landed";
  return{
    game:MINIGAME_BY_ID[session.id],
    rankings
  };
}

export function minigameDefinition(gameId){
  return MINIGAME_BY_ID[gameId]??null;
}
