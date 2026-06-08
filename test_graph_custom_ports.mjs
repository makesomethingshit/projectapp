import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { state } from "./state.js";
import { buildGraphData, renderGraphView } from "./graph-components.js";

state.projects = [
  { id: 1, parentId: null, name: "Source", status: "진행 중", progress: 40, advance: 50, note: "" },
  { id: 2, parentId: 1, name: "Child Target", status: "진행 중", progress: 20, advance: 30, note: "" },
  { id: 3, parentId: null, name: "Top Target", status: "진행 중", progress: 20, advance: 30, note: "" }
];
state.tasks = [];
state.projectLinks = [];
state.archiveResources = [];
state.archiveResourceLinks = [];
state.appSettings.graphFormulaNodes = [];
state.appSettings.graphFormulaLinks = [];
state.appSettings.graphFormulaInputLinks = [];
state.appSettings.graphArchiveNodes = [];
state.appSettings.graphArchiveLinks = [];
state.appSettings.graphCustomPortLinks = [];
state.appSettings.graphNodePortSettings = {
  "project:1": {
    enabled: ["completion", "custom-mood"],
    custom: [{ id: "mood", label: "Mood" }]
  },
  "project:2": {
    enabled: ["deadline", "custom-mood"],
    custom: [{ id: "mood", label: "Mood" }]
  },
  "project:3": {
    enabled: ["deadline"],
    custom: []
  }
};
state.selectedProjectId = 1;

const html = renderGraphView(state.projects[0], { full: true });

assert.match(html, /data-graph-port-settings="project:1"/);
assert.match(html, /data-graph-port-section="project:1" open/);
assert.match(html, /class="graph-port-section-count">2\/11/);
assert.match(html, /class="graph-port-section-body"/);
assert.match(html, /graph-managed-port-stack[\s\S]*data-graph-port-id="1"[\s\S]*data-graph-port-metric="custom-mood"/);
assert.doesNotMatch(html, /class="graph-child-port-panel"/);
assert.match(html, /하위 프로젝트/);
assert.match(html, /data-graph-port-toggle="project:2"/);
assert.match(html, /graph-child-port-stack managed[\s\S]*data-graph-port-id="2"[\s\S]*data-graph-port-metric="custom-mood"/);
assert.match(html, /data-graph-delete-custom-port="project:2:custom-mood"/);
assert.match(html, /data-graph-connect-metric="custom-mood"/);
assert.match(html, /data-graph-source-port="custom-mood"/);
assert.match(html, /data-graph-target-port="custom-mood"/);

state.appSettings.graphNodePortSettings = {};
const defaultHtml = renderGraphView(state.projects[0], { full: true });
assert.match(defaultHtml, /graph-managed-port-stack[\s\S]*data-graph-port-id="1"[\s\S]*data-graph-port-metric="completion"/);
assert.match(defaultHtml, /graph-managed-port-stack[\s\S]*data-graph-port-id="1"[\s\S]*data-graph-port-metric="advance"/);
assert.doesNotMatch(defaultHtml, /graph-child-port-stack managed[\s\S]*data-graph-port-id="2"[\s\S]*data-graph-port-metric="completion"/);

state.appSettings.graphNodePortSettings = {
  "project:2": {
    enabled: ["completion"],
    custom: []
  }
};
const childEnabledHtml = renderGraphView(state.projects[0], { full: true });
assert.match(childEnabledHtml, /graph-child-port-stack managed[\s\S]*data-graph-port-id="2"[\s\S]*data-graph-port-metric="completion"/);

state.projectLinks = [
  { sourceId: 2, targetId: 3, metric: "completion", weight: 30 },
  { sourceId: 2, targetId: 3, metric: "advance", weight: 30 }
];
state.appSettings.graphNodePortSettings = {
  "project:2": {
    enabled: ["completion", "advance"],
    custom: []
  }
};
const alignedGraph = buildGraphData(state.projects[0], { full: true });
const completionEdge = alignedGraph.edges.find((edge) => edge.sourceId === 2 && edge.targetId === 3 && edge.metric === "completion");
const advanceEdge = alignedGraph.edges.find((edge) => edge.sourceId === 2 && edge.targetId === 3 && edge.metric === "advance");
assert.notEqual(completionEdge.sourcePortY, advanceEdge.sourcePortY);
assert.equal(completionEdge.sourcePortY < advanceEdge.sourcePortY, true);

state.appSettings.graphCustomPortLinks.push({
  id: "custom:project:1:custom-mood:project:2:deadline",
  sourceType: "project",
  sourceId: 1,
  sourcePort: "custom-mood",
  targetType: "project",
  targetId: 3,
  targetPort: "deadline",
  weight: 30
});

assert.equal(state.appSettings.graphCustomPortLinks.length, 1);
const graph = buildGraphData(state.projects[0], { full: true });
assert.equal(graph.edges.some((edge) => edge.linkKind === "custom" && edge.sourcePort === "custom-mood" && edge.targetPort === "deadline"), true);

const eventSource = readFileSync("app-graph-events.js", "utf8");
assert.match(
  eventSource,
  /event\.target\.closest\("\.graph-port-settings, \[data-graph-port-slot\]"\)[\s\S]*?event\.stopPropagation\(\);[\s\S]*?return;/
);
assert.match(eventSource, /suppressNextGraphPortToggle/);
assert.match(eventSource, /closeSuppressedGraphPortDetails/);
assert.match(eventSource, /graph-port-settings > summary, \.graph-port-settings-section > summary/);
assert.match(eventSource, /event\.preventDefault\(\);[\s\S]*?event\.stopImmediatePropagation\(\);/);
assert.match(eventSource, /document\.addEventListener\("toggle"[\s\S]*?closeSuppressedGraphPortDetails\(details\);/);

console.log("graph custom ports test passed");
