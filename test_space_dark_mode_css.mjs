import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const variablesCss = readFileSync("variables.css", "utf8");
const layoutCss = readFileSync("layout.css", "utf8");
const componentsCss = readFileSync("components.css", "utf8");

assert.match(variablesCss, /--border:\s*var\(--line\);/);

assert.match(
  layoutCss,
  /\.view-tab-nav button\.active\s*\{[^}]*background:\s*var\(--text\);[^}]*color:\s*var\(--surface\);/s,
  "top view active tabs must keep contrast in dark mode"
);

assert.match(
  componentsCss,
  /\.archive-graph-view-header\s*\{[^}]*background:\s*var\(--panel-raised\);/s,
  "Space header should follow theme surfaces"
);
assert.doesNotMatch(
  componentsCss,
  /\.archive-graph-view-header\s*\{[^}]*background:\s*#f7f4ed;/s,
  "Space header must not keep a hard-coded light background"
);

assert.match(
  componentsCss,
  /\.archive-graph-view-header dl div\s*\{[^}]*background:\s*var\(--panel-soft\);/s,
  "Space metric chips should follow theme surfaces"
);
assert.match(
  componentsCss,
  /\.archive-graph-mode-toggle\s*\{[^}]*background:\s*var\(--panel-soft\);/s,
  "Space renderer toggle should follow theme surfaces"
);
assert.match(
  componentsCss,
  /\.archive-graph-inspector\s*\{[^}]*background:\s*var\(--panel-raised\);/s,
  "Space inspector should follow theme surfaces"
);
assert.doesNotMatch(
  componentsCss,
  /\.archive-graph-inspector\s*\{[^}]*background:\s*#f4f0e7;/s,
  "Space inspector must not keep a hard-coded light background"
);

console.log("space dark mode css test passed");
