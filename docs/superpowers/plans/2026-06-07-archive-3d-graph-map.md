# Archive 3D Graph Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian-like 3D archive graph map where materials, notes, tasks, projects, and topic echoes form a navigable Second Brain surface.

**Architecture:** Keep relationship extraction separate from rendering. `archive-model.js` owns content-centered scoring and link candidates, `archive-graph-model.js` will produce a renderer-neutral graph payload, and `archive-graph-3d.js` will own Three.js rendering/interactions. Existing D3 graph remains as a fallback/toggle until the 3D graph is verified.

**Tech Stack:** Electron renderer, plain JavaScript ES modules, D3 for existing 2D graph, Three.js for 3D graph rendering, Node assertion tests, Playwright/browser verification for rendered canvas.

---

## Product Contract

- The archive graph is rhizomatic, not hierarchical. Folders and drives are storage aids, not conceptual parent nodes.
- The first visible goal is agent readability: an agent should quickly find which materials are near a project/task/context.
- The visual target is closer to Obsidian Graph View than a dashboard chart: dark infinite space, clustered constellations, soft links, zoom/orbit/pan, search focus, neighbor expansion.
- 3D should clarify relationships, not create a decorative cloud. It must support inspection, filtering, and local neighborhood views.
- Large similar document sets should compress into cluster/folder candidates instead of flooding the map.

## File Structure

- Modify `package.json` and `package-lock.json`: add `three` and include the distributable file in Electron packaging.
- Create `archive-graph-model.js`: renderer-neutral graph payload builder, node categories, scoring, clustering, visible neighborhood selection.
- Create `archive-graph-3d.js`: Three.js scene, camera, controls, node meshes, edge lines, labels, hover/select/focus.
- Modify `index.html`: load Three.js and the new 3D graph script.
- Modify `ui-components.js`: add `3D Graph` view mode markup, payload script tag, inspector copy, and 2D/3D toggle.
- Modify `app-graph-events.js`: support 3D graph mode toggle, focus commands, keyboard shortcuts, resize lifecycle.
- Modify `components.css`: 3D graph canvas shell, overlay controls, labels, legend, focus panel.
- Modify `state.js`: persist archive graph display mode (`graph2d`/`graph3d`), focus depth, label density, cluster visibility.
- Create `test_archive_graph_model.mjs`: graph payload, clustering, score ordering, neighborhood depth.
- Create `test_archive_graph_3d_markup.mjs`: markup, script loading, persisted mode contracts.
- Extend `scripts/run-tests.mjs`: include new tests.
- Update `docs/HARNESS.md`, `docs/PROJECT_LOGIC.md`, `docs/FRONTEND.md`: document 3D graph contract and verification.

## Phase 1: Model First

### Task 1: Extract Renderer-Neutral Graph Payload

**Files:**
- Create: `archive-graph-model.js`
- Test: `test_archive_graph_model.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Write the failing model test**

Create `test_archive_graph_model.mjs`:

```js
import assert from "node:assert/strict";
import { buildArchiveGraphModel } from "./archive-graph-model.js";

const stateLike = {
  selectedArchiveResourceId: 1,
  projects: [{ id: 10, name: "Levinas Study", note: "레비나스 전체성과 무한" }],
  tasks: [{ id: 20, projectId: 10, name: "레비나스 해설 정리", note: "진리 정의 존재성" }],
  archiveResources: [
    { id: 1, name: "레비나스 전체성과 무한 1부 해설.pdf", type: "file", path: "G:\\levinas\\a.pdf", desc: "진리 정의 해설", tags: [] },
    { id: 2, name: "레비나스 존재와 달리 해설.pdf", type: "file", path: "G:\\levinas\\b.pdf", desc: "존재성 주체성", tags: [] },
    { id: 3, name: "타이포그래피 공간의 구조.pdf", type: "file", path: "G:\\type\\c.pdf", desc: "타이포그래피 활자 글꼴", tags: ["타이포"] }
  ],
  archiveResourceLinks: [
    { resourceId: 1, targetType: "task", targetId: 20 },
    { resourceId: 3, targetType: "project", targetId: 10 }
  ]
};

const model = buildArchiveGraphModel(stateLike, { mode: "local", depth: 2, limit: 80 });
assert.ok(model.nodes.some((node) => node.id === "resource:1" && node.active));
assert.ok(model.nodes.some((node) => node.id === "resource:2"));
assert.ok(model.links.some((link) => link.source === "resource:1" && link.target === "task:20"));

const levinasNode = model.nodes.find((node) => node.id === "resource:2");
const typoNode = model.nodes.find((node) => node.id === "resource:3");
assert.ok(levinasNode.score > typoNode.score, "selected Levinas context should outrank unrelated typography backlinks");
assert.ok(model.meta.relationCount >= 1);

console.log("archive graph model ok");
```

- [ ] **Step 2: Run the failing test**

Run: `node test_archive_graph_model.mjs`

Expected: FAIL because `archive-graph-model.js` does not exist.

- [ ] **Step 3: Implement minimal graph model**

Create `archive-graph-model.js` with these exports:

```js
import {
  getArchiveContentTerms,
  getProjectContentTerms,
  getTaskContentTerms
} from "./archive-model.js";

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function nodeScoreForTerms(terms, selectedTerms) {
  const overlap = terms.filter((term) => selectedTerms.has(normalizeKey(term))).length;
  return overlap * 24;
}

export function buildArchiveGraphModel(stateLike, options = {}) {
  const resources = Array.isArray(stateLike.archiveResources) ? stateLike.archiveResources : [];
  const projects = Array.isArray(stateLike.projects) ? stateLike.projects : [];
  const tasks = Array.isArray(stateLike.tasks) ? stateLike.tasks : [];
  const archiveLinks = Array.isArray(stateLike.archiveResourceLinks) ? stateLike.archiveResourceLinks : [];
  const selectedId = Number(stateLike.selectedArchiveResourceId || resources[0]?.id || 0);
  const selected = resources.find((resource) => Number(resource.id) === selectedId) || null;
  const selectedTerms = new Set(selected ? getArchiveContentTerms(selected).map(normalizeKey) : []);
  const limit = Number(options.limit) || 80;

  const nodes = [];
  const links = [];
  const addNode = (node) => {
    if (nodes.some((item) => item.id === node.id)) return;
    nodes.push(node);
  };
  const addLink = (link) => {
    if (links.some((item) => item.source === link.source && item.target === link.target && item.type === link.type)) return;
    links.push(link);
  };

  resources
    .filter((resource) => resource.type !== "folder")
    .map((resource) => {
      const terms = getArchiveContentTerms(resource);
      const score = Number(resource.id) === selectedId ? 100 : nodeScoreForTerms(terms, selectedTerms);
      return { resource, terms, score };
    })
    .sort((a, b) => b.score - a.score || Number(b.resource.id) - Number(a.resource.id))
    .slice(0, limit)
    .forEach(({ resource, terms, score }) => {
      addNode({
        id: `resource:${resource.id}`,
        kind: resource.type === "link" ? "link" : "material",
        label: resource.name,
        terms,
        score,
        active: Number(resource.id) === selectedId
      });
      terms.slice(0, 4).forEach((term) => {
        const topicId = `topic:${normalizeKey(term)}`;
        addNode({ id: topicId, kind: "topic", label: `#${term}`, terms: [term], score: nodeScoreForTerms([term], selectedTerms) });
        addLink({ source: `resource:${resource.id}`, target: topicId, type: "topic", score: 24 });
      });
    });

  archiveLinks.forEach((link) => {
    const sourceId = `resource:${Number(link.resourceId)}`;
    if (!nodes.some((node) => node.id === sourceId)) return;
    const target = link.targetType === "task"
      ? tasks.find((task) => Number(task.id) === Number(link.targetId))
      : projects.find((project) => Number(project.id) === Number(link.targetId));
    if (!target) return;
    const targetId = `${link.targetType === "task" ? "task" : "project"}:${target.id}`;
    const terms = link.targetType === "task" ? getTaskContentTerms(target, projects) : getProjectContentTerms(target, tasks);
    addNode({ id: targetId, kind: link.targetType === "task" ? "task" : "project", label: target.name, terms, score: nodeScoreForTerms(terms, selectedTerms) + 12 });
    addLink({ source: sourceId, target: targetId, type: "backlink", score: 60 });
  });

  return {
    nodes: nodes.map((node, index) => ({ ...node, index, terms: unique(node.terms || []) })),
    links,
    meta: {
      selectedId,
      nodeCount: nodes.length,
      relationCount: links.length
    }
  };
}
```

- [ ] **Step 4: Register the test**

Add `"test_archive_graph_model.mjs"` immediately after `"test_archive_auto_links.mjs"` in `scripts/run-tests.mjs`.

- [ ] **Step 5: Verify**

Run:

```powershell
node test_archive_graph_model.mjs
npm.cmd test
```

Expected: both pass, with existing ESM warnings allowed.

## Phase 2: 3D Renderer Shell

### Task 2: Add Three.js Dependency and Script Loading

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `index.html`
- Create: `archive-graph-3d.js`
- Test: `test_archive_graph_3d_markup.mjs`

- [ ] **Step 1: Install dependency**

Run:

```powershell
npm.cmd install three
```

Expected: `three` appears in `dependencies`, and `package-lock.json` updates.

- [ ] **Step 2: Add script to `index.html`**

Add before `app.js` module scripts:

```html
<script src="node_modules/three/build/three.module.js" type="module"></script>
```

If browser module loading from `node_modules` fails in Electron, use a local wrapper import in `archive-graph-3d.js` instead:

```js
import * as THREE from "./node_modules/three/build/three.module.js";
```

- [ ] **Step 3: Create renderer placeholder**

Create `archive-graph-3d.js`:

```js
import * as THREE from "./node_modules/three/build/three.module.js";

let activeGraph = null;

export function initArchiveGraph3D(root = document) {
  const container = root.querySelector("[data-archive-graph-3d]");
  if (!container) return null;
  const payloadEl = container.querySelector("[data-archive-graph-3d-payload]");
  const payload = payloadEl ? JSON.parse(payloadEl.textContent || "{}") : { nodes: [], links: [] };
  const canvasHost = container.querySelector("[data-archive-graph-3d-canvas]");
  if (!canvasHost) return null;

  if (activeGraph?.dispose) activeGraph.dispose();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111315);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(0, 0, 280);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  canvasHost.replaceChildren(renderer.domElement);

  function resize() {
    const rect = canvasHost.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvasHost);

  const geometry = new THREE.SphereGeometry(3.5, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xd8e5ff });
  payload.nodes.forEach((node, index) => {
    const mesh = new THREE.Mesh(geometry, material.clone());
    const angle = (Math.PI * 2 * index) / Math.max(payload.nodes.length, 1);
    mesh.position.set(Math.cos(angle) * 80, Math.sin(angle) * 50, ((index % 7) - 3) * 18);
    mesh.userData = node;
    scene.add(mesh);
  });

  function animate() {
    activeGraph.frame = requestAnimationFrame(animate);
    scene.rotation.y += 0.0015;
    renderer.render(scene, camera);
  }

  activeGraph = {
    frame: 0,
    dispose() {
      cancelAnimationFrame(this.frame);
      resizeObserver.disconnect();
      renderer.dispose();
    }
  };
  animate();
  return activeGraph;
}
```

- [ ] **Step 4: Write markup test**

Create `test_archive_graph_3d_markup.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync("index.html", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const rendererSource = readFileSync("archive-graph-3d.js", "utf8");

assert.match(packageSource, /"three":/);
assert.match(indexSource, /archive-graph-3d\.js/);
assert.match(rendererSource, /THREE\.Scene/);
assert.match(rendererSource, /WebGLRenderer/);
assert.match(rendererSource, /data-archive-graph-3d/);

console.log("archive graph 3d markup ok");
```

- [ ] **Step 5: Register and verify**

Add `"test_archive_graph_3d_markup.mjs"` after `"test_archive_graph_model.mjs"` in `scripts/run-tests.mjs`.

Run:

```powershell
node test_archive_graph_3d_markup.mjs
npm.cmd test
```

Expected: tests pass.

## Phase 3: UI Integration

### Task 3: Add 2D/3D Graph Toggle

**Files:**
- Modify: `state.js`
- Modify: `ui-components.js`
- Modify: `app-graph-events.js`
- Modify: `app.js`

- [ ] **Step 1: Persist graph display mode**

In `state.appSettings`, add:

```js
archiveGraphDisplayMode: "3d",
archiveGraphDepth: 2,
archiveGraphLabelDensity: "focus"
```

In `applyLoadedState(saved)`, normalize:

```js
state.appSettings.archiveGraphDisplayMode = ["2d", "3d"].includes(state.appSettings.archiveGraphDisplayMode)
  ? state.appSettings.archiveGraphDisplayMode
  : "3d";
state.appSettings.archiveGraphDepth = Math.max(1, Math.min(3, Number(state.appSettings.archiveGraphDepth) || 2));
state.appSettings.archiveGraphLabelDensity = ["focus", "all", "none"].includes(state.appSettings.archiveGraphLabelDensity)
  ? state.appSettings.archiveGraphLabelDensity
  : "focus";
```

- [ ] **Step 2: Render 3D shell in archive graph view**

In `ui-components.js`, import:

```js
import { buildArchiveGraphModel } from "./archive-graph-model.js";
```

Inside `renderArchiveView()`, when `viewMode === "graph"` and `state.appSettings.archiveGraphDisplayMode === "3d"`, render:

```html
<section class="archive-graph-3d" data-archive-graph-3d aria-label="Archive 3D graph">
  <div class="archive-graph-3d-toolbar">
    <button type="button" data-archive-graph-display-mode="2d">2D</button>
    <button type="button" data-archive-graph-display-mode="3d" class="active">3D</button>
    <button type="button" data-archive-graph-focus-depth="1">1-step</button>
    <button type="button" data-archive-graph-focus-depth="2">2-step</button>
    <button type="button" data-archive-graph-focus-depth="3">3-step</button>
  </div>
  <div class="archive-graph-3d-canvas" data-archive-graph-3d-canvas></div>
  <script type="application/json" data-archive-graph-3d-payload>${escapeHtml(JSON.stringify(buildArchiveGraphModel(state, {
    mode: "local",
    depth: state.appSettings.archiveGraphDepth,
    limit: 120
  })))}</script>
</section>
```

- [ ] **Step 3: Wire events**

In `app-graph-events.js`, add click handlers:

```js
const archiveGraphDisplayModeBtn = event.target.closest("[data-archive-graph-display-mode]");
if (archiveGraphDisplayModeBtn) {
  state.appSettings.archiveGraphDisplayMode = archiveGraphDisplayModeBtn.dataset.archiveGraphDisplayMode === "2d" ? "2d" : "3d";
  saveState();
  render();
  return;
}

const archiveGraphDepthBtn = event.target.closest("[data-archive-graph-focus-depth]");
if (archiveGraphDepthBtn) {
  state.appSettings.archiveGraphDepth = Math.max(1, Math.min(3, Number(archiveGraphDepthBtn.dataset.archiveGraphFocusDepth) || 2));
  saveState();
  render();
  return;
}
```

- [ ] **Step 4: Initialize renderer after archive render**

In `app.js`, import:

```js
import { initArchiveGraph3D } from "./archive-graph-3d.js";
```

After `archiveFullContent.innerHTML = renderArchiveView();`, call:

```js
requestAnimationFrame(() => {
  initArchiveGraphD3();
  initArchiveGraph3D();
});
```

- [ ] **Step 5: Verify**

Run:

```powershell
node test_archive_view_modes.mjs
node test_archive_graph_3d_markup.mjs
npm.cmd test
```

Expected: all pass.

## Phase 4: Real 3D Interactions

### Task 4: Add Orbit, Hover, Select, and Focus

**Files:**
- Modify: `archive-graph-3d.js`
- Modify: `components.css`
- Test: `test_archive_graph_3d_markup.mjs`

- [ ] **Step 1: Add imports**

At top of `archive-graph-3d.js`:

```js
import { OrbitControls } from "./node_modules/three/examples/jsm/controls/OrbitControls.js";
```

- [ ] **Step 2: Add controls**

After camera/renderer creation:

```js
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 80;
controls.maxDistance = 900;
```

Inside `animate()` before render:

```js
controls.update();
```

- [ ] **Step 3: Add raycast hover**

Add:

```js
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

renderer.domElement.addEventListener("pointermove", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(scene.children, false).find((entry) => entry.object.userData?.id);
  hovered = hit?.object || null;
  container.dataset.archiveGraphHover = hovered?.userData?.label || "";
});
```

- [ ] **Step 4: Add select dispatch**

Add:

```js
renderer.domElement.addEventListener("click", () => {
  if (!hovered?.userData?.id?.startsWith("resource:")) return;
  const resourceId = hovered.userData.id.replace("resource:", "");
  container.dispatchEvent(new CustomEvent("archive-graph-3d-select", {
    bubbles: true,
    detail: { resourceId: Number(resourceId) }
  }));
});
```

In `app-graph-events.js`, listen:

```js
document.addEventListener("archive-graph-3d-select", (event) => {
  state.selectedArchiveResourceId = Number(event.detail.resourceId);
  state.archiveEditMode = false;
  saveState();
  render();
});
```

- [ ] **Step 5: Verify with browser**

Use the in-app Browser or Playwright:

```powershell
npm.cmd test
```

Then open the app, switch to Archive -> Graph -> 3D, confirm:

- Canvas is not blank.
- Drag rotates.
- Wheel zooms.
- Hover updates label overlay.
- Clicking a material selects it.

## Phase 5: Visual Design Upgrade

### Task 5: Make It Feel Like A Knowledge Constellation

**Files:**
- Modify: `archive-graph-3d.js`
- Modify: `components.css`

- [ ] **Step 1: Node colors**

Use this palette in `archive-graph-3d.js`:

```js
const nodeColorByKind = {
  material: 0xd8e5ff,
  link: 0xb4e0ff,
  topic: 0xb7f0c1,
  project: 0xffe3a3,
  task: 0xffb6a3,
  cluster: 0xcdb7ff
};
```

- [ ] **Step 2: Edge colors**

Use this edge palette:

```js
const edgeColorByType = {
  backlink: 0xffd88a,
  topic: 0x7ecf91,
  similarity: 0xb9a8ff,
  related: 0x8fb8ff
};
```

- [ ] **Step 3: Add starfield grid**

Add a subtle points background:

```js
const starGeometry = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 900; i += 1) {
  starPositions.push((Math.random() - 0.5) * 1400, (Math.random() - 0.5) * 900, (Math.random() - 0.5) * 900);
}
starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x34383c, size: 0.8 })));
```

- [ ] **Step 4: CSS shell**

Add to `components.css`:

```css
.archive-graph-3d {
  position: relative;
  min-height: 620px;
  background: #111315;
  color: #f1f3ef;
  overflow: hidden;
}

.archive-graph-3d-canvas {
  width: 100%;
  min-height: 620px;
}

.archive-graph-3d-toolbar {
  position: absolute;
  z-index: 3;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
}

.archive-graph-3d-toolbar button {
  border: 1px solid rgba(255,255,255,0.16);
  background: rgba(20,22,24,0.72);
  color: #f1f3ef;
  border-radius: 6px;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 700;
}

.archive-graph-3d-toolbar button.active {
  background: #f1f3ef;
  color: #111315;
}
```

- [ ] **Step 5: Visual QA**

Run the app and verify desktop and mobile-ish narrow window:

- Text overlays do not overlap.
- Canvas has stable height.
- Toolbar stays clickable.
- Scene is visible within first viewport.

## Phase 6: Neighborhood Tools

### Task 6: Add Focus Depth and Agent Index

**Files:**
- Modify: `archive-graph-model.js`
- Modify: `ui-components.js`
- Modify: `test_archive_graph_model.mjs`

- [ ] **Step 1: Extend model meta**

Return:

```js
meta: {
  selectedId,
  nodeCount: nodes.length,
  relationCount: links.length,
  focusDepth: Number(options.depth) || 2,
  topTerms: [...selectedTerms].slice(0, 8)
}
```

- [ ] **Step 2: Add inspector rows**

In `ui-components.js`, render a 3D inspector:

```html
<aside class="archive-graph-3d-inspector">
  <h3>Active Context</h3>
  <strong>${escapeHtml(selectedResource?.name || "Archive Graph")}</strong>
  <p>${escapeHtml(graphModel.meta.topTerms.join(", ") || "No focused terms")}</p>
  <h3>Agent Index</h3>
  <p>${graphModel.meta.nodeCount} nodes · ${graphModel.meta.relationCount} relations · ${graphModel.meta.focusDepth}-step view</p>
</aside>
```

- [ ] **Step 3: Test metadata**

Extend `test_archive_graph_model.mjs`:

```js
assert.equal(model.meta.focusDepth, 2);
assert.ok(model.meta.topTerms.includes("레비나스"));
```

- [ ] **Step 4: Verify**

Run:

```powershell
node test_archive_graph_model.mjs
npm.cmd test
```

Expected: all pass.

## Phase 7: Performance Guardrails

### Task 7: Keep Large Archives Usable

**Files:**
- Modify: `archive-graph-model.js`
- Modify: `archive-graph-3d.js`
- Test: `test_archive_graph_model.mjs`

- [ ] **Step 1: Add model limits**

In `buildArchiveGraphModel`, enforce:

```js
const materialLimit = Math.max(20, Math.min(240, Number(options.limit) || 120));
const edgeLimit = Math.max(40, Math.min(600, Number(options.edgeLimit) || 280));
```

Before return:

```js
const limitedLinks = links
  .sort((a, b) => (b.score || 0) - (a.score || 0))
  .slice(0, edgeLimit);
```

Return `links: limitedLinks`.

- [ ] **Step 2: Add renderer disposal**

Ensure `archive-graph-3d.js` disposes geometries/materials:

```js
scene.traverse((object) => {
  object.geometry?.dispose?.();
  if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
  else object.material?.dispose?.();
});
```

- [ ] **Step 3: Test limits**

In `test_archive_graph_model.mjs`, add:

```js
const bigState = {
  ...stateLike,
  archiveResources: Array.from({ length: 300 }, (_, index) => ({
    id: 1000 + index,
    name: `레비나스 해설 ${index}.pdf`,
    type: "file",
    path: `G:\\levinas\\${index}.pdf`,
    desc: "레비나스 전체성과 무한 해설",
    tags: []
  }))
};
const limited = buildArchiveGraphModel(bigState, { limit: 60, edgeLimit: 90 });
assert.ok(limited.nodes.length <= 60 + 80, "topics and targets may add nodes, but material limit must hold");
assert.ok(limited.links.length <= 90);
```

- [ ] **Step 4: Verify**

Run:

```powershell
node test_archive_graph_model.mjs
npm.cmd test
```

Expected: all pass.

## Phase 8: Documentation and Harness Update

### Task 8: Document The New Contract

**Files:**
- Modify: `docs/HARNESS.md`
- Modify: `docs/FRONTEND.md`
- Modify: `docs/PROJECT_LOGIC.md`
- Modify: `docs/DATA_MODEL.md`

- [ ] **Step 1: Update `docs/HARNESS.md`**

Add:

```markdown
## Archive 3D Graph Contract

- The archive graph defaults to 3D when available and falls back to 2D/D3 when rendering fails.
- 3D graph nodes are peer concepts: materials, topics, projects, tasks, and clusters. Folder and drive paths are storage metadata, not conceptual roots.
- Active context must dominate ranking. Unrelated global backlinks must not outrank local same-topic materials.
- Any 3D graph change requires `test_archive_graph_model.mjs`, `test_archive_graph_3d_markup.mjs`, `test_archive_view_modes.mjs`, and `npm test`.
```

- [ ] **Step 2: Update `docs/FRONTEND.md`**

Add file ownership notes:

```markdown
- `archive-graph-model.js`: renderer-neutral archive relationship graph.
- `archive-graph-3d.js`: Three.js scene, camera, controls, hover/select lifecycle.
```

- [ ] **Step 3: Update `docs/PROJECT_LOGIC.md`**

Add:

```markdown
- Strong Relations in archive graph are scoped to active context. A high global backlink score is not enough to outrank same-context materials.
- 3D graph depth means relationship steps from the selected material/task/project, not filesystem depth.
```

- [ ] **Step 4: Verify docs and tests**

Run:

```powershell
node test_encoding_integrity.mjs
npm.cmd test
```

Expected: all pass.

## Phase 9: Manual QA Checklist

### Task 9: Visual and Interaction QA

**Files:**
- No code changes unless bugs are found.

- [ ] **Step 1: Start app**

Run:

```powershell
npm.cmd run dev
```

Expected: 작업실 opens.

- [ ] **Step 2: Desktop QA**

In Archive -> Graph -> 3D:

- Scene is visible and not blank.
- Nodes are distributed in 3D space.
- Drag rotates.
- Wheel zooms.
- Hover reveals node label.
- Click selects material and inspector updates.
- 1-step/2-step/3-step controls change density.
- 타이포 backlinks do not outrank 레비나스 relations when a 레비나스 material is selected.

- [ ] **Step 3: Narrow window QA**

Resize to about `760 x 820`:

- Toolbar remains visible.
- Canvas does not collapse.
- Inspector does not overlap canvas controls.
- Text remains readable.

- [ ] **Step 4: Performance QA**

Use current 252-resource archive:

- Initial render completes in under 2 seconds on the local machine.
- Orbiting remains responsive.
- Switching away from Archive and back does not duplicate canvases or leak multiple animation loops.

## Execution Recommendation

Use two implementation passes:

1. **Model + 3D shell:** Tasks 1-3. This creates a working 3D mode behind a toggle.
2. **Interaction + polish:** Tasks 4-9. This makes it feel like an Obsidian-grade graph instead of a tech demo.

Do not remove the existing D3 graph until the 3D path passes manual QA.
