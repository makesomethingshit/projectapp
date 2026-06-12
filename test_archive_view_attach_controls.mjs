import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [
  { id: 1, name: "Attached project" },
  { id: 2, name: "Available project" }
];
state.tasks = [
  { id: 20, projectId: 1, name: "Attached task" },
  { id: 21, projectId: 2, name: "Available task" }
];
state.archiveResources = [
  { id: 10, name: "Brand asset", type: "file", path: "C:\\asset.pdf", desc: "" }
];
state.archiveResourceLinks = [
  { resourceId: 10, targetType: "project", targetId: 1 },
  {
    resourceId: 10,
    targetType: "task",
    targetId: 20,
    relationStrength: "strong",
    relationScore: 92,
    relationStatus: "confirmed",
    relationType: "evidence",
    relationReason: "Weekly page reference",
    relationNote: "Check first for weekly picture-text page"
  }
];

const html = renderArchiveView();

assert.match(html, /data-detach-archive-target="10"/);
assert.match(html, /data-target-id="1"/);
assert.match(html, /Attached project/);
assert.match(html, /Attached task/);
assert.match(html, /archive-relation-note-preview/);
assert.match(html, /Check first for weekly picture-text page/);
assert.match(html, /archive-relation-reason/);
assert.match(html, /Weekly page reference/);
assert.match(html, /archive-relation-badge strong/);
assert.match(html, /\uc2e0\ub8b0\ub3c4 92/);
assert.match(html, /\uc774 \uc791\uc5c5\uc5d0\uc11c\uc758 \uc2e0\ub8b0\ub3c4/);
assert.match(html, /data-archive-relation-strength="medium"/);
assert.match(html, /data-archive-relation-note="true"/);
assert.match(html, /data-resource-id="10"/);
assert.match(html, /data-attach-archive-target="10"/);
assert.match(html, /data-target-type="task"/);
assert.match(html, /Available project \u00b7 Available task/);
assert.doesNotMatch(html, /data-attach-archive-project="10"/);
assert.doesNotMatch(html, /<option value="20">/);

console.log("archive view attach controls test passed");
