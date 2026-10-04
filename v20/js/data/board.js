export const BOARD_VERSION="20.0.0-alpha.3";
export const MAX_ROUNDS=30;
const property=(number,name,group,price)=>({number,name,type:"property",group,price,rent:Math.round(price*0.14)});
const event=(number,name,type)=>({number,name,type});
export const BOARD_TILES=Object.freeze([
event(1,"起點","start"),
property(2,"星港住宅","海港區",2200),property(3,"海灣公寓","海港區",2460),property(4,"水岸別墅","海港區",2720),property(5,"海天御苑","海港區",2980),
event(6,"投資機遇","investment"),
property(7,"翡翠商圈","商業區",3240),property(8,"黃金商圈","商業區",3500),property(9,"百貨商場","商業區",3760),property(10,"影城","商業區",4020),
event(11,"機會廣場","chance"),
property(12,"科技園區","科技區",4280),property(13,"創新園區","科技區",4540),property(14,"雲端科技城","科技區",4800),
event(15,"市場風雲","market"),
property(16,"北城豪宅","住宅區",5060),property(17,"綠能園區","住宅區",5320),property(18,"湖畔豪宅","住宅區",5580),
event(19,"命運廣場","fate"),
property(20,"金融大道","金融區",5840),property(21,"商務中心","金融區",6100),property(22,"晶鑽商業區","金融區",6360),property(23,"國際金融城","金融區",6620),
event(24,"全民同樂","group"),
property(25,"山景莊園","豪宅區",6880),property(26,"天空豪宅","豪宅區",7140),property(27,"奢華莊園","豪宅區",7400),property(28,"頂級飯店","豪宅區",7660),
event(29,"娛樂廣場","entertainment"),
property(30,"國際飯店","觀光區",7920),property(31,"都會娛樂城","觀光區",8180),property(32,"世界中心","觀光區",8440),
event(33,"策略奇遇","strategy"),
property(34,"皇后大道","帝王區",8700),property(35,"帝王商圈","帝王區",8960),property(36,"帝國廣場","帝王區",9220)
]);
export const CORNER_INDEXES=Object.freeze([0,10,18,28]);
export const GROUP_SIZES=Object.freeze({"海港區":4,"商業區":4,"科技區":3,"住宅區":3,"金融區":4,"豪宅區":4,"觀光區":3,"帝王區":3});
export function boardPlacement(index){
  if(index<=10)return{row:1,col:index+1,orientation:"horizontal"};
  if(index<=17)return{row:index-9,col:11,orientation:"vertical"};
  if(index<=28)return{row:9,col:29-index,orientation:"horizontal"};
  return{row:37-index,col:1,orientation:"vertical"};
}
