import assert from "node:assert/strict";
import { applyBottleneckDetailNavigation } from "./detail-navigation.js";

const appState = {
  projects: [{ id: 1 }, { id: 2 }],
  tasks: [{ id: 10, projectId: 2 }],
  selectedProjectId: 1,
  detailFilter: "todo",
  viewMode: "graph",
  appSettings: {
    globalGraphView: true
  },
  selectedGraphProjectIds: new Set([1])
};

assert.equal(applyBottleneckDetailNavigation(appState, "task", 10), 2);
assert.equal(appState.selectedProjectId, 2);
assert.equal(appState.viewMode, "detail");
assert.equal(appState.detailFilter, "all");
assert.equal(appState.appSettings.globalGraphView, false);
assert.deepEqual([...appState.selectedGraphProjectIds], [2]);

assert.equal(applyBottleneckDetailNavigation(appState, "project", 1), 1);
assert.equal(appState.selectedProjectId, 1);

assert.equal(applyBottleneckDetailNavigation(appState, "task", 999), null);

console.log("detail bottleneck navigation test passed");
