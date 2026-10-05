import fs from"node:fs";
import assert from"node:assert/strict";

const ui=fs.readFileSync(new URL("../js/ui/minigame-ui.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");

assert.match(ui,/runContinuousRace\(\{/);
assert.match(ui,/requestAnimationFrame\(frame\)/);
assert.match(ui,/continuous:true/);

const horseStart=ui.indexOf("  runHorseRace(");
const horseEnd=ui.indexOf("  startSnail(",horseStart);
const snailStart=ui.indexOf("  runSnailRace(");
const snailEnd=ui.indexOf("  startTreasure(",snailStart);

assert.ok(horseStart>=0&&horseEnd>horseStart);
assert.ok(snailStart>=0&&snailEnd>snailStart);
assert.doesNotMatch(ui.slice(horseStart,horseEnd),/setInterval\(/,"horse race must not use stepwise interval movement");
assert.doesNotMatch(ui.slice(snailStart,snailEnd),/setInterval\(/,"snail race must not use stepwise interval movement");

for(const token of[
  'key:"sprint"',
  'key:"mud"',
  'key:"stumble"',
  'key:"cheer"',
  'key:"kick"',
  'key:"fall"',
  'key:"rocket"',
  'key:"heart"',
  'key:"fart"',
  'key:"oil"',
  'key:"slip"',
  'key:"treasure"',
  'key:"cheat"'
]){
  assert.ok(ui.includes(token),"missing race event "+token);
}

assert.match(css,/transition:none;\s*will-change:left,transform,filter/);
assert.match(css,/race-runner--fx-rocket/);
assert.match(css,/race-runner--fx-fart/);
assert.match(css,/race-runner--fx-stumble/);
assert.match(css,/@keyframes race-track-flow/);

console.log("V20 Alpha 26 continuous race animation test PASS");
