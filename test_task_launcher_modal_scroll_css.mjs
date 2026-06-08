import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("components.css", "utf8");

assert.match(css, /\.task-launcher-modal\s*\{[^}]*max-height:\s*min\(760px,\s*calc\(100vh - 48px\)\)/s);
assert.match(css, /\.task-launcher-modal\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto/s);
assert.match(css, /\.task-launcher-modal\s*\{[^}]*overflow:\s*hidden/s);
assert.match(css, /\.task-launcher-body\s*\{[^}]*min-height:\s*0/s);
assert.match(css, /\.task-launcher-body\s*\{[^}]*overflow-y:\s*auto/s);

console.log("task launcher modal scroll css test passed");
