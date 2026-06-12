import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const d3Source = readFileSync("archive-graph-d3.js", "utf8");
const cssSource = readFileSync("components.css", "utf8");

assert.match(
  d3Source,
  /function linkKey|const linkKey = function/,
  "2D D3 link key must be able to inspect existing SVG line elements"
);
assert.match(
  d3Source,
  /getAttribute\?\.\("data-archive-graph-edge"\)/,
  "D3 must preserve server-rendered line identity when rebinding existing SVG edges"
);
assert.match(
  d3Source,
  /placeArchiveGraphLinks/,
  "2D links must receive visible coordinates immediately, before the force simulation ticks"
);

const weakEdgeRule = cssSource.match(/\.archive-graph-view-edge\.weak,\s*\.archive-graph-view-edge\.review\s*{([\s\S]*?)}/);
assert.ok(weakEdgeRule, "weak/review edge style must exist");
const weakOpacity = Number(weakEdgeRule[1].match(/opacity:\s*([0-9.]+)/)?.[1]);
assert.ok(weakOpacity >= 0.64, "weak/review edges should remain visible enough to read on the 2D map");

const baseEdgeRule = cssSource.match(/\.archive-graph-view-edge\s*{([\s\S]*?)}/);
assert.ok(baseEdgeRule, "base edge style must exist");
assert.match(baseEdgeRule[1], /filter:\s*drop-shadow/, "2D edges need a glow/shadow so they do not disappear into the map");
