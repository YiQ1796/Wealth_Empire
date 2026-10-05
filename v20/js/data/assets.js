export const CENTER_BACKGROUND="./assets/board/center-bg.webp";

const V5_ROOT="./assets/v5";

export const TILE_ART_BY_INDEX=Object.freeze(
  Array.from({length:44},(_,index)=>
    V5_ROOT+"/tiles/TILE_"+String(index+1).padStart(2,"0")+".webp"
  )
);

export const V5_ROOT_PATH=V5_ROOT;
