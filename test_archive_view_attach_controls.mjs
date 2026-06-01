import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [
  { id: 1, name: "Attached project" },
  { id: 2, name: "Available project" }
];
state.tasks = [];
state.archiveResources = [
  { id: 10, name: "Brand asset", type: "file", path: "C:\\asset.pdf", desc: "" }
];
state.archiveResourceLinks = [
  { resourceId: 10, targetType: "project", targetId: 1 }
];

const html = renderArchiveView();

assert.match(html, /data-detach-archive-project="10"/);
assert.match(html, /data-project-id="1"/);
assert.match(html, /Attached project/);
assert.match(html, /data-attach-archive-project="10"/);
assert.match(html, /Available project/);
assert.doesNotMatch(html, /<option value="1">Attached project<\/option>/);

console.log("archive view attach controls test passed");
