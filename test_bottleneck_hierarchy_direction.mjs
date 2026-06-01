import assert from "node:assert/strict";
import { state } from "./state.js";
import { getBottleneckDetails } from "./calculator.js";

state.projects = [
  { id: 1, parentId: null, name: "Parent", progress: 0, advance: 0, contributionMode: "both" },
  { id: 2, parentId: 1, name: "Child", progress: 100, advance: 100, contributionMode: "both" },
  { id: 3, parentId: 1, name: "Slow sibling", progress: 0, advance: 0, contributionMode: "both" }
];
state.tasks = [];
state.projectLinks = [
  { sourceId: 1, targetId: 2, metric: "completion", weight: 50 }
];
state.completionWeights = {};
state.appSettings.graphFormulaNodes = [];
state.appSettings.graphFormulaLinks = [];
state.appSettings.graphFormulaInputLinks = [];

const childBottlenecks = getBottleneckDetails(2);

assert.equal(
  childBottlenecks.some((item) => item.sourceType === "project" && item.sourceId === 1),
  false
);

console.log("bottleneck hierarchy direction test passed");
