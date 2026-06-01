import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [{ id: 1, name: "Brand Project" }];
state.tasks = [];
state.archiveResourceLinks = [{ resourceId: 2, targetType: "project", targetId: 1 }];
state.archiveResources = [
  { id: 1, name: "Contract", type: "file", path: "C:\\contract.pdf", desc: "Legal", tags: ["계약"] },
  { id: 2, name: "Logo guide", type: "link", path: "https://brand.example", desc: "Identity", tags: ["브랜딩"] }
];
state.appSettings.archiveViewMode = "topic";

state.searchQuery = "brand";
let html = renderArchiveView();
assert.match(html, /Logo guide/);
assert.doesNotMatch(html, /Contract/);
assert.match(html, /검색 결과 1개/);

state.searchQuery = "계약";
html = renderArchiveView();
assert.match(html, /Contract/);
assert.doesNotMatch(html, /Logo guide/);

state.searchQuery = "";
html = renderArchiveView();
assert.match(html, /Contract/);
assert.match(html, /Logo guide/);

console.log("archive search test passed");
