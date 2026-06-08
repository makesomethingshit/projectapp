import assert from "node:assert/strict";
import {
  ensureArchiveSemanticEmbeddings,
  hydrateArchiveSemanticEmbeddings
} from "./archive-embeddings.js";
import { scoreArchiveProjectRelation } from "./archive-model.js";

const stateLike = {
  appSettings: {},
  archiveResources: [
    { id: 1, name: "Levinas responsibility note", type: "file", path: "note.md", desc: "ethics and responsibility", tags: ["levinas"] }
  ],
  projects: [
    { id: 10, name: "Levinas ethics research", note: "responsibility" }
  ],
  tasks: []
};

let calls = 0;
const provider = async (text) => {
  calls += 1;
  return text.toLowerCase().includes("levinas") ? [1, 0, 0] : [0, 1, 0];
};

const first = await ensureArchiveSemanticEmbeddings(stateLike, { provider, limit: 10 });
assert.equal(first.computed, 2);
assert.equal(calls, 2);
assert.ok(Array.isArray(stateLike.archiveResources[0].semanticEmbedding));
assert.ok(Array.isArray(stateLike.projects[0].semanticEmbedding));

const relation = scoreArchiveProjectRelation(stateLike.archiveResources[0], stateLike.projects[0], stateLike.tasks);
assert.equal(relation.semanticScore, 1);
assert.equal(relation.score, 92);
assert.equal(relation.pendingEmbedding, false);

delete stateLike.archiveResources[0].semanticEmbedding;
delete stateLike.projects[0].semanticEmbedding;
hydrateArchiveSemanticEmbeddings(stateLike);
assert.ok(Array.isArray(stateLike.archiveResources[0].semanticEmbedding));
assert.ok(Array.isArray(stateLike.projects[0].semanticEmbedding));

const second = await ensureArchiveSemanticEmbeddings(stateLike, { provider, limit: 10 });
assert.equal(second.computed, 0);
assert.equal(calls, 2);

console.log("archive embeddings ok");
