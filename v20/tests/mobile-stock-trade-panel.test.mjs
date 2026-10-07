import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const stock=readFileSync(new URL("../js/ui/stock-render.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");

assert.match(html,/app\.css\?v=alpha32-238/);
assert.match(html,/main\.js\?v=alpha32-238/);
assert.match(main,/\.\/ui\/stock-render\.js\?v=alpha32-238/);
assert.match(main,/stock-mobile-trade-dock/);

assert.match(stock,/function stockMobileCardMarkup/);
assert.match(stock,/function mobileTradePanelMarkup/);
assert.match(stock,/const isMobile=container\.id==="stockMarketMobileGrid"/);
assert.match(stock,/data-stock-mobile-trade-dock/);
assert.match(stock,/data-stock-mobile-buy/);
assert.match(stock,/data-stock-mobile-sell/);
assert.match(stock,/data-stock-quick="10"/);
assert.match(stock,/data-stock-quick="100"/);
assert.match(stock,/data-stock-quick="max-buy"/);
assert.match(stock,/data-stock-quick="all-held"/);
assert.match(stock,/placeholder="直接輸入股數"/);
assert.match(stock,/value="'\+\(shares>0\?shares:""\)\+'"/);
assert.match(stock,/stockCardMarkup\(stock,player,canTrade,draft\)/,"desktop card path must remain intact");

assert.match(css,/phone stock trading uses one dedicated trade panel/);
assert.match(css,/\.stock-mobile-trade-dock\{/);
assert.match(css,/\.stock-card-list--mobile-compact\{/);
assert.match(css,/body\.stock-keyboard-active \.feature-modal__header,[\s\S]*?#stockMarketMobileGrid>\.stock-card-list\{[\s\S]*?display:none!important/);
assert.match(css,/body\.stock-keyboard-active #stockMarketMobileGrid\{[\s\S]*?overflow:hidden!important/);
assert.match(css,/body\.stock-keyboard-active \.stock-mobile-trade-dock__actions button\{[\s\S]*?min-height:37px/);

console.log("V20 phone dedicated stock trade panel regression PASS");
