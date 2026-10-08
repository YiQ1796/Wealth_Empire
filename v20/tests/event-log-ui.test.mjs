import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const render=readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");

assert.doesNotMatch(html,/id="endTurnButton"/);
assert.doesNotMatch(html,/id="desktopEndTurnButton"/);
assert.match(html,/id="mobileEventLogButton"[\s\S]*?data-feature="info"[\s\S]*?事件紀錄/);
assert.match(html,/id="desktopMarketButton"[\s\S]*?data-feature="info"[\s\S]*?事件紀錄/);
assert.match(html,/id="desktopEventLogButton"[\s\S]*?data-feature="market"[\s\S]*?股票市場/);
assert.match(html,/data-feature="market"[\s\S]*?市場操作/);
assert.match(html,/data-feature-panel="info"[\s\S]*?<h3>事件紀錄<\/h3>/);
assert.match(main,/info:\["事件紀錄","查看每位玩家/);
assert.match(main,/\.\/ui\/render\.js\?v=alpha32-239/);
assert.doesNotMatch(main,/getElementById\("endTurnButton"\)\.addEventListener/);
assert.doesNotMatch(main,/desktopEndTurnButton/);
assert.match(render,/function eventActor\(state,event\)/);
assert.match(render,/ROUND /);
assert.match(render,/event-entry__actor/);
assert.match(render,/escapeHtml\(event\.text\)/);
assert.doesNotMatch(render,/getElementById\("endTurnButton"\)/);
assert.doesNotMatch(render,/desktopEndTurnButton/);
assert.match(css,/#desktopEventLogButton/);
assert.match(css,/#mobileEventLogButton/);
assert.doesNotMatch(css,/#desktopEndTurnButton/);
assert.doesNotMatch(css,/#endTurnButton/);

console.log("V20 desktop/mobile event history control regression PASS");
