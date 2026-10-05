export const CENTER_BACKGROUND="./assets/board/center-bg.webp";

const V5_ROOT="./assets/v5";

// Visual order is kept aligned with BOARD_TILES after the mixed-region redesign.
// Every delivered TILE_XX artwork is still used exactly once.
const TILE_ART_ORDER=Object.freeze([
  1,
  3,2,4,5,9,8,10,12,26,7,15,
  11,
  13,14,16,18,17,6,19,21,20,
  23,
  27,24,28,44,25,33,30,32,34,29,39,
  42,
  37,22,36,38,40,31,41,43,35
]);

export const TILE_ART_BY_INDEX=Object.freeze(
  TILE_ART_ORDER.map(tileNumber=>
    V5_ROOT+"/tiles/TILE_"+String(tileNumber).padStart(2,"0")+".webp"
  )
);

export const V5_ROOT_PATH=V5_ROOT;
