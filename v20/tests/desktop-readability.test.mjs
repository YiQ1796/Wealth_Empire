import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const stock=readFileSync(new URL("../js/ui/stock-render.js",import.meta.url),"utf8");
const render=readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");

assert.match(html,/財富帝國 V20 Alpha 32\.3\.8/);
assert.match(html,/app\.css\?v=alpha32-229/);
assert.match(html,/main\.js\?v=alpha32-229/);
assert.match(main,/\.\/ui\/stock-render\.js\?v=alpha32-229/);
assert.match(main,/\.\/core\/game\.js\?v=alpha32-229/);

assert.match(stock,/const desktopTradeSurface=/);
assert.match(stock,/stock-market-grid--desktop-popup/);
assert.match(stock,/\(desktopTradeSurface\|\|state\.currentPlayer===localSeat\)/);
assert.match(stock,/const cardsPerRow=desktopTradeSurface\?1:2/);

const desktopMarker="/* V20 Alpha 32.3.4 — desktop-only readability pass. Phone/mobile authority remains unchanged. */";
const desktopStart=css.indexOf(desktopMarker);
assert.ok(desktopStart>=0,"desktop readability marker missing");
const desktopBlock=css.slice(desktopStart);
assert.match(desktopBlock,/@media \(min-width:1181px\)/);


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
assert.match(main,/\.\/ui\/render\.js\?v=alpha32-229/);

const rankingMarker="/* V20 Alpha 32.3.7 — desktop wealth ranking + forced-acquisition visibility. */";
const rankingStart=css.indexOf(rankingMarker);
assert.ok(rankingStart>=0,"desktop wealth ranking marker missing");
const rankingBlock=css.slice(rankingStart);
assert.match(rankingBlock,/\.player-rank-badge--1\{/);
assert.match(rankingBlock,/\.player-wealth\{/);
assert.match(rankingBlock,/\.players::before\{[\s\S]*?即時總資產排名/);
assert.match(render,/playerAssetRankings/);

const marketPopupMarker="/* V20 Alpha 32.3.8 — desktop market moves to a popup; player cards share the freed HUD space. */";
const marketPopupStart=css.indexOf(marketPopupMarker);
assert.ok(marketPopupStart>=0,"desktop market popup marker missing");
const marketPopupBlock=css.slice(marketPopupStart);
assert.match(html,/id="stockMarketDesktopGrid"/);
assert.doesNotMatch(html,/class="desktop-stock-panel"/);
assert.match(html,/id="desktopMarketButton"[\s\S]*?data-feature="market"/);
assert.match(marketPopupBlock,/\.players\{[\s\S]*?grid-template-rows:auto repeat\(4,minmax\(0,1fr\)\)/);
assert.match(html,/class="feature-tabs feature-tabs--secondary desktop-command-dock"/);
assert.match(html,/我的房產[\s\S]*?道具[\s\S]*?資訊[\s\S]*?id="rollButton"[\s\S]*?id="desktopEndTurnButton"/);
assert.doesNotMatch(html,/desktop-command-dock[\s\S]{0,900}feature-tab--market/);
assert.match(css,/\.desktop-command-dock\{[\s\S]*?grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
assert.match(css,/desktop-command-dock__feature:nth-of-type\(1\),[\s\S]*?grid-column:span 2/);
assert.match(css,/\.desktop-command-dock #rollButton,[\s\S]*?#desktopEndTurnButton\{[\s\S]*?grid-column:span 3/);
assert.match(render,/player-card__details/);
assert.match(render,/所在地/);
assert.match(render,/持股/);
assert.match(render,/完整連區/);
assert.match(marketPopupBlock,/\.stock-market-grid--desktop-popup \.stock-pair-row\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
assert.match(marketPopupBlock,/\.stock-market-grid--desktop-popup \.stock-trade-controls input\{[\s\S]*?font-size:20px/);

console.log("V20 Alpha32.3.8 desktop-only readability regression PASS");
