import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderGraphView } from "./graph-components.js";

state.projects = [{ id: 1, parentId: null, name: "Project", status: "진행 중", progress: 40, advance: 50, note: "" }];
state.tasks = [];
state.projectLinks = [];
state.archiveResources = [];
state.archiveResourceLinks = [];
state.appSettings.graphArchiveNodes = [];
state.appSettings.graphArchiveLinks = [];
state.appSettings.graphFormulaNodes = [];
state.appSettings.graphFormulaLinks = [];
state.appSettings.graphFormulaInputLinks = [];
state.selectedProjectId = 1;

const html = renderGraphView(state.projects[0], { full: true });

assert.match(html, /data-graph-connect-target="archiveProject"/);
assert.match(html, /data-graph-connect-metric="archive"/);
assert.match(html, /자료 연결/);

console.log("archive project port markup test passed");
