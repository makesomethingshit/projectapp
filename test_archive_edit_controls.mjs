import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [];
state.tasks = [];
state.archiveResources = [
  { id: 10, name: "Brand asset", type: "link", path: "https://old.example", desc: "Old desc", tags: ["Brand", "Reference"] }
];
state.archiveResourceLinks = [];
state.selectedArchiveResourceId = 10;
state.archiveEditMode = true;

const html = renderArchiveView();

assert.match(html, /data-edit-archive-form="10"/);
assert.match(html, /data-edit-archive-name/);
assert.match(html, /value="Brand asset"/);
assert.match(html, /data-edit-archive-type/);
assert.match(html, /value="link" selected/);
assert.match(html, /data-edit-archive-desc/);
assert.match(html, />Old desc<\/textarea>/);
assert.match(html, /data-edit-archive-tags/);
assert.match(html, /value="Brand, Reference"/);
assert.match(html, /data-edit-archive-path/);
assert.match(html, /value="https:\/\/old.example"/);
assert.match(html, /id="newArchiveTags"/);
assert.match(html, /class="archive-edit-form"/);
assert.match(html, /class="archive-edit-row"/);
assert.match(html, /class="archive-field archive-field-name"/);
assert.match(html, /class="archive-field archive-field-type"/);
assert.match(html, /class="archive-field archive-field-path"/);
assert.doesNotMatch(html, /data-edit-archive-name[^>]*style="/);
assert.doesNotMatch(html, /data-edit-archive-type[^>]*style="/);
assert.doesNotMatch(html, /data-edit-archive-path[^>]*style="/);
assert.doesNotMatch(html, /data-edit-archive-tags[^>]*style="/);
assert.doesNotMatch(html, /id="newArchiveName"[^>]*style="/);
assert.doesNotMatch(html, /id="newArchivePath"[^>]*style="/);

console.log("archive edit controls test passed");
