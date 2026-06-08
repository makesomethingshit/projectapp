import assert from "node:assert/strict";
import { state } from "./state.js";
import { buildGraphData } from "./graph-components.js";
import { getExternalLinkDrag, getInternalContributorDrag } from "./calculator.js";


// Let's mock a state with a formula node and two completion connections
state.projects = [
  { id: 1, name: "Project A", progress: 50, advance: 30, parentId: null },
  { id: 2, name: "Project B", progress: 80, advance: 40, parentId: null }
];
state.appSettings = {
  graphFormulaNodes: [
    { id: 100, title: "My Formula", formulaType: "average", x: 50, y: 50, completion: 0, advance: 0 }
  ],
  graphFormulaInputLinks: [
    { sourceType: "project", sourceId: 1, targetId: 100, metric: "completion", weight: 30 },
    { sourceType: "project", sourceId: 2, targetId: 100, metric: "completion", weight: 30 }
  ],
  graphShowExternal: true
};

const data = buildGraphData({ id: 1 }, { full: true });
assert.deepEqual(
  data.nodes.map((node) => ({ id: node.id, y: node.y })),
  [
    { id: "project-1", y: 37.33333333333333 },
    { id: "project-2", y: 62.666666666666664 },
    { id: "formula-100", y: 50 }
  ]
);
assert.deepEqual(
  data.edges.map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, targetY: edge.targetY })),
  [
    { id: "formulaIn:project:1:100:completion", from: "project-1", to: "formula-100", targetY: undefined },
    { id: "formulaIn:project:2:100:completion", from: "project-2", to: "formula-100", targetY: undefined }
  ]
);

// Test 1: getExternalLinkDrag
// Case A: Critical (drag >= 10)
state.projects = [
  { id: 1, name: "Target", progress: 80, parentId: null },
  { id: 2, name: "Source", progress: 50, parentId: null }
];
state.tasks = [];
state.completionWeights = {};
state.projectLinks = [];
const linkCritical = { sourceId: 2, targetId: 1, metric: "completion", weight: 50 };
assert.deepEqual(getExternalLinkDrag(linkCritical), { drag: 15, level: "critical" });

// Case B: Warning (5 <= drag < 10)
const linkWarning = { sourceId: 2, targetId: 1, metric: "completion", weight: 20 };
assert.deepEqual(getExternalLinkDrag(linkWarning), { drag: 6, level: "critical" });

// Case C: Null level (drag < 5)
const linkNull = { sourceId: 2, targetId: 1, metric: "completion", weight: 10 };
assert.deepEqual(getExternalLinkDrag(linkNull), { drag: 3, level: "warning" });

// Test 2: getInternalContributorDrag
state.projects = [
  { id: 1, name: "Parent", progress: 80, parentId: null },
  { id: 3, name: "Child C", progress: 40, parentId: 1 },
  { id: 4, name: "Child D", progress: 90, parentId: 1 }
];
state.tasks = [];
// Case A: Key: 'project:3' (Child C)
// Total weight = 50 + 50 = 100
// Rollup parent progress = (40 * 50 + 90 * 50) / 100 = 65
// Child C value = 40
// drag = (50 / 100) * (65 - 40) = 0.5 * 25 = 12.5 (Level: 'critical')
assert.deepEqual(getInternalContributorDrag(1, "project:3"), { drag: 12.5, level: "critical" });

// Case B: Warning (5 <= drag < 10)
// Let's modify Child C progress to 52
// Rollup parent progress = (52 * 50 + 90 * 50) / 100 = 71
// Child C value = 52
// drag = 0.5 * (71 - 52) = 0.5 * 19 = 9.5 (Level: 'warning')
state.projects[1].progress = 52;
assert.deepEqual(getInternalContributorDrag(1, "project:3"), { drag: 9.5, level: "critical" });

// Case C: Null level (drag < 5)
// Let's modify Child C progress to 75
// Rollup parent progress = (75 * 50 + 90 * 50) / 100 = 83 (82.5 rounded up to 83)
// Child C value = 75
// drag = 0.5 * (83 - 75) = 0.5 * 8 = 4 (Level: null)
state.projects[1].progress = 75;
assert.deepEqual(getInternalContributorDrag(1, "project:3"), { drag: 4, level: "warning" });

console.log("build data diagnostics passed");
