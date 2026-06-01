import assert from "node:assert/strict";
import { addArchiveResourceLink, removeArchiveResourceLink } from "./archive-model.js";

const first = addArchiveResourceLink([], 10, "project", 3);
assert.deepEqual(first, [{ resourceId: 10, targetType: "project", targetId: 3 }]);

const noDuplicate = addArchiveResourceLink(first, 10, "project", 3);
assert.deepEqual(noDuplicate, first);

const second = addArchiveResourceLink(noDuplicate, 10, "project", 4);
assert.deepEqual(second, [
  { resourceId: 10, targetType: "project", targetId: 3 },
  { resourceId: 10, targetType: "project", targetId: 4 }
]);

const detached = removeArchiveResourceLink(second, 10, "project", 3);
assert.deepEqual(detached, [{ resourceId: 10, targetType: "project", targetId: 4 }]);

console.log("archive attach detach tests passed");
