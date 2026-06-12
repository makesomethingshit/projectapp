import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const variablesCss = readFileSync("variables.css", "utf8");
const componentsCss = readFileSync("components.css", "utf8");

const requiredTokens = [
  "--space-hair: 4px",
  "--space-tight: 8px",
  "--space-cluster: 12px",
  "--space-section: 16px",
  "--space-block: 24px",
  "--space-panel: 32px"
];

for (const token of requiredTokens) {
  assert.ok(variablesCss.includes(token), `${token} should be defined`);
}

function blocks(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "gs"))]
    .map((match) => match.groups.body);
}

function assertRuleToken(css, selector, property, token) {
  const selectorBlocks = blocks(css, selector);
  assert.ok(selectorBlocks.length, `${selector} CSS block should exist`);
  const tokenPattern = new RegExp(`${property}:\\s*var\\(${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`);
  assert.ok(
    selectorBlocks.some((body) => tokenPattern.test(body)),
    `${selector} ${property} should use ${token}`
  );
}

assertRuleToken(componentsCss, ".detail-summary", "gap", "--space-section");
assertRuleToken(componentsCss, ".detail-summary", "margin-top", "--space-block");
assertRuleToken(componentsCss, ".summary-item", "padding", "--space-section");

assertRuleToken(componentsCss, ".task-launcher-body", "gap", "--space-section");
assertRuleToken(componentsCss, ".task-launcher-summary", "padding", "--space-cluster");
assertRuleToken(componentsCss, ".task-launcher-list", "gap", "--space-tight");
assertRuleToken(componentsCss, ".task-launcher-curation", "gap", "--space-cluster");
assertRuleToken(componentsCss, ".task-launcher-resource", "gap", "--space-cluster");
assertRuleToken(componentsCss, ".task-launcher-resource-main", "gap", "--space-hair");
assertRuleToken(componentsCss, ".task-launcher-empty", "padding", "--space-section");

assertRuleToken(componentsCss, ".archive-relation-control-panel", "gap", "--space-tight");
assertRuleToken(componentsCss, ".archive-relation-control-panel", "padding", "--space-tight");
assertRuleToken(componentsCss, ".task-launcher-resource-actions", "gap", "--space-tight");

assertRuleToken(componentsCss, ".archive-graph-view-header", "gap", "--space-section");
assertRuleToken(componentsCss, ".archive-graph-view-header", "padding", "--space-section");
assertRuleToken(componentsCss, ".archive-graph-mode-toggle", "margin-top", "--space-cluster");
assertRuleToken(componentsCss, ".archive-graph-3d-toolbar", "gap", "--space-cluster");
assertRuleToken(componentsCss, ".archive-graph-inspector section", "gap", "--space-tight");
assertRuleToken(componentsCss, ".archive-graph-view-legend", "gap", "--space-cluster");

const taskLauncherSlice = componentsCss.slice(
  componentsCss.indexOf(".task-launcher-body"),
  componentsCss.indexOf(".task-completion-control")
);
assert.doesNotMatch(
  taskLauncherSlice,
  /(?:gap|padding|margin(?:-top)?):\s*(?:3|5|7|9|10|14)px/,
  "task launcher block spacing should avoid ad hoc in-between px values"
);

console.log("spacing hierarchy css test passed");
