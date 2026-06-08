# Structure Map Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구조지도에서 프로젝트, 하위 프로젝트, 할 일, 연결 자료의 위치를 한눈에 파악하고 사용자가 직접 열 자료를 고르게 합니다.

**Architecture:** 기존 그래프 데이터 생성은 `graph-components.js`에 유지하고, 자료 연결 요약은 `archiveResourceLinks`와 `archiveResources`에서 파생합니다. 저장 구조를 새로 만들지 않고, 구조지도 표시와 이벤트 연결만 확장합니다.

**Tech Stack:** Electron renderer, plain JavaScript modules, CSS, existing Node `.mjs` tests.

---

## Scope

이번 업그레이드는 "작업 전/작업 중 파일 위치를 헤매는 시간"을 줄이는 데 집중합니다.

포함:
- 구조지도 노드에서 연결 자료 개수와 종류를 볼 수 있게 하기.
- 할 일 노드에서 `작업 열기` 모달로 바로 들어갈 수 있게 하기.
- 아카이브 노드/자료 연결이 있는 프로젝트와 할 일을 더 쉽게 구분하기.
- 전역 구조지도와 로컬 구조지도 모두에서 과밀도를 줄이는 표시 규칙 추가.
- 테스트와 문서 업데이트.

제외:
- 새 저장 필드 추가.
- 자동으로 특정 파일을 여는 추천 엔진.
- 구조지도 전체 레이아웃 알고리즘의 대규모 교체.
- 앱 서버 재시작 전제의 테스트. 사용자가 앱을 이미 켜둔 상태를 기본으로 둡니다.

## Assumptions

- "구조지도"는 `state.viewMode === "graph"` 또는 `state.appSettings.globalGraphView === true`에서 보이는 그래프 화면입니다.
- 사용자는 모든 자료 후보를 볼 수 있어야 하며, 앱이 하나를 임의로 골라 바로 열면 안 됩니다.
- 자료 연결의 출처는 `state.archiveResourceLinks`와 `state.archiveResources`입니다.
- 이미 구현된 작업 자료 모달 `taskLauncherMarkup()`과 `data-open-task-launcher` 흐름을 재사용합니다.

## File Structure

- Modify: `graph-components.js`
  - 구조지도 노드 데이터와 마크업에 자료 요약, 작업 열기 액션, 과밀도 표시를 추가합니다.
- Modify: `app-graph-events.js`
  - 그래프 안의 작업 열기 버튼과 자료 열기 버튼 이벤트를 기존 모달/아카이브 열기 흐름에 연결합니다.
- Modify: `graph.css`
  - 구조지도 자료 배지, 작업 열기 액션, 과밀도 힌트 스타일을 추가합니다.
- Modify: `graph-interactions.css`
  - hover/focus/selected 상태에서 자료 배지와 열기 버튼이 읽히도록 조정합니다.
- Modify: `docs/FRONTEND.md`
  - 구조지도에서 자료 요약과 작업 열기 진입점을 설명합니다.
- Modify: `docs/generated/project-map.md`
  - 그래프 파일 책임과 새 테스트 파일을 반영합니다.
- Create: `test_graph_resource_summary.mjs`
  - 그래프 노드에 자료 연결 요약이 올바르게 생성되는지 검증합니다.
- Create: `test_graph_task_launcher_entry.mjs`
  - 할 일 노드의 작업 열기 진입점이 올바른 data attribute로 렌더링되는지 검증합니다.
- Modify: `scripts/run-tests.mjs`
  - 새 테스트 두 개를 전체 테스트 목록에 추가합니다.

## Task 1: Graph Resource Summary Contract

**Files:**
- Create: `test_graph_resource_summary.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Write the resource summary test**

Create `test_graph_resource_summary.mjs`:

```js
import assert from "node:assert/strict";
import { state } from "./state.js";
import { buildGraphData, renderGraphView } from "./graph-components.js";

state.projects = [
  { id: 1, parentId: null, name: "Top", status: "진행 중", progress: 50, advance: 40, deadline: null, note: "" }
];
state.tasks = [
  { id: 10, projectId: 1, name: "Design file", progress: 20, advance: 10, note: "", contributionMode: "completion" }
];
state.archiveResources = [
  { id: 100, type: "file", name: "Brief.indd", path: "C:/work/Brief.indd", desc: "", tags: ["design"] },
  { id: 101, type: "folder", name: "Assets", path: "C:/work/assets", desc: "", tags: ["asset"] }
];
state.archiveResourceLinks = [
  { id: 200, resourceId: 100, targetType: "task", targetId: 10 },
  { id: 201, resourceId: 101, targetType: "project", targetId: 1 }
];
state.projectLinks = [];
state.graphFormulaLinks = [];
state.graphFormulaInputLinks = [];
state.appSettings.graphArchiveNodes = [];
state.appSettings.graphArchiveLinks = [];

const graph = buildGraphData(state.projects[0], { full: false, includeTasks: true });
const html = renderGraphView(state.projects[0], { full: false, includeTasks: true });

assert.ok(graph.nodes.some((node) => node.id === "project-1"), "project node should exist");
assert.ok(graph.nodes.some((node) => node.id === "task-10"), "task node should exist");
assert.match(html, /자료 1개/);
assert.match(html, /작업 열기/);
assert.match(html, /data-open-task-launcher="10"/);
console.log("graph resource summary test passed");
```

- [ ] **Step 2: Run the new test and confirm it fails before implementation**

Run:

```bash
node test_graph_resource_summary.mjs
```

Expected:

```text
AssertionError
```

The exact failed assertion may differ, but it must fail because graph markup does not yet expose task resource summary and task launcher entry.

- [ ] **Step 3: Add the test to the full suite**

In `scripts/run-tests.mjs`, add:

```js
"test_graph_resource_summary.mjs",
```

near the other graph tests.

## Task 2: Task Launcher Entry From Graph Nodes

**Files:**
- Create: `test_graph_task_launcher_entry.mjs`
- Modify: `scripts/run-tests.mjs`
- Modify: `graph-components.js`

- [ ] **Step 1: Write the launcher entry test**

Create `test_graph_task_launcher_entry.mjs`:

```js
import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderGraphView } from "./graph-components.js";

state.projects = [
  { id: 1, parentId: null, name: "Top", status: "진행 중", progress: 50, advance: 40, deadline: null, note: "" }
];
state.tasks = [
  { id: 10, projectId: 1, name: "Package draft", progress: 20, advance: 10, note: "", contributionMode: "completion" }
];
state.archiveResources = [
  { id: 100, type: "file", name: "Package.indd", path: "C:/work/Package.indd", desc: "", tags: [] }
];
state.archiveResourceLinks = [
  { id: 200, resourceId: 100, targetType: "task", targetId: 10 }
];
state.projectLinks = [];
state.graphFormulaLinks = [];
state.graphFormulaInputLinks = [];
state.appSettings.graphArchiveNodes = [];
state.appSettings.graphArchiveLinks = [];

const html = renderGraphView(state.projects[0], { full: false, includeTasks: true });

assert.match(html, /class="[^"]*graph-task-launch[^"]*"/);
assert.match(html, /data-open-task-launcher="10"/);
assert.match(html, /작업 열기/);
console.log("graph task launcher entry test passed");
```

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run:

```bash
node test_graph_task_launcher_entry.mjs
```

Expected:

```text
AssertionError
```

- [ ] **Step 3: Add the test to the full suite**

In `scripts/run-tests.mjs`, add:

```js
"test_graph_task_launcher_entry.mjs",
```

near `test_graph_selection.mjs`.

## Task 3: Add Resource Summary Helpers To Graph Markup

**Files:**
- Modify: `graph-components.js`

- [ ] **Step 1: Add small helper functions near existing graph markup helpers**

Add helpers that derive display-only data from existing state:

```js
function getLinkedResourcesForTarget(targetType, targetId) {
  const target = Number(targetId);
  return (state.archiveResourceLinks || [])
    .filter((link) => link.targetType === targetType && Number(link.targetId) === target)
    .map((link) => (state.archiveResources || []).find((resource) => Number(resource.id) === Number(link.resourceId)))
    .filter(Boolean);
}

function graphResourceSummaryMarkup(targetType, targetId) {
  const resources = getLinkedResourcesForTarget(targetType, targetId);
  if (!resources.length) return "";
  const fileCount = resources.filter((resource) => resource.type === "file").length;
  const folderCount = resources.filter((resource) => resource.type === "folder").length;
  const linkCount = resources.filter((resource) => resource.type === "link").length;
  const parts = [
    fileCount ? `파일 ${fileCount}` : "",
    folderCount ? `폴더 ${folderCount}` : "",
    linkCount ? `링크 ${linkCount}` : ""
  ].filter(Boolean);
  return `<span class="graph-resource-summary" title="${escapeHtml(parts.join(" · "))}">자료 ${resources.length}개</span>`;
}
```

- [ ] **Step 2: Insert project resource summary into project node cards**

Find the project node card markup in `graph-components.js` and add:

```js
${graphResourceSummaryMarkup("project", project.id)}
```

inside the node body where project metadata badges are rendered.

- [ ] **Step 3: Insert task resource summary and launcher into task node cards**

Find task node card markup in `graph-components.js` and add:

```js
${graphResourceSummaryMarkup("task", task.id)}
<button type="button" class="graph-task-launch" data-open-task-launcher="${task.id}">작업 열기</button>
```

inside each task node card. Keep the button small and secondary; it should not replace clicking/selecting the node.

- [ ] **Step 4: Run the graph resource tests**

Run:

```bash
node test_graph_resource_summary.mjs
node test_graph_task_launcher_entry.mjs
```

Expected:

```text
graph resource summary test passed
graph task launcher entry test passed
```

## Task 4: Wire Graph Actions To Existing Modal Flow

**Files:**
- Modify: `app-graph-events.js`

- [ ] **Step 1: Confirm existing click handler covers data-open-task-launcher**

Search:

```bash
rg -n "data-open-task-launcher|openTaskLauncherModal" app-graph-events.js
```

Expected:

```text
app-graph-events.js:<line>: ...
```

- [ ] **Step 2: If graph clicks are already delegated globally, do not add a duplicate handler**

If the existing handler uses:

```js
event.target.closest("[data-open-task-launcher]")
```

and is attached to a parent that includes graph nodes, leave it as-is.

- [ ] **Step 3: If graph clicks are scoped too narrowly, expand the scope**

If the existing handler only applies inside task cards, add this near the graph click handling branch:

```js
const graphTaskLauncherButton = event.target.closest("[data-open-task-launcher]");
if (graphTaskLauncherButton) {
  event.preventDefault();
  event.stopPropagation();
  openTaskLauncherModal(Number(graphTaskLauncherButton.dataset.openTaskLauncher));
  return;
}
```

- [ ] **Step 4: Run navigation and launcher tests**

Run:

```bash
node test_graph_task_launcher_entry.mjs
node test_detail_bottleneck_navigation.mjs
node test_task_launcher_markup.mjs
```

Expected:

```text
graph task launcher entry test passed
detail bottleneck navigation test passed
task launcher markup test passed
```

## Task 5: Style Graph Resource Signals

**Files:**
- Modify: `graph.css`
- Modify: `graph-interactions.css`

- [ ] **Step 1: Add base resource badge styles**

In `graph.css`, add:

```css
.graph-resource-summary {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 2px 7px;
  background: var(--panel-soft);
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.graph-task-launch {
  justify-self: start;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 4px 7px;
  background: var(--panel-raised);
  color: var(--text);
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.graph-task-launch:hover,
.graph-task-launch:focus-visible {
  border-color: var(--line-strong);
  outline: 0;
}
```

- [ ] **Step 2: Keep selected and hover states readable**

In `graph-interactions.css`, add:

```css
.graph-node.selected .graph-resource-summary,
.graph-node:hover .graph-resource-summary {
  border-color: var(--line-strong);
  color: var(--text);
}

.graph-node.selected .graph-task-launch {
  background: var(--surface);
}
```

- [ ] **Step 3: Run CSS/diff checks**

Run:

```bash
git diff --check
```

Expected:

```text
no output
```

CRLF warnings are acceptable on this repository.

## Task 6: Update Documentation

**Files:**
- Modify: `docs/FRONTEND.md`
- Modify: `docs/generated/project-map.md`

- [ ] **Step 1: Update frontend structure docs**

In `docs/FRONTEND.md`, add a bullet under 주요 화면:

```markdown
- 구조지도 노드는 프로젝트/할 일에 연결된 아카이브 자료 개수를 요약하고, 할 일 노드의 `작업 열기` 버튼으로 작업 자료 모달에 진입합니다.
```

- [ ] **Step 2: Update project map responsibilities**

In `docs/generated/project-map.md`, update the `graph-components.js` entry to mention:

```markdown
자료 요약 배지와 작업 자료 모달 진입점
```

Add these tests under the test list:

```markdown
- `test_graph_resource_summary.mjs`
- `test_graph_task_launcher_entry.mjs`
```

- [ ] **Step 3: Run encoding check**

Run:

```bash
node test_encoding_integrity.mjs
```

Expected:

```text
encoding integrity test passed
```

## Task 7: Full Verification And Commit

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node test_graph_resource_summary.mjs
node test_graph_task_launcher_entry.mjs
node test_task_launcher_markup.mjs
node test_graph_selection.mjs
```

Expected:

```text
graph resource summary test passed
graph task launcher entry test passed
task launcher markup test passed
graph selection tests passed
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm.cmd test
```

Expected:

```text
all reliability checks passed
```

Existing `MODULE_TYPELESS_PACKAGE_JSON` warnings are acceptable unless this plan explicitly decides to change `package.json`.

- [ ] **Step 3: Check diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected:

```text
git diff --check: no whitespace errors
git status --short: only intended files modified/added
```

- [ ] **Step 4: Commit**

Run:

```bash
git add graph-components.js app-graph-events.js graph.css graph-interactions.css docs/FRONTEND.md docs/generated/project-map.md scripts/run-tests.mjs test_graph_resource_summary.mjs test_graph_task_launcher_entry.mjs
git commit -m "feat: upgrade structure map resource cues"
```

## Risk Gates

- If implementation needs a new persistent field, stop and read `docs/DATA_MODEL.md` and `docs/PROJECT_LOGIC.md` before proceeding.
- If graph layout becomes crowded, prefer a compact badge or collapsed count over adding new large cards.
- If event handling requires a new global branch, check for duplicate handlers in `app-graph-events.js` first.
- If tests fail because the app's Korean text is garbled in terminal output, verify with `test_encoding_integrity.mjs` rather than editing text blindly.

## Handoff Notes

- Do not open a new dev server. The user normally keeps the app running.
- This plan intentionally does not create a `.workflow/` folder. Use subagents only if the next implementation session splits into independent graph, event, and QA review packets.
- Start execution with Task 1, not visual styling. The rendering contract should pin the behavior before UI polish.
