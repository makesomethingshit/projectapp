import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [];
state.tasks = [];
state.archiveResourceLinks = [];
state.archiveResources = [
  { id: 1, name: "Logo guide", type: "file", path: "C:\\logo.pdf", desc: "", tags: ["Brand"] },
  { id: 2, name: "Mood board", type: "link", path: "https://example.com", desc: "", tags: ["Reference"] },
  { id: 3, name: "Asset folder", type: "folder", path: "C:\\assets", desc: "", tags: [] }
];

state.appSettings.archiveViewMode = "topic";
let html = renderArchiveView();
assert.match(html, /data-archive-view-mode="topic" class="active"/);
assert.match(html, />Brand</);
assert.match(html, />Reference</);

state.appSettings.archiveViewMode = "type";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="type" class="active"/);
assert.match(html, /작업 폴더/);
assert.match(html, /문서와 파일/);
assert.match(html, /웹 링크/);

state.appSettings.archiveViewMode = "all";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="all" class="active"/);
assert.match(html, />전체</);

console.log("archive view modes test passed");
