import assert from "node:assert/strict";
import { buildArchiveGraphModel } from "./archive-graph-model.js";

const stateLike = {
  selectedArchiveResourceId: 1,
  projects: [
    { id: 10, name: "Levinas Study", note: "levinas totality infinity explanation", semanticEmbedding: [1, 0, 0] },
    { id: 11, name: "Typography Site", note: "typography layout type system", semanticEmbedding: [0, 1, 0] }
  ],
  tasks: [
    { id: 20, projectId: 10, name: "Levinas explanation cleanup", note: "truth justice being", semanticEmbedding: [1, 0, 0] },
    { id: 21, projectId: 11, name: "Typography system cleanup", note: "type grid layout", semanticEmbedding: [0, 1, 0] }
  ],
  archiveResources: [
    { id: 1, name: "Levinas totality infinity chapter one.pdf", type: "file", path: "G:\\levinas\\a.pdf", desc: "levinas truth justice explanation", tags: [], semanticEmbedding: [1, 0, 0] },
    { id: 2, name: "Levinas otherwise than being notes.pdf", type: "file", path: "G:\\levinas\\b.pdf", desc: "levinas subjectivity proximity responsibility", tags: [], semanticEmbedding: [0.95, 0.05, 0] },
    { id: 3, name: "Typography space structure.pdf", type: "file", path: "G:\\type\\c.pdf", desc: "typography type grid layout", tags: ["typography"], semanticEmbedding: [0, 1, 0] },
    { id: 4, name: "Levinas folder", type: "folder", path: "G:\\levinas", desc: "levinas storage folder", tags: ["folder"], semanticEmbedding: [1, 0, 0] }
  ],
  archiveResourceLinks: [
    { resourceId: 1, targetType: "task", targetId: 20 },
    { resourceId: 3, targetType: "task", targetId: 21 }
  ]
};

const model = buildArchiveGraphModel(stateLike, { mode: "local", depth: 2, limit: 80 });
assert.ok(model.nodes.some((node) => node.id === "resource:1" && node.active));
assert.ok(model.nodes.some((node) => node.id === "resource:2"));
assert.ok(model.nodes.every((node) => node.id.startsWith("resource:")), "graph nodes should stay material-only");
assert.ok(model.links.every((link) => String(link.source).startsWith("resource:") && String(link.target).startsWith("resource:")), "graph links should stay material-to-material only");
assert.ok(!model.links.some((link) => String(link.target).startsWith("task:") || String(link.target).startsWith("project:")));
assert.ok(model.nodes.every((node) => node.kind !== "folder"), "folders should not become conceptual graph nodes");

const levinasNode = model.nodes.find((node) => node.id === "resource:2");
const typoNode = model.nodes.find((node) => node.id === "resource:3");
assert.ok(levinasNode.score > typoNode.score, "selected Levinas context should outrank unrelated typography materials");
assert.equal(model.nodes.find((node) => node.id === "resource:1").explicitLinkCount, 1);
assert.equal(typoNode.explicitLinkCount, 1);
assert.deepEqual(typoNode.backlinks[0], {
  targetType: "task",
  targetId: 21,
  label: "Typography system cleanup",
  relationStatus: "confirmed",
  relationType: "reference",
  relationStrength: "medium",
  relationScore: null
});
assert.equal(model.meta.backlinkCount, 2);
assert.equal(model.meta.focusDepth, 2);
assert.ok(model.meta.topTerms.includes("levinas"));
assert.ok(model.meta.relationCount >= 1);
assert.ok(model.links.every((link) => !String(link.label || "").includes("undefined")), "semantic-only relations should not leak undefined labels");
assert.equal(model.nodes.find((node) => node.id === "resource:1").graphDistance, 0);
assert.ok(model.nodes.some((node) => node.graphDistance === 1), "selected material should have at least one 1-step relation");

const semanticOnlyState = {
  selectedArchiveResourceId: 501,
  projects: [],
  tasks: [],
  archiveResources: [
    { id: 501, name: "alpha source.pdf", type: "file", path: "G:\\a.pdf", desc: "alpha source", tags: [], semanticEmbedding: [1, 0] },
    { id: 502, name: "beta source.pdf", type: "file", path: "G:\\b.pdf", desc: "beta source", tags: [], semanticEmbedding: [0.98, 0.02] }
  ],
  archiveResourceLinks: []
};
const semanticOnly = buildArchiveGraphModel(semanticOnlyState, { limit: 20, edgeLimit: 20 });
assert.ok(semanticOnly.links.some((link) => link.type === "similarity" && link.label === "semantic match"));

const chainState = {
  selectedArchiveResourceId: 701,
  projects: [],
  tasks: [],
  archiveResources: [
    { id: 701, name: "alpha source.pdf", type: "file", path: "G:\\chain\\a.pdf", desc: "alpha", tags: [], semanticEmbedding: [1, 0] },
    { id: 702, name: "bridge source.pdf", type: "file", path: "G:\\chain\\b.pdf", desc: "bridge", tags: [], semanticEmbedding: [0.8, 0.6] },
    { id: 703, name: "gamma source.pdf", type: "file", path: "G:\\chain\\c.pdf", desc: "gamma", tags: [], semanticEmbedding: [0, 1] }
  ],
  archiveResourceLinks: []
};
const chain = buildArchiveGraphModel(chainState, { limit: 20, edgeLimit: 20 });
assert.equal(chain.nodes.find((node) => node.id === "resource:701").graphDistance, 0);
assert.equal(chain.nodes.find((node) => node.id === "resource:702").graphDistance, 1);
assert.equal(chain.nodes.find((node) => node.id === "resource:703").graphDistance, 2);
assert.equal(chain.nodes.find((node) => node.id === "resource:702").connectedToActive, true);
assert.equal(chain.nodes.find((node) => node.id === "resource:703").connectedToActive, false);

const bigState = {
  ...stateLike,
  archiveResources: Array.from({ length: 300 }, (_, index) => ({
    id: 1000 + index,
    name: `Levinas explanation ${index}.pdf`,
    type: "file",
    path: `G:\\levinas\\${index}.pdf`,
    desc: "levinas totality infinity explanation",
    tags: [],
    semanticEmbedding: [1, 0, 0]
  }))
};
const limited = buildArchiveGraphModel(bigState, { limit: 60, edgeLimit: 90 });
assert.ok(limited.meta.materialCount <= 60);
assert.ok(limited.links.length <= 90);

const shallow = buildArchiveGraphModel(bigState, { depth: 1, limit: 80, edgeLimit: 120 });
const expanded = buildArchiveGraphModel(bigState, { depth: 3, limit: 80, edgeLimit: 120 });
assert.ok(shallow.meta.materialCount < expanded.meta.materialCount, "focus depth should change visible graph breadth");
assert.ok(shallow.links.length <= expanded.links.length, "deeper focus should allow at least as many relations");

console.log("archive graph model ok");
