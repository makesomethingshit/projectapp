import assert from "node:assert/strict";
import { addArchiveResourceLink, removeArchiveResourceLink } from "./archive-model.js";

const link = (resourceId, targetType, targetId) => ({
  resourceId,
  targetType,
  targetId,
  relationStatus: "confirmed",
  relationType: "reference",
  relationStrength: "medium",
  relationScore: null,
  relationNote: ""
});

const first = addArchiveResourceLink([], 10, "project", 3);
assert.deepEqual(first, [link(10, "project", 3)]);

const noDuplicate = addArchiveResourceLink(first, 10, "project", 3);
assert.deepEqual(noDuplicate, first);

const second = addArchiveResourceLink(noDuplicate, 10, "project", 4);
assert.deepEqual(second, [
  link(10, "project", 3),
  link(10, "project", 4)
]);

const detached = removeArchiveResourceLink(second, 10, "project", 3);
assert.deepEqual(detached, [link(10, "project", 4)]);

console.log("archive attach detach tests passed");
