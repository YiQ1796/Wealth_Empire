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

export function chooseMinigame(state){
  const recent=new Set((state.minigameHistory??[]).slice(-RECENT_LIMIT));
  const available=MINIGAME_DEFINITIONS.filter(game=>!recent.has(game.id));
  const pool=available.length?available:MINIGAME_DEFINITIONS;
  const random=rng(hash((state.round??1)+":"+(state.nextEventId??1)+":"+(state.turnToken??0)));
  return pool[Math.floor(random()*pool.length)];
}

export function startMinigame(state,triggerSeat,now=Date.now()){
  const game=chooseMinigame(state);
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
  state.minigameHistory=[...(state.minigameHistory??[]),game.id].slice(-12);
  return state.minigame;
}

export function submitMinigameResult(state,seat,result){
  const session=state.minigame;
  if(!session||session.status!=="playing")return{ok:false,reason:"inactive"};
  const player=state.players?.[seat];
  if(!player||player.bankrupt)return{ok:false,reason:"player"};

  const score=Math.max(0,Math.min(RESULT_MAX,Math.round(Number(result?.score)||0)));
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

export function createAiMinigameResult(state,seat){
  const session=state.minigame;
  const player=state.players[seat];
  const random=rng(hash(session.seed+":"+seat+":"+session.id));
  const skill=aiSkill(player);

  // Luck is the dominant factor now. AI profile only nudges the result slightly,
  // so minigames feel like Monopoly-style chance events instead of a hidden skill check.
  const luck=random();
  const swing=(random()-0.5)*900;
  const skillBonus=(skill-0.70)*1500;
  const gameBias={
    courier:80,
    vault:0,
    tower:40,
    memory:-20,
    route:60,
    district:100
  }[session.id]??0;
  const score=Math.max(
    1800,
    Math.min(9800,Math.round(2600+luck*6400+swing+skillBonus+gameBias))
  );

  return{
    score,
    detail:{ai:true,profile:player.aiProfile??"balanced",luck:Math.round(luck*100)}
  };
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
      submitMinigameResult(state,seat,{score:2500,detail:{timeout:true}});
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
