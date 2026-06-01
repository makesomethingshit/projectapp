import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [];
state.tasks = [];
state.archiveResources = [
  { id: 10, name: "Brand asset", type: "link", path: "https://old.example", desc: "Old desc", tags: ["브랜딩", "레퍼런스"] }
];
state.archiveResourceLinks = [];

const html = renderArchiveView();

assert.match(html, /data-edit-archive-form="10"/);
assert.match(html, /data-edit-archive-name/);
assert.match(html, /value="Brand asset"/);
assert.match(html, /data-edit-archive-type/);
assert.match(html, /value="link" selected/);
assert.match(html, /data-edit-archive-desc/);
assert.match(html, /value="Old desc"/);
assert.match(html, /data-edit-archive-tags/);
assert.match(html, /value="브랜딩, 레퍼런스"/);
assert.match(html, /data-edit-archive-path/);
assert.match(html, /value="https:\/\/old.example"/);
assert.match(html, />브랜딩</);
assert.match(html, /링크 · Brand asset/);
assert.match(html, /id="newArchiveTags"/);

console.log("archive edit controls test passed");
