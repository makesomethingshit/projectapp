import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("components.css", "utf8");

function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "s"));
  assert.ok(match, `${selector} CSS block should exist`);
  return match.groups.body;
}

function assertHas(selector, propertyPattern, message) {
  assert.match(block(selector), propertyPattern, message || `${selector} should contain ${propertyPattern}`);
}

function assertLacks(selector, propertyPattern, message) {
  assert.doesNotMatch(block(selector), propertyPattern, message || `${selector} should not contain ${propertyPattern}`);
}

function assertGroupHas(selectorPattern, propertyPattern, message) {
  assert.match(css, new RegExp(`${selectorPattern}\\s*\\{[^}]*${propertyPattern.source}`, "s"), message);
}

assertHas(".task-launcher-modal", /max-height:\s*min\(760px,\s*calc\(100vh - 48px\)\)/);
assertHas(".task-launcher-body", /overflow-y:\s*auto/);

assertHas(".task-launcher-curation-head div", /min-width:\s*0/);
assertHas(".task-launcher-curation-head strong", /overflow-wrap:\s*anywhere/);
assertHas(".task-launcher-curation-head em", /overflow-wrap:\s*anywhere/);
assertGroupHas(
  "\\.task-launcher-curation-meta b,\\s*\\.task-launcher-curation-meta em",
  /max-width:\s*100%/,
  "curation meta chips should stay inside narrow Korean modal columns"
);
assertGroupHas(
  "\\.task-launcher-curation-meta b,\\s*\\.task-launcher-curation-meta em",
  /overflow-wrap:\s*anywhere/,
  "curation meta chips should wrap long Korean evidence text"
);
assertHas(".task-launcher-overflow-details summary", /overflow-wrap:\s*anywhere/);

assertHas(".task-launcher-resource", /grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
assertHas(".task-launcher-resource-main", /min-width:\s*0/);
assertHas(".task-launcher-resource-main strong", /overflow-wrap:\s*anywhere/);
assertHas(".archive-relation-badge", /white-space:\s*nowrap/);
assertHas(".archive-relation-note-preview", /text-overflow:\s*ellipsis/);
assertHas(".archive-relation-note-preview", /white-space:\s*nowrap/);
assertHas(".archive-relation-reason", /overflow-wrap:\s*anywhere/);
assertHas(".archive-relation-adjust", /grid-column:\s*1 \/ -1/);
assertGroupHas("\\.archive-relation-adjust summary", /overflow-wrap:\s*anywhere/);
assertHas(".archive-relation-control-panel", /background:\s*var\(--panel-soft\)/);
assertGroupHas("\\.archive-relation-note", /max-width:\s*180px/);
assertHas(".archive-relation-note textarea", /width:\s*min\(180px,\s*100%\)/);
assertHas(".archive-relation-note textarea", /overflow-wrap:\s*anywhere/);
assertHas(".archive-relation-evidence", /flex-wrap:\s*wrap/);
assertHas(".archive-relation-evidence", /max-width:\s*180px/);
assertHas(".archive-relation-evidence span", /overflow-wrap:\s*anywhere/);

assertHas(".archive-graph-view-header p", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-view-header h2", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-view-header > div > span", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-depth-note", /max-width:\s*min\(360px,\s*42vw\)/);
assertHas(".archive-graph-depth-note", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-depth-note", /white-space:\s*normal/);
assert.doesNotMatch(css, /archive-graph-depth-legend/);
assert.doesNotMatch(css, /archive-graph-depth-dot/);
assertHas(".archive-graph-inspector > section > strong", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-inspector p", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-inspector-empty", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-inspector-card", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-relation-scope", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-linked-work", /overflow-wrap:\s*anywhere/);
assertHas(".archive-graph-lane-metrics", /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assertHas(".archive-graph-view-legend em", /overflow-wrap:\s*anywhere/);

console.log("korean ui layout contract test passed");
