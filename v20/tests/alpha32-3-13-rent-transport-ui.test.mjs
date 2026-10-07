import fs from"node:fs";
import assert from"node:assert/strict";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const stock=fs.readFileSync(new URL("../js/ui/stock-render.js",import.meta.url),"utf8");
const board=fs.readFileSync(new URL("../js/data/board.js",import.meta.url),"utf8");
const transport=fs.readFileSync(new URL("../js/data/transport.js",import.meta.url),"utf8");
const central=fs.readFileSync(new URL("../js/data/central-features.js",import.meta.url),"utf8");

// Music must be truly absent from the runtime and UI.
assert.doesNotMatch(html,/desktopBgmControls|bgmMuteButton|bgmVolumeSlider|巷仔口的風/);
assert.doesNotMatch(main,/initBgmController|bgm-controller\.js/);

// Phone stock quantity must start blank and must never normalize blank input to 1.
assert.match(stock,/placeholder="輸入股數"/);
assert.match(stock,/String\(value\)\.trim\(\)===""/);
assert.doesNotMatch(stock,/draft\.quantities\.get\(stock\.id\)\?\?1/);
assert.doesNotMatch(stock,/qty\.value=String\(shares\)/);

// Transport nodes must have distinct roles and user can minimize to inspect the board.
assert.match(transport,/id:"central_station"[\s\S]*?fee:400/);
assert.match(transport,/id:"international_airport"[\s\S]*?fee:1200/);
assert.match(transport,/id:"international_port"[\s\S]*?fee:800/);
assert.match(transport,/id:"cross_sea_bridge"[\s\S]*?fee:0/);
assert.match(html,/id="toggleTransportMinimizeButton"/);
assert.match(main,/transportMinimized/);
assert.match(css,/\.transport-dialog\.is-minimized/);

// Final settlement is a dedicated modal and is removed only by explicit close.
assert.match(html,/id="finalSettlementDialog"/);
assert.match(html,/id="closeFinalSettlementButton"/);
assert.match(main,/function renderFinalSettlementDialog/);
assert.match(main,/dismissedFinalSettlementEventId/);
assert.doesNotMatch(main,/game_complete"[\s\S]{0,80}ACTION_TOAST_KINDS/);

// Rent threat and insurance must be materially stronger than the previous values.
assert.match(board,/PROPERTY_LEVEL_RENT_BONUS=0\.85/);
assert.match(board,/rent:Math\.round\(price\*0\.18\)/);
assert.match(board,/"商業區":2\.25/);
assert.match(central,/insuranceRentMultiplier:0\.6/);
assert.match(central,/insuranceCooldownRounds:3/);
assert.match(central,/insurancePremiumBase:1200/);

// Strategic choice UI is explicit and non-dismissible through cancel.
assert.match(html,/id="strategicChoiceDialog"/);
assert.match(main,/case"strategic_choice"/);
assert.match(main,/strategicChoiceDialog\.addEventListener\("cancel",event=>event\.preventDefault\(\)\)/);

console.log("V20 Alpha32.3.13 rent, transport, settlement, stock-input and BGM-removal regression PASS");
