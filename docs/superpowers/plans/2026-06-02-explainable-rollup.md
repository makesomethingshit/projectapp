# Explainable Rollup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show why project completion and advance rollup values are what they are, without storing duplicate progress state.

**Architecture:** `calculator.js` remains the single source for rollup math and exposes explanation objects derived from the existing state. `ui-components.js` renders those explanation objects inside the existing rollup panels. CSS only extends the current compact breakdown pattern.

**Tech Stack:** Plain JavaScript modules, Node assertion tests, Electron renderer HTML/CSS.

---

### Task 1: Add Derived Rollup Explanation Data

**Files:**
- Modify: `calculator.js`
- Create: `test_rollup_explanation.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Write the failing test**

Create `test_rollup_explanation.mjs` with cases for fallback, weighted completion, average advance, external links, formula links, and non-mutation of stored project values.

- [ ] **Step 2: Run test to verify it fails**

Run: `node test_rollup_explanation.mjs`
Expected: fail because `getRollupExplanation` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add `getRollupExplanation(projectId, metric)` to `calculator.js`. It should return:

```js
{
  metric,
  projectId,
  ownValue,
  finalValue,
  ownWeight,
  incomingWeight,
  incomingRequestedWeight,
  incomingScale,
  mode,
  summary,
  contributors,
  incoming
}
```

Completion contributors use saved or fallback weights. Advance contributors use equal shares. Fallback rows use stored project fallback only when there are no internal contributors. Incoming project/formula links are shown separately and capped by the existing 90% rule.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test_rollup_explanation.mjs`
Expected: pass.

- [ ] **Step 5: Add the test to the full suite**

Add `test_rollup_explanation.mjs` to `scripts/run-tests.mjs`.

### Task 2: Render Explanation in Existing Panels

**Files:**
- Modify: `ui-components.js`
- Modify: `components.css`
- Create: `test_rollup_explanation_markup.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Write the failing markup test**

Create `test_rollup_explanation_markup.mjs` that checks expanded completion and advance panels include a summary row, contributor type labels, values, weights/shares, and fallback text.

- [ ] **Step 2: Run test to verify it fails**

Run: `node test_rollup_explanation_markup.mjs`
Expected: fail because the markup still renders only the old segment list.

- [ ] **Step 3: Render the explanation model**

Import `getRollupExplanation` in `ui-components.js`. Update `rollupStructureMarkup()` to render a small summary and rows from `contributors` and `incoming`, while preserving completion weight inputs.

- [ ] **Step 4: Style the extra fields**

Add narrow, responsive styles for summary text, row type labels, and influence text in `components.css`.

- [ ] **Step 5: Run test to verify it passes**

Run: `node test_rollup_explanation_markup.mjs`
Expected: pass.

### Task 3: Update Documentation and Verify

**Files:**
- Modify: `docs/PROJECT_LOGIC.md`
- Modify: `docs/FRONTEND.md`
- Modify: `docs/QUALITY_CHECK.md`
- Modify: `docs/generated/project-map.md`

- [ ] **Step 1: Document the rule**

Add that rollup explanations are derived from `calculator.js` and do not introduce saved progress state.

- [ ] **Step 2: Document UI location**

Add that expanded rollup panels explain completion/advance calculation.

- [ ] **Step 3: Run full verification**

Run: `npm.cmd test`
Expected: all tests pass. Existing Node ES module warnings may still appear.

- [ ] **Step 4: Review diff**

Run: `git diff --stat` and `git diff --check`
Expected: only intended files changed and no whitespace errors.
