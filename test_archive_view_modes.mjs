import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

function graph3dPayload(html) {
  const match = html.match(/<script type="application\/json" data-archive-graph-3d-payload>([\s\S]*?)<\/script>/);
  assert.ok(match, "3D Space payload should render");
  return JSON.parse(match[1]);
}

state.projects = [
  { id: 10, name: "Brand Project", parentId: null, note: "logo system" },
  { id: 11, name: "Typography Web", parentId: null, note: "type grid layout" }
];
state.tasks = [
  { id: 20, name: "Review mood board", projectId: 10, note: "logo mood board" },
  { id: 21, name: "Typography cleanup", projectId: 11, note: "type grid layout" }
];
state.archiveResources = [
  { id: 1, name: "Logo guide", type: "file", path: "C:\\logo.pdf", desc: "brand logo system", tags: ["Brand", "pdf", "g-drive"], semanticEmbedding: [1, 0, 0] },
  { id: 2, name: "Mood board", type: "link", path: "https://example.com", desc: "brand visual mood", tags: ["Reference"], semanticEmbedding: [0.96, 0.04, 0] },
  { id: 3, name: "Asset folder", type: "folder", path: "C:\\assets", desc: "", tags: [], semanticEmbedding: [1, 0, 0] },
  { id: 4, name: "Typography reference", type: "file", path: "C:\\type.pdf", desc: "typography type grid layout", tags: ["Typography"], semanticEmbedding: [0, 1, 0] }
];
state.archiveResourceLinks = [
  { resourceId: 1, targetType: "project", targetId: 10, relationStrength: "strong", relationScore: 88, relationType: "core", relationNote: "Start here" },
  { resourceId: 2, targetType: "task", targetId: 20, relationStrength: "medium", relationScore: 62, relationType: "reference" },
  { resourceId: 4, targetType: "task", targetId: 21, relationStrength: "weak", relationScore: 28, relationType: "similar" }
];
state.selectedArchiveResourceId = 1;

state.appSettings.archiveViewMode = "topic";
let html = renderArchiveView();
assert.match(html, /data-archive-view-mode="topic" class="active"/);
assert.match(html, />Brand \(1\)</);
assert.match(html, />Reference \(1\)</);
assert.match(html, />Typography \(1\)</);
assert.match(html, /class="archive-explorer-open-link"[^>]*data-open-archive-path="https:\/\/example\.com"[^>]*data-archive-type="link"/);
assert.match(html, /class="archive-explorer-open-link"[^>]*data-open-archive-path="C:\\logo\.pdf"[^>]*data-archive-type="file"/);
assert.match(html, /class="archive-explorer-open-link"[^>]*data-open-archive-path="C:\\assets"[^>]*data-archive-type="folder"/);

state.appSettings.archiveViewMode = "type";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="type" class="active"/);
assert.match(html, /data-archive-type="link"/);
assert.match(html, /data-archive-type="file"/);

state.appSettings.archiveViewMode = "all";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="all" class="active"/);
assert.match(html, />전체 \(4\)</);

state.appSettings.archiveViewMode = "graph";
state.appSettings.archiveGraphDisplayMode = "graph3d";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="graph" class="active"/);
assert.match(html, /data-archive-graph-view/);
assert.match(html, /Space Observatory/);
assert.match(html, />Space</);
assert.match(html, /archive-main graph-mode/);
assert.match(html, /archive-backlinks graph-mode/);
assert.match(html, /data-archive-graph-3d/);
assert.match(html, /data-archive-graph-3d-canvas/);
assert.match(html, /data-archive-graph-display-mode="graph3d"/);
assert.match(html, /archive-graph-observatory/);
assert.match(html, /archive-graph-inspector-card/);
assert.match(html, /\uc120\ud0dd \uc790\ub8cc/);
assert.match(html, /\uc790\ub8cc \ud488\uc9c8/);
assert.match(html, /\uc774 \ud504\ub85c\uc81d\ud2b8\uc5d0\uc11c\uc758 \uc2e0\ub8b0\ub3c4/);
assert.match(html, /\uac00\uc7a5 \uac15\ud55c \uc5f0\uacb0/);
assert.match(html, /\ud050\ub808\uc774\uc158 \ubd84\ud3ec/);
assert.match(html, /\uc5f0\uacb0\ub41c \uc791\uc5c5/);
assert.match(html, /\ubc94\uc704/);
assert.doesNotMatch(html, /\uac70\ub9ac/);
assert.doesNotMatch(html, /\+1\ub2e8\uacc4/);
assert.match(html, /archive-graph-lane-metrics/);
assert.match(html, /data-archive-relation-strength="strong"/);
assert.match(html, /data-archive-relation-note="true"/);
assert.doesNotMatch(html, /Active Context/);
assert.doesNotMatch(html, /Strong Relations/);
assert.doesNotMatch(html, /Visible Materials/);

const payload = graph3dPayload(html);
assert.ok(payload.nodes.some((node) => node.id === "resource:1" && node.active));
assert.ok(payload.nodes.some((node) => node.id === "resource:2" && node.relationLane === "middle"));
assert.ok(payload.meta.relationLaneCounts.first >= 1);
assert.ok(payload.meta.relationLaneCounts.middle >= 1);

state.appSettings.archiveGraphDisplayMode = "graph2d";
html = renderArchiveView();
assert.match(html, /data-archive-graph-display-mode="graph2d"/);
assert.match(html, /data-archive-graph-node="resource:1"/);
assert.doesNotMatch(html, /data-archive-graph-node="tag:brand"/);
assert.doesNotMatch(html, /data-archive-graph-node="similarity:logo"/);
assert.match(html, /archive-graph-workspace/);
assert.match(html, /archive-graph-inspector/);
assert.match(html, /archive-graph-observatory/);
assert.match(html, /archive-graph-canvas-top/);
assert.match(html, /archive-graph-node-mark/);
assert.match(html, /data-archive-graph-pan-catcher/);
assert.match(html, /data-archive-graph-pan-layer/);
assert.match(html, /data-archive-graph-control-hint/);
assert.match(html, /Archive Relation Map/);

state.selectedArchiveResourceId = 300;
state.archiveResources = [
  {
    id: 300,
    name: "Ring note.pdf",
    type: "file",
    path: "G:\\archive\\ring-note.pdf",
    desc: "Indexed external reference. Kind: note/doc. Size: 0.2 MB.",
    tags: ["reference-library", "g-drive", "ring", "note/doc", "pdf"],
    semanticEmbedding: [1, 0]
  },
  {
    id: 301,
    name: "Typography layout.pdf",
    type: "file",
    path: "G:\\archive\\type.pdf",
    desc: "typography layout structure",
    tags: ["typography"],
    semanticEmbedding: [0, 1]
  }
];
state.archiveResourceLinks = [];
state.appSettings.archiveGraphDisplayMode = "graph3d";
html = renderArchiveView();
const weirdPayload = graph3dPayload(html);
const activeNode = weirdPayload.nodes.find((node) => node.id === "resource:300");
assert.ok(activeNode, "selected archive material should remain in Space payload");
assert.ok(activeNode.terms.includes("ring"));
assert.ok(!activeNode.terms.some((term) => ["kind", "size", "mb", "items"].includes(term)));
assert.doesNotMatch(html, /Topic Touchpoints/);
assert.doesNotMatch(html, /Similar Documents/);
assert.doesNotMatch(html, /Folder Candidates/);

const eventSource = readFileSync("app-graph-events.js", "utf8");
const stateSource = readFileSync("state.js", "utf8");
const styleSource = readFileSync("components.css", "utf8");
const appSource = readFileSync("app.js", "utf8");
const indexSource = readFileSync("index.html", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const d3Source = readFileSync("archive-graph-d3.js", "utf8");
const mainSource = readFileSync("main.js", "utf8");
const openingBraces = (styleSource.match(/{/g) || []).length;
const closingBraces = (styleSource.match(/}/g) || []).length;

assert.match(eventSource, /\["topic", "type", "all", "graph"\]\.includes\(mode\)/);
assert.match(eventSource, /archiveGraphPanDrag/);
assert.match(eventSource, /applyArchiveGraphPan/);
assert.match(eventSource, /state\.appSettings\.archiveViewMode === "graph"[\s\S]*state\.appSettings\.archiveViewMode = "all"/);
assert.match(stateSource, /\["topic", "type", "all", "graph"\]\.includes\(state\.appSettings\.archiveViewMode\)/);
assert.equal(openingBraces, closingBraces);
assert.match(styleSource, /\.archive-backlinks\.graph-mode\s*{[\s\S]*?display: none;/);
assert.match(styleSource, /\.archive-graph-view-node\s*{[\s\S]*?border-radius: 8px;/);
assert.match(styleSource, /\.archive-graph-view-node\.file,/);
assert.match(styleSource, /\.archive-graph-view-edge-label\s*{/);
assert.match(styleSource, /\.archive-graph-inspector-card\s*{/);
assert.match(styleSource, /\.archive-graph-lane-metrics\s*{/);
assert.match(styleSource, /\.archive-graph-linked-work\s*{/);
assert.match(styleSource, /\.archive-graph-view-canvas\s*{[\s\S]*?#161718/);
assert.match(styleSource, /\.archive-graph-pan-catcher\s*{[\s\S]*?touch-action: none;/);
assert.match(styleSource, /\.archive-graph-workspace\s*{/);
assert.match(styleSource, /\.archive-graph-inspector\s*{/);
assert.match(html, /data-archive-graph-3d-payload/);
assert.match(appSource, /initArchiveGraphD3/);
assert.match(appSource, /lastWorkspaceWindowMode/);
assert.match(appSource, /windowMode = isGlobalGraph \? "graph" : isArchive \? "archive" : "detail"/);
assert.match(appSource, /setWindowSize\(1360, 900\)/);
assert.match(indexSource, /node_modules\/d3\/dist\/d3\.min\.js/);
assert.match(packageSource, /"d3": "\^7\.9\.0"/);
assert.match(packageSource, /"archive-graph-d3\.js"/);
assert.match(packageSource, /"node_modules\/d3\/dist\/d3\.min\.js"/);
assert.match(d3Source, /d3\.forceSimulation/);
assert.match(d3Source, /d3\.drag/);
assert.match(d3Source, /link\.type === "related"/);
assert.match(d3Source, /link\.type === "similarity"/);
assert.doesNotMatch(d3Source, /addEventListener\("pointerdown"/);
assert.doesNotMatch(d3Source, /addEventListener\("wheel"/);
assert.match(d3Source, /node\.degree/);
assert.match(d3Source, /labelSelection/);
assert.match(mainSource, /"archive-graph-d3\.js"/);

console.log("archive view modes test passed");
