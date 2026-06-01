import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderBottleneckAlertCard } from "./ui-components.js";

state.projects = [
  { id: 1, parentId: null, name: "Parent", progress: 0, advance: 0, contributionMode: "both" }
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

assert.match(html, /bottleneck-recommendation/);
assert.match(html, /추천/);
assert.match(html, /이 할 일을 먼저 올리면 완성도 병목이 가장 빨리 줄어듭니다\./);
assert.match(html, /bottleneck-action-btn trace/);
assert.match(html, /bottleneck-action-btn pin/);
assert.doesNotMatch(html, /\[.*\]/);

console.log("bottleneck recommendation markup test passed");
