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
console.log("Nodes:");
console.log(data.nodes.map(n => ({ id: n.id, y: n.y })));

console.log("\nEdges:");
console.log(data.edges.map(e => ({ id: e.id, from: e.from, to: e.to, targetY: e.targetY })));

console.log("\n--- Testing Drag Calculations ---");

// Test 1: getExternalLinkDrag
console.log("Testing getExternalLinkDrag:");
// Case A: Critical (drag >= 10)
state.projects = [
  { id: 1, name: "Target", progress: 80, parentId: null },
  { id: 2, name: "Source", progress: 50, parentId: null }
];
state.tasks = [];
state.completionWeights = {};
state.projectLinks = [];
const linkCritical = { sourceId: 2, targetId: 1, metric: "completion", weight: 50 };
console.log("Critical (drag=15):", getExternalLinkDrag(linkCritical)); // { drag: 15, level: 'critical' }

// Case B: Warning (5 <= drag < 10)
const linkWarning = { sourceId: 2, targetId: 1, metric: "completion", weight: 20 };
console.log("Warning (drag=6):", getExternalLinkDrag(linkWarning)); // { drag: 6, level: 'warning' }

// Case C: Null level (drag < 5)
const linkNull = { sourceId: 2, targetId: 1, metric: "completion", weight: 10 };
console.log("Null (drag=3):", getExternalLinkDrag(linkNull)); // { drag: 3, level: null }

// Test 2: getInternalContributorDrag
console.log("\nTesting getInternalContributorDrag:");
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
console.log("Internal Critical (drag=12.5):", getInternalContributorDrag(1, "project:3"));

// Case B: Warning (5 <= drag < 10)
// Let's modify Child C progress to 52
// Rollup parent progress = (52 * 50 + 90 * 50) / 100 = 71
// Child C value = 52
// drag = 0.5 * (71 - 52) = 0.5 * 19 = 9.5 (Level: 'warning')
state.projects[1].progress = 52;
console.log("Internal Warning (drag=9.5):", getInternalContributorDrag(1, "project:3"));

// Case C: Null level (drag < 5)
// Let's modify Child C progress to 75
// Rollup parent progress = (75 * 50 + 90 * 50) / 100 = 83 (82.5 rounded up to 83)
// Child C value = 75
// drag = 0.5 * (83 - 75) = 0.5 * 8 = 4 (Level: null)
state.projects[1].progress = 75;
console.log("Internal Null (drag=4):", getInternalContributorDrag(1, "project:3"));

