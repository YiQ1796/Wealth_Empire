import fs from"node:fs";
import assert from"node:assert/strict";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const render=fs.readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");

assert.match(html,/class="mobile-primary-actions"/);
assert.match(html,/id="mobileRollButton"/);
assert.match(html,/data-feature="market"/);
assert.match(html,/id="stockMarketMobileGrid"/);
assert.match(html,/app\.css\?v=alpha19-197/);
assert.match(html,/main\.js\?v=alpha19-197/);

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
