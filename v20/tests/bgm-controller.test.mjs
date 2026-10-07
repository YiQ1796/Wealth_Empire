import{readFileSync}from"node:fs";
import assert from"node:assert/strict";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");

assert.match(html,/財富帝國 V20 Alpha 32\.3\.13/);
assert.match(html,/app\.css\?v=alpha32-234/);
assert.match(html,/main\.js\?v=alpha32-234/);

assert.doesNotMatch(html,/desktopBgmControls/);
assert.doesNotMatch(html,/bgmMuteButton/);
assert.doesNotMatch(html,/bgmVolumeSlider/);
assert.doesNotMatch(html,/巷仔口的風/);
assert.doesNotMatch(main,/initBgmController/);
assert.doesNotMatch(main,/bgm-controller\.js/);

console.log("V20 Alpha32.3.13 BGM disabled regression PASS");
