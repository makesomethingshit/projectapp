import assert from "node:assert/strict";
import { updateArchiveResource } from "./archive-model.js";

const original = [
  { id: 1, name: "Old name", type: "file", path: "C:\\old.pdf", desc: "Old", tags: ["x"], createdAt: "2026-01-01" },
  { id: 2, name: "Other", type: "link", path: "https://example.com", desc: "" }
];

const result = updateArchiveResource(original, 1, {
  name: "New name",
  type: "folder",
  path: "C:\\new",
  desc: "New desc"
});

assert.equal(result.updated.name, "New name");
assert.equal(result.updated.type, "folder");
assert.equal(result.updated.path, "C:\\new");
assert.equal(result.updated.desc, "New desc");
assert.deepEqual(result.updated.tags, ["x"]);
assert.equal(result.updated.createdAt, "2026-01-01");
assert.equal(result.resources[1], original[1]);

const invalidType = updateArchiveResource(result.resources, 1, { name: "Name only", type: "bad", path: "", desc: "" });
assert.equal(invalidType.updated.type, "folder");
assert.equal(invalidType.updated.name, "Name only");
assert.equal(invalidType.updated.path, "C:\\new");

const topicUpdate = updateArchiveResource(invalidType.resources, 1, {
  name: "Topic item",
  type: "file",
  path: "C:\\topic.pdf",
  desc: "",
  tags: "브랜딩, 레퍼런스, 브랜딩"
});
assert.deepEqual(topicUpdate.updated.tags, ["브랜딩", "레퍼런스"]);

console.log("archive resource update test passed");
