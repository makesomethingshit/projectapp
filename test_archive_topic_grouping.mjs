import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [
  { id: 10, name: "Brand System", parentId: null, note: "Identity work" }
];
state.tasks = [
  { id: 20, name: "Collect references", projectId: 10, note: "Gather inputs" }
];
state.archiveResourceLinks = [
  { resourceId: 1, targetType: "project", targetId: 10 },
  { resourceId: 1, targetType: "task", targetId: 20 }
];
state.selectedArchiveResourceId = 1;
state.archiveEditMode = false;
state.appSettings.archiveViewMode = "topic";
state.archiveResources = [
  { id: 1, name: "Logo guide", type: "file", path: "C:\\logo.pdf", desc: "", tags: ["Brand"] },
  { id: 2, name: "Mood board", type: "link", path: "https://example.com", desc: "", tags: ["Brand", "Reference"] },
  { id: 3, name: "Loose folder", type: "folder", path: "C:\\loose", desc: "", tags: [] }
];

const html = renderArchiveView();

assert.match(html, />Brand \(2\)</);
assert.match(html, />미분류 \(1\)</);
assert.match(html, /archive-explorer-item-name">Logo guide</);
assert.match(html, /archive-explorer-item-name">Mood board</);
assert.match(html, /archive-explorer-item-name">Loose folder</);
assert.match(html, /📄 로컬 파일/);

assert.match(html, /archive-knowledge-graph/);
assert.match(html, /Knowledge Graph/);
assert.match(html, /Brand System/);
assert.match(html, /Collect references/);
assert.match(html, /shares tag/);
assert.match(html, /archive-agent-index/);
assert.match(html, /Agent Index/);

console.log("archive topic grouping test passed");
