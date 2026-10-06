import fs from"node:fs";
import assert from"node:assert/strict";

const main=fs.readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("../js/ui/minigame-ui.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles/app.css",import.meta.url),"utf8");

const finishStart=ui.indexOf("  finish(detail={},score=this.score){");
assert.ok(finishStart>=0,"finish() must exist");
const finishEnd=ui.indexOf("\n  randomFor(",finishStart);
assert.ok(finishEnd>finishStart,"finish() block must be bounded");
const finishBlock=ui.slice(finishStart,finishEnd);
const waitingIndex=finishBlock.indexOf("this.arena.innerHTML");
const submitIndex=finishBlock.indexOf("this.onSubmit?.");
assert.ok(waitingIndex>=0&&submitIndex>=0,"finish() must render waiting and submit");
assert.ok(
  waitingIndex<submitIndex,
  "waiting UI must render before synchronous submit so completed rankings are not overwritten"
);

assert.match(ui,/data-minigame-close>關閉<\/button>/);
assert.match(main,/action-toast__divider-mask/);
assert.match(css,/V20 Alpha 29\.2 — phone notice seam mask \+ minigame completion hotfix/);
assert.match(css,/\.action-toast__divider-mask\{[\s\S]*?display:none/);
assert.match(css,/@media \(orientation:landscape\) and \(max-height:650px\) and \(max-width:1180px\)\{[\s\S]*?\.action-toast__divider-mask\{[\s\S]*?display:block/);

console.log("V20 Alpha 29.2 UI hotfix regression PASS");
