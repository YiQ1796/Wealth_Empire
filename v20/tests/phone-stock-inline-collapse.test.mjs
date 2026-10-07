import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const stock=readFileSync(new URL("../js/ui/stock-render.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");

assert.match(html,/app\.css\?v=alpha32-239/);
assert.match(html,/main\.js\?v=alpha32-239/);
assert.match(main,/\.\/ui\/stock-render\.js\?v=alpha32-239/);

assert.match(stock,/data-stock-mobile-close/);
assert.match(stock,/aria-label="收合交易面板"/);
assert.match(stock,/active\?"收合":"交易"/);
assert.match(stock,/draft\.stockId=collapse\?null:nextStockId/);
assert.match(stock,/stock-mobile-pair-row/);
assert.match(stock,/has-active-trade/);
assert.match(stock,/scrollIntoView\(\{block:"nearest",behavior:"smooth"\}\)/);
assert.match(stock,/function mobileTradePanelMarkup[\s\S]*?if\(!stock\)return "";/);

assert.match(css,/\.stock-mobile-trade-dock\{[\s\S]*?position:relative;[\s\S]*?grid-column:1\/-1/);
assert.match(css,/\.stock-mobile-trade-dock__close\{/);
assert.match(css,/body\.stock-keyboard-active \.feature-modal__header\{[\s\S]*?display:flex!important/);
assert.match(css,/body\.stock-keyboard-active \.stock-mobile-pair-row\.has-active-trade\{[\s\S]*?display:block!important/);

console.log("V20 phone stock inline/collapse/close regression PASS");
