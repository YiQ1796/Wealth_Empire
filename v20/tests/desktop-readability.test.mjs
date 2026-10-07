import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const stock=readFileSync(new URL("../js/ui/stock-render.js",import.meta.url),"utf8");
const render=readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");

assert.match(html,/財富帝國 V20 Alpha 32\.3\.12/);
assert.match(html,/app\.css\?v=alpha32-233/);
assert.match(html,/main\.js\?v=alpha32-233/);
assert.match(main,/\.\/ui\/stock-render\.js\?v=alpha32-233/);
assert.match(main,/\.\/core\/game\.js\?v=alpha32-229/);

assert.match(stock,/const cardsPerRow=2/);
assert.doesNotMatch(stock,/currentPlayer===localSeat/);
assert.doesNotMatch(stock,/輪到你的回合時才能買賣股票/);

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
assert.match(main,/\.\/ui\/render\.js\?v=alpha32-230/);

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

const alpha329Marker="/* V20 Alpha 32.3.9 — desktop two-column market and readability/color pass. */";
const alpha329Start=css.indexOf(alpha329Marker);
assert.ok(alpha329Start>=0,"Alpha 32.3.9 desktop readability marker missing");
const alpha329Block=css.slice(alpha329Start);
assert.match(alpha329Block,/\.stock-market-grid--desktop-popup \.stock-pair-row\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(alpha329Block,/\.feature-modal__header h2\{[\s\S]*?font-size:30px/);
assert.match(alpha329Block,/\.central-facility-modal__title>h2\{[\s\S]*?font-size:32px/);
assert.match(alpha329Block,/\.player-card h3\{[\s\S]*?font-size:18px/);
assert.match(alpha329Block,/border-left:4px solid var\(--player-accent/);
assert.match(render,/--player-accent/);

const heldStockMarker="/* V20 Alpha 32.3.10 — desktop held-stock visibility. */";
const heldStockStart=css.indexOf(heldStockMarker);
assert.ok(heldStockStart>=0,"Alpha 32.3.10 held-stock marker missing");
const heldStockBlock=css.slice(heldStockStart);
assert.match(stock,/is-held-stock/);
assert.match(stock,/stock-owned-badge/);
assert.match(stock,/持有 '\+position\.shares\+' 股/);
assert.match(heldStockBlock,/\.stock-trade-card\.is-held-stock\{/);
assert.match(heldStockBlock,/inset 6px 0 0 #2f78c8/);
assert.match(heldStockBlock,/\.stock-owned-badge\{/);
assert.match(css,/\.stock-owned-badge\{display:none\}/);

const noticeFrameMarker="/* V20 Alpha 32.3.11 — restore desktop notification frame artwork. */";
const noticeFrameStart=css.indexOf(noticeFrameMarker);
assert.ok(noticeFrameStart>=0,"Alpha 32.3.11 notification frame marker missing");
const noticeFrameBlock=css.slice(noticeFrameStart);
assert.match(main,/function noticeCardSources\(config\)/);
assert.match(main,/UI_ASSETS\.notification\.cards/);
assert.match(main,/class="action-toast__card-bg"/);
assert.match(main,/src="'\+source\.desktop\+'"/);
assert.match(noticeFrameBlock,/@media \(min-width:1181px\)/);
assert.match(noticeFrameBlock,/\.action-toast__card-bg\{[\s\S]*?display:block!important/);
assert.match(noticeFrameBlock,/\.action-toast\{[\s\S]*?background:transparent!important/);

console.log("V20 Alpha32.3.12 desktop readability + anytime stock regression PASS");
