import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");

assert.match(html,/id="acquisitionTitle"/);
assert.match(main,/acquisition_offer:\{title:"取得強制收購權"/);
assert.match(main,/ACTION_TOAST_KINDS[\s\S]*?"acquisition_offer"/);
assert.match(main,/if\(itemPromptDialog\?\.open\)itemPromptDialog\.close\(\)/);
assert.match(main,/state\.pendingAcquisition/);
assert.match(main,/state\.pendingPurchase!=null[\s\S]*?state\.pendingAcquisition[\s\S]*?state\.pendingTransport/);
assert.match(main,/acquisitionDialog\?\.open/);
assert.match(main,/acquisitionDialog\.classList\.toggle\("is-landing-acquisition",landingOffer\)/);
assert.match(main,/取得強制收購權｜要不要收購？/);
assert.match(main,/確認收購這塊地/);
assert.match(main,/不要收購，保留現金並繼續遊戲/);
assert.match(main,/levelAfterAcquisition/);
assert.match(main,/自動升 1 級/);
assert.match(main,/確認後會轉移地產並免費自動升 1 級/);
assert.match(css,/V20 Alpha 32\.3\.7 — desktop wealth ranking \+ forced-acquisition visibility/);
assert.match(css,/\.acquisition-dialog\.is-landing-acquisition \.acquisition-modal/);
assert.match(css,/\.acquisition-dialog\.is-landing-acquisition \.acquisition-option:not\(:disabled\)/);
assert.match(css,/V20 Alpha 32\.3\.8 — explicit yes\/no forced-acquisition choice/);

console.log("V20 Alpha32.3.12 forced acquisition choice + auto-upgrade regression PASS");
