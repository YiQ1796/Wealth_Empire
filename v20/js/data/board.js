export const BOARD_VERSION="20.0.0-alpha.18";
export const MAX_ROUNDS=30;
export const MAX_PROPERTY_LEVEL=2;
export const COMPLETE_GROUP_RENT_BONUS=0.25;
export const PROPERTY_LEVEL_RENT_BONUS=0.65;
export const PROPERTY_UPGRADE_COST_RATE=0.5;

export const GROUP_ORDER=Object.freeze([
  "海港區","商業區","科技區","住宅區",
  "金融區","觀光區","豪宅區","帝王區"
]);
export const GROUP_SIZES=Object.freeze(Object.fromEntries(GROUP_ORDER.map(group=>[group,3])));

const property=(number,name,slot)=>{
  const group=GROUP_ORDER[Math.floor(slot/3)];
  const price=2200+slot*260;
  return{number,name,type:"property",group,price,rent:Math.round(price*0.14)};
};
const event=(number,name,type)=>({number,name,type});

export const BOARD_TILES=Object.freeze([
  event(1,"起點","start"),

  property(2,"星港住宅",0),
  property(3,"海灣公寓",1),
  property(4,"水岸別墅",2),
  event(5,"機會","chance"),
  event(6,"稅務局","tax"),

  property(7,"翡翠商圈",3),
  property(8,"黃金商圈",4),
  property(9,"百貨商場",5),
  event(10,"中央車站","station"),
  event(11,"機會","chance"),

  property(12,"科技園區",6),
  property(13,"創新園區",7),
  property(14,"雲端科技城",8),
  event(15,"國際機場","station"),
  event(16,"高低骰對決","highlow"),

  property(17,"北城豪宅",9),
  property(18,"綠能園區",10),
  property(19,"湖畔豪宅",11),
  event(20,"收購中心","acquisition"),
  event(21,"財富賽馬場","horse"),

  property(22,"金融大道",12),
  property(23,"商務中心",13),
  property(24,"晶鑽商業區",14),
  event(25,"股市事件","market"),
  event(26,"法院","court"),

  property(27,"影城",15),
  property(28,"國際飯店",16),
  property(29,"頂級飯店",17),
  event(30,"國際港口","station"),
  event(31,"醫療中心","hospital"),

  property(32,"山景莊園",18),
  property(33,"天空豪宅",19),
  property(34,"奢華莊園",20),
  event(35,"機會","chance"),
  event(36,"跨海大橋","station"),

  property(37,"皇后大道",21),
  property(38,"帝王商圈",22),
  property(39,"世界中心",23),
  event(40,"命運","fate"),
  event(41,"地產拍賣行","auction"),
  event(42,"城市更新局","urban"),
  event(43,"命運","fate"),
  event(44,"命運","fate")
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

export function groupsAreContiguous(){
  return GROUP_ORDER.every(group=>{
    const indexes=groupTileIndexes(group);
    return indexes.length===3&&indexes[1]===indexes[0]+1&&indexes[2]===indexes[1]+1;
  });
}
