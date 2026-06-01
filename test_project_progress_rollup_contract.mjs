import assert from "node:assert/strict";
import { state } from "./state.js";
import {
  getRollupProgress,
  getRollupAdvance,
  getProjectDisplayProgress,
  getProjectDisplayAdvance,
  pruneCompletionWeights
} from "./calculator.js";

function resetState({ projects, tasks = [], projectLinks = [], formulaNodes = [], formulaLinks = [] }) {
  state.projects = projects.map((project) => ({
    status: "진행 중",
    note: "",
    deadline: null,
    contributionMode: "both",
    advance: project.progress ?? 0,
    ...project
  }));
  state.tasks = tasks.map((task) => ({
    note: "",
    contributionMode: "both",
    advance: task.progress ?? 0,
    ...task
  }));
  state.projectLinks = projectLinks;
  state.completionWeights = {};
  state.appSettings.graphFormulaNodes = formulaNodes;
  state.appSettings.graphFormulaLinks = formulaLinks;
  state.appSettings.graphFormulaInputLinks = [];
}

resetState({
  projects: [
    { id: 1, parentId: null, name: "Fallback only", progress: 34, advance: 56 }
  ]
});

assert.equal(getRollupProgress(1), 34, "stored project progress is fallback completion without contributors");
assert.equal(getRollupAdvance(1), 56, "stored project advance is fallback advance without contributors");
assert.equal(getProjectDisplayProgress(1), getRollupProgress(1), "display completion uses rollup helper");
assert.equal(getProjectDisplayAdvance(1), getRollupAdvance(1), "display advance uses rollup helper");

resetState({
  projects: [
    { id: 1, parentId: null, name: "Parent", progress: 10, advance: 20 }
  ],
  tasks: [
    { id: 10, projectId: 1, name: "Completion task", progress: 80, advance: 15, contributionMode: "completion" },
    { id: 11, projectId: 1, name: "Advance task", progress: 5, advance: 60, contributionMode: "advance" }
  ]
});

assert.equal(getRollupProgress(1), 80, "completion task overrides project fallback completion");
assert.equal(getRollupAdvance(1), 60, "advance task overrides project fallback advance");
assert.equal(state.projects[0].progress, 10, "rollup does not mutate stored project progress");
assert.equal(state.projects[0].advance, 20, "rollup does not mutate stored project advance");

resetState({
  projects: [
    { id: 1, parentId: null, name: "Parent", progress: 5, advance: 5 },
    { id: 2, parentId: 1, name: "Child", progress: 70, advance: 40, contributionMode: "both" }
  ],
  tasks: [
    { id: 10, projectId: 1, name: "Direct parent task", progress: 10, advance: 95, contributionMode: "both" }
  ]
});

assert.equal(getRollupProgress(1), 40, "child project and direct tasks are calculated together for completion");
assert.equal(getRollupAdvance(1), 68, "child project and direct tasks are calculated together for advance");

state.projects[1].contributionMode = "advance";
assert.equal(getRollupProgress(1), 10, "advance-only child is excluded from parent completion contributors");
assert.equal(getRollupAdvance(1), 68, "advance-only child remains an advance contributor along with task");

state.projects[1].contributionMode = "completion";
assert.equal(getRollupProgress(1), 40, "completion-only child remains a completion contributor along with task");
assert.equal(getRollupAdvance(1), 95, "completion-only child is excluded from parent advance contributors");

resetState({
  projects: [
    { id: 1, parentId: null, name: "Source", progress: 100, advance: 100 },
    { id: 2, parentId: null, name: "Target", progress: 20, advance: 30 }
  ],
  projectLinks: [
    { sourceId: 1, targetId: 2, metric: "completion", weight: 50 },
    { sourceId: 1, targetId: 2, metric: "advance", weight: 40 }
  ]
});

assert.equal(getRollupProgress(2), 60, "external completion link affects displayed rollup");
assert.equal(getRollupAdvance(2), 58, "external advance link affects displayed rollup");
assert.equal(state.projects[1].progress, 20, "external completion link does not mutate target stored progress");
assert.equal(state.projects[1].advance, 30, "external advance link does not mutate target stored advance");

resetState({
  projects: [
    { id: 1, parentId: null, name: "Parent", progress: 0, advance: 0 },
    { id: 2, parentId: 1, name: "Child", progress: 80, advance: 80 }
  ],
  tasks: [
    { id: 10, projectId: 1, name: "Direct task", progress: 30, advance: 30 }
  ]
});

state.completionWeights = {
  1: {
    "project:2": 70,
    "task:10": 30,
    "task:999": 20
  }
};
pruneCompletionWeights(1);
assert.deepEqual(state.completionWeights[1], { "project:2": 70, "task:10": 30 }, "stale weights are pruned while valid child and task weights are preserved");

state.projects[1].parentId = null;
state.completionWeights = {
  1: {
    "project:2": 70,
    "task:10": 30
  }
};
pruneCompletionWeights(1);
assert.deepEqual(state.completionWeights[1], { "task:10": 30 }, "stale child project weight is pruned after hierarchy removal");

console.log("project progress rollup contract test passed");
