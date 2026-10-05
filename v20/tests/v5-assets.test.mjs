import assert from"node:assert/strict";
import{V5_BADGES,V5_CHARACTERS,V5_HOUSES,V5_MODAL,V5_TILES}from"../js/data/v5-embedded-assets.js";
import{REGION_BADGES,UI_ASSETS,characterAsset,houseAsset,propertyHouseCount}from"../js/data/ui-assets.js";

function assertImageData(value,label){
  assert.equal(typeof value,"string",label+" must be a string");
  assert.ok(value.startsWith("data:image/webp;base64,"),label+" must use the V5 embedded WebP source");
  assert.ok(value.length>500,label+" must not be an empty placeholder");
}

assert.equal(Object.keys(V5_TILES).length,44,"V5 must contain exactly 44 board tiles");
for(let n=1;n<=44;n++)assertImageData(V5_TILES[n],"tile "+n);

assert.deepEqual(Object.keys(V5_HOUSES).sort(),["blue","green","purple","red"]);
for(const [key,value] of Object.entries(V5_HOUSES))assertImageData(value,"house "+key);

assert.deepEqual(Object.keys(V5_CHARACTERS).sort(),["blue","green","purple","red"]);
for(const [color,states] of Object.entries(V5_CHARACTERS)){
  assert.deepEqual(Object.keys(states).sort(),["idle","jump","walkA","walkB"]);
  for(const [state,value] of Object.entries(states))assertImageData(value,color+" "+state);
}

const requiredModal=[
  "close","empty_data","empty_holdings",
  "info_header","info_icon","items_header","items_icon",
  "property_header","property_icon","stock_header","stock_icon"
];
for(const key of requiredModal)assertImageData(V5_MODAL[key],"modal "+key);

const requiredBadges=[
  "ai","player","thinking","auto_fill",
  "region_bonus_25","property_max","no_acquisition",
  "region_harbor","region_commercial","region_tech","region_residential",
  "region_financial","region_tourism","region_luxury","region_imperial"
];
for(const key of requiredBadges)assertImageData(V5_BADGES[key],"badge "+key);

assert.equal(Object.keys(REGION_BADGES).length,8,"all 8 property regions need V5 badges");
assertImageData(UI_ASSETS.modal.close,"modal close source");
assertImageData(characterAsset(0,"walkA"),"blue walk A");
assertImageData(characterAsset(3,"jump"),"purple jump");
assertImageData(houseAsset(2),"green house");

assert.equal(propertyHouseCount({type:"property",owner:null,level:0}),0);
assert.equal(propertyHouseCount({type:"property",owner:0,level:0}),1);
assert.equal(propertyHouseCount({type:"property",owner:1,level:1}),2);
assert.equal(propertyHouseCount({type:"property",owner:2,level:2}),3);

console.log("V20 Alpha 18 V5 Batch01-09 asset gate PASS");
