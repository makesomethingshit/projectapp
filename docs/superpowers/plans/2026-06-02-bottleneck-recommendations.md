# Bottleneck Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add derived next-action recommendations to the existing bottleneck card.

**Architecture:** `calculator.js` exposes recommendation objects derived from `getBottleneckDetails()` and `getRollupExplanation()`. `ui-components.js` renders those objects in the existing bottleneck card. No new saved state is introduced.

**Tech Stack:** Plain JavaScript modules, Node assertion tests, existing CSS.

---

### Task 1: Recommendation Data

**Files:**
- Modify: `calculator.js`
- Create: `test_bottleneck_recommendations.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Write the failing test**

Test task, project, external project, formula, and advance-only bottleneck recommendations.

- [ ] **Step 2: Run the test**

Run: `node test_bottleneck_recommendations.mjs`
Expected: fail because `getBottleneckRecommendations` is not exported.

- [ ] **Step 3: Implement the derived function**

Add `getBottleneckRecommendations(projectId)` to `calculator.js`. It should return sorted bottleneck items with `recommendation`, `actionType`, and `rationale`.

- [ ] **Step 4: Re-run the test**

Run: `node test_bottleneck_recommendations.mjs`
Expected: pass.

### Task 2: Recommendation Markup

**Files:**
- Modify: `ui-components.js`
- Modify: `components.css`
- Create: `test_bottleneck_recommendation_markup.mjs`
- Modify: `scripts/run-tests.mjs`

- [ ] **Step 1: Write the failing markup test**

Test that `renderBottleneckAlertCard()` includes a recommendation line and keeps the existing action buttons.

- [ ] **Step 2: Implement markup and CSS**

Render recommendation text inside each `.bottleneck-alert-item`. Style it compactly under the current source/rationale copy.

- [ ] **Step 3: Run full checks**

Run: `npm.cmd test`
Expected: all tests pass with the existing module-type warnings.
