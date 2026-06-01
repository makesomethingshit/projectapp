import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [];
state.tasks = [];
state.archiveResourceLinks = [];
state.archiveResources = [
  { id: 1, name: "Logo guide", type: "file", path: "C:\\logo.pdf", desc: "", tags: ["브랜딩"] },
  { id: 2, name: "Mood board", type: "link", path: "https://example.com", desc: "", tags: ["레퍼런스"] },
  { id: 3, name: "Loose file", type: "folder", path: "C:\\loose", desc: "", tags: [] }
];

const html = renderArchiveView();

assert.match(html, /브랜딩/);
assert.match(html, /레퍼런스/);
assert.match(html, /미분류/);
assert.match(html, /파일 · Logo guide/);
assert.match(html, /링크 · Mood board/);
assert.match(html, /폴더 · Loose file/);

console.log("archive topic grouping test passed");
