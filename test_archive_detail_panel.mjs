import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderLinkedArchivePanel } from "./ui-components.js";

state.archiveResources = [
  { id: 1, name: "Project brief", type: "file", path: "C:\\brief.pdf", desc: "Brief" },
  { id: 2, name: "Task reference", type: "link", path: "https://example.com", desc: "" },
  { id: 3, name: "Other", type: "folder", path: "C:\\Other", desc: "" }
];
state.archiveResourceLinks = [
  { resourceId: 1, targetType: "project", targetId: 10 },
  { resourceId: 2, targetType: "task", targetId: 100, relationStrength: "weak", relationScore: 30, relationNote: "Check later" },
  { resourceId: 3, targetType: "project", targetId: 20 }
];

const html = renderLinkedArchivePanel(
  { id: 10, name: "Selected project" },
  [{ id: 100, name: "Selected task" }]
);

assert.match(html, /연결된 아카이브/);
assert.match(html, /Project brief/);
assert.match(html, /현재 프로젝트에 연결/);
assert.match(html, /Task reference/);
assert.match(html, /할 일 · Selected task/);
assert.match(html, /archive-relation-badge weak/);
assert.match(html, /archive-relation-adjust/);
assert.match(html, /<summary>조정<\/summary>/);
assert.match(html, /data-archive-relation-strength="weak"/);
assert.match(html, /data-target-type="task"/);
assert.match(html, /신뢰도 30/);
assert.match(html, /class="active"[\s\S]*data-archive-relation-strength="weak"/);
assert.match(html, /archive-relation-evidence/);
assert.match(html, /수동 조정/);
assert.match(html, /메모 반영/);
assert.match(html, /data-archive-relation-note="true"/);
assert.match(html, /Check later/);
assert.match(html, /archive-relation-note-preview/);
assert.match(html, /\uba54\ubaa8 \u00b7 Check later/);
assert.doesNotMatch(html, /Other/);

console.log("archive detail panel test passed");
