import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const variablesCss = readFileSync("variables.css", "utf8");
const layoutCss = readFileSync("layout.css", "utf8");
const modalsCss = readFileSync("modals.css", "utf8");
const componentsCss = readFileSync("components.css", "utf8");

const requiredTokens = [
  "--type-display: 32px",
  "--type-page: 24px",
  "--type-brand: 22px",
  "--type-stat: 20px",
  "--type-panel-title: 18px",
  "--type-section: 16px",
  "--type-title: 14px",
  "--type-body: 13px",
  "--type-row-title: 12px",
  "--type-meta: 11px",
  "--type-caption: 10px",
  "--type-micro: 9px"
];

for (const token of requiredTokens) {
  assert.ok(variablesCss.includes(token), `${token} should be defined`);
}

function block(css, selector) {
  const matches = blocks(css, selector);
  assert.ok(matches.length, `${selector} CSS block should exist`);
  return matches[0];
}

function blocks(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "gs"))]
    .map((match) => match.groups.body);
}

function assertFontToken(css, selector, token) {
  const pattern = new RegExp(`font-size:\\s*var\\(${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`);
  const selectorBlocks = blocks(css, selector);
  assert.ok(selectorBlocks.length, `${selector} CSS block should exist`);
  assert.ok(
    selectorBlocks.some((body) => pattern.test(body)),
    `${selector} should use ${token}`
  );
}

assertFontToken(layoutCss, ".brand h1", "--type-brand");
assertFontToken(layoutCss, ".brand p", "--type-title");
assertFontToken(layoutCss, ".view-tab-nav button", "--type-row-title");
assertFontToken(modalsCss, ".modal-head h2", "--type-panel-title");

assertFontToken(componentsCss, ".detail-header h2", "--type-display");
assertFontToken(componentsCss, ".summary-item strong", "--type-stat");
assertFontToken(componentsCss, ".task-launcher-summary strong", "--type-title");
assertFontToken(componentsCss, ".task-launcher-resource-main strong", "--type-row-title");
assertFontToken(componentsCss, ".archive-relation-note-preview", "--type-meta");
assertFontToken(componentsCss, ".archive-graph-view-header h2", "--type-page");
assertFontToken(componentsCss, ".archive-graph-inspector > section > strong", "--type-title");

const textUiSlices = [
  componentsCss.slice(
    componentsCss.indexOf(".task-launcher-modal"),
    componentsCss.indexOf(".task-launcher-empty p") + 200
  ),
  componentsCss.slice(
    componentsCss.indexOf(".archive-explorer-item-icon"),
    componentsCss.indexOf(".archive-agent-index-row span") + 200
  )
];

for (const slice of textUiSlices) {
  assert.doesNotMatch(slice, /font-size:\s*\d+\.\d+px/, "general UI typography should avoid fractional px sizes");
  assert.doesNotMatch(slice, /font-size:\s*clamp\(/, "general UI typography should not scale with viewport width");
}

console.log("typography hierarchy css test passed");
