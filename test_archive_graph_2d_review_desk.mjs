import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [
  { id: 1, name: "Weekly Book Page" }
];
state.tasks = [
  { id: 10, projectId: 1, name: "Draw one page" },
  { id: 11, projectId: 1, name: "Collect references" }
];
state.archiveResources = [
  {
    id: 100,
    name: "Visual rhythm notes",
    type: "file",
    path: "C:/refs/rhythm.md",
    desc: "weekly image and text page references",
    tags: ["design", "page"]
  },
  {
    id: 101,
    name: "Editorial grid sample",
    type: "link",
    path: "https://example.com/grid",
    desc: "page grid and typography",
    tags: ["design", "page"]
  },
  {
    id: 102,
    name: "Loose trend board",
    type: "link",
    path: "https://example.com/trend",
    desc: "trend signal",
    tags: ["trend"]
  }
];
state.archiveResourceLinks = [
  {
    resourceId: 100,
    targetType: "task",
    targetId: 10,
    relationStatus: "suggested",
    relationType: "reference",
    relationStrength: "weak",
    relationScore: 32,
    relationReason: "topic overlap needs human review",
    relationNote: ""
  },
  {
    resourceId: 100,
    targetType: "project",
    targetId: 1,
    relationStatus: "confirmed",
    relationType: "evidence",
    relationStrength: "strong",
    relationScore: 91,
    relationReason: "manual project reference",
    relationNote: ""
  },
  {
    resourceId: 100,
    targetType: "task",
    targetId: 11,
    relationStatus: "confirmed",
    relationType: "similar",
    relationStrength: "medium",
    relationScore: 66,
    relationReason: "shared layout terms",
    relationNote: "Check after the first draft."
  }
];
state.selectedArchiveResourceId = 100;
state.archiveEditMode = false;
state.searchQuery = "";
state.appSettings.archiveViewMode = "graph";
state.appSettings.archiveGraphDisplayMode = "graph2d";
state.appSettings.archiveGraphDepth = 2;
state.appSettings.archiveGraphKindFilter = "all";
state.appSettings.archiveGraphStrengthFilter = "all";
state.appSettings.archiveGraphFiltersCollapsed = false;

const html = renderArchiveView();

assert.match(html, /data-archive-graph-display-mode="graph2d"[^>]*active|active[^>]*data-archive-graph-display-mode="graph2d"/);
assert.match(html, /archive-relation-review-desk/);
assert.match(html, /검토할 연결/);

const weakKey = "resource:100:task:10";
const projectKey = "resource:100:project:1";
const memoKey = "resource:100:task:11";

assert.match(html, new RegExp(`data-archive-review-edge="${weakKey}"`));
assert.match(html, new RegExp(`data-archive-review-edge="${projectKey}"`));
assert.match(html, new RegExp(`data-archive-graph-edge="${weakKey}"`));
assert.match(html, /data-resource-id="100"/);
assert.match(html, /data-target-type="task"/);
assert.match(html, /data-target-id="10"/);
assert.match(html, /이 작업에서의 신뢰도/);
assert.match(html, /이 프로젝트에서의 신뢰도/);
assert.match(html, /Check after the first draft\./);

const deskHtml = html.slice(html.indexOf("archive-relation-review-desk"));
const weakIndex = deskHtml.indexOf(`data-archive-review-edge="${weakKey}"`);
const memoIndex = deskHtml.indexOf(`data-archive-review-edge="${memoKey}"`);
const projectIndex = deskHtml.indexOf(`data-archive-review-edge="${projectKey}"`);
assert.ok(weakIndex >= 0 && weakIndex < memoIndex, "review/low relation should be first");
assert.ok(memoIndex >= 0 && memoIndex < projectIndex, "memo relation should appear before strong remainder");

assert.match(html, /archive-graph-view-node[^"]*selected-resource/);
assert.match(html, /archive-graph-view-node[^"]*direct-relation/);
assert.match(html, /archive-graph-view-edge[^"]*weak/);
assert.match(html, /archive-graph-view-edge[^"]*strong/);

const css = readFileSync("components.css", "utf8");
assert.match(css, /\.archive-relation-review-desk/);
assert.match(css, /\.archive-graph-view-edge\.selected/);
assert.match(css, /\.archive-graph-view-node\.direct-relation/);

const events = readFileSync("app-graph-events.js", "utf8");
assert.match(events, /markArchiveGraphRelationSelection/);
assert.match(events, /data-archive-review-edge/);
