import assert from "node:assert/strict";
import {
  migrateProjectResourcesToArchive,
  normalizeArchiveResourceLinks,
  updateArchiveResourceLinkConfidence,
  updateArchiveResourceLinkNote
} from "./archive-model.js";

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
      { resourceId: 2, targetType: "task", targetId: 99, relationStrength: "strong", relationScore: 130, relationNote: "Read first" },
      { resourceId: 3, targetType: "project", targetId: 10 }
    ],
    [{ id: 10 }],
    [{ id: 99 }],
    [{ id: 1 }, { id: 2 }]
  ),
  [
    {
      resourceId: 1,
      targetType: "project",
      targetId: 10,
      relationStatus: "confirmed",
      relationType: "reference",
      relationStrength: "medium",
      relationScore: null,
      relationNote: ""
    },
    {
      resourceId: 2,
      targetType: "task",
      targetId: 99,
      relationStatus: "confirmed",
      relationType: "reference",
      relationStrength: "strong",
      relationScore: 100,
      relationNote: "Read first"
    }
  ]
);

assert.deepEqual(
  updateArchiveResourceLinkConfidence(
    [
      { resourceId: 1, targetType: "project", targetId: 10, relationStrength: "medium", relationScore: null },
      { resourceId: 2, targetType: "task", targetId: 99, relationStrength: "weak", relationScore: 30 }
    ],
    2,
    "task",
    99,
    "strong"
  ),
  [
    { resourceId: 1, targetType: "project", targetId: 10, relationStrength: "medium", relationScore: null },
    { resourceId: 2, targetType: "task", targetId: 99, relationStrength: "strong", relationScore: 90, relationStatus: "confirmed" }
  ]
);

assert.deepEqual(
  updateArchiveResourceLinkNote(
    [
      { resourceId: 1, targetType: "project", targetId: 10, relationNote: "" },
      { resourceId: 2, targetType: "task", targetId: 99, relationNote: "" }
    ],
    2,
    "task",
    99,
    "Useful for typography"
  ),
  [
    { resourceId: 1, targetType: "project", targetId: 10, relationNote: "" },
    { resourceId: 2, targetType: "task", targetId: 99, relationNote: "Useful for typography" }
  ]
);

console.log("archive model tests passed");
