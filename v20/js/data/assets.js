export const CENTER_BACKGROUND="./assets/board/center-bg.webp";

// Alpha 14 的完整格素材已把固定名稱與構圖畫進圖片。
// Alpha 15 改為 44 格後，只有「名稱相同 + 橫直方向相同」才可沿用，
// 否則使用單一文字 fallback，避免把錯誤方向的舊完整格硬拉伸到新位置。
export const TILE_ART_BY_NAME=Object.freeze({
  "起點":{path:"./assets/tiles-v2/TILE_01.webp",orientation:"horizontal"},
  "星港住宅":{path:"./assets/tiles-v2/TILE_02.webp",orientation:"horizontal"},
  "海灣公寓":{path:"./assets/tiles-v2/TILE_03.webp",orientation:"horizontal"},
  "水岸別墅":{path:"./assets/tiles-v2/TILE_04.webp",orientation:"horizontal"},
  "海天御苑":{path:"./assets/tiles-v2/TILE_05.webp",orientation:"horizontal"},
  "翡翠商圈":{path:"./assets/tiles-v2/TILE_07.webp",orientation:"horizontal"},
  "黃金商圈":{path:"./assets/tiles-v2/TILE_08.webp",orientation:"horizontal"},
  "百貨商場":{path:"./assets/tiles-v2/TILE_09.webp",orientation:"horizontal"},
  "影城":{path:"./assets/tiles-v2/TILE_10.webp",orientation:"horizontal"},
  "機會":{path:"./assets/tiles-v2/TILE_11.webp",orientation:"horizontal"},
  "科技園區":{path:"./assets/tiles-v2/TILE_12.webp",orientation:"vertical"},
  "創新園區":{path:"./assets/tiles-v2/TILE_13.webp",orientation:"vertical"},
  "雲端科技城":{path:"./assets/tiles-v2/TILE_14.webp",orientation:"vertical"},
  "北城豪宅":{path:"./assets/tiles-v2/TILE_16.webp",orientation:"vertical"},
  "綠能園區":{path:"./assets/tiles-v2/TILE_17.webp",orientation:"vertical"},
  "湖畔豪宅":{path:"./assets/tiles-v2/TILE_18.webp",orientation:"vertical"},
  "命運":{path:"./assets/tiles-v2/TILE_19.webp",orientation:"horizontal"},
  "金融大道":{path:"./assets/tiles-v2/TILE_20.webp",orientation:"horizontal"},
  "商務中心":{path:"./assets/tiles-v2/TILE_21.webp",orientation:"horizontal"},
  "晶鑽商業區":{path:"./assets/tiles-v2/TILE_22.webp",orientation:"horizontal"},
  "山景莊園":{path:"./assets/tiles-v2/TILE_25.webp",orientation:"horizontal"},
  "天空豪宅":{path:"./assets/tiles-v2/TILE_26.webp",orientation:"horizontal"},
  "奢華莊園":{path:"./assets/tiles-v2/TILE_27.webp",orientation:"horizontal"},
  "頂級飯店":{path:"./assets/tiles-v2/TILE_28.webp",orientation:"horizontal"},
  "國際飯店":{path:"./assets/tiles-v2/TILE_30.webp",orientation:"vertical"},
  "世界中心":{path:"./assets/tiles-v2/TILE_32.webp",orientation:"vertical"},
  "皇后大道":{path:"./assets/tiles-v2/TILE_34.webp",orientation:"vertical"},
  "帝王商圈":{path:"./assets/tiles-v2/TILE_35.webp",orientation:"vertical"}
});
