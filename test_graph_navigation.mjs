import assert from "node:assert/strict";
import { applyGraphProjectDoubleClickNavigation } from "./graph-navigation.js";

const appState = {
  selectedProjectId: 1,
  detailFilter: "done",
  selectedGraphProjectIds: new Set([1, 2]),
  appSettings: {
    globalGraphView: false,
    graphScope: "all"
  }
};

applyGraphProjectDoubleClickNavigation(appState, 7);

assert.equal(appState.selectedProjectId, 7);
assert.equal(appState.detailFilter, "all");
assert.equal(appState.appSettings.globalGraphView, true);
assert.equal(appState.appSettings.graphScope, "local");
assert.deepEqual([...appState.selectedGraphProjectIds], [7]);

console.log("graph project double-click navigation test passed");
