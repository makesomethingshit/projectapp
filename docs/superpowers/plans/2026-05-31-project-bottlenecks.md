# Project Bottlenecks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구조지도(Graph) 상에서 전체 프로젝트 완성도를 저해하는 외부 반영선 및 내부 하위 요소의 병목을 실시간 탐지하고 시각적으로 강조합니다.

**Architecture:** `calculator.js`에서 영향도(Drag Score)를 계산하는 함수들을 추가하고, `graph-components.js`에서 연결선 및 하위 노드 카드에 등급별 CSS 클래스를 부여하여 `graph-interactions.css`에 선언한 스타일로 구조지도 캔버스를 렌더링합니다.

**Tech Stack:** Vanilla HTML/CSS/JS (ES Modules), SVG Elements, Electron/Node.js

---

### Task 1: 연산 로직 추가 (calculator.js)

**Files:**
- Modify: `c:\Users\USER\Documents\Codex\2026-05-22\1-2-ui-3-4\calculator.js`
- Test: `c:\Users\USER\Documents\Codex\2026-05-22\1-2-ui-3-4\test_build_data.js`

- [ ] **Step 1: 외부 반영선 영향도 연산 함수 작성**

  [calculator.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/calculator.js) 하단에 `getExternalLinkDrag` 함수를 추가합니다.

  ```javascript
  export function getExternalLinkDrag(link) {
    const target = getProject(link.targetId);
    if (!target) return { drag: 0, level: null };
  
    // 후행 프로젝트 자체 진행도/완성도
    const targetOwn = link.metric === "advance" 
      ? getOwnAdvance(link.targetId) 
      : getOwnProgress(link.targetId);
  
    // 선행 반영 요소의 합산 롤업 점수
    const sourceRollup = link.sourceType === "formula"
      ? getFormulaValue(link.sourceId, link.metric)
      : link.metric === "advance"
        ? getRollupAdvance(link.sourceId)
        : getRollupProgress(link.sourceId);
  
    if (sourceRollup >= targetOwn) return { drag: 0, level: null };
  
    // 드래그 영향도 공식: D = W * (V_own - V_source_rollup) / 100
    const drag = Math.round((link.weight * (targetOwn - sourceRollup)) / 100 * 10) / 10;
  
    let level = null;
    if (drag >= 10) level = "critical";
    else if (drag >= 5) level = "warning";
  
    return { drag, level };
  }
  ```

- [ ] **Step 2: 내부 기여 요소 영향도 연산 함수 작성**

  [calculator.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/calculator.js) 하단에 `getInternalContributorDrag` 함수를 추가합니다.

  ```javascript
  export function getInternalContributorDrag(projectId, key) {
    const contributors = getCompletionContributors(projectId);
    if (!contributors.length) return { drag: 0, level: null };
  
    const fallback = Math.round(100 / contributors.length);
    const targetContrib = contributors.find(c => getCompletionItemKey(c.type, c.id) === key);
    if (!targetContrib) return { drag: 0, level: null };
  
    const weight = getCompletionWeight(projectId, key, fallback);
    const totalWeight = contributors.reduce((sum, c) => {
      const k = getCompletionItemKey(c.type, c.id);
      return sum + getCompletionWeight(projectId, k, fallback);
    }, 0) || 1;
  
    const parentRollup = getRollupProgress(projectId);
    const childVal = targetContrib.type === "project" 
      ? getRollupProgress(targetContrib.id) 
      : targetContrib.value();
  
    if (childVal >= parentRollup) return { drag: 0, level: null };
  
    // 드래그 영향도 공식: D_int = (W_i / Total_W) * (V_parent - V_child)
    const drag = Math.round((weight / totalWeight * (parentRollup - childVal)) * 10) / 10;
  
    let level = null;
    if (drag >= 10) level = "critical";
    else if (drag >= 5) level = "warning";
  
    return { drag, level };
  }
  ```

- [ ] **Step 3: 테스트 코드로 연산 검증**

  [test_build_data.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/test_build_data.js)에 임의의 연결 구조와 가중치를 입력해 병목 수준이 올바르게 리턴되는지 콘솔로 확인합니다.

  ```javascript
  import { getExternalLinkDrag, getInternalContributorDrag } from "./calculator.js";
  
  // 테스트용 모킹
  const testLink = { sourceId: 1, targetId: 2, sourceType: "project", metric: "completion", weight: 50 };
  const res = getExternalLinkDrag(testLink);
  console.log("Drag result:", res);
  ```

  Run: `node test_build_data.js`
  Expected: 예상이 계산과 부합하여 PASS 출력

- [ ] **Step 4: 변경 사항 저장 및 커밋**

---

### Task 2: 외부 반영선 시각화 연동 (graph-components.js & graph-interactions.css)

**Files:**
- Modify: `c:\Users\USER\Documents\Codex\2026-05-22\1-2-ui-3-4\graph-components.js`
- Modify: `c:\Users\USER\Documents\Codex\2026-05-22\1-2-ui-3-4\graph-interactions.css`

- [ ] **Step 1: SVG Path 및 배지에 병목 클래스 주입**

  [graph-components.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-components.js)의 `renderGraphView()` 함수 내에서 SVG 엣지를 렌더링하는 부분과 배지를 출력하는 부분에 `bottleneck-critical`, `bottleneck-warning` 클래스를 주입합니다.

  ```javascript
  // L568 주변
  const lines = edges.map((edge) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return "";
    const active = from.scoped || to.type === "task" || edge.type === "external";
    
    // 외부 연결선 병목 상태 체크
    let bottleneckClass = "";
    if (edge.type === "external" && edge.linkKind !== "formulaIn") {
      const linkObj = state.projectLinks.find(l => l.sourceId === edge.sourceId && l.targetId === edge.targetId && l.metric === edge.metric);
      if (linkObj) {
        const { level } = getExternalLinkDrag(linkObj);
        if (level) bottleneckClass = `bottleneck-${level}`;
      }
    }
  
    return `<path d="${graphEdgePath(from, to, edge)}" class="${edge.type} ${active ? "active" : ""} ${bottleneckClass}" ${graphEdgeDataAttrs(edge)} />`;
  }).join("");
  ```

  ```javascript
  // L586 주변 (weightBadges)
  const weightBadges = edges.filter((edge) => edge.type === "external").map((edge) => {
    ...
    const weight = linkObj ? linkObj.weight : 30;
    
    let badgeClass = "";
    let warningSymbol = "";
    if (linkObj) {
      const { level } = getExternalLinkDrag(linkObj);
      if (level) {
        badgeClass = `bottleneck-${level}`;
        warningSymbol = "⚠️ ";
      }
    }
  
    return `
      <span class="graph-edge-weight-badge ${badgeClass}" data-graph-edge-weight="${edge.id}" style="--x:${midpoint.x}%; --y:${midpoint.y}%">
        <button type="button" data-graph-weight-badge="${edge.id}" aria-label="반영 비율 ${weight}%">${warningSymbol}${weight}%</button>
        <button type="button" class="graph-edge-break" data-graph-remove-edge="${edge.id}" aria-label="반영 연결 끊기"></button>
      </span>
    `;
  }).join("");
  ```

- [ ] **Step 2: 외부 반영선 병목 CSS 스타일 선언**

  [graph-interactions.css](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-interactions.css) 하단에 외부 병목용 대시라인과 애니메이션을 선언합니다.

  ```css
  /* 외부 반영선 병목 스타일 */
  .graph-lines path.external.bottleneck-critical {
    stroke: var(--coral) !important;
    stroke-width: 2.2px !important;
    stroke-dasharray: 6 4 !important;
    animation: bottleneck-flow 1.5s linear infinite !important;
  }
  
  .graph-lines path.external.bottleneck-warning {
    stroke: var(--warning, #f59e0b) !important;
    stroke-width: 1.8px !important;
    stroke-dasharray: 4 4 !important;
  }
  
  /* 배지 스타일 */
  .graph-edge-weight-badge.bottleneck-critical {
    border-color: var(--coral) !important;
    background: color-mix(in srgb, var(--coral) 12%, var(--surface)) !important;
    box-shadow: 0 0 10px rgba(244, 63, 94, 0.2) !important;
  }
  
  .graph-edge-weight-badge.bottleneck-warning {
    border-color: var(--warning, #f59e0b) !important;
    background: color-mix(in srgb, var(--warning, #f59e0b) 12%, var(--surface)) !important;
  }
  
  @keyframes bottleneck-flow {
    to {
      stroke-dashoffset: -20;
    }
  }
  ```

- [ ] **Step 3: CSS 구문 검사**

  [verify_css.py](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/verify_css.py) (존재 시) 혹은 수동 브래킷 정합성 검사를 시행합니다.

---

### Task 3: 내부 요소 병목 시각화 연동 (graph-components.js & graph-interactions.css)

**Files:**
- Modify: `c:\Users\USER\Documents\Codex\2026-05-22\1-2-ui-3-4\graph-components.js`
- Modify: `c:\Users\USER\Documents\Codex\2026-05-22\1-2-ui-3-4\graph-interactions.css`

- [ ] **Step 1: 하위 프로젝트 카드 병목 정보 렌더링**

  [graph-components.js](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-components.js)의 `graphProjectCardMarkup()` 함수를 수정하여 내부 병목 탐지 결과를 적용합니다.

  ```javascript
  // graphProjectCardMarkup 내부 L330 주변
  const child = item.project;
  
  // 부모 노드 기준의 내부 병목 정보 파악
  let internalBottleneckClass = "";
  let warningSymbol = "";
  let dragLabel = "";
  if (child.parentId) {
    const parentKey = getCompletionItemKey("project", child.id);
    const { drag, level } = getInternalContributorDrag(child.parentId, parentKey);
    if (level) {
      internalBottleneckClass = `bottleneck-${level}`;
      warningSymbol = "⚠️ ";
      dragLabel = `<small class="drag-label ${level}">하락 기여: -${drag}%p</small>`;
    }
  }
  
  // 리턴 템플릿의 wrap 태그 클래스에 internalBottleneckClass 추가 및 드래그 라벨 포함
  return `
    <div class="graph-child-project-section ${internalBottleneckClass}" style="--depth:${depth}">
      <div class="graph-child-project-wrap">
        ...
        <button type="button" class="graph-child-project-card" data-select-project="${child.id}">
          <strong style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${warningSymbol}${escapeHtml(child.name)}</span>
            ${parentWeightHtml}
          </strong>
          <span>${getRollupProgress(child.id)}% 완성 · ${getRollupAdvance(child.id)}% 진행${childCount ? ` · 하위 ${childCount}` : ""}</span>
          ${dragLabel}
        </button>
        ...
      </div>
  `;
  ```

- [ ] **Step 2: 할 일 카드 병목 정보 렌더링**

  동일 파일 내의 할 일 카드 생성 루프 영역(`tasksHtml` 부분 및 `groupedTaskList` 부분)에도 동일하게 `getInternalContributorDrag` 결과에 따른 스타일 및 라벨을 추가합니다.

  ```javascript
  const tasksHtml = (state.appSettings.graphShowTasks !== false && childTasks.length) ? childTasks.map((task) => {
    const taskKey = getCompletionItemKey("task", task.id);
    const taskWeight = getCompletionWeight(child.id, taskKey, childFallback);
    
    // 할 일 내부 병목 판정
    const { drag, level } = getInternalContributorDrag(child.id, taskKey);
    let taskClass = "";
    let warningSymbol = "";
    let dragLabel = "";
    if (level) {
      taskClass = `bottleneck-${level}`;
      warningSymbol = "⚠️ ";
      dragLabel = `<small class="drag-label ${level}" style="display:block; margin-top:2px;">하락 기여: -${drag}%p</small>`;
    }
  
    return `
      <button type="button" class="graph-task-card ${taskClass}" data-graph-drag-task="${task.id}" data-open-note="${task.id}" style="--depth:${depth}" aria-label="${escapeHtml(task.name)} 이동 또는 열기">
        <strong style="display: flex; justify-content: space-between; align-items: center; gap: 4px; width: 100%;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${warningSymbol}${escapeHtml(task.name)}</span>
          <span class="graph-item-weight-badge task-badge" data-graph-internal-weight="${child.id}:${taskKey}:${childFallback}" role="button" tabindex="0" aria-label="${escapeHtml(task.name)} 내부 반영비 ${taskWeight}%">반영비 ${taskWeight}%</span>
        </strong>
        <span>${clampProgress(task.progress)}% 완성 · ${clampProgress(task.advance)}% 진행</span>
        ${dragLabel}
      </button>
    `;
  }).join("") : "";
  ```

- [ ] **Step 3: 내부 병목 카드 CSS 정의**

  [graph-interactions.css](file:///c:/Users/USER/Documents/Codex/2026-05-22/1-2-ui-3-4/graph-interactions.css) 하단에 자식 카드들의 경고 스타일을 추가합니다.

  ```css
  /* 내부 자식 요소 병목 스타일 */
  .graph-node.project-group .graph-child-project-section.bottleneck-critical .graph-child-project-wrap {
    border: 1px.5px solid var(--coral) !important;
    background: color-mix(in srgb, var(--coral) 4%, var(--surface)) !important;
    box-shadow: inset 0 0 4px rgba(244, 63, 94, 0.1) !important;
  }
  
  .graph-node.project-group .graph-child-project-section.bottleneck-warning .graph-child-project-wrap {
    border: 1px.5px solid var(--warning, #f59e0b) !important;
    background: color-mix(in srgb, var(--warning, #f59e0b) 4%, var(--surface)) !important;
  }
  
  /* 태스크 카드 내부 병목 스타일 */
  .graph-node.project-group .graph-task-card.bottleneck-critical {
    border: 1px.5px solid var(--coral) !important;
    background: color-mix(in srgb, var(--coral) 4%, var(--surface)) !important;
  }
  
  .graph-node.project-group .graph-task-card.bottleneck-warning {
    border: 1px.5px solid var(--warning, #f59e0b) !important;
    background: color-mix(in srgb, var(--warning, #f59e0b) 4%, var(--surface)) !important;
  }
  
  /* 드래그 기여 라벨 */
  .drag-label {
    display: block;
    font-size: 8.5px;
    font-weight: 800;
    margin-top: 3px;
  }
  .drag-label.critical {
    color: var(--coral) !important;
  }
  .drag-label.warning {
    color: var(--warning, #f59e0b) !important;
  }
  ```

- [ ] **Step 4: 저장 및 CSS/JS 빌드 점검**

---

### Task 4: 최종 동작 검증 (Verification)

**Files:**
- Run commands in terminal

- [ ] **Step 1: JS 구문 정합성 확인**

  Run: `node --check calculator.js`
  Expected: 구문 오류 없음

  Run: `node --check graph-components.js`
  Expected: 구문 오류 없음

- [ ] **Step 2: 수동 확인**

  Run: `npm start` (또는 로컬 Electron 실행)
  Expected: 
  1. 임의로 선행 프로젝트의 진척률을 깎고 고배율 반영선을 연결하여 캔버스에 빨간 흐르는 점선이 출력되는지 확인.
  2. 부모 노드 내에서 특정 하위 프로젝트의 진행률을 크게 낮추어 카드 테두리가 붉게 변하고 `-8%p` 등의 기여 감소량이 출력되는지 확인.
