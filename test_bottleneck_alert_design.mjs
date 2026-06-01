import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderBottleneckAlertCard } from "./ui-components.js";

state.projects = [
  { id: 1, name: "Parent", progress: 0, advance: 0 }
];
state.tasks = [
  { id: 10, projectId: 1, name: "Slow task", progress: 0, advance: 0, contributionMode: "both" },
  { id: 11, projectId: 1, name: "Done task", progress: 100, advance: 100, contributionMode: "both" }
];
state.projectLinks = [];
state.completionWeights = {};
state.appSettings.graphFormulaNodes = [];
state.appSettings.graphFormulaLinks = [];
state.appSettings.graphFormulaInputLinks = [];

const html = renderBottleneckAlertCard(state.projects[0]);

assert.match(html, /병목요인/);
assert.match(html, /bottleneck-action-btn trace/);
assert.match(html, />추적</);
assert.match(html, /bottleneck-action-btn pin/);
assert.match(html, />집중</);
assert.doesNotMatch(html, /\[.*\]/);

console.log("bottleneck alert design test passed");
