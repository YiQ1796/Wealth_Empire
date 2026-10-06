import fs from"node:fs";
import assert from"node:assert/strict";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const render=fs.readFileSync(new URL("../js/ui/render.js",import.meta.url),"utf8");
const economy=fs.readFileSync(new URL("../js/core/property-economy.js",import.meta.url),"utf8");

assert.doesNotMatch(render,/tile__price/,"property tile price text must not be rendered on the board");
assert.doesNotMatch(render,/tile__dynamic/,"legacy board footer price container must not remain");
assert.match(render,/tile--property/);
assert.match(render,/aria-label","查看地產資訊："/);

assert.match(html,/id="propertyInfoDialog"/);
assert.match(html,/id="propertyInfoPurchasePrice"/);
assert.match(html,/id="propertyInfoAcquisition"/);
assert.match(html,/id="propertyInfoAcquisitionNote"/);
assert.match(html,/id="upgradeDialog"/);
assert.match(html,/id="confirmUpgradeButton"/);
assert.match(html,/id="declineUpgradeButton"/);

assert.match(main,/function openPropertyInfo/);
assert.match(main,/suggestedAcquisitionOffer/);
assert.match(main,/canForceAcquireProperty/);
assert.match(main,/board\.addEventListener\("click"/);
assert.match(main,/board\.addEventListener\("keydown"/);
assert.match(main,/目前資產估值 ×1\.25/);
assert.match(main,/decline_upgrade/);

assert.match(economy,/export function suggestedAcquisitionOffer/);
assert.match(economy,/propertyValue\(tile\)\*1\.25/);

assert.match(css,/V20 Alpha 20 — property tiles keep the footer clear for houses/);
assert.match(css,/\.tile__houses\{[\s\S]*?bottom:2px/);
assert.match(css,/\.property-info-dialog\{/);
assert.match(css,/orientation:landscape[\s\S]*?\.property-info-dialog/);
assert.match(css,/V20 Alpha 29\.3 — landing-only property upgrades/);
assert.match(render,/state\.pendingUpgrade===tileIndex/);
assert.match(render,/需再次走到此地產/);
assert.doesNotMatch(render,/data-upgrade-property/);

console.log("V20 Alpha20 property tile info regression PASS");
