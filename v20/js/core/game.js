import{MAX_PROPERTY_LEVEL}from"../data/board.js";
import{ownsCompleteGroup,rentFor,upgradeCost}from"./property-economy.js";

export class GameEngine{
  constructor(state,onChange){
    this.state=state;
    this.onChange=onChange;
  }

  get currentPlayer(){return this.state.players[this.state.currentPlayer]}

  log(text,kind="info",data={}){
    this.state.events.unshift({
      id:this.state.nextEventId++,
      kind,
      text,
      data,
      round:this.state.round
    });
    this.state.events=this.state.events.slice(0,60);
  }

  notify(){if(this.onChange)this.onChange(this.state)}

  roll(){
    if(this.state.phase!=="await-roll")return false;
    const d1=1+Math.floor(Math.random()*6);
    const d2=1+Math.floor(Math.random()*6);
    const total=d1+d2;
    this.state.dice={d1,d2,total};

    const player=this.currentPlayer;
    const from=player.position;
    let passedStart=false;
    for(let i=0;i<total;i++){
      player.position=(player.position+1)%this.state.tiles.length;
      if(player.position===0)passedStart=true;
    }

    if(passedStart){
      player.cash+=2500;
      this.log(player.name+" 通過起點，獲得 $2,500。","cash",{seat:player.seat,amount:2500});
    }

    this.log(
      player.name+" 擲出 "+d1+" + "+d2+" = "+total+"，從第 "+(from+1)+" 格移動到第 "+(player.position+1)+" 格。",
      "move",
      {seat:player.seat,from,to:player.position,d1,d2,total}
    );
    this.resolveLanding(player);
    this.notify();
    return true;
  }

  resolveLanding(player){
    this.state.pendingPurchase=null;
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
        const rent=rentFor(this.state,tile);
        const paid=Math.min(player.cash,rent);
        player.cash-=paid;
        owner.cash+=paid;
        player.rentPaid+=paid;
        owner.rentReceived+=paid;
        this.log(
          player.name+" 支付「"+tile.name+"」過路費 "+this.formatMoney(paid)+" 給 "+owner.name+"。"+
          (ownsCompleteGroup(this.state,tile.owner,tile.group)?"（區域完成 +25%）":""),
          "rent",
          {payerSeat:player.seat,ownerSeat:owner.seat,tile:player.position,amount:paid,requested:rent,group:tile.group}
        );
        if(paid<rent){
          this.log(player.name+" 現金不足，實際支付可用現金 "+this.formatMoney(paid)+"。","warning",{seat:player.seat});
        }
      }else{
        this.log(player.name+" 回到自己的「"+tile.name+"」。","property_owned",{seat:player.seat,tile:player.position});
      }

      this.state.phase="landed";
      return;
    }

    this.state.phase="landed";
    const eventText={
      start:"回到起點。",
      tax:"抵達稅務局。",
      station:"抵達交通設施。",
      chance:"觸發機會事件池。",
      fate:"觸發命運事件池。",
      highlow:"觸發高低骰對決。",
      acquisition:"抵達收購中心。",
      horse:"觸發財富賽馬。",
      market:"觸發股市事件。",
      court:"抵達法院。",
      hospital:"抵達醫療中心。",
      auction:"抵達地產拍賣行。",
      urban:"抵達城市更新局。"
    }[tile.type]||"觸發特殊事件。";
    this.log(player.name+" 抵達「"+tile.name+"」："+eventText,"event",{seat:player.seat,tile:player.position,type:tile.type});
  }

  buyCurrentProperty(){
    const tileIndex=this.state.pendingPurchase;
    const player=this.currentPlayer;
    if(tileIndex==null){
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
      {seat:player.seat,tile:tileIndex,amount:tile.price,group:tile.group}
    );

    if(ownsCompleteGroup(this.state,player.seat,tile.group)){
      this.log(
        player.name+" 已完成「"+tile.group+"」3/3 地產，該區過路費永久提高 25%。",
        "group_complete",
        {seat:player.seat,group:tile.group}
      );
    }

    this.notify();
    return true;
  }

  declineCurrentProperty(){
    const tileIndex=this.state.pendingPurchase;
    if(tileIndex==null)return false;
    const tile=this.state.tiles[tileIndex];
    this.state.pendingPurchase=null;
    this.log(this.currentPlayer.name+" 放棄購買「"+tile.name+"」。","property_decline",{seat:this.currentPlayer.seat,tile:tileIndex});
    this.notify();
    return true;
  }

  upgradeProperty(tileIndex){
    const player=this.currentPlayer;
    const tile=this.state.tiles[Number(tileIndex)];
    const cost=tile?upgradeCost(tile):0;
    const validPhase=["await-roll","landed"].includes(this.state.phase)&&this.state.pendingPurchase==null;
    const canUpgrade=Boolean(
      validPhase&&
      tile&&
      tile.type==="property"&&
      tile.owner===player.seat&&
      tile.level<MAX_PROPERTY_LEVEL&&
      player.cash>=cost
    );

    if(!canUpgrade){
      this.log("目前無法升級這塊地產。","warning",{seat:player.seat,tile:Number(tileIndex)});
      this.notify();
      return false;
    }

    player.cash-=cost;
    tile.level+=1;
    this.log(
      player.name+" 花費 "+this.formatMoney(cost)+" 將「"+tile.name+"」升級至 LV."+tile.level+"，目前過路費 "+this.formatMoney(rentFor(this.state,tile))+"。",
      "property_upgrade",
      {seat:player.seat,tile:Number(tileIndex),level:tile.level,amount:cost}
    );
    this.notify();
    return true;
  }

  endTurn(){
    if(this.state.phase!=="landed"||this.state.pendingPurchase!=null)return false;
    this.state.currentPlayer=(this.state.currentPlayer+1)%this.state.players.length;
    if(this.state.currentPlayer===0)this.state.round=Math.min(this.state.maxRounds,this.state.round+1);
    this.state.dice=null;
    this.state.phase="await-roll";
    this.notify();
    return true;
  }

  formatMoney(value){return"$"+Math.round(value).toLocaleString()}
}
