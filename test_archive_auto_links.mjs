import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAutomaticArchiveResourceLinks,
  getArchiveContentTerms,
  normalizeArchiveResourceLinks,
  scoreArchiveProjectRelation,
  scoreArchiveTaskRelation
} from "./archive-model.js";
import { applyAutomaticArchiveLinks, state } from "./state.js";

const projects = [
  { id: 1, name: "Levinas ethics research", parentId: null, note: "prepare levinas responsibility notes", semanticEmbedding: [1, 0, 0] },
  { id: 2, name: "Typography portfolio", parentId: null, note: "type design case study", semanticEmbedding: [0, 1, 0] }
];
const tasks = [
  { id: 10, projectId: 1, name: "Levinas presentation", note: "ethics and responsibility", semanticEmbedding: [1, 0, 0] }
];
const resources = [
  { id: 100, name: "Levinas Reference Folder", type: "folder", path: "C:\\archive\\levinas", desc: "levinas ethics responsibility", tags: ["reference-library"], semanticEmbedding: [1, 0, 0] },
  { id: 101, name: "Levinas ethics paper 1", type: "file", path: "C:\\archive\\levinas\\paper-1.pdf", desc: "levinas ethics responsibility", tags: ["pdf", "g-drive"], semanticEmbedding: [1, 0, 0] },
  { id: 102, name: "Levinas ethics paper 2", type: "file", path: "C:\\archive\\levinas\\paper-2.pdf", desc: "levinas responsibility", tags: ["pdf"], semanticEmbedding: [1, 0, 0] },
  { id: 103, name: "Levinas ethics paper 3", type: "file", path: "C:\\archive\\levinas\\paper-3.pdf", desc: "responsibility note", tags: ["pdf"], semanticEmbedding: [1, 0, 0] },
  { id: 201, name: "Typography grid study", type: "file", path: "C:\\archive\\type\\grid.pdf", desc: "typography portfolio type design", tags: ["pdf", "type"], semanticEmbedding: [0, 1, 0] },
  { id: 999, name: "PDF storage folder", type: "folder", path: "C:\\archive\\pdf", desc: "", tags: ["pdf", "folder"], semanticEmbedding: [0, 0, 1] }
];

assert.deepEqual(getArchiveContentTerms(resources[0]), ["levinas", "ethics", "responsibility"]);
assert.deepEqual(
  getArchiveContentTerms({
    id: 300,
    name: "설 - ringringring.pdf",
    type: "file",
    path: "G:\\귀한거\\악보\\설 - ringringring.pdf",
    desc: "Indexed external reference from G:\\귀한거. Kind: note/doc. Size: 0.2 MB.",
    tags: ["reference-library", "g-drive", "귀한거", "악보", "note/doc", "pdf"]
  }),
  ["악보", "ringringring"],
  "scanner boilerplate should not outrank the explicit music-sheet tag"
);
const levinasProjectRelation = scoreArchiveProjectRelation(resources[1], projects[0], tasks);
const levinasTaskRelation = scoreArchiveTaskRelation(resources[1], tasks[0], projects);
assert.ok(levinasProjectRelation.score >= 40);
assert.ok(levinasProjectRelation.semanticScore > 0.5);
assert.ok(levinasProjectRelation.sharedTerms.includes("levinas"));
assert.ok(levinasTaskRelation.score >= 40);
assert.ok(levinasTaskRelation.semanticScore > 0.5);
assert.equal(scoreArchiveProjectRelation(resources[5], projects[0], tasks).score, 0);

const mdNote = { id: 301, name: "Levinas class note", type: "file", path: "C:\\archive\\levinas\\note.md", desc: "responsibility responsibility ethics", tags: [] };
const pdfNote = { ...mdNote, id: 302, path: "C:\\archive\\levinas\\note.pdf" };
assert.equal(scoreArchiveProjectRelation(mdNote, projects[0], tasks).score, 0, "missing cached embeddings should not invent a relation");
assert.equal(scoreArchiveProjectRelation(pdfNote, projects[0], tasks).score, 0, "file type should not change the relation score");

const result = buildAutomaticArchiveResourceLinks(projects, tasks, resources, [], {
  folderCollapseThreshold: 3
});
assert.ok(result.added >= 3);
assert.ok(result.links.some((link) => link.resourceId === 100 && link.targetType === "project" && link.targetId === 1));
assert.ok(result.links.some((link) => link.resourceId === 100 && link.targetType === "task" && link.targetId === 10));
assert.ok(result.links.some((link) => link.resourceId === 201 && link.targetType === "project" && link.targetId === 2));
assert.ok(!result.links.some((link) => [101, 102, 103].includes(link.resourceId) && link.targetId === 1));
assert.ok(!result.links.some((link) => link.resourceId === 999));
assert.ok(result.links.every((link) => link.relationStatus === "confirmed"));
assert.ok(result.links.every((link) => ["core", "reference", "evidence", "similar"].includes(link.relationType)));
assert.ok(result.links.every((link) => ["strong", "medium", "weak"].includes(link.relationStrength)));
assert.ok(result.links.every((link) => Number.isFinite(link.relationScore)));

const conservative = buildAutomaticArchiveResourceLinks(projects, tasks, [
  ...resources,
  { id: 301, name: "Loose theory reference", type: "file", path: "C:\\archive\\loose.pdf", desc: "nearby theory", tags: [], semanticEmbedding: [0.65, 0.35, 0] }
], []);
assert.ok(conservative.suggestions.some((link) => link.resourceId === 301 && link.targetType === "project" && link.targetId === 1));
assert.ok(!conservative.links.some((link) => link.resourceId === 301 && link.targetType === "project" && link.targetId === 1));
assert.ok(conservative.links.some((link) => link.relationType === "core" && link.relationStrength === "strong"));

const memoAssisted = buildAutomaticArchiveResourceLinks(
  projects,
  tasks,
  [
    {
      id: 401,
      name: "Ambiguous reference",
      type: "file",
      path: "C:\\archive\\ambiguous.pdf",
      desc: "visual reference",
      tags: [],
      semanticEmbedding: [0.45, 0.55, 0]
    }
  ],
  [
    {
      resourceId: 401,
      targetType: "task",
      targetId: 10,
      relationNote: "typography portfolio"
    }
  ]
);
assert.ok(memoAssisted.links.some((link) => link.resourceId === 401 && link.targetType === "project" && link.targetId === 2));

const normalizedLegacyLinks = normalizeArchiveResourceLinks(
  [{ resourceId: 101, targetType: "task", targetId: 10 }],
  projects,
  tasks,
  resources
);
assert.deepEqual(normalizedLegacyLinks[0], {
  resourceId: 101,
  targetType: "task",
  targetId: 10,
  relationStatus: "confirmed",
  relationType: "reference",
  relationStrength: "medium",
  relationScore: null,
  relationNote: ""
});

state.projects = projects;
state.tasks = tasks;
state.archiveResources = resources;
state.archiveResourceLinks = [{ resourceId: 201, targetType: "project", targetId: 1 }];
const added = applyAutomaticArchiveLinks();
assert.ok(added >= 3);
assert.ok(state.archiveResourceLinks.some((link) => link.resourceId === 201 && link.targetId === 1));
assert.ok(state.archiveResourceLinks.some((link) => link.resourceId === 100 && link.targetId === 1));
assert.ok(state.archiveResourceLinks.some((link) => link.resourceId === 100 && link.targetType === "task" && link.targetId === 10));
assert.ok(state.archiveResourceLinks.some((link) => link.resourceId === 201 && link.targetId === 2));

const eventSource = readFileSync("app-graph-events.js", "utf8");
assert.match(
  eventSource,
  /if \(event\.target\.matches\("#taskForm"\)\) \{[\s\S]*?state\.tasks = \[\{[\s\S]*?applyAutomaticArchiveLinks\(\);[\s\S]*?closeTaskModal\(\);/,
  "creating a task should refresh Space archive auto-links"
);
assert.match(
  eventSource,
  /if \(event\.target\.matches\("#noteForm"\)\) \{[\s\S]*?applyAutomaticArchiveLinks\(\);[\s\S]*?closeNoteModal\(\);/,
  "editing a task should refresh Space archive auto-links"
);
assert.match(
  eventSource,
  /if \(event\.target\.matches\("#deleteTaskForm"\)\) \{[\s\S]*?state\.archiveResourceLinks = \(state\.archiveResourceLinks \|\| \[\]\)\.filter/,
  "deleting a task should remove stale Space archive task links"
);

console.log("archive auto links ok");
