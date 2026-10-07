import{propertyValue}from"./property-economy.js?v=alpha32-233";

function safeMoney(value){
  const number=Number(value);
  return Number.isFinite(number)?Math.max(0,number):0;
}

export function playerAssetBreakdown(state,playerOrSeat){
  const player=typeof playerOrSeat==="object"
    ?playerOrSeat
    :state?.players?.[Number(playerOrSeat)];
  if(!player){
    return{
      cash:0,
      properties:0,
      stocks:0,
      bankDeposit:0,
      total:0
    };
  }

  const cash=safeMoney(player.cash);
  const properties=(state?.tiles??[])
    .filter(tile=>tile?.type==="property"&&tile.owner===player.seat)
    .reduce((total,tile)=>total+safeMoney(propertyValue(tile)),0);

  const stocks=(state?.market?.stocks??[])
    .reduce((total,stock)=>{
      const shares=Math.max(0,Math.floor(Number(player.portfolio?.[stock.id]?.shares)||0));
      return total+shares*safeMoney(stock.price);
    },0);

  const bankDeposit=safeMoney(player.centralBankDeposit?.principal);
  const total=cash+properties+stocks+bankDeposit;

  return{
    cash:Math.round(cash),
    properties:Math.round(properties),
    stocks:Math.round(stocks),
    bankDeposit:Math.round(bankDeposit),
    total:Math.round(total)
  };
}

export function playerAssetRankings(state){
  return(state?.players??[])
    .map(player=>({
      seat:player.seat,
      player,
      assets:playerAssetBreakdown(state,player)
    }))
    .sort((left,right)=>
      right.assets.total-left.assets.total||
      right.assets.cash-left.assets.cash||
      left.seat-right.seat
    )
    .map((entry,index)=>({...entry,rank:index+1}));
}
