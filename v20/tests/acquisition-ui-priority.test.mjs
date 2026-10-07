import assert from"node:assert/strict";
import{readFileSync}from"node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");

assert.match(html,/id="acquisitionTitle"/);
assert.match(main,/acquisition_offer:\{title:"強制收購機會"/);
assert.match(main,/if\(itemPromptDialog\?\.open\)itemPromptDialog\.close\(\)/);
assert.match(main,/state\.pendingAcquisition/);
assert.match(main,/acquisitionDialog\?\.open/);
assert.match(main,/acquisitionDialog\.classList\.toggle\("is-landing-acquisition",landingOffer\)/);
assert.match(main,/踩到對手地產｜強制收購/);
assert.match(css,/V20 Alpha 32\.3\.7 — desktop wealth ranking \+ forced-acquisition visibility/);
assert.match(css,/\.acquisition-dialog\.is-landing-acquisition \.acquisition-modal/);
assert.match(css,/\.acquisition-dialog\.is-landing-acquisition \.acquisition-option:not\(:disabled\)/);

console.log("V20 Alpha32.3.7 forced acquisition visibility regression PASS");
