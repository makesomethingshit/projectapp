import assert from "node:assert/strict";
import { state, saveState } from "./state.js";
import { getBottleneckRecommendations } from "./calculator.js";

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
    { id: 1, parentId: null, name: "Parent", progress: 0, advance: 0 }
  ],
  tasks: [
    { id: 10, projectId: 1, name: "Slow task", progress: 0, advance: 0, contributionMode: "both" },
    { id: 11, projectId: 1, name: "Done task", progress: 100, advance: 100, contributionMode: "both" }
  ]
});

let recommendations = getBottleneckRecommendations(1);
assert.equal(recommendations[0].sourceType, "task");
assert.equal(recommendations[0].sourceName, "Slow task");
assert.equal(recommendations[0].actionType, "focus_task");
assert.equal(recommendations[0].metric, "completion");
assert.match(recommendations[0].recommendation, /이 할 일을 먼저 올리면/);

resetState({
  projects: [
    { id: 1, parentId: null, name: "Parent", progress: 0, advance: 0 },
    { id: 2, parentId: 1, name: "Slow child", progress: 0, advance: 0 },
    { id: 3, parentId: 1, name: "Healthy child", progress: 100, advance: 100 }
  ]
});
state.completionWeights = {
  1: {
    "project:2": 80,
    "project:3": 20
  }
};

recommendations = getBottleneckRecommendations(1);
assert.equal(recommendations[0].sourceType, "project");
assert.equal(recommendations[0].sourceName, "Slow child");
assert.equal(recommendations[0].actionType, "open_project");
assert.match(recommendations[0].recommendation, /하위 프로젝트 안의 낮은 할 일을 정리/);

resetState({
  projects: [
    { id: 1, parentId: null, name: "External source", progress: 20, advance: 20 },
    { id: 2, parentId: null, name: "Target", progress: 80, advance: 80 }
  ],
  projectLinks: [
    { sourceId: 1, targetId: 2, metric: "completion", weight: 50 }
  ]
});

recommendations = getBottleneckRecommendations(2);
assert.equal(recommendations[0].type, "external");
assert.equal(recommendations[0].sourceType, "project");
assert.equal(recommendations[0].actionType, "add_task");
assert.match(recommendations[0].recommendation, /외부 반영 원천이 낮아/);

resetState({
  projects: [
    { id: 1, parentId: null, name: "Formula target", progress: 90, advance: 90 }
  ],
  formulaNodes: [
    { id: 201, title: "Risk formula", formulaType: "fixed", completion: 10, advance: 10 }
  ],
  formulaLinks: [
    { sourceId: 201, targetId: 1, metric: "completion", weight: 50 }
  ]
});

recommendations = getBottleneckRecommendations(1);
assert.equal(recommendations[0].sourceType, "formula");
assert.equal(recommendations[0].actionType, "trace_formula");
assert.match(recommendations[0].recommendation, /수식 입력값/);

resetState({
  projects: [
    { id: 1, parentId: null, name: "Advance parent", progress: 50, advance: 0 }
  ],
  tasks: [
    { id: 10, projectId: 1, name: "Advance-only slow task", progress: 100, advance: 0, contributionMode: "advance" },
    { id: 11, projectId: 1, name: "Advance-only done task", progress: 100, advance: 100, contributionMode: "advance" }
  ]
});

recommendations = getBottleneckRecommendations(1);
assert.equal(recommendations[0].sourceType, "task");
assert.equal(recommendations[0].sourceName, "Advance-only slow task");
assert.equal(recommendations[0].metric, "advance");
assert.equal(recommendations[0].actionType, "focus_task");
assert.match(recommendations[0].recommendation, /진행도/);

// bottleneckCache 검증 테스트
saveState();
const cached = state.appSettings.bottleneckCache;
assert(Array.isArray(cached), "bottleneckCache should be an array");
const slowTaskCache = cached.find(item => item.sourceType === "task" && Number(item.sourceId) === 10);
assert.ok(slowTaskCache, "Slow task (id 10) should be cached in bottleneckCache");

console.log("bottleneck recommendations test passed");
