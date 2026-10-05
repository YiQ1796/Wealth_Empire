import fs from"node:fs";
import assert from"node:assert/strict";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const render=fs.readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("../js/ui/minigame-ui.js",import.meta.url),"utf8");

assert.match(html,/class="mobile-primary-actions"/);
assert.match(html,/id="mobileRollButton"/);
assert.match(html,/data-feature="market"/);
assert.match(html,/id="stockMarketMobileGrid"/);
assert.match(html,/app\.css\?v=alpha25-203/);
assert.match(html,/main\.js\?v=alpha25-203/);

assert.match(css,/V20 Alpha 19 — phone landscape authority/);
assert.match(css,/@media \(orientation:landscape\) and \(max-height:650px\) and \(max-width:1180px\)/);
assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(250px,29vw,300px\)/);
assert.match(css,/\.desktop-stock-panel\{\s*display:none/);
assert.match(css,/\.mobile-primary-actions\{[\s\S]*?display:grid/);
assert.match(css,/env\(safe-area-inset-left\)/);
assert.match(css,/\.entry-gate\{[\s\S]*?overflow:auto/);

assert.match(main,/stockMarketMobileGrid/);
assert.match(main,/market:\["市場操作"/);
assert.match(main,/mobileRollButton/);
assert.match(render,/mobileRollButton\.disabled=rollDisabled/);

console.log("V20 Alpha19 mobile responsive static regression PASS");

assert.match(main,/orientation:landscape.*max-height:650px.*max-width:1180px.*max-width:760px/);
assert.match(css,/Alpha 19 mobile notification correction/);
assert.match(css,/width:min\(68%,560px\)/);
assert.match(css,/grid-template-columns:48px minmax\(0,1fr\) 78px/);

assert.match(css,/V20 Alpha 19 mobile pass 2/);
assert.match(css,/grid-template-rows:auto auto auto/);
assert.match(css,/width:min\(58%,460px\)/);
assert.match(css,/grid-template-columns:42px minmax\(0,1fr\) 68px/);

assert.match(css,/V20 Alpha 21 — first-entry iPhone landscape stabilization/);
assert.match(css,/height:100lvh/);
assert.match(css,/\.tile__tokens:has\(\.pawn-token:nth-child\(3\)\)/);
assert.match(main,/function settlePhoneLandscapeLayout/);
assert.match(main,/visualViewport\?\.addEventListener\("resize",settlePhoneLandscapeLayout\)/);
assert.match(main,/if\(!visible\)settlePhoneLandscapeLayout\(\)/);

assert.match(css,/V20 Alpha 22 — mobile-only pawn, houses and HUD fill/);
assert.match(css,/\.tile__tokens\{[\s\S]*?top:42%/);
assert.match(css,/\.tile__tokens \.pawn-token\{[\s\S]*?width:22px/);
assert.match(css,/grid-template-columns:repeat\(2,15px\)/);
assert.match(css,/\.property-house\{[\s\S]*?width:13px/);
assert.match(css,/\.tile__houses\{[\s\S]*?height:14px/);
assert.match(css,/\.hud-panel\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\) auto/);
assert.match(css,/\.players\{[\s\S]*?grid-template-rows:repeat\(4,minmax\(0,1fr\)\)/);

assert.match(css,/V20 Alpha 23 — mobile scroll and viewport authority/);
assert.match(css,/height:var\(--phone-app-height,100dvh\)/);
assert.match(css,/\.minigame-modal\{[\s\S]*?overflow-y:scroll/);
assert.match(css,/-webkit-overflow-scrolling:touch/);
assert.match(css,/touch-action:pan-y/);
assert.match(main,/function syncPhoneViewportHeight/);
assert.match(main,/--phone-app-height/);
assert.match(main,/\[80,180,350,650,1000\]/);
assert.match(main,/visualViewport\?\.addEventListener\("scroll",syncPhoneViewportHeight\)/);
assert.match(ui,/resetScrollPosition\(\)/);
assert.match(ui,/modal\.scrollTop=0/);
assert.match(html,/id="transportDialog"/);
assert.match(css,/V20 Alpha 25 — functional transport system/);
assert.match(css,/\.transport-destinations\{/);
