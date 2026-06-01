import assert from "node:assert/strict";
import { migrateProjectResourcesToArchive, normalizeArchiveResourceLinks } from "./archive-model.js";

const projects = [
  {
    id: 10,
    name: "Project A",
    resources: [
      { id: 1, name: "Guide", type: "file", path: "C:\\Guide.pdf", desc: "Spec" }
    ]
  },
  {
    id: 20,
    name: "Project B",
    resources: [
      { id: 1, name: "Moodboard", type: "link", path: "https://example.com" }
    ]
  }
];

const migrated = migrateProjectResourcesToArchive(projects);

assert.equal(migrated.projects[0].resources.length, 0);
assert.equal(migrated.projects[1].resources.length, 0);
assert.equal(migrated.archiveResources.length, 2);
assert.deepEqual(
  migrated.archiveResourceLinks.map((link) => [link.resourceId, link.targetType, link.targetId]),
  [
    [1, "project", 10],
    [2, "project", 20]
  ]
);
assert.equal(migrated.resourceMap.get("10:1"), 1);
assert.equal(migrated.resourceMap.get("20:1"), 2);
assert.equal(migrated.resourceMap.get("legacy:1"), 1);

assert.deepEqual(
  normalizeArchiveResourceLinks(
    [
      { resourceId: 1, targetType: "project", targetId: 10 },
      { resourceId: 1, targetType: "project", targetId: 10 },
      { resourceId: 2, targetType: "task", targetId: 99 },
      { resourceId: 3, targetType: "project", targetId: 10 }
    ],
    [{ id: 10 }],
    [{ id: 99 }],
    [{ id: 1 }, { id: 2 }]
  ),
  [
    { resourceId: 1, targetType: "project", targetId: 10 },
    { resourceId: 2, targetType: "task", targetId: 99 }
  ]
);

console.log("archive model tests passed");
