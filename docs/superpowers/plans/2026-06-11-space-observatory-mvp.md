# Space Observatory MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Space tab into the primary archive observatory: a realistic 3D material space plus a compact intelligence panel for confidence, notes, curation status, and linked work.

**Architecture:** Keep `archiveResources` and `archiveResourceLinks` as the data source. Enrich the derived Space graph payload in `archive-graph-model.js`, render the observatory shell and inspector in `ui-components.js`, render the photographic star field in `archive-graph-3d.js`, and keep all interaction routed through the existing `selectedArchiveResourceId` and relation metadata handlers.

**Tech Stack:** Electron renderer, plain JavaScript modules, CSS tokens, Three.js, existing Node test files run through `npm.cmd test`.

---

## Success Contract

- Space remains the archive graph tab, but it reads as the app's main observatory rather than a secondary graph demo.
- The first visible interaction is: select a material star, inspect why it matters, then open/edit/adjust relation confidence without searching another panel.
- Relation brightness is proportional to existing `relationScore` or derived edge score; weak relations must become visibly quieter.
- The right inspector shows selected material name, path/description, confidence lane, memo preview, evidence/reason, and linked projects/tasks as one coherent decision surface.
- Manually linked resources are treated as normal relation intelligence, not a separate "reference links" bucket.
- Korean labels must use UTF-8-safe literals or `\u` escapes and must not be clipped in compact panels.
- No broad data migration is allowed in MVP. New persisted settings are avoided unless a UI control genuinely needs to survive reload.

## File Structure

- Modify `archive-graph-model.js`
  - Derived Space payload only.
  - Add relation lane, strongest backlink, memo presence, relation score summary, and selected-context metadata.
- Modify `ui-components.js`
  - Archive graph header copy, metric labels, filter labels, and right inspector markup.
  - Extract small helper functions near existing archive relation helpers.
- Modify `archive-graph-3d.js`
  - Realistic background polish, star-node material polish, z-depth distribution, relation line brightness.
  - No application state writes.
- Modify `components.css`
  - Space layout, inspector hierarchy, action buttons, relation chips, dark-mode contrast, Korean wrapping.
- Modify `app-graph-events.js`
  - Only if new inspector controls need event delegation.
  - Existing `archive-graph-3d-select` already updates `state.selectedArchiveResourceId`.
- Modify tests:
  - `test_archive_graph_model.mjs`
  - `test_archive_graph_3d_markup.mjs`
  - `test_space_dark_mode_css.mjs`
  - `test_korean_ui_layout_contract.mjs`
  - Add `test_space_observatory_inspector.mjs` if the inspector assertions become too large for `test_archive_graph_3d_markup.mjs`.
- Update `scripts/run-tests.mjs` only if a new test file is added.

## Assumptions

- Existing dirty worktree changes are user/previous-agent work and must not be reverted.
- Three.js is already an accepted dependency for Space.
- The user values reliable curation signals more than faster computation.
- Relation notes are already stored on `archiveResourceLinks.relationNote` and should continue to help later auto-link scoring.
- `Space` is the user-facing tab name, but some internal classes may keep `archive-graph-*` names to avoid a risky rename.

---

### Task 1: Graph Payload Intelligence

**Files:**
- Modify: `archive-graph-model.js`
- Test: `test_archive_graph_model.mjs`

- [ ] **Step 1: Add failing model assertions**

Add a focused state where the selected material has strong, medium, weak, and memo-bearing backlinks.

```js
const relationState = {
  selectedArchiveResourceId: 801,
  projects: [
    { id: 81, name: "Weekly visual essay", note: "one page image text reference" }
  ],
  tasks: [
    { id: 82, projectId: 81, name: "Design site review", note: "trend useful weekly layout" }
  ],
  archiveResources: [
    { id: 801, name: "Primary gallery", type: "link", path: "https://example.com/a", desc: "weekly design reference", tags: ["design"], semanticEmbedding: [1, 0, 0] },
    { id: 802, name: "Medium magazine", type: "link", path: "https://example.com/b", desc: "editorial layout reference", tags: ["layout"], semanticEmbedding: [0.96, 0.04, 0] },
    { id: 803, name: "Weak inspiration", type: "link", path: "https://example.com/c", desc: "loose visual mood", tags: ["mood"], semanticEmbedding: [0.8, 0.2, 0] }
  ],
  archiveResourceLinks: [
    { resourceId: 801, targetType: "task", targetId: 82, relationStrength: "strong", relationScore: 92, relationType: "core", relationNote: "Start here" },
    { resourceId: 802, targetType: "task", targetId: 82, relationStrength: "medium", relationScore: 61, relationType: "reference", relationNote: "" },
    { resourceId: 803, targetType: "project", targetId: 81, relationStrength: "weak", relationScore: 28, relationType: "similar", relationNote: "Only mood" }
  ]
};

const relationModel = buildArchiveGraphModel(relationState, { depth: 2, limit: 20, edgeLimit: 40 });
const primary = relationModel.nodes.find((node) => node.id === "resource:801");
assert.equal(primary.relationLane, "first");
assert.equal(primary.relationScore, 92);
assert.equal(primary.hasRelationMemo, true);
assert.equal(primary.strongestBacklink.label, "Design site review");
assert.ok(relationModel.meta.relationLaneCounts.first >= 1);
assert.ok(relationModel.meta.relationLaneCounts.review >= 1);
assert.ok(relationModel.links.every((link) => Number.isFinite(Number(link.score))));
```

- [ ] **Step 2: Run the failing test**

Run: `node test_archive_graph_model.mjs`

Expected: FAIL because `relationLane`, `relationScore`, `hasRelationMemo`, `strongestBacklink`, or `relationLaneCounts` is not present.

- [ ] **Step 3: Implement derived relation summaries**

Add small helpers near `buildLinksByResource()`:

```js
function relationScoreValue(link, fallback = 50) {
  const score = Number(link?.relationScore);
  if (Number.isFinite(score)) return Math.max(0, Math.min(100, Math.round(score)));
  if (link?.relationStrength === "strong") return 90;
  if (link?.relationStrength === "weak") return 30;
  return fallback;
}

function relationLaneFromScore(score, link = {}) {
  if (link.relationStatus === "suggested") return "review";
  if (score >= 78) return "first";
  if (score >= 55) return "middle";
  if (score >= 1) return "low";
  return "unverified";
}

function summarizeResourceRelations(backlinks = []) {
  if (!backlinks.length) {
    return {
      relationScore: 0,
      relationLane: "unverified",
      hasRelationMemo: false,
      strongestBacklink: null
    };
  }
  const ordered = [...backlinks].sort((a, b) => relationScoreValue(b, 0) - relationScoreValue(a, 0));
  const strongestBacklink = ordered[0];
  const relationScore = relationScoreValue(strongestBacklink, 50);
  return {
    relationScore,
    relationLane: relationLaneFromScore(relationScore, strongestBacklink),
    hasRelationMemo: backlinks.some((link) => typeof link.relationNote === "string" && link.relationNote.trim()),
    strongestBacklink
  };
}
```

Extend `buildLinksByResource()` summaries to include `relationNote`, then merge `summarizeResourceRelations(backlinks)` into each material node.

- [ ] **Step 4: Add lane counts to model metadata**

After `depthGraph` is computed:

```js
const relationLaneCounts = depthGraph.nodes.reduce((counts, node) => {
  const lane = node.relationLane || "unverified";
  counts[lane] = (counts[lane] || 0) + 1;
  return counts;
}, { first: 0, middle: 0, low: 0, review: 0, unverified: 0 });
```

Add `relationLaneCounts` to `meta`.

- [ ] **Step 5: Verify**

Run: `node test_archive_graph_model.mjs`

Expected: PASS and prints `archive graph model ok`.

---

### Task 2: Space Observatory Inspector Markup

**Files:**
- Modify: `ui-components.js`
- Test: `test_archive_graph_3d_markup.mjs`
- Optional Test: `test_space_observatory_inspector.mjs`
- Optional Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Add failing markup assertions**

In `test_archive_graph_3d_markup.mjs`, after parsing `graph3dHtml`, assert that the inspector has a coherent observatory structure.

```js
assert.match(graph3dHtml, /archive-graph-observatory/);
assert.match(graph3dHtml, /archive-graph-inspector-card/);
assert.match(graph3dHtml, /\uc120\ud0dd \uc790\ub8cc/);
assert.match(graph3dHtml, /\uc2e0\ub8b0\ub3c4/);
assert.match(graph3dHtml, /\uba54\ubaa8/);
assert.match(graph3dHtml, /\uc5f0\uacb0\ub41c \uc791\uc5c5/);
assert.match(graph3dHtml, /data-archive-relation-strength="strong"/);
assert.match(graph3dHtml, /data-archive-relation-note="true"/);
assert.doesNotMatch(graph3dHtml, /Active Context/);
assert.doesNotMatch(graph3dHtml, /Archive Graph/);
```

- [ ] **Step 2: Run the failing test**

Run: `node test_archive_graph_3d_markup.mjs`

Expected: FAIL because the current inspector still uses older English structure and does not expose the selected relation as a first-class inspector card.

- [ ] **Step 3: Add inspector helper functions**

Near the existing archive relation helpers in `ui-components.js`, add helpers that use existing `archiveRelationConfidenceBadgeMarkup()`, `archiveRelationReasonMarkup()`, `archiveRelationAdjustMarkup()`, and `archiveRelationNotePreviewMarkup()`.

```js
function selectedArchiveBacklinks(resourceId) {
  const projectsById = new Map((state.projects || []).map((project) => [Number(project.id), project]));
  const tasksById = new Map((state.tasks || []).map((task) => [Number(task.id), task]));
  return (state.archiveResourceLinks || [])
    .filter((link) => Number(link.resourceId) === Number(resourceId))
    .map((link) => {
      const target = link.targetType === "task"
        ? tasksById.get(Number(link.targetId))
        : projectsById.get(Number(link.targetId));
      if (!target) return null;
      return { link, target };
    })
    .filter(Boolean)
    .sort((a, b) => archiveRelationConfidenceState(b.link).score - archiveRelationConfidenceState(a.link).score);
}

function archiveGraphInspectorMarkup(selectedResource, graph3dPayload) {
  const backlinks = selectedResource ? selectedArchiveBacklinks(selectedResource.id) : [];
  const primary = backlinks[0]?.link || null;
  const laneCounts = graph3dPayload?.meta?.relationLaneCounts || {};
  return `
    <aside class="archive-graph-inspector archive-graph-observatory" aria-label="Space observatory inspector">
      <section class="archive-graph-inspector-card">
        <p class="archive-graph-kicker">Space Observatory</p>
        <h3>${selectedResource ? "\uc120\ud0dd \uc790\ub8cc" : "\uc790\ub8cc \uad00\uce21"}</h3>
        <strong>${selectedResource ? escapeHtml(selectedResource.name) : "\uc120\ud0dd\ub41c \uc790\ub8cc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4"}</strong>
        <p>${selectedResource ? escapeHtml(selectedResource.desc || selectedResource.path || "\uc124\uba85 \uc5c6\uc74c") : "\ubcc4\uc744 \uc120\ud0dd\ud558\uba74 \uc2e0\ub8b0\ub3c4, \uba54\ubaa8, \uc5f0\uacb0\ub41c \uc791\uc5c5\uc744 \ud55c\ubc88\uc5d0 \ubcf4\uc5ec\uc90d\ub2c8\ub2e4."}</p>
      </section>
      ${selectedResource && primary ? `
        <section class="archive-graph-inspector-card">
          <h3>\ud310\ub2e8 \uae30\uc900</h3>
          ${archiveRelationConfidenceBadgeMarkup(primary)}
          ${archiveRelationReasonMarkup(primary)}
          ${archiveRelationNotePreviewMarkup(primary)}
          ${archiveRelationAdjustMarkup(primary)}
        </section>
      ` : ""}
      <section class="archive-graph-inspector-card">
        <h3>\ud050\ub808\uc774\uc158 \ubd84\ud3ec</h3>
        <dl class="archive-graph-lane-metrics">
          <div><dt>\uba3c\uc800 \ubcfc \uac83</dt><dd>${Number(laneCounts.first || 0)}</dd></div>
          <div><dt>\uc911\uac04</dt><dd>${Number(laneCounts.middle || 0)}</dd></div>
          <div><dt>\ub0ae\uc74c</dt><dd>${Number(laneCounts.low || 0)}</dd></div>
          <div><dt>\ud655\uc778 \ud544\uc694</dt><dd>${Number((laneCounts.review || 0) + (laneCounts.unverified || 0))}</dd></div>
        </dl>
      </section>
      ${selectedResource ? `
        <section class="archive-graph-inspector-card">
          <h3>\uc5f0\uacb0\ub41c \uc791\uc5c5</h3>
          ${backlinks.length ? backlinks.slice(0, 6).map(({ link, target }) => `
            <article class="archive-graph-linked-work">
              <strong>${escapeHtml(target.name || "\uc774\ub984 \uc5c6\uc74c")}</strong>
              ${archiveRelationConfidenceBadgeMarkup(link)}
            </article>
          `).join("") : `<p>\uc5f0\uacb0\ub41c \uc791\uc5c5\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</p>`}
        </section>
        <div class="archive-graph-context-actions">
          <button type="button" id="toggleArchiveEditMode">\uc790\ub8cc \ud3b8\uc9d1</button>
          <button type="button" data-open-archive-path="${escapeHtml(selectedResource.path)}" data-archive-type="${selectedResource.type}">\uc790\ub8cc \uc5f4\uae30</button>
        </div>
      ` : ""}
    </aside>
  `;
}
```

- [ ] **Step 4: Replace the old inspector block**

In `renderArchiveView()`, replace the old `<aside class="archive-graph-inspector"...>` block with:

```js
${archiveGraphInspectorMarkup(selectedResource, graph3dPayload)}
```

Do not rename the whole archive view yet. Only change visible copy and inspector structure.

- [ ] **Step 5: Verify**

Run: `node test_archive_graph_3d_markup.mjs`

Expected: PASS and inspector assertions find the new Space observatory markup.

---

### Task 3: Space Visual Depth And Relation Brightness

**Files:**
- Modify: `archive-graph-3d.js`
- Test: `test_archive_graph_3d_markup.mjs`

- [ ] **Step 1: Add failing renderer assertions**

Extend `test_archive_graph_3d_markup.mjs`:

```js
assert.match(rendererSource, /function photographicStarDepth/);
assert.match(rendererSource, /function relationLineWidth/);
assert.match(rendererSource, /relationLane/);
assert.match(rendererSource, /transparent:\s*true/);
assert.match(rendererSource, /toneMappingExposure = 1\.08|toneMappingExposure = 1\.1/);
assert.match(rendererSource, /space-photographic-grain/);
assert.doesNotMatch(rendererSource, /toneMappingExposure = 1\.14/);
```

- [ ] **Step 2: Run the failing test**

Run: `node test_archive_graph_3d_markup.mjs`

Expected: FAIL because these named visual helpers do not exist yet.

- [ ] **Step 3: Reduce gradient banding**

In the backdrop shader, keep the nebula but lower overexposure and name the dither/grain more clearly:

```js
float photographicGrain(vec2 position) {
  return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453123);
}
```

Use:

```glsl
color = pow(color, vec3(0.92));
color += (photographicGrain(gl_FragCoord.xy + time * 11.0) - 0.5) / 384.0;
```

Set:

```js
renderer.toneMappingExposure = 1.08;
```

- [ ] **Step 4: Make z-depth visible**

Add a helper near node layout helpers:

```js
function photographicStarDepth(node) {
  const distance = Number(node.graphDistance);
  if (node.active) return 72;
  if (distance === 1) return seededRange(hashString(node.id) + 41, 12, 120);
  if (distance === 2) return seededRange(hashString(node.id) + 43, -170, 40);
  return seededRange(hashString(node.id) + 45, -360, -120);
}
```

Use this helper in `layoutNodes()` or the final mesh positioning path so selected, direct, and expanded materials occupy visibly different z shells. Keep deterministic seeded positions so tests and user spatial memory stay stable.

- [ ] **Step 5: Make relation strength visible**

Add:

```js
function relationLineWidth(link) {
  return 0.65 + relationIntensity(link) * 2.2;
}
```

If `THREE.LineBasicMaterial.linewidth` is unreliable on the platform, still store the value in `line.userData.lineWidth` and make opacity/glow carry the visible effect:

```js
line.userData.lineWidth = relationLineWidth(link);
```

Strengthen `relationLineOpacity()`, `relationGlowOpacity()`, and `relationPulseAmount()` around high scores while keeping weak lines visible but quiet.

- [ ] **Step 6: Verify**

Run: `node test_archive_graph_3d_markup.mjs`

Expected: PASS.

---

### Task 4: Space CSS Hierarchy And Dark Contrast

**Files:**
- Modify: `components.css`
- Test: `test_space_dark_mode_css.mjs`
- Test: `test_korean_ui_layout_contract.mjs`

- [ ] **Step 1: Add failing CSS assertions**

In `test_space_dark_mode_css.mjs`:

```js
assert.match(
  componentsCss,
  /\.archive-graph-inspector-card\s*\{[^}]*background:\s*var\(--panel-soft\);/s,
  "Space inspector cards should use theme surface tokens"
);
assert.match(
  componentsCss,
  /\.archive-graph-context-actions button\s*\{[^}]*background:\s*var\(--panel-raised\);[^}]*color:\s*var\(--text\);/s,
  "Space inspector action buttons must remain visible in dark mode"
);
assert.match(
  componentsCss,
  /\.archive-graph-linked-work\s*\{[^}]*min-width:\s*0;/s,
  "linked work rows must allow Korean labels to shrink without clipping"
);
```

In `test_korean_ui_layout_contract.mjs`, add checks for the new classes:

```js
assert.match(componentsCss, /\.archive-graph-inspector-card[\s\S]*overflow-wrap:\s*anywhere;/);
assert.match(componentsCss, /\.archive-graph-linked-work[\s\S]*overflow-wrap:\s*anywhere;/);
assert.match(componentsCss, /\.archive-graph-lane-metrics[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
```

- [ ] **Step 2: Run failing CSS tests**

Run:

```bash
node test_space_dark_mode_css.mjs
node test_korean_ui_layout_contract.mjs
```

Expected: FAIL because the new inspector classes are not styled.

- [ ] **Step 3: Add Space inspector CSS**

Place Space-specific CSS near existing `.archive-graph-*` rules in `components.css`:

```css
.archive-graph-observatory {
  display: grid;
  align-content: start;
  gap: var(--space-section);
  min-width: 0;
}

.archive-graph-inspector-card {
  display: grid;
  gap: var(--space-tight);
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: var(--space-section);
  background: var(--panel-soft);
  color: var(--text);
  overflow-wrap: anywhere;
}

.archive-graph-inspector-card h3 {
  margin: 0;
  color: var(--muted);
  font-size: var(--type-caption);
  font-weight: 900;
  text-transform: uppercase;
}

.archive-graph-inspector-card strong {
  min-width: 0;
  color: var(--text);
  font-size: var(--type-body);
  line-height: 1.35;
}

.archive-graph-inspector-card p {
  margin: 0;
  color: var(--muted);
  font-size: var(--type-meta);
  line-height: 1.45;
}

.archive-graph-kicker {
  margin: 0;
  color: var(--quiet);
  font-size: var(--type-micro);
  font-weight: 900;
  text-transform: uppercase;
}

.archive-graph-lane-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-tight);
  margin: 0;
}

.archive-graph-lane-metrics div,
.archive-graph-linked-work {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: var(--space-tight);
  background: var(--panel-raised);
  overflow-wrap: anywhere;
}

.archive-graph-lane-metrics dt,
.archive-graph-lane-metrics dd {
  margin: 0;
}

.archive-graph-lane-metrics dt {
  color: var(--muted);
  font-size: var(--type-micro);
  font-weight: 850;
}

.archive-graph-lane-metrics dd {
  color: var(--text);
  font-size: var(--type-body);
  font-weight: 900;
}

.archive-graph-linked-work {
  display: grid;
  gap: var(--space-hair);
}
```

Keep existing `.archive-graph-context-actions button` dark-mode contrast rules.

- [ ] **Step 4: Verify CSS tests**

Run:

```bash
node test_space_dark_mode_css.mjs
node test_korean_ui_layout_contract.mjs
```

Expected: PASS.

---

### Task 5: Event Wiring Guard

**Files:**
- Modify: `app-graph-events.js` only if needed
- Test: `test_archive_graph_3d_markup.mjs`
- Test: `test_archive_detail_panel.mjs` if relation adjustment event coverage is already there

- [ ] **Step 1: Confirm existing selection event**

Read `app-graph-events.js` and confirm this behavior remains:

```js
document.addEventListener("archive-graph-3d-select", (event) => {
  const node = event.detail?.node;
  if (!node || state.viewMode !== "archive") return;
  if (node.resourceId !== undefined) {
    state.selectedArchiveResourceId = Number(node.resourceId);
    state.archiveEditMode = false;
    saveState();
    render();
    return;
  }
});
```

- [ ] **Step 2: Avoid new event handlers for existing controls**

Do not add handlers for:

- `data-archive-relation-strength`
- `data-archive-relation-note`
- `#toggleArchiveEditMode`
- `data-open-archive-path`

These already exist in the event layer. If the markup uses the same attributes, no new behavior is needed.

- [ ] **Step 3: Add a regression assertion if an event change is needed**

Only if a new action attribute is introduced, add a test assertion to ensure it appears in the markup and add a single delegated handler near the existing archive graph handler block.

- [ ] **Step 4: Verify no event syntax break**

Run: `node --check app-graph-events.js`

Expected: no output and exit code 0.

---

### Task 6: Final Verification And Manual QA Script

**Files:**
- Modify: no source files unless a test file was added to `scripts/run-tests.mjs`
- Test: all relevant tests

- [ ] **Step 1: Run targeted checks**

Run:

```bash
node test_archive_graph_model.mjs
node test_archive_graph_3d_markup.mjs
node test_space_dark_mode_css.mjs
node test_korean_ui_layout_contract.mjs
node --check archive-graph-3d.js
node --check ui-components.js
node --check app-graph-events.js
```

Expected: all PASS or syntax-check exit code 0.

- [ ] **Step 2: Run full test suite**

Run: `npm.cmd test`

Expected: all project tests pass.

- [ ] **Step 3: Run whitespace check**

Run: `git diff --check`

Expected: no whitespace errors. CRLF warnings may appear from existing repository line endings; report them separately if they are unchanged by this work.

- [ ] **Step 4: Manual QA for the user**

Ask the user to test these specific flows:

1. Open the app, switch to `Space`, and confirm the scene feels like real space rather than a pixel map.
2. Click a bright/central material star and confirm the right panel updates to that material.
3. Confirm strong relation lines are brighter than weak or review-needed lines.
4. In the right panel, change confidence to high/medium/low and confirm it stays after closing/reopening.
5. Add a short Korean memo and confirm it appears without clipping.
6. Toggle dark mode and confirm edit/open buttons remain readable.
7. Open a task with manually linked design links and confirm those links are absorbed into the normal curation lanes.

## Self-Review

- Spec coverage: The plan covers Space visual realism, z-depth, relation brightness, inspector information hierarchy, memo/confidence display, Korean clipping, dark contrast, and existing link absorption.
- Placeholder scan: No placeholder markers or vague "add tests later" steps remain.
- Type consistency: The plan uses existing `archiveResourceLinks` fields: `relationStatus`, `relationType`, `relationStrength`, `relationScore`, and `relationNote`. New derived fields are payload-only: `relationLane`, `relationScore`, `hasRelationMemo`, `strongestBacklink`, and `relationLaneCounts`.
- Risk note: The implementation should not rename all `archive-graph-*` internals to `space-*` in this MVP because that would create high CSS/event/test churn without improving the user's workflow.
