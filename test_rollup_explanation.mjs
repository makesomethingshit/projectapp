import assert from "node:assert/strict";
import { state } from "./state.js";
import {
  getRollupProgress,
  getRollupAdvance,
  getAdvanceSegments,
  getRollupExplanation
} from "./calculator.js";

function resetState({ projects, tasks = [], projectLinks = [], formulaNodes = [], formulaLinks = [] }) {
  state.projects = projects.map((project) => ({
    status: "In progress",
    note: "",
    deadline: null,
    contributionMode: "both",
    progress: 0,
    advance: project.progress ?? 0,
    ...project
  }));
  state.tasks = tasks.map((task) => ({
    note: "",
    contributionMode: "both",
    progress: 0,
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

const fallbackCompletion = getRollupExplanation(1, "completion");
assert.equal(fallbackCompletion.metric, "completion");
assert.equal(fallbackCompletion.mode, "fallback");
assert.equal(fallbackCompletion.ownValue, 34);
assert.equal(fallbackCompletion.finalValue, getRollupProgress(1));
assert.equal(fallbackCompletion.ownWeight, 100);
assert.equal(fallbackCompletion.incomingWeight, 0);
assert.deepEqual(
  fallbackCompletion.contributors.map((item) => ({
    type: item.type,
    value: item.value,
    share: item.share,
    influence: item.influence
  })),
  [{ type: "fallback", value: 34, share: 100, influence: 34 }]
);

const fallbackAdvance = getRollupExplanation(1, "advance");
assert.equal(fallbackAdvance.mode, "fallback");
assert.equal(fallbackAdvance.ownValue, 56);
assert.equal(fallbackAdvance.finalValue, getRollupAdvance(1));
assert.deepEqual(
  fallbackAdvance.contributors.map((item) => ({
    type: item.type,
    value: item.value,
    share: item.share,
    influence: item.influence
  })),
  [{ type: "fallback", value: 56, share: 100, influence: 56 }]
);

resetState({
  projects: [
    { id: 1, parentId: null, name: "Parent", progress: 5, advance: 5 },
    { id: 2, parentId: 1, name: "Child", progress: 80, advance: 40 }
  ],
  tasks: [
    { id: 10, projectId: 1, name: "Direct task", progress: 30, advance: 95 }
  ]
});
state.completionWeights = {
  1: {
    "project:2": 70,
    "task:10": 30
  }
};

const weightedCompletion = getRollupExplanation(1, "completion");
assert.equal(weightedCompletion.mode, "weighted");
assert.equal(weightedCompletion.ownValue, 65);
assert.equal(weightedCompletion.finalValue, getRollupProgress(1));
assert.deepEqual(
  weightedCompletion.contributors.map((item) => ({
    key: item.key,
    type: item.type,
    value: item.value,
    weight: item.weight,
    share: item.share,
    influence: item.influence
  })),
  [
    { key: "project:2", type: "project", value: 80, weight: 70, share: 70, influence: 56 },
    { key: "task:10", type: "task", value: 30, weight: 30, share: 30, influence: 9 }
  ]
);

const averageAdvance = getRollupExplanation(1, "advance");
assert.equal(averageAdvance.mode, "average");
assert.equal(averageAdvance.ownValue, 68);
assert.equal(averageAdvance.finalValue, getRollupAdvance(1));
assert.deepEqual(
  getAdvanceSegments(1).map((segment) => segment.name),
  ["Child", "Direct task"],
  "advance bar segments include child projects and direct tasks together"
);
assert.deepEqual(
  averageAdvance.contributors.map((item) => ({
    type: item.type,
    value: item.value,
    share: item.share,
    influence: item.influence
  })),
  [
    { type: "project", value: 40, share: 50, influence: 20 },
    { type: "task", value: 95, share: 50, influence: 48 }
  ]
);

resetState({
  projects: [
    { id: 1, parentId: null, name: "Source", progress: 100, advance: 100 },
    { id: 2, parentId: null, name: "Target", progress: 20, advance: 30 }
  ],
  projectLinks: [
    { sourceId: 1, targetId: 2, metric: "completion", weight: 50 }
  ],
  formulaNodes: [
    { id: 201, title: "Formula source", formulaType: "fixed", completion: 40, advance: 40 }
  ],
  formulaLinks: [
    { sourceId: 201, targetId: 2, metric: "completion", weight: 60 }
  ]
});

const externalCompletion = getRollupExplanation(2, "completion");
assert.equal(externalCompletion.mode, "fallback");
assert.equal(externalCompletion.ownValue, 20);
assert.equal(externalCompletion.ownWeight, 10);
assert.equal(externalCompletion.incomingRequestedWeight, 110);
assert.equal(externalCompletion.incomingWeight, 90);
assert.equal(externalCompletion.finalValue, getRollupProgress(2));
assert.deepEqual(
  externalCompletion.incoming.map((item) => ({
    sourceType: item.sourceType,
    value: item.value,
    requestedWeight: item.requestedWeight,
    effectiveWeight: item.effectiveWeight,
    influence: item.influence
  })),
  [
    { sourceType: "project", value: 100, requestedWeight: 50, effectiveWeight: 41, influence: 41 },
    { sourceType: "formula", value: 40, requestedWeight: 60, effectiveWeight: 49, influence: 20 }
  ]
);

assert.equal(state.projects[1].progress, 20, "rollup explanation does not mutate stored project progress");
assert.equal(state.projects[1].advance, 30, "rollup explanation does not mutate stored project advance");

console.log("rollup explanation test passed");
