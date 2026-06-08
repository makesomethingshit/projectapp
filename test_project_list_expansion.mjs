import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { state } from "./state.js";

const inertElement = {
  innerHTML: "",
  hidden: false,
  dataset: {},
  style: {},
  classList: {
    add() {},
    remove() {},
    toggle() {}
  },
  addEventListener() {},
  appendChild() {},
  remove() {},
  setAttribute() {},
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  }
};

globalThis.document = {
  documentElement: { dataset: {} },
  querySelector() {
    return inertElement;
  },
  querySelectorAll() {
    return [];
  },
  getElementById() {
    return inertElement;
  },
  createElement() {
    return { ...inertElement };
  },
  addEventListener() {},
  elementFromPoint() {
    return null;
  }
};

globalThis.window = {
  innerWidth: 1200,
  workshopApp: {
    setAlwaysOnTop: async (value) => value,
    getAlwaysOnTop: async () => false
  },
  addEventListener() {}
};
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};
globalThis.requestAnimationFrame = (callback) => callback();

const { getVisibleProjectRows, syncProjectListExpansion } = await import("./app.js");

state.projects = [
  { id: 1, parentId: null, name: "Book", status: "active", progress: 15, advance: 20, deadline: null, note: "" },
  { id: 2, parentId: 1, name: "Levinas", status: "active", progress: 25, advance: 25, deadline: null, note: "" },
  { id: 3, parentId: 1, name: "Body", status: "active", progress: 15, advance: 15, deadline: null, note: "" },
  { id: 4, parentId: null, name: "Typography", status: "active", progress: 9, advance: 20, deadline: null, note: "" }
];
state.tasks = [];
state.projectLinks = [];
state.searchQuery = "";
state.projectFilter = "all";

state.selectedProjectId = 4;
state.expandedProjectIds = new Set([1]);
syncProjectListExpansion(state.selectedProjectId);

assert.deepEqual([...state.expandedProjectIds], [], "stale expansion from another root is pruned");
assert.deepEqual(
  getVisibleProjectRows().map(({ project }) => project.id),
  [1, 4],
  "unselected parent children stay hidden in the project list"
);

state.selectedProjectId = 1;
syncProjectListExpansion(state.selectedProjectId);

assert.deepEqual([...state.expandedProjectIds], [1], "selected parent with children expands");
assert.deepEqual(
  getVisibleProjectRows().map(({ project }) => project.id),
  [1, 2, 3, 4],
  "selected parent reveals direct children"
);

state.selectedProjectId = 2;
syncProjectListExpansion(state.selectedProjectId);

assert.deepEqual([...state.expandedProjectIds], [1], "selected child reveals its ancestor path");
assert.deepEqual(
  getVisibleProjectRows().map(({ project }) => project.id),
  [1, 2, 3, 4],
  "selected child keeps its parent branch visible"
);

const eventSource = readFileSync("app-graph-events.js", "utf8");
assert.doesNotMatch(
  eventSource,
  /expandedProjectIds\.add\(state\.selectedProjectId\)/,
  "project row selection must not accumulate stale expanded branches"
);

console.log("project list expansion test passed");
