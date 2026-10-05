export const CENTER_BACKGROUND="./assets/board/center-bg.webp";

const V5_ROOT="./assets/v5";

// The visual order follows the gameplay board order. Each number points to the
// original delivered TILE_XX artwork so names/icons still match after regrouping.
const TILE_ART_ORDER=Object.freeze([
  1,
  2,4,6,3,5,
  8,10,12,7,15,
  14,16,18,13,11,
  19,21,22,17,20,
  24,26,28,23,25,
  30,32,34,29,31,
  36,38,40,33,35,
  41,43,44,9,39,42,27,37
]);

export const TILE_ART_BY_INDEX=Object.freeze(
  TILE_ART_ORDER.map(tileNumber=>
    V5_ROOT+"/tiles/TILE_"+String(tileNumber).padStart(2,"0")+".webp"
  )
);

export const V5_ROOT_PATH=V5_ROOT;
