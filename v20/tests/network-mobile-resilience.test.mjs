import fs from"node:fs";
import assert from"node:assert/strict";

const source=fs.readFileSync(new URL("../js/core/network.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");

assert.match(source,/presenceRetryTimer/);
assert.match(source,/setInterval\(\(\)=>\{\s*if\(!settled&&connection\.open\)sendPresence\(\);\s*\},1400\)/);
assert.match(source,/relay_join_timeout/);
assert.match(source,/type\.includes\("is taken"\)/);
assert.match(source,/type\.includes\("unavailable-id"\)/);
assert.match(source,/WSS 中繼暫時不可用/);

assert.match(css,/V20 Alpha 28 — central five desktop fill \+ friend dialog fit/);
assert.match(css,/@media \(max-width:700px\)/);
assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(330px,23vw,390px\)/);

console.log("V20 Alpha 28 mobile network resilience + desktop fill test PASS");
