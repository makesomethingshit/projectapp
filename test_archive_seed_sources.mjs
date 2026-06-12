import assert from "node:assert/strict";
import { DEFAULT_ARCHIVE_SOURCES } from "./archive-seed-sources.js";
import { ensureDefaultArchiveSources, ensureDesignSiteTaskLink, state } from "./state.js";
import { renderArchiveView, taskCardMarkup, taskLauncherMarkup } from "./ui-components.js";

state.archiveResources = [];
state.selectedArchiveResourceId = null;

const source = DEFAULT_ARCHIVE_SOURCES.find((entry) => entry.id === "g-precious-reference-library");
assert.ok(source, "G precious reference source should be registered");
const designReferenceLinks = source.resources.filter((resource) => resource.type === "link" && resource.tags?.includes("디자인 참고 사이트"));
assert.equal(designReferenceLinks.length, 185);
assert.ok(designReferenceLinks.some((resource) => resource.path === "https://bpando.org/logo-reviews/"));
assert.ok(designReferenceLinks.some((resource) => resource.path === "https://parksb.github.io/article/37.html"));

const added = ensureDefaultArchiveSources();
assert.equal(added, source.resources.length);
assert.equal(state.archiveResources.length, source.resources.length);

const root = state.archiveResources.find((resource) => resource.path === "G:\\귀한거");
assert.ok(root, "G precious root folder should be added");
assert.equal(root.type, "folder");
assert.ok(root.tags.includes("reference-library"));
assert.ok(root.tags.includes("귀한거"));
assert.equal(state.selectedArchiveResourceId, root.id);

const duplicateAdded = ensureDefaultArchiveSources();
assert.equal(duplicateAdded, 0);
assert.equal(state.archiveResources.length, source.resources.length);

state.projects = [{ id: 3, parentId: 2, name: "개인 웹사이트", status: "진행 중", progress: 30, note: "" }];
state.tasks = [{ id: 777, name: "디자인 사이트 보기 ", projectId: 3, progress: 15, advance: 20, contributionMode: "advance", note: "사용자가 직접 만든 할일" }];
state.archiveResourceLinks = [];
const ensuredDesignTaskLink = ensureDesignSiteTaskLink();
const designTask = state.tasks.find((task) => task.name === "디자인 사이트 보기");
const userDesignTask = state.tasks.find((task) => Number(task.id) === 777);
const designSiteResources = state.archiveResources.filter((resource) => resource.type === "link" && resource.tags?.includes("디자인 참고 사이트"));
assert.equal(ensuredDesignTaskLink, designSiteResources.length * 2);
assert.equal(designTask, undefined);
assert.ok(userDesignTask, "existing user design site task should be reused");
assert.equal(designSiteResources.length, 185);
assert.ok(designSiteResources.some((resource) => resource.path === "https://bpando.org/logo-reviews/"));
assert.ok(designSiteResources.every((resource) => state.archiveResourceLinks.some((link) => (
  Number(link.resourceId) === Number(resource.id)
  && link.targetType === "task"
  && Number(link.targetId) === Number(userDesignTask.id)
))));
const confidenceLinkForPath = (path) => {
  const resource = designSiteResources.find((item) => item.path === path);
  assert.ok(resource, `${path} should be seeded as a design reference`);
  const link = state.archiveResourceLinks.find((item) => (
    Number(item.resourceId) === Number(resource.id)
    && item.targetType === "task"
    && Number(item.targetId) === Number(userDesignTask.id)
  ));
  assert.ok(link, `${path} should be linked to the design site task`);
  return link;
};
const itsNiceThatLink = confidenceLinkForPath("https://www.itsnicethat.com/graphic-design");
assert.equal(itsNiceThatLink.relationStrength, "strong");
assert.equal(itsNiceThatLink.relationScore, 94);
assert.ok(itsNiceThatLink.relationNote.includes("\uc8fc\uac04 1\ud398\uc774\uc9c0"));
const bpandoLink = confidenceLinkForPath("https://bpando.org/logo-reviews/");
assert.equal(bpandoLink.relationStrength, "strong");
assert.equal(bpandoLink.relationScore, 86);
const parksbLink = confidenceLinkForPath("https://parksb.github.io/article/37.html");
assert.equal(parksbLink.relationStrength, "weak");
assert.equal(parksbLink.relationScore, 34);
itsNiceThatLink.relationStrength = "medium";
itsNiceThatLink.relationScore = 0;
itsNiceThatLink.relationNote = "";
const migratedLegacyConfidence = ensureDesignSiteTaskLink();
assert.equal(migratedLegacyConfidence, 1);
const migratedItsNiceThatLink = confidenceLinkForPath("https://www.itsnicethat.com/graphic-design");
assert.equal(migratedItsNiceThatLink.relationStrength, "strong");
assert.equal(migratedItsNiceThatLink.relationScore, 94);
const duplicateDesignTaskLink = ensureDesignSiteTaskLink();
assert.equal(duplicateDesignTaskLink, 0);
assert.equal(state.tasks.length, 1);
assert.equal(state.archiveResourceLinks.filter((link) => (
  link.targetType === "task"
  && Number(link.targetId) === Number(userDesignTask.id)
  && designSiteResources.some((resource) => Number(resource.id) === Number(link.resourceId))
)).length, 185);
const designTaskCardHtml = taskCardMarkup(userDesignTask);
assert.match(designTaskCardHtml, /자료 185개/);
const designTaskLauncherHtml = taskLauncherMarkup(userDesignTask.id);
assert.match(designTaskLauncherHtml, /BP&amp;O/);
assert.match(designTaskLauncherHtml, /https:\/\/bpando\.org\/logo-reviews\//);

state.projects = [];
state.tasks = [];
state.archiveResourceLinks = [];
state.appSettings.archiveViewMode = "graph";
state.appSettings.archiveGraphDisplayMode = "graph2d";
const graphHtml = renderArchiveView();
assert.match(graphHtml, /data-archive-graph-node="resource:/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="source:archive-index"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="collection:source:archive-index:/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:reference-library"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:g-drive"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:pdf"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:gpt"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:note-doc"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:indexed"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:of"/);
assert.doesNotMatch(graphHtml, /data-archive-graph-node="tag:external"/);
assert.match(graphHtml, /Active Context/);
assert.match(graphHtml, /Strong Relations/);
assert.match(graphHtml, /Visible Materials/);
assert.match(graphHtml, /Topic Touchpoints/);
assert.match(graphHtml, /Archive Relation Map/);
assert.match(graphHtml, /selected material first, nearest relations next/);

console.log("archive seed sources ok");
