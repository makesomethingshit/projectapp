import assert from "node:assert/strict";
import { state } from "./state.js";
import {
  rollupPanelMarkup,
  rollupStructureMarkup
} from "./ui-components.js";

function resetState({ projects, tasks = [] }) {
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
  state.projectLinks = [];
  state.completionWeights = {};
  state.appSettings.graphFormulaNodes = [];
  state.appSettings.graphFormulaLinks = [];
  state.appSettings.graphFormulaInputLinks = [];
}

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

state.expandedRollupMetric = "completion";
const completionMarkup = rollupPanelMarkup(state.projects[0], "completion");
assert.match(completionMarkup, /rollup-summary/);
assert.match(completionMarkup, /완성도 가중 합산 65%/);
assert.match(completionMarkup, /data-rollup-row-type="project"/);
assert.match(completionMarkup, /하위 프로젝트/);
assert.match(completionMarkup, /data-completion-weight="project:2"/);
assert.match(completionMarkup, /가중치 70%/);
assert.match(completionMarkup, /\+56%p/);

state.expandedRollupMetric = "advance";
const advanceMarkup = rollupPanelMarkup(state.projects[0], "advance");
assert.match(advanceMarkup, /진행도 평균 합산 68%/);
assert.match(advanceMarkup, /Child/);
assert.match(advanceMarkup, /Direct task/);
assert.match(advanceMarkup, /평균 몫 50%/);
assert.match(advanceMarkup, /\+48%p/);

resetState({
  projects: [
    { id: 3, parentId: null, name: "Fallback", progress: 12, advance: 44 }
  ]
});
const fallbackMarkup = rollupStructureMarkup(3, "completion");
assert.match(fallbackMarkup, /기여 항목 없음\. 프로젝트 기본값을 사용합니다\./);
assert.match(fallbackMarkup, /data-rollup-row-type="fallback"/);
assert.match(fallbackMarkup, /기본값/);

console.log("rollup explanation markup test passed");
