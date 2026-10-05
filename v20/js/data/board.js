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
  event(3,"機會","chance"),
  property(4,"海灣公寓",1),
  event(5,"稅務局","tax"),
  property(6,"水岸別墅",2),
  event(7,"中央車站","station"),
  property(8,"翡翠商圈",3),
  event(9,"命運","fate"),
  property(10,"黃金商圈",4),
  event(11,"高低骰對決","highlow"),
  property(12,"百貨商場",5),
  event(13,"國際機場","station"),
  property(14,"科技園區",6),
  event(15,"機會","chance"),
  property(16,"創新園區",7),
  event(17,"收購中心","acquisition"),
  property(18,"雲端科技城",8),
  property(19,"北城豪宅",9),
  event(20,"財富賽馬場","horse"),
  property(21,"綠能園區",10),
  property(22,"湖畔豪宅",11),
  event(23,"股市事件","market"),
  property(24,"金融大道",12),
  event(25,"法院","court"),
  property(26,"商務中心",13),
  event(27,"命運","fate"),
  property(28,"晶鑽商業區",14),
  event(29,"國際港口","station"),
  property(30,"影城",15),
  event(31,"醫療中心","hospital"),
  property(32,"國際飯店",16),
  event(33,"機會","chance"),
  property(34,"頂級飯店",17),
  event(35,"跨海大橋","station"),
  property(36,"山景莊園",18),
  event(37,"命運","fate"),
  property(38,"天空豪宅",19),
  event(39,"地產拍賣行","auction"),
  property(40,"奢華莊園",20),
  property(41,"皇后大道",21),
  event(42,"城市更新局","urban"),
  property(43,"帝王商圈",22),
  property(44,"世界中心",23)
]);

export const CORNER_INDEXES=Object.freeze([0,12,22,34]);

export function boardPlacement(index){
  if(index<=12)return{row:1,col:index+1,orientation:"horizontal"};
  if(index<=21)return{row:index-11,col:13,orientation:"vertical"};
  if(index<=34)return{row:11,col:35-index,orientation:"horizontal"};
  return{row:45-index,col:1,orientation:"vertical"};
}
