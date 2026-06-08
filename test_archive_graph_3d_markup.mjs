import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

const packageSource = readFileSync("package.json", "utf8");
const indexSource = readFileSync("index.html", "utf8");
const appSource = readFileSync("app.js", "utf8");
const rendererSource = readFileSync("archive-graph-3d.js", "utf8");
const cssSource = readFileSync("components.css", "utf8");

assert.match(packageSource, /"three":/);
assert.match(packageSource, /archive-graph-3d\.js/);
assert.match(packageSource, /node_modules\/three\/build\/three\.module\.js/);
assert.match(packageSource, /OrbitControls\.js/);
assert.match(indexSource, /archive-graph-3d\.js/);
assert.match(indexSource, /type="importmap"/);
assert.match(indexSource, /"three": "\.\/node_modules\/three\/build\/three\.module\.js"/);
assert.match(appSource, /initArchiveGraph3D/);
assert.match(rendererSource, /THREE\.Scene/);
assert.match(rendererSource, /OrbitControls/);
assert.match(rendererSource, /data-archive-graph-3d/);
assert.match(rendererSource, /function buildGraphContext/);
assert.match(rendererSource, /connectedToActive/);
assert.match(rendererSource, /function shouldLabelNode/);
assert.match(rendererSource, /return node\.active;/);
assert.match(rendererSource, /let hoverLabel = null/);
assert.match(rendererSource, /const clearHoverLabel = \(\) =>/);
assert.match(rendererSource, /removeEventListener\("pointerleave", handlePointerLeave\)/);
assert.match(rendererSource, /!node\.active && !hoverLabel/);
assert.match(rendererSource, /function createHalo/);
assert.match(rendererSource, /degree \|\| 0/);
assert.match(rendererSource, /function formatTooltip/);
assert.match(rendererSource, /function summarizeBacklink/);
assert.match(rendererSource, /explicitLinkCount|backlinks/);
assert.match(rendererSource, /relationStrength/);
assert.match(rendererSource, /SPACE_BACKGROUND/);
assert.match(rendererSource, /space-dust/);
assert.match(rendererSource, /space-stars-far/);
assert.match(rendererSource, /space-stars-near/);
assert.match(rendererSource, /THREE\.AdditiveBlending/);
assert.match(rendererSource, /constellation-line-glow/);
assert.match(rendererSource, /constellationLines/);
assert.match(rendererSource, /clock\.getElapsedTime/);
assert.match(cssSource, /\.archive-graph-3d-canvas/);
assert.match(cssSource, /\.archive-graph-3d::before/);
assert.match(cssSource, /mix-blend-mode: screen/);
assert.match(cssSource, /#060914/);

state.projects = [{ id: 10, name: "Levinas Study", note: "levinas totality infinity explanation" }];
state.tasks = [{ id: 20, projectId: 10, name: "Levinas task", note: "truth justice being" }];
state.archiveResources = [
  { id: 1, name: "Levinas totality infinity.pdf", type: "file", path: "G:\\levinas\\a.pdf", desc: "levinas truth justice explanation", tags: [], semanticEmbedding: [1, 0, 0] },
  { id: 2, name: "Levinas otherwise than being.pdf", type: "file", path: "G:\\levinas\\b.pdf", desc: "levinas subjectivity responsibility", tags: [], semanticEmbedding: [0.96, 0.04, 0] },
  { id: 3, name: "Levinas ethics notes.pdf", type: "file", path: "G:\\levinas\\c.pdf", desc: "levinas ethics responsibility", tags: [], semanticEmbedding: [0.93, 0.07, 0] }
];
state.archiveResourceLinks = [{ resourceId: 1, targetType: "task", targetId: 20 }];
state.selectedArchiveResourceId = 1;
state.appSettings.archiveViewMode = "graph";
state.appSettings.archiveGraphDisplayMode = "graph3d";
state.appSettings.archiveGraphDepth = 2;

const graph3dHtml = renderArchiveView();
assert.match(graph3dHtml, /data-archive-graph-3d/);
assert.match(graph3dHtml, /data-archive-graph-3d-canvas/);
assert.match(graph3dHtml, /data-archive-graph-3d-payload/);
const graph3dPayloadText = graph3dHtml.match(/<script type="application\/json" data-archive-graph-3d-payload>([\s\S]*?)<\/script>/)?.[1] || "";
const graph3dPayload = JSON.parse(graph3dPayloadText);
assert.ok(graph3dPayload.nodes.length >= 3);
assert.ok(graph3dPayload.links.length >= 1);
assert.equal(graph3dPayload.nodes.find((node) => node.id === "resource:1").explicitLinkCount, 1);
assert.match(JSON.stringify(graph3dPayload.nodes.find((node) => node.id === "resource:1").backlinks), /Levinas task/);
assert.match(JSON.stringify(graph3dPayload.nodes.find((node) => node.id === "resource:1").backlinks), /relationType/);
assert.ok(graph3dPayload.nodes.every((node) => String(node.id).startsWith("resource:")));
assert.ok(graph3dPayload.links.every((link) => String(link.source).startsWith("resource:") && String(link.target).startsWith("resource:")));
assert.match(graph3dHtml, /data-archive-graph-display-mode="graph3d"[^>]*>3D Graph/);
assert.match(graph3dHtml, /data-archive-graph-depth="2" class="active"/);
assert.match(graph3dHtml, /selected core/);
assert.doesNotMatch(graph3dHtml, /data-archive-graph-pan-catcher/);

state.appSettings.archiveGraphDisplayMode = "graph2d";
const graph2dHtml = renderArchiveView();
assert.match(graph2dHtml, /data-archive-graph-pan-catcher/);
const graph2dPayloadText = graph2dHtml.match(/<script type="application\/json" data-archive-graph-payload>([\s\S]*?)<\/script>/)?.[1] || "";
const graph2dPayload = JSON.parse(graph2dPayloadText);
assert.ok(graph2dPayload.nodes.length >= 3);
assert.ok(graph2dPayload.nodes.every((node) => String(node.id).startsWith("resource:")));
assert.ok(graph2dPayload.links.every((link) => String(link.source).startsWith("resource:") && String(link.target).startsWith("resource:")));
assert.doesNotMatch(graph2dHtml, /data-archive-graph-3d-canvas/);

console.log("archive 3d graph markup ok");
