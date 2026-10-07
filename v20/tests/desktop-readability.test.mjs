import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const stock=readFileSync(new URL("../js/ui/stock-render.js",import.meta.url),"utf8");
const render=readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");

assert.match(html,/財富帝國 V20 Alpha 32\.3\.7/);
assert.match(html,/app\.css\?v=alpha32-228/);
assert.match(html,/main\.js\?v=alpha32-228/);
assert.match(main,/\.\/ui\/stock-render\.js\?v=alpha32-225/);
assert.match(main,/\.\/core\/game\.js\?v=alpha32-228/);

assert.match(stock,/const desktopPersistent=container\.classList\.contains\("stock-market-grid--persistent"\)/);
assert.match(stock,/\(desktopPersistent\|\|state\.currentPlayer===localSeat\)/);
assert.match(stock,/const cardsPerRow=desktopPersistent\?1:2/);

const desktopMarker="/* V20 Alpha 32.3.4 — desktop-only readability pass. Phone/mobile authority remains unchanged. */";
const desktopStart=css.indexOf(desktopMarker);
assert.ok(desktopStart>=0,"desktop readability marker missing");
const desktopBlock=css.slice(desktopStart);
assert.match(desktopBlock,/@media \(min-width:1181px\)/);
assert.match(desktopBlock,/\.desktop-stock-panel \.stock-pair-row\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
assert.match(desktopBlock,/\.desktop-stock-panel \.stock-trade-controls input\{[\s\S]*?font-size:18px/);
assert.match(desktopBlock,/\.player-card h3\{[\s\S]*?font-size:17px/);
assert.match(desktopBlock,/\.central-feature-action small,[\s\S]*?font-size:11px/);
assert.match(desktopBlock,/#startRoomGameButton:not\(:disabled\)/);
assert.match(desktopBlock,/#leaveRoomButton:not\(:disabled\)/);

assert.match(css,/@media \(orientation:landscape\) and \(max-height:650px\) and \(max-width:1180px\)/);
assert.match(css,/\.stock-market-grid--mobile \.stock-pair-row\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);

const propertyMarker="/* V20 Alpha 32.3.5 — desktop property readability only; mobile remains unchanged. */";
const propertyStart=css.indexOf(propertyMarker);
assert.ok(propertyStart>=0,"desktop property readability marker missing");
const propertyBlock=css.slice(propertyStart);
assert.match(propertyBlock,/@media \(min-width:1181px\)/);
assert.match(propertyBlock,/\.property-event-card strong\{[\s\S]*?font-size:15px/);
assert.match(propertyBlock,/\.property-row__title strong\{[\s\S]*?font-size:15px/);
assert.match(propertyBlock,/\.property-row span,[\s\S]*?font-size:11px/);

const regionMarker="/* V20 Alpha 32.3.6 — desktop complete-region visibility; mobile layout remains unchanged. */";
const regionStart=css.indexOf(regionMarker);
assert.ok(regionStart>=0,"desktop complete-region marker missing");
const regionBlock=css.slice(regionStart);
assert.match(regionBlock,/\.tile\.tile--region-complete::before/);
assert.match(regionBlock,/content:"連區 " attr\(data-region-bonus\)/);
assert.match(regionBlock,/\.property-rent-breakdown\{/);
assert.match(main,/\.\/ui\/render\.js\?v=alpha32-228/);

const rankingMarker="/* V20 Alpha 32.3.7 — desktop wealth ranking + forced-acquisition visibility. */";
const rankingStart=css.indexOf(rankingMarker);
assert.ok(rankingStart>=0,"desktop wealth ranking marker missing");
const rankingBlock=css.slice(rankingStart);
assert.match(rankingBlock,/\.wealth-ranking-heading\{/);
assert.match(rankingBlock,/\.player-rank-badge--1\{/);
assert.match(rankingBlock,/\.player-wealth\{/);
assert.match(rankingBlock,/\.players::before\{[\s\S]*?即時總資產排名/);
assert.match(render,/playerAssetRankings/);

console.log("V20 Alpha32.3.7 desktop-only readability regression PASS");
