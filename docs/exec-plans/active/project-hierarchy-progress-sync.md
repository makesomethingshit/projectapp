# Project Hierarchy Progress Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicated progress state from becoming the displayed truth, and make project hierarchy, child contribution, task contribution, and rollup behavior consistent.

**Architecture:** Keep editable task/project base values separate from derived rollup display values. Centralize hierarchy and progress calculations in `calculator.js`, keep normalization in `state.js`, and make UI/event code consume named calculation helpers instead of reinterpreting stored fields.

**Tech Stack:** Electron renderer, plain JavaScript ES modules, browser `localStorage`, standalone Node assertion tests.

---

## 현재 문제 요약

- `project.progress` and `project.advance` are stored on projects, but the UI usually displays `getRollupProgress(project.id)` and `getRollupAdvance(project.id)`. The same field can therefore be read as either editable/base progress or final displayed progress.
- `task.progress` and `task.advance` are the clearest editable source values, but project values are also editable through import/default data and used as fallback when there are no contributors.
- Parent/child hierarchy is represented by `project.parentId`, while external influence is represented by `projectLinks`. These are separate concepts, but both ultimately affect displayed rollup values.
- `getCompletionContributors()` chooses child projects first and ignores direct tasks whenever eligible children exist. This may be intentional, but it is the most important hierarchy rule to make explicit and test.
- Completion rollup is weighted through `completionWeights`, while advance rollup is a simple average. This asymmetry may be intentional, but it should be documented and guarded by tests.
- `contributionMode` exists on both projects and tasks. It controls whether an item contributes to completion, advance, or both, but the exact behavior differs between completion and advance paths.
- The docs mention folder behavior, but code has no separate `Folder` entity. Folder-like grouping is currently top-level or nested projects.

## 현재 데이터 흐름

1. App state is held in `state` from `state.js`.
2. Saved data is loaded from `localStorage` key `studio-project-widget-state-v1`.
3. `applyLoadedState()` normalizes `projects`, `tasks`, `projectLinks`, archive collections, formula links, and UI settings.
4. `normalizeProjects()` clamps project `progress` and `advance`; `advance` falls back to `progress`.
5. `normalizeTasks()` clamps task `progress` and `advance`; `advance` falls back to `progress` or old `status === "done"`.
6. User actions update stored values directly:
   - New project: `progress: 0`, `advance: 0`, `contributionMode: "both"`.
   - Edit project: updates `parentId`, `contributionMode`, note, deadline, outgoing `projectLinks`.
   - New/edit task: updates task `progress`, `advance`, `projectId`, and `contributionMode`.
   - Graph hierarchy connection: sets `target.parentId = source.id`, updates child `contributionMode`, and may set a completion weight.
   - Weight sliders mutate `completionWeights`, `projectLinks`, formula links, or formula input links.
7. UI display reads mostly derived values:
   - Project list/detail/graph use `getRollupProgress()` and `getRollupAdvance()`.
   - Segment views use `getProgressSegments()` and `getAdvanceSegments()`.
   - Bottleneck views use `getBottleneckDetails()`.
8. `saveState()` records history using derived top-level rollups, then serializes stored state.

## 관련 파일

- `docs/PRODUCT.md`: product intent and current ambiguity around folders/status/progress.
- `docs/DATA_MODEL.md`: stored project/task fields and the current note that project progress is both stored and derived.
- `docs/PROJECT_LOGIC.md`: hierarchy, completion, advance, links, formula, and known open questions.
- `docs/QUALITY_CHECK.md`: required verification commands and QA checklist.
- `docs/generated/project-map.md`: current source map.
- `state.js`: defaults, normalization, load/save, serialization, history snapshots.
- `calculator.js`: hierarchy traversal, contributors, weights, rollups, segments, bottleneck calculations.
- `app-graph-actions.js`: graph hierarchy and external link creation/removal.
- `app-graph-events.js`: form submissions, task sliders, project edits, graph interactions.
- `app-modals.js`: parent/project/task/contribution edit controls.
- `ui-components.js`: detail/list markup, rollup panels, task cards, metric badges.
- `graph-components.js`: graph data, hierarchy edges, grouped tasks, metric badges and graph nodes.
- Existing tests: `test_bottleneck_hierarchy_direction.mjs`, `test_graph_navigation.mjs`, `test_detail_bottleneck_navigation.mjs`, archive tests.

## 불분명한 가정

- Assumption: A project's stored `progress` and `advance` should remain as fallback/base values only when the project has no eligible child project or task contributors.
- Assumption: A child project should hide direct parent tasks from the same metric when at least one eligible child exists. This is current behavior, but it may surprise users.
- Assumption: Completion should remain weighted, and advance should remain average-based unless the product owner explicitly asks for weighted advance too.
- Assumption: There is no separate Folder model for this phase. Project hierarchy remains the folder/grouping mechanism.
- Assumption: Project `status` remains manual text and should not be auto-derived from progress/deadline in this change.
- Assumption: External `projectLinks` and formula links should continue to affect displayed rollups, not stored base values.
- Assumption: Existing imported JSON may contain project `progress`/`advance`; migration must keep those values as base fallback values.

## 진행도의 단일 진실 공급원 제안

- Treat task values as primary editable progress inputs:
  - `task.progress`: task completion input.
  - `task.advance`: task advance input.
  - `task.contributionMode`: which metric(s) the task contributes to.
- Treat project values as base fallback inputs, not displayed truth:
  - `project.progress`: project base completion used only when there are no eligible completion contributors.
  - `project.advance`: project base advance used only when there are no eligible advance contributors.
  - Optional future rename: `baseProgress` and `baseAdvance`, but avoid that migration unless implementation needs it.
- Treat rollup helpers as the only displayed truth:
  - `getOwnProgress(projectId)`: internal/base completion before external links.
  - `getOwnAdvance(projectId)`: internal/base advance before external links.
  - `getRollupProgress(projectId)`: final displayed completion after external/formula influence.
  - `getRollupAdvance(projectId)`: final displayed advance after external/formula influence.
- Add small naming/documentation guards so UI code never uses `project.progress` or `project.advance` directly for display unless it is clearly showing base/fallback value.
- Keep `completionWeights` as weights for completion contributors only. Do not duplicate derived rollup values into state.

## 부모/자식 동기화 동작 제안

- Parent/child sync should be calculation-based, not write-through:
  - Changing a child task updates only that task.
  - Changing a child project's fallback/base values updates only that child project.
  - Parent displayed values update because rollup functions recalculate during render/save history.
- Hierarchy creation/removal should update only relationship fields and related weights:
  - Creating child relation sets `child.parentId = parent.id`.
  - Creating child relation sets child `contributionMode` from the selected connection metric.
  - If child contributes to completion, set/update `completionWeights[parent.id]["project:child.id"]`.
  - Removing child relation sets `child.parentId = null`.
  - Removing child relation should also prune stale `completionWeights[parent.id]["project:child.id"]` if no longer a contributor.
- Parent contributor rules should be explicit:
  - Completion contributors: eligible direct child projects if any exist; otherwise eligible direct tasks.
  - Advance contributors: eligible direct child projects if any exist; otherwise eligible direct tasks.
  - External and formula links modify final rollup after own/internal value.
- Cycle prevention remains mandatory in:
  - `normalizeProjects()`.
  - edit parent form submission.
  - graph hierarchy connection.

## 구현 단계

### Task 1: Lock Current Behavior With Focused Tests

**Files:**
- Create: `test_project_progress_rollup_contract.mjs`
- Modify: none

- [ ] Add tests proving stored project progress is fallback only when no contributors exist.
- [ ] Add tests proving task changes affect parent rollup without mutating parent stored `progress`/`advance`.
- [ ] Add tests proving child projects take precedence over direct tasks for the same parent metric.
- [ ] Add tests proving external links affect rollup but do not mutate target stored `progress`/`advance`.
- [ ] Run: `node test_project_progress_rollup_contract.mjs`
- [ ] Expected: tests pass against current intended behavior or fail only where the implementation contradicts this plan.

### Task 2: Add Central Helper Names For Display Values

**Files:**
- Modify: `calculator.js`
- Test: `test_project_progress_rollup_contract.mjs`

- [ ] Add tiny exported aliases/helpers such as `getProjectDisplayProgress(projectId)` and `getProjectDisplayAdvance(projectId)` that call the rollup functions.
- [ ] Keep `getRollupProgress()` and `getRollupAdvance()` intact to avoid broad churn.
- [ ] Update tests to assert the display helpers match rollup helpers.
- [ ] Run: `node test_project_progress_rollup_contract.mjs`
- [ ] Expected: all assertions pass.

### Task 3: Prune Stale Completion Weights On Relationship Changes

**Files:**
- Modify: `calculator.js`
- Modify: `app-graph-actions.js`
- Modify: `app-graph-events.js`
- Test: `test_project_progress_rollup_contract.mjs`

- [ ] Add a helper in `calculator.js` to clean `completionWeights` for a parent based on current `getCompletionContributors(parentId)`.
- [ ] Call it after parent changes in the project edit form.
- [ ] Call it after graph hierarchy removal.
- [ ] Call it after project deletion for any affected parent IDs.
- [ ] Keep this cleanup limited to stale contributor keys; do not normalize or rewrite unrelated weights.
- [ ] Run: `node test_project_progress_rollup_contract.mjs`
- [ ] Expected: stale `project:<childId>` and `task:<taskId>` keys are removed only when the item is no longer a current completion contributor.

### Task 4: Make UI Consumption Of Derived Values Explicit

**Files:**
- Modify: `ui-components.js`
- Modify: `graph-components.js`
- Optional Modify: `focus-widget.js` if it reads project progress directly.
- Test: existing graph/detail tests plus `test_project_progress_rollup_contract.mjs`

- [ ] Replace display-oriented `getRollupProgress()`/`getRollupAdvance()` call sites with the new display helper names where it improves readability.
- [ ] Leave segment and bottleneck internals on the existing specialized helpers.
- [ ] Search for direct `project.progress` and `project.advance` usage in UI files.
- [ ] Keep direct project field reads only where the UI is editing base/fallback project values or serializing state.
- [ ] Run existing affected tests:
  - `node test_bottleneck_hierarchy_direction.mjs`
  - `node test_graph_navigation.mjs`
  - `node test_detail_bottleneck_navigation.mjs`
  - `node test_project_progress_rollup_contract.mjs`

### Task 5: Document The Contract

**Files:**
- Modify: `docs/DATA_MODEL.md`
- Modify: `docs/PROJECT_LOGIC.md`
- Modify: `docs/QUALITY_CHECK.md`
- Modify: `docs/generated/project-map.md` only if new test/helper files are added.

- [ ] Document that project `progress`/`advance` are stored fallback/base inputs, not final display values.
- [ ] Document that task `progress`/`advance` are direct editable inputs.
- [ ] Document the child-first contributor rule.
- [ ] Document that external/formula links affect rollup display only.
- [ ] Add the new test command to `docs/QUALITY_CHECK.md`.
- [ ] Update project map for the new test file and any new helper responsibility.

## 추가하거나 수정해야 할 테스트

- Add `test_project_progress_rollup_contract.mjs`.
- Cover fallback behavior:
  - Project with no tasks/children returns stored `progress` and `advance`.
  - Project with completion task returns task-derived completion, not stored project progress.
  - Project with advance task returns task-derived advance, not stored project advance.
- Cover hierarchy behavior:
  - Parent with eligible child project uses child rollup.
  - Parent with eligible child project and direct tasks uses child rollup for that metric under current child-first rule.
  - Child `contributionMode: "advance"` excludes it from completion and includes it in advance.
  - Child `contributionMode: "completion"` includes it in completion and excludes it from advance.
- Cover mutation boundaries:
  - Updating a task should not overwrite parent project stored `progress`/`advance`.
  - External links should not overwrite target stored `progress`/`advance`.
  - Formula links should not overwrite target stored `progress`/`advance`.
- Cover cleanup:
  - Removing a child relation prunes stale completion weight for that parent/child.
  - Deleting a project prunes related links and avoids stale completion contributors.
- Keep existing tests:
  - `test_bottleneck_hierarchy_direction.mjs`
  - `test_graph_navigation.mjs`
  - `test_detail_bottleneck_navigation.mjs`
  - all archive tests if implementation touches shared state normalization.

## 수동 QA 단계

1. Start the app with `npm run dev`.
2. Create a parent project with no tasks or children and confirm displayed completion/advance match its base fallback values.
3. Add a task under that project and change task completion. Confirm the parent displayed completion changes and the exported JSON does not rewrite parent `progress`.
4. Change task advance. Confirm the parent displayed advance changes and parent `advance` is not rewritten.
5. Add a child project under the parent. Confirm the parent's rollup uses eligible child projects for that metric.
6. Add a direct task to the parent while it has an eligible child. Confirm the current child-first rule is visible and consistent.
7. Change child `contributionMode` between completion, advance, and both. Confirm parent completion/advance panels update consistently.
8. Create a graph hierarchy connection and confirm it does not create a cycle.
9. Remove the hierarchy connection and confirm stale completion weight does not remain visible.
10. Add an external project link and confirm the target displayed rollup changes while stored project fallback fields remain unchanged in export.
11. Import/export JSON and confirm normalized data still loads with no orphan task/project references.

## 위험 요소

- Renaming stored fields would require migration and could break old exports. Prefer documentation and helper names first.
- Changing child-first contributor behavior would alter current user-facing rollups. Do not change it unless the product owner confirms.
- Cleanup of `completionWeights` can accidentally erase user-set weights if based on the wrong contributor set.
- `app-graph-events.js` is broad and easy to regress. Keep edits narrow and test parent edit, task edit, graph connection, and graph removal flows.
- Formula links and external links both feed rollups. Cycle protection should remain conservative.
- Some docs/source text previously showed encoding damage in terminal output. Verify final docs in UTF-8 capable editor or through `Get-Content -Encoding UTF8`.

## 수용 기준

- Project displayed completion/advance always comes from named calculation helpers, not from ad hoc direct reads of stored project fields.
- Stored project `progress`/`advance` are documented and treated as base fallback inputs only.
- Task progress/advance remains the primary editable source for task-level work.
- Parent displayed rollups update after child/task/contribution/link changes without writing derived values back into parent `progress`/`advance`.
- Hierarchy changes cannot create cycles.
- Removing or changing hierarchy does not leave visible stale completion weights.
- External and formula links affect final displayed rollups without mutating target base values.
- New and existing tests listed in this plan pass.
- `docs/DATA_MODEL.md`, `docs/PROJECT_LOGIC.md`, and `docs/QUALITY_CHECK.md` reflect the final implemented contract.
