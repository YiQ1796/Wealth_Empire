export const BOARD_VERSION="20.0.0-alpha.27";
export const MAX_ROUNDS=30;
export const MAX_PROPERTY_LEVEL=2;
export const PROPERTY_LEVEL_RENT_BONUS=0.65;
export const PROPERTY_UPGRADE_COST_RATE=0.5;

export const GROUP_ORDER=Object.freeze([
  "海港區","商業區","科技區","住宅區",
  "金融區","觀光區","豪宅區","帝王區"
]);

export const GROUP_SIZES=Object.freeze({
  "海港區":2,
  "商業區":4,
  "科技區":3,
  "住宅區":3,
  "金融區":3,
  "觀光區":3,
  "豪宅區":4,
  "帝王區":2
});

/*
  Completed-region rent multipliers are intentionally different:
  2-tile region = x1.25
  3-tile region = x1.50
  4-tile region = x2.00
*/
export const GROUP_RENT_MULTIPLIERS=Object.freeze({
  "海港區":1.25,
  "商業區":2.00,
  "科技區":1.50,
  "住宅區":1.50,
  "金融區":1.50,
  "觀光區":1.50,
  "豪宅區":2.00,
  "帝王區":1.25
});

const PROPERTY_BASE_PRICE=2200;
const PROPERTY_PRICE_STEP=260;

const property=(number,name,group,slot)=>{
  const price=PROPERTY_BASE_PRICE+slot*PROPERTY_PRICE_STEP;
  return{number,name,type:"property",group,price,rent:Math.round(price*0.14)};
};
const event=(number,name,type)=>({number,name,type});

export const BOARD_TILES=Object.freeze([
  event(1,"起點","start"),

  event(2,"機會","chance"),
  property(3,"星港住宅","海港區",0),
  property(4,"海灣公寓","海港區",1),
  event(5,"稅務局","tax"),
  event(6,"命運","fate"),
  property(7,"翡翠商圈","商業區",2),
  property(8,"黃金商圈","商業區",3),
  property(9,"百貨商場","商業區",4),
  property(10,"商務中心","商業區",5),
  event(11,"中央車站","station"),
  event(12,"機會","chance"),

  event(13,"高低骰對決","highlow"),

  event(14,"國際機場","station"),
  property(15,"科技園區","科技區",6),
  property(16,"創新園區","科技區",7),
  property(17,"雲端科技城","科技區",8),
  event(18,"收購中心","acquisition"),
  property(19,"水岸別墅","住宅區",9),
  property(20,"北城豪宅","住宅區",10),
  property(21,"綠能園區","住宅區",11),
  event(22,"財富賽馬場","horse"),

  event(23,"股市事件","market"),

  event(24,"命運","fate"),
  property(25,"金融大道","金融區",12),
  property(26,"晶鑽商業區","金融區",13),
  property(27,"世界中心","金融區",14),
  event(28,"法院","court"),
  event(29,"機會","chance"),
  property(30,"影城","觀光區",15),
  property(31,"國際飯店","觀光區",16),
  property(32,"頂級飯店","觀光區",17),
  event(33,"國際港口","station"),
  event(34,"地產拍賣行","auction"),

  event(35,"城市更新局","urban"),

  event(36,"命運","fate"),
  property(37,"湖畔豪宅","豪宅區",18),
  property(38,"山景莊園","豪宅區",19),
  property(39,"天空豪宅","豪宅區",20),
  property(40,"奢華莊園","豪宅區",21),
  event(41,"醫療中心","hospital"),
  property(42,"皇后大道","帝王區",22),
  property(43,"帝王商圈","帝王區",23),
  event(44,"跨海大橋","station")
]);

export const CORNER_INDEXES=Object.freeze([0,12,22,34]);

export function boardPlacement(index){
  if(index<=12)return{row:1,col:index+1,orientation:"horizontal"};
  if(index<=21)return{row:index-11,col:13,orientation:"vertical"};
  if(index<=34)return{row:11,col:35-index,orientation:"horizontal"};
  return{row:45-index,col:1,orientation:"vertical"};
}

export function groupTileIndexes(group){
  return BOARD_TILES
    .map((tile,index)=>({tile,index}))
    .filter(entry=>entry.tile.type==="property"&&entry.tile.group===group)
    .map(entry=>entry.index);
}

export function groupRentMultiplier(group){
  return GROUP_RENT_MULTIPLIERS[group]??1;
}

export function groupsAreContiguous(){
  return GROUP_ORDER.every(group=>{
    const indexes=groupTileIndexes(group);
    const expected=GROUP_SIZES[group]??indexes.length;
    return(
      indexes.length===expected&&
      indexes.every((index,offset)=>offset===0||index===indexes[offset-1]+1)
    );
  });
}

export function cornerTilesAreSpecial(){
  return CORNER_INDEXES.every(index=>BOARD_TILES[index]?.type!=="property");
}

export function duplicateAdjacentEventTypes(){
  const duplicates=[];
  for(let index=0;index<BOARD_TILES.length;index++){
    const current=BOARD_TILES[index];
    const next=BOARD_TILES[(index+1)%BOARD_TILES.length];
    if(
      current?.type!=="property"&&
      next?.type!=="property"&&
      current?.type===next?.type&&
      ["chance","fate"].includes(current.type)
    ){
      duplicates.push([index,(index+1)%BOARD_TILES.length,current.type]);
    }
  }
  return duplicates;
}
