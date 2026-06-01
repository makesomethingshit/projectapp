import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderGraphView } from "./graph-components.js";

state.projects = [{ id: 1, parentId: null, name: "Project", status: "진행 중", progress: 40, advance: 50, note: "" }];
state.tasks = [];
state.projectLinks = [];
state.archiveResources = [];
state.archiveResourceLinks = [];
state.appSettings.graphArchiveNodes = [{ id: 10, label: "Archive", x: 70, y: 40 }];
state.appSettings.graphArchiveLinks = [];
state.appSettings.graphFormulaNodes = [];
state.appSettings.graphFormulaLinks = [];
state.appSettings.graphFormulaInputLinks = [];
state.selectedProjectId = 1;

const html = renderGraphView(state.projects[0], { full: true });

assert.match(html, /class="graph-port-label">완성<\/span>/);
assert.match(html, /class="graph-port-label">진행<\/span>/);
assert.match(html, /class="graph-port-label">자료<\/span>/);
assert.match(html, /class="graph-port-item"/);

console.log("graph port labels test passed");
