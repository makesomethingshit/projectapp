import {
  state,
  loadState,
  saveState,
  createId,
  normalizeProjects,
  normalizeTasks,
  normalizeProjectLinks,
  normalizeGraphFormulaLinks,
  normalizeGraphFormulaInputLinks,
  logActivity
} from "./state.js";

import {
  clampProgress,
  clampGraphZoom,
  clampGraphCanvasScale,
  getProject,
  getChildProjects,
  getDescendantProjectIds,
  getProjectPath,
  getTopProjectId,
  getAncestorIds,
  revealProjectPath,
  getScopedProjectIds,
  taskContributesTo,
  getProjectTasks,
  getCompletionItemKey,
  getCompletionWeight,
  setCompletionWeight,
  getRollupProgress,
  getRollupAdvance,
  getIncomingLinks,
  getOutgoingLinks,
  clampGraphNodeScale,
  getCompletionContributors
} from "./calculator.js";

import {
  escapeHtml,
  daysUntil,
  dateFromOffset,
  formatDueLabel,
  progressSegmentsMarkup,
  advanceSegmentsMarkup,
  rollupPanelMarkup,
  benchmarkInsightMarkup,
  reviewPanelMarkup,
  workFlowSummaryMarkup,
  renderImpactTrail,
  renderExternalInfluence,
  renderLinkedArchivePanel,
  taskCardMarkup,
  taskSectionMarkup,
  metricBadgesMarkup,
  projectListGraphsMarkup,
  renderViewSwitch,
  renderDetailHeader,
  renderChildProjects,
  renderBottleneckAlertCard,
  renderArchiveView
} from "./ui-components.js";

import {
  buildGraphData,
  graphEdgePath,
  graphEdgeControlPosition,
  graphProjectCardMarkup,
  renderGraphView
} from "./graph-components.js";

import {
  openTaskModal,
  closeTaskModal,
  openNoteModal,
  closeNoteModal,
  openDeleteProjectModal,
  closeDeleteProjectModal,
  openDeleteTaskModal,
  closeDeleteTaskModal,
  openProjectDeadlineModal,
  closeProjectDeadlineModal,
  openWeightSliderPopup,
  hideWeightSliderPopup,
  openPreferencesModal,
  closePreferencesModal,
  openProjectModal,
  closeProjectModal,
  renderParentOptions,
  renderEditParentOptions,
  externalTargetOptionsMarkup,
  renderExternalLinkRows,
  addExternalLinkRow
} from "./app-modals.js";

import {
  applyGraphConnection,
  applyGraphFormulaConnection,
  applyGraphFormulaInputConnection,
  removeGraphEdge
} from "./app-graph-actions.js";

import {
  addArchiveResourceLink,
  createArchiveResourceId,
  normalizeArchiveTags,
  removeArchiveResourceLink,
  updateArchiveResource as updateArchiveResourceModel
} from "./archive-model.js";

import {
  initEvents
} from "./app-graph-events.js";

// ── DOM REFS & MODULE VARS ─────────────────────────────────────────────

const $ = (selector) => document.querySelector(selector);
const workspace = $("#workspace");
const panelCollapseHandle = $("#panelCollapseHandle");
const projectList = $("#projectList");
const projectDetail = $("#projectDetail");
const searchPanel = $("#searchPanel");
const searchInput = $("#searchInput");
const fileMenu = $("#fileMenu");
const archiveFullView = $("#archiveFullView");
const archiveFullContent = $("#archiveFullContent");
const pinToggle = $("#pinToggle");
const preferencesPinInput = $("#preferencesPinInput");
const weightSliderPopup = $("#weightSliderPopup");
const weightSliderInput = $("#weightSliderInput");
const weightSliderValue = $("#weightSliderValue");
const deleteProjectModal = $("#deleteProjectModal");
const deleteTaskModal = $("#deleteTaskModal");
const projectDeadlineModal = $("#projectDeadlineModal");
const preferencesModal = $("#preferencesModal");
const projectModal = $("#projectModal");
const taskModal = $("#taskModal");
const noteModal = $("#noteModal");

let lastGlobalGraphState = null;

// ── UI STATE & RENDER FUNCTIONS ────────────────────────────────────────

export function applyPanelState() {
  const collapsed = state.appSettings.leftPanelCollapsed === true;
  const isGlobalGraph = state.appSettings.globalGraphView === true;
  const isArchive = !isGlobalGraph && state.viewMode === "archive";

  const workspaceEl = document.getElementById("workspace");
  const archiveFullViewEl = document.getElementById("archiveFullView");
  const panelCollapseHandleEl = document.getElementById("panelCollapseHandle");

  if (workspaceEl) workspaceEl.hidden = isArchive;
  if (archiveFullViewEl) archiveFullViewEl.hidden = !isArchive;

  if (!isArchive && workspaceEl) {
    workspaceEl.classList.toggle("project-panel-collapsed", collapsed);
    workspaceEl.classList.toggle("global-graph-mode", isGlobalGraph);
  }
  if (panelCollapseHandleEl) {
    panelCollapseHandleEl.setAttribute("aria-pressed", String(collapsed));
    panelCollapseHandleEl.setAttribute("aria-label", collapsed ? "왼쪽 패널 펼치기" : "왼쪽 패널 접기");
  }

  // 뷰 탭 버튼 active 동기화
  const viewTabNav = document.getElementById("viewTabNav");
  if (viewTabNav) {
    viewTabNav.querySelectorAll("[data-main-view]").forEach((btn) => {
      const v = btn.dataset.mainView;
      const isActive = v === "graph"
        ? isGlobalGraph
        : !isGlobalGraph && state.viewMode === v;
      btn.classList.toggle("active", isActive);
    });
  }

  if (lastGlobalGraphState !== isGlobalGraph) {
    lastGlobalGraphState = isGlobalGraph;
    if (window.workshopApp?.setWindowSize) {
      if (isGlobalGraph) {
        window.workshopApp.setWindowSize(1720, 980);
      } else {
        window.workshopApp.setWindowSize(1120, 820);
      }
    }
  }
}

export function applyTheme() {
  document.documentElement.dataset.theme = state.appSettings.theme === "dark" ? "dark" : "light";
  const darkModeInput = $("#darkModeInput");
  if (darkModeInput) darkModeInput.checked = state.appSettings.theme === "dark";
}

export async function setPinnedState(next, persist = true) {
  let result = Boolean(next);
  if (window.workshopApp) {
    try {
      result = await window.workshopApp.setAlwaysOnTop(next);
    } catch (error) {
      console.warn("창 고정 상태를 바꾸지 못했습니다.", error);
    }
  }
  state.appSettings.alwaysOnTop = result;
  pinToggle.setAttribute("aria-pressed", String(result));
  pinToggle.classList.toggle("active", result);
  pinToggle.textContent = result ? "상단 고정" : "일반 창";
  if (preferencesPinInput) preferencesPinInput.checked = result;
  if (persist) saveState();
}

export function projectMatchesFilter(project) {
  const query = state.searchQuery.trim().toLowerCase();
  const matchesSearch = !query
    || project.name.toLowerCase().includes(query)
    || project.note.toLowerCase().includes(query)
    || getProjectTasks(project.id, true).some((task) => {
      return task.name.toLowerCase().includes(query) || task.note.toLowerCase().includes(query);
    });
  if (!matchesSearch) return false;
  if (state.projectFilter === "all") return true;
  if (state.projectFilter === "with-deadline") return Boolean(project.deadline);
  if (state.projectFilter === "no-deadline") return !project.deadline;
  return project.status === state.projectFilter;
}

export function shouldRevealChildren(project, hasFilteredDescendant) {
  return state.expandedProjectIds.has(project.id)
    || project.id === state.selectedProjectId
    || getAncestorIds(state.selectedProjectId).includes(project.id)
    || (state.projectFilter !== "all" && hasFilteredDescendant);
}

export function getVisibleProjectRows() {
  const rows = [];
  const visited = new Set();

  function walk(parentId, depth) {
    state.projects
      .filter((project) => project.parentId === parentId)
      .forEach((project) => {
        if (visited.has(project.id)) return;
        visited.add(project.id);
        const descendants = getDescendantProjectIds(project.id).map(getProject).filter(Boolean);
        const shouldShow = projectMatchesFilter(project) || descendants.some(projectMatchesFilter);
        if (shouldShow) rows.push({ project, depth, contextual: !projectMatchesFilter(project) });
        if (shouldRevealChildren(project, descendants.some(projectMatchesFilter))) walk(project.id, depth + 1);
      });
  }

  walk(null, 0);
  state.projects.filter((project) => !visited.has(project.id)).forEach((project) => rows.push({ project, depth: 0, contextual: false }));
  return rows;
}

export function renderProjectList() {
  revealProjectPath(state.selectedProjectId);
  const rows = getVisibleProjectRows();
  projectList.innerHTML = rows.map(({ project, depth, contextual }) => {
    const projectTasks = getProjectTasks(project.id, true);
    const lowCount = projectTasks.filter((task) => taskContributesTo(task, "completion") && clampProgress(task.progress) < 30).length;
    const childCount = getChildProjects(project.id).length;
    const isExpanded = project.id === state.selectedProjectId;
    const projectDeadline = project.deadline
      ? `<span class="project-deadline ${daysUntil(project.deadline) <= 7 ? "urgent" : ""}">${escapeHtml(formatDueLabel(project.deadline))}</span>`
      : '<span class="project-deadline none">마감 없음</span>';

    return `
      <button class="project-item depth-${Math.min(depth, 4)} ${project.id === state.selectedProjectId ? "active expanded" : ""} ${contextual ? "contextual" : ""}" style="--depth:${depth}" data-select-project="${project.id}" data-project-row="${project.id}">
        <span class="tree-rail" aria-hidden="true"></span>
        <span class="project-item-top">
          <span class="tree-title">
            <i class="tree-mark">${childCount ? (state.expandedProjectIds.has(project.id) || project.id === state.selectedProjectId ? "−" : "+") : depth ? "└" : "●"}</i>
            <strong>${escapeHtml(project.name)}</strong>
          </span>
          ${metricBadgesMarkup(project)}
        </span>
        ${isExpanded ? `
          <span class="project-item-meta">
            <span class="meta-chip status-chip">${escapeHtml(project.status)}</span>
            <span class="meta-chip">${projectDeadline}</span>
            <span class="meta-chip">${projectTasks.length}개 할 일</span>
            ${childCount ? `<span class="meta-chip">${childCount}개 하위</span>` : ""}
            <span class="meta-chip quiet-chip">${childCount ? "하위 합산" : "할 일 합산"}</span>
            ${lowCount ? `<span class="meta-chip mini-alert">${lowCount}개 낮음</span>` : ""}
          </span>
          ${projectListGraphsMarkup(project)}
        ` : ""}
      </button>
    `;
  }).join("");
}

export function updateGraphMinimapViewport() {
  document.querySelectorAll(".graph-view").forEach((view) => {
    syncGraphPortEdges(view);
    const stage = view.querySelector(".graph-stage");
    const canvas = view.querySelector(".graph-canvas");
    const viewport = view.querySelector(".graph-minimap-view");
    if (!stage || !canvas || !viewport) return;
    const width = Math.max(8, Math.min(100, (stage.clientWidth / canvas.offsetWidth) * 100));
    const height = Math.max(8, Math.min(100, (stage.clientHeight / canvas.offsetHeight) * 100));
    const x = Math.max(0, Math.min(100 - width, (stage.scrollLeft / canvas.offsetWidth) * 100));
    const y = Math.max(0, Math.min(100 - height, (stage.scrollTop / canvas.offsetHeight) * 100));
    viewport.setAttribute("x", x);
    viewport.setAttribute("y", y);
    viewport.setAttribute("width", width);
    viewport.setAttribute("height", height);
  });
}

export function scheduleGraphViewportUpdate() {
  requestAnimationFrame(() => {
    syncGraphPortEdges();
    updateGraphMinimapViewport();
  });
}

function syncRenderedGraphNow() {
  syncGraphPortEdges(projectDetail);
  updateGraphMinimapViewport();
}

let lastDetailedProjectId = null;

export function renderProjectDetail() {
  const project = getProject(state.selectedProjectId);
  if (!project) {
    projectDetail.innerHTML = '<p class="notice">프로젝트가 없습니다. 새 프로젝트를 추가해 주세요.</p>';
    return;
  }

  const stage = document.querySelector(".graph-stage");
  const projectIdChanged = lastDetailedProjectId !== state.selectedProjectId;
  const scrollLeft = (stage && !projectIdChanged) ? stage.scrollLeft : null;
  const scrollTop = (stage && !projectIdChanged) ? stage.scrollTop : null;
  lastDetailedProjectId = state.selectedProjectId;

  if (state.appSettings.globalGraphView === true) {
    const isLocalScope = state.appSettings.graphScope === "local";
    projectDetail.innerHTML = renderGraphView(project, { full: !isLocalScope, includeTasks: true });
    syncRenderedGraphNow();
    if (scrollLeft !== null || scrollTop !== null) {
      requestAnimationFrame(() => {
        const nextStage = document.querySelector(".graph-stage");
        if (nextStage) {
          if (scrollLeft !== null) nextStage.scrollLeft = scrollLeft;
          if (scrollTop !== null) nextStage.scrollTop = scrollTop;
          updateGraphMinimapViewport();
        }
      });
    } else {
      scheduleGraphViewportUpdate();
    }
    return;
  }

  if (state.viewMode === "archive") {
    // 아카이브는 별도 전체 뷰에 렌더링
    const archiveFullContentEl = document.getElementById("archiveFullContent");
    if (archiveFullContentEl) {
      archiveFullContentEl.innerHTML = renderArchiveView(project);
      scanArchivePaths(document.getElementById("archiveFullView"));
    }
    return;
  }

  if (state.viewMode === "graph") {
    projectDetail.innerHTML = `${renderDetailHeader(project)}${renderGraphView(project)}`;
    syncRenderedGraphNow();
    if (scrollLeft !== null || scrollTop !== null) {
      requestAnimationFrame(() => {
        const nextStage = document.querySelector(".graph-stage");
        if (nextStage) {
          if (scrollLeft !== null) nextStage.scrollLeft = scrollLeft;
          if (scrollTop !== null) nextStage.scrollTop = scrollTop;
          updateGraphMinimapViewport();
        }
      });
    } else {
      scheduleGraphViewportUpdate();
    }
    return;
  }

  const query = state.searchQuery.trim().toLowerCase();
  const allTasks = getProjectTasks(project.id, true).filter((task) => {
    if (!query) return true;
    return task.name.toLowerCase().includes(query) || task.note.toLowerCase().includes(query);
  });
  const completionTasks = allTasks.filter((task) => taskContributesTo(task, "completion"));
  const advanceOnlyTasks = allTasks.filter((task) => task.contributionMode === "advance");
  const lowTasks = completionTasks.filter((task) => clampProgress(task.progress) < 30);
  const midTasks = completionTasks.filter((task) => clampProgress(task.progress) >= 30 && clampProgress(task.progress) < 60);
  const highTasks = completionTasks.filter((task) => clampProgress(task.progress) >= 60);
  const nextTask = lowTasks[0] || midTasks[0] || highTasks[0];
  const childCount = getDescendantProjectIds(project.id).length;
  const showProjectName = childCount > 0;
  const rollupProgress = getRollupProgress(project.id);
  const rollupAdvance = getRollupAdvance(project.id);

  let visibleTasks = allTasks;
  if (state.detailFilter === "low") visibleTasks = lowTasks;
  if (state.detailFilter === "mid") visibleTasks = midTasks;
  if (state.detailFilter === "high") visibleTasks = highTasks;

  const taskListMarkup = state.detailFilter === "all"
    ? [
      taskSectionMarkup("완성도 낮음", lowTasks, "30% 미만", showProjectName),
      taskSectionMarkup("완성도 중간", midTasks, "30% 이상 60% 미만", showProjectName),
      taskSectionMarkup("완성도 높음", highTasks, "60% 이상", showProjectName),
      taskSectionMarkup("진행도만", advanceOnlyTasks, "완성도에는 반영하지 않음", showProjectName)
    ].join("") || '<p class="notice">아직 할 일이 없습니다.</p>'
    : visibleTasks.length
      ? `<div class="task-board single">${visibleTasks.map((task) => taskCardMarkup(task, showProjectName)).join("")}</div>`
      : '<p class="notice">조건에 맞는 할 일이 없습니다.</p>';

  // 병목 진단 카드 호출
  const bottleneckAlertMarkup = renderBottleneckAlertCard(project);

  projectDetail.innerHTML = `
    ${renderDetailHeader(project)}

    ${bottleneckAlertMarkup}

    <div class="detail-summary" aria-label="프로젝트 요약">
      <div class="summary-item urgent"><strong>${lowTasks.length}</strong><span>낮음</span></div>
      <div class="summary-item"><strong>${midTasks.length}</strong><span>중간</span></div>
      <div class="summary-item"><strong>${highTasks.length}</strong><span>높음</span></div>
      <div class="summary-item"><strong>${rollupProgress}%</strong><span>완성도</span></div>
      <div class="summary-item"><strong>${rollupAdvance}%</strong><span>진행도</span></div>
    </div>

    ${rollupPanelMarkup(project, "completion")}

    ${rollupPanelMarkup(project, "advance")}

    ${workFlowSummaryMarkup(project, allTasks, nextTask, lowTasks)}

    ${renderImpactTrail(project)}

    ${renderExternalInfluence(project)}

    ${renderLinkedArchivePanel(project, allTasks)}

    ${renderChildProjects(project)}

    <section class="next-action">
      <div>
        <span>완성도 조율</span>
        <strong>${nextTask ? escapeHtml(nextTask.name) : "새 할 일을 추가하세요"}</strong>
        <p>${nextTask ? `현재 ${clampProgress(nextTask.progress)}% · 낮음/중간/높음 기준으로 조율` : "아직 할 일이 없습니다."}</p>
      </div>
    </section>

    <div class="detail-toolbar">
      <div class="tabs compact-tabs" data-tabs="detail">
        <button class="${state.detailFilter === "all" ? "active" : ""}" data-filter="all">전체</button>
        <button class="${state.detailFilter === "low" ? "active" : ""}" data-filter="low">낮음</button>
        <button class="${state.detailFilter === "mid" ? "active" : ""}" data-filter="mid">중간</button>
        <button class="${state.detailFilter === "high" ? "active" : ""}" data-filter="high">높음</button>
      </div>
      <button class="green-command" id="focusTaskInput">+ 새 할 일</button>
    </div>

    <div class="task-board">${taskListMarkup}</div>
  `;
  scanArchivePaths(document.getElementById("projectDetailPanel") || document.getElementById("projectDetail"));
}

export function renderSearch() {
  if (!searchPanel || !searchInput) return;
  searchPanel.hidden = !state.isSearchOpen;
  searchInput.value = state.searchQuery;
}

export function closeFileMenu() {
  if (fileMenu) fileMenu.hidden = true;
}

export function toggleFileMenu() {
  if (!fileMenu) return;
  fileMenu.hidden = !fileMenu.hidden;
}

export function toggleThemeMode() {
  state.appSettings.theme = state.appSettings.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
}

// ── GRAPH SUPPORTING HELPERS ──

export function graphPointFromEvent(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const zoom = clampGraphZoom(state.appSettings.graphZoom);
  const clientX = event.clientX;
  const clientY = event.clientY;
  return {
    x: Math.max(0, Math.min(1000, ((clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(1000, ((clientY - rect.top) / rect.height) * 100))
  };
}

export function graphPointFromElement(canvas, element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  return {
    x: ((rect.left + rect.width / 2 - canvasRect.left) / canvasRect.width) * 100,
    y: ((rect.top + rect.height / 2 - canvasRect.top) / canvasRect.height) * 100
  };
}

export function graphBezierMidpoint(from, to) {
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  };
}

function graphOrthogonalPath(fromX, fromY, toX, toY, edge) {
  if (edge?.type !== "task" && toX < fromX) {
    const routeX = Math.min(100, Math.max(fromX, toX) + 6);
    return `M ${fromX} ${fromY} H ${routeX} V ${toY} H ${toX}`;
  }
  const midX = fromX + (toX - fromX) * (edge?.type === "task" ? 0.68 : 0.52);
  return `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
}

function graphNodeSelector(graphNodeId) {
  const [type, rawId] = String(graphNodeId || "").split("-");
  if (!type || !rawId) return "";
  if (type === "project") return `[data-graph-project-node="${rawId}"]`;
  if (type === "task") return `[data-graph-task-node="${rawId}"], [data-open-note="${rawId}"], [data-graph-drag-task="${rawId}"]`;
  if (type === "memo" || type === "formula" || type === "archive") return `[data-graph-free-node="${type}:${rawId}"]`;
  return "";
}

const GRAPH_PORT_FALLBACK_X_OFFSET = 4.8;
const GRAPH_PORT_FALLBACK_Y_OFFSETS = {
  completion: -0.58,
  advance: 0.58,
  archive: 1.74
};
const GRAPH_GROUP_HEADER_PORT_FALLBACK_Y = {
  completion: -3.4,
  advance: -2.55,
  archive: -1.7
};

export function findGraphPort(canvas, targetId, direction, metric, type = "project", sourceId = null, sourceType = null, ownerGraphNodeId = null) {
  let selector = `[data-graph-port-role="${direction === "out" ? "source" : "target"}"][data-graph-port-id="${targetId}"][data-graph-port-metric="${metric}"][data-graph-port-type="${type}"]`;
  if (direction === "in" && type === "formula" && sourceId !== null && sourceType !== null) {
    selector = `[data-graph-port-role="target"][data-graph-port-id="${targetId}"][data-graph-port-metric="${metric}"][data-graph-port-type="formula"][data-graph-connect-source-id="${sourceId}"][data-graph-connect-source-type="${sourceType}"]`;
  }
  const ownerSelector = graphNodeSelector(ownerGraphNodeId);
  const ownerEl = ownerSelector ? canvas.querySelector(ownerSelector) : null;
  const el = ownerEl?.querySelector(selector) || canvas.querySelector(selector);
  if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const pt = graphPointFromElement(canvas, el);
      if (pt) pt.isReal = true;
      return pt;
    }
  }
  const nodeSelector = type === "memo" || type === "formula" || type === "archive"
    ? `[data-graph-free-node="${type}:${targetId}"]`
    : type === "task"
      ? `[data-graph-task-node="${targetId}"], [data-open-note="${targetId}"], [data-graph-drag-task="${targetId}"]`
      : `[data-graph-${type}-node="${targetId}"]`;
  const nodeEl = ownerEl?.matches?.(nodeSelector) ? ownerEl : ownerEl?.querySelector?.(nodeSelector) || canvas.querySelector(nodeSelector);
  if (nodeEl) {
    const x = Number.parseFloat(nodeEl.style.getPropertyValue("--x")) || 50;
    const y = Number.parseFloat(nodeEl.style.getPropertyValue("--y")) || 50;
    const xOffset = direction === "out" ? GRAPH_PORT_FALLBACK_X_OFFSET : -GRAPH_PORT_FALLBACK_X_OFFSET;
    const isOwnProjectPort = type === "project"
      && ownerGraphNodeId === `project-${targetId}`;
    const yOffset = isOwnProjectPort
      ? (GRAPH_GROUP_HEADER_PORT_FALLBACK_Y[metric] ?? GRAPH_GROUP_HEADER_PORT_FALLBACK_Y.completion)
      : (GRAPH_PORT_FALLBACK_Y_OFFSETS[metric] ?? 0);
    return {
      x: Math.max(0, Math.min(100, x + xOffset)),
      y: Math.max(0, Math.min(100, y + yOffset))
    };
  }
  return null;
}

export function setGraphPortConnectionState(portEl, active) {
  if (portEl) {
    portEl.classList.toggle("is-connected", active);
    portEl.classList.toggle("is-idle", !active);
  }
}

export function syncGraphPortEdges(view = document) {
  const canvas = view?.matches?.(".graph-canvas") ? view : view?.querySelector?.(".graph-canvas");
  if (!canvas) return;
  
  const isFull = state.appSettings.globalGraphView === true && state.viewMode !== "archive" && state.appSettings.graphScope !== "local";
  const edges = buildGraphData(getProject(state.selectedProjectId), { full: isFull }).edges;
  
  edges.forEach((edge) => {
    const edgePath = canvas.querySelector(`path[data-graph-edge-id="${edge.id}"]`);
    if (!edgePath) return;
    const isFormulaIn = edge.linkKind === "formulaIn";
    const fromPort = isFormulaIn
      ? findGraphPort(canvas, edge.sourceId, "out", edge.metric, edge.sourceType, null, null, edge.from)
      : findGraphPort(canvas, edge.sourceId, "out", edge.metric || "completion", edge.sourceType || "project", null, null, edge.from);
    const archiveTargetPortType = edge.linkKind === "archiveLink" && edge.targetType === "project" ? "archiveProject" : edge.targetType;
    const archiveTargetMetric = edge.linkKind === "archiveLink" ? "archive" : "completion";
    const toPort = isFormulaIn
      ? findGraphPort(canvas, edge.targetId, "in", edge.metric, "formula", edge.sourceId, edge.sourceType, edge.to)
      : edge.linkKind === "archiveLink"
        ? findGraphPort(canvas, edge.targetId, "in", archiveTargetMetric, archiveTargetPortType, null, null, edge.to)
        : findGraphPort(canvas, edge.targetId, "in", edge.metric || "completion", "project", null, null, edge.to);
    if (!fromPort || !toPort) return;
    
    // 포트 위치 offset 보정
    const fromX = fromPort.x;
    const fromY = fromPort.isReal ? fromPort.y : (edge.sourcePortY ?? fromPort.y);
    const toX = toPort.x;
    const toY = toPort.isReal ? toPort.y : (edge.targetPortY ?? toPort.y);
    
    edgePath.setAttribute("d", graphOrthogonalPath(fromX, fromY, toX, toY, edge));
    
    // 연결선 끊기 버튼과 가중치 배지 위치 동적 갱신
    const edgeControl = canvas.querySelector(`[data-graph-edge-control="${edge.id}"]`);
    if (edgeControl) {
      const pos = graphEdgeControlPosition({ x: fromX, y: fromY }, { x: toX, y: toY }, edge);
      edgeControl.style.setProperty("--x", `${pos.x}%`);
      edgeControl.style.setProperty("--y", `${pos.y}%`);
    }
    const weightBadge = canvas.querySelector(`[data-graph-edge-weight="${edge.id}"]`);
    if (weightBadge) {
      const mid = edge.type === "external"
        ? { x: fromX + (toX - fromX) * 0.52, y: (fromY + toY) / 2 }
        : graphBezierMidpoint({ x: fromX, y: fromY }, { x: toX, y: toY });
      weightBadge.style.setProperty("--x", `${mid.x}%`);
      weightBadge.style.setProperty("--y", `${mid.y}%`);
    }
  });
}

export function updateGraphConnectionPreview(event) {
  const drag = state.graphConnectionDrag;
  if (!drag) return;
  const zoom = clampGraphZoom(state.appSettings.graphZoom);
  const current = graphPointFromEvent(drag.canvas, event);
  let preview = drag.canvas.querySelector(".graph-connection-preview");
  if (!preview) {
    preview = document.createElementNS("http://www.w3.org/2000/svg", "path");
    preview.setAttribute("class", "graph-connection-preview");
    drag.canvas.querySelector(".graph-lines")?.appendChild(preview);
  }
  const from = drag.start;
  const to = current;
  const midX = from.x + (to.x - from.x) * 0.52;
  preview.setAttribute("d", `M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`);
}

export function clearGraphConnectionPreview() {
  const drag = state.graphConnectionDrag;
  if (!drag) return;
  drag.canvas.querySelector(".graph-connection-preview")?.remove();
  state.graphConnectionDrag = null;
}

export function applyGraphWheelZoom(stage, event) {
  event.preventDefault();
  const currentZoom = clampGraphZoom(state.appSettings.graphZoom);
  const delta = event.deltaY < 0 ? 0.1 : -0.1;
  const nextZoom = clampGraphZoom(currentZoom + delta);
  state.appSettings.graphZoom = nextZoom;
  saveState();
  
  const canvas = stage.querySelector(".graph-canvas");
  if (canvas) {
    canvas.style.setProperty("--graph-zoom", String(nextZoom));
    const label = stage.closest(".graph-view")?.querySelector('[data-graph-zoom="reset"]');
    if (label) label.textContent = `${Math.round(nextZoom * 100)}%`;
    syncGraphPortEdges(stage);
  }
}

export function finishGraphTaskDrop(event) {
  const { taskId, canvas, card } = state.graphTaskDrag;
  card.classList.remove("dragging");
  card.style.transform = "";
  state.graphTaskDrag = null;
  
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const taskGroup = el?.closest?.("[data-graph-task-group]");
  const childProjectCard = el?.closest?.(".graph-child-project-card")
    || el?.closest?.(".graph-child-project-wrap")?.querySelector?.(".graph-child-project-card");
  const projectNode = el?.closest?.("[data-graph-project-node]");
  
  let targetProjectId = null;
  if (taskGroup) {
    targetProjectId = Number(taskGroup.dataset.graphTaskGroup);
  } else if (childProjectCard?.dataset.selectProject) {
    targetProjectId = Number(childProjectCard.dataset.selectProject);
  } else if (projectNode?.dataset.graphProjectNode) {
    targetProjectId = Number(projectNode.dataset.graphProjectNode);
  }
  
  const task = state.tasks.find((item) => item.id === taskId);
  if (task) {
    if (targetProjectId && targetProjectId !== task.projectId) {
      task.projectId = targetProjectId;
      if (state.appSettings.graphTaskPositions) {
        delete state.appSettings.graphTaskPositions[task.id];
      }
      state.graphNotice = `${task.name}을 다른 프로젝트로 이동했습니다.`;
      logActivity("task", state.graphNotice, targetProjectId);
      saveState();
      render();
    } else if (!targetProjectId && event.altKey) {
      // 복사 기능 지원
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(8, Math.min(1000, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(8, Math.min(1000, ((event.clientY - rect.top) / rect.height) * 100));
      
      const copyId = createId(state.tasks);
      state.tasks = [{
        id: copyId,
        name: `${task.name} (복사)`,
        projectId: null,
        progress: task.progress,
        advance: task.advance,
        contributionMode: task.contributionMode,
        note: task.note
      }, ...state.tasks];
      
      state.appSettings.graphTaskPositions = state.appSettings.graphTaskPositions || {};
      state.appSettings.graphTaskPositions[copyId] = { x, y };
      state.graphNotice = `할 일을 복사하여 독립 노드로 추가했습니다.`;
      saveState();
      render();
    } else if (!targetProjectId) {
      // 독립 할 일로 이동
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(8, Math.min(1000, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(8, Math.min(1000, ((event.clientY - rect.top) / rect.height) * 100));
      
      task.projectId = null;
      state.appSettings.graphTaskPositions = state.appSettings.graphTaskPositions || {};
      state.appSettings.graphTaskPositions[task.id] = { x, y };
      state.graphNotice = `${task.name}을 독립 할 일로 이동했습니다.`;
      logActivity("task", state.graphNotice, null);
      saveState();
      render();
    } else {
      render();
    }
  }
}

export function renderGraphKeepingViewport(canvas) {
  if (!canvas) return;
  const stage = canvas.closest(".graph-stage");
  const scrollLeft = stage ? stage.scrollLeft : 0;
  const scrollTop = stage ? stage.scrollTop : 0;
  renderProjectDetail();
  requestAnimationFrame(() => {
    const nextStage = document.querySelector(".graph-stage");
    if (nextStage) {
      nextStage.scrollLeft = scrollLeft;
      nextStage.scrollTop = scrollTop;
      updateGraphMinimapViewport();
    }
  });
}

export function createGraphMemoNode(point) {
  state.appSettings.graphMemoNodes = state.appSettings.graphMemoNodes || [];
  const id = createId(state.appSettings.graphMemoNodes);
  state.appSettings.graphMemoNodes.push({
    id,
    title: "새 메모",
    body: "생각을 적으세요",
    x: point.x,
    y: point.y
  });
  state.graphNotice = "메모 노드를 생성했습니다.";
  saveState();
  renderProjectDetail();
}

export function createGraphFormulaNode(point) {
  state.appSettings.graphFormulaNodes = state.appSettings.graphFormulaNodes || [];
  const id = createId(state.appSettings.graphFormulaNodes);
  state.appSettings.graphFormulaNodes.push({
    id,
    title: `수식 ${id}`,
    formulaType: "fixed",
    completion: 0,
    advance: 0,
    x: point.x,
    y: point.y
  });
  state.graphNotice = "수식 노드를 생성했습니다.";
  saveState();
  renderProjectDetail();
}

export function deleteGraphFreeNode(nodeTypeAndId, canvas) {
  const [type, idText] = String(nodeTypeAndId).split(":");
  const id = Number(idText);
  if (type === "memo") {
    state.appSettings.graphMemoNodes = (state.appSettings.graphMemoNodes || []).filter((node) => node.id !== id);
    state.graphNotice = "메모 노드를 삭제했습니다.";
  }
  if (type === "formula") {
    state.appSettings.graphFormulaNodes = (state.appSettings.graphFormulaNodes || []).filter((node) => node.id !== id);
    state.appSettings.graphFormulaLinks = (state.appSettings.graphFormulaLinks || []).filter((link) => link.sourceId !== id);
    state.appSettings.graphFormulaInputLinks = (state.appSettings.graphFormulaInputLinks || [])
      .filter((link) => !(link.targetId === id) && !(link.sourceType === "formula" && link.sourceId === id));
    state.graphNotice = "수식 노드를 삭제했습니다.";
  }
  if (type === "archive") {
    state.appSettings.graphArchiveNodes = (state.appSettings.graphArchiveNodes || []).filter((node) => node.id !== id);
    state.appSettings.graphArchiveLinks = (state.appSettings.graphArchiveLinks || []).filter((link) => link.sourceId !== id);
    state.graphNotice = "아카이브 노드를 삭제했습니다.";
  }
  saveState();
  renderGraphKeepingViewport(canvas);
}

export function openGraphInlineEdit(nodeEl) {
  if (!nodeEl) return;
  const nodeMain = nodeEl.querySelector(".graph-node-main");
  const titleEl = nodeMain?.querySelector("strong");
  if (!nodeMain || !titleEl) return;
  
  const oldText = titleEl.textContent;
  const input = document.createElement("input");
  input.type = "text";
  input.className = "graph-inline-editor-input";
  input.value = oldText;
  
  titleEl.replaceWith(input);
  input.focus();
  input.select();
  
  const finishEdit = () => {
    const newText = input.value.trim() || oldText;
    const nextStrong = document.createElement("strong");
    nextStrong.textContent = newText;
    input.replaceWith(nextStrong);
    
    if (newText === oldText) return;
    
    const nodeTypeAndId = nodeEl.dataset.graphFreeNode || "";
    const projectId = nodeEl.dataset.graphProjectNode ? Number(nodeEl.dataset.graphProjectNode) : 0;
    const taskId = nodeEl.dataset.graphTaskNode ? Number(nodeEl.dataset.graphTaskNode) : 0;
    
    if (projectId) {
      const proj = getProject(projectId);
      if (proj) {
        proj.name = newText;
        state.graphNotice = `프로젝트 이름을 수정했습니다.`;
        logActivity("project", `이름을 "${newText}"(으)로 수정`, projectId);
      }
    } else if (taskId) {
      const t = state.tasks.find((item) => item.id === taskId);
      if (t) {
        t.name = newText;
        state.graphNotice = `할 일 이름을 수정했습니다.`;
        logActivity("task", `이름을 "${newText}"(으)로 수정`, t.projectId);
      }
    } else if (nodeTypeAndId) {
      const [type, idText] = nodeTypeAndId.split(":");
      const id = Number(idText);
      if (type === "memo") {
        const m = state.appSettings.graphMemoNodes?.find((item) => item.id === id);
        if (m) m.title = newText;
      }
      if (type === "formula") {
        const f = state.appSettings.graphFormulaNodes?.find((item) => item.id === id);
        if (f) f.title = newText;
      }
      if (type === "archive") {
        const a = state.appSettings.graphArchiveNodes?.find((item) => item.id === id);
        if (a) a.title = newText;
      }
    }
    saveState();
    renderProjectList();
    renderGraphKeepingViewport(nodeEl.closest(".graph-canvas"));
  };
  
  input.addEventListener("blur", finishEdit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      input.value = oldText;
      input.blur();
    }
  });
}

// ── BOTTLEANECK ACTION HELPERS (신규 구현) ──

export function focusGraphNode(nodeSelector) {
  const nodeEl = document.querySelector(nodeSelector);
  const stage = document.querySelector(".graph-stage");
  const canvas = document.querySelector(".graph-canvas");
  if (!nodeEl || !stage || !canvas) return;
  
  const targetScrollLeft = nodeEl.offsetLeft + nodeEl.offsetWidth / 2 - stage.clientWidth / 2;
  const targetScrollTop = nodeEl.offsetTop + nodeEl.offsetHeight / 2 - stage.clientHeight / 2;
  
  stage.scrollTo({
    left: targetScrollLeft,
    top: targetScrollTop,
    behavior: "smooth"
  });
  
  nodeEl.classList.remove("focus-pulse");
  void nodeEl.offsetWidth; // trigger reflow
  nodeEl.classList.add("focus-pulse");
  setTimeout(() => nodeEl.classList.remove("focus-pulse"), 3000);
}

export function navigateToAndFocusNode(type, id) {
  const numericId = Number(id);
  let targetProjectId = null;
  let selector = "";

  if (type === "project") {
    const proj = getProject(numericId);
    if (proj) {
      if (state.appSettings.globalGraphView !== true) {
        if (proj.parentId) {
          targetProjectId = proj.parentId;
        } else {
          targetProjectId = proj.id;
        }
      }
      selector = `[data-graph-project-node="${numericId}"]`;
    }
  } else if (type === "task") {
    const task = state.tasks.find(t => t.id === numericId);
    if (task) {
      if (state.appSettings.globalGraphView !== true) {
        if (task.projectId) {
          targetProjectId = task.projectId;
        }
      }
      selector = `[data-graph-task-node="${numericId}"]`;
    }
  }

  if (targetProjectId !== null && targetProjectId !== state.selectedProjectId) {
    state.selectedProjectId = targetProjectId;
    revealProjectPath(targetProjectId);
  }

  state.viewMode = "graph";
  render();

  requestAnimationFrame(() => {
    setTimeout(() => {
      focusGraphNode(selector);
    }, 120);
  });
}

export function pinToFocusWidget(type, id) {
  const numericId = Number(id);
  let taskIds = [];
  if (type === "project") {
    const tasks = state.tasks
      .filter(t => t.projectId === numericId && clampProgress(t.progress) < 100)
      .slice(0, 2);
    taskIds = tasks.map(t => t.id);
  } else if (type === "task") {
    taskIds = [numericId];
  }
  
  if (taskIds.length === 0) {
    state.graphNotice = "집중 목록에 등록할 미완료 할 일이 없습니다.";
    renderProjectDetail();
    return;
  }
  
  const currentIds = Array.isArray(state.appSettings.focusedTaskIds) ? state.appSettings.focusedTaskIds.map(Number) : [];
  taskIds.forEach(taskId => {
    if (!currentIds.includes(taskId)) {
      currentIds.push(taskId);
    }
  });
  state.appSettings.focusedTaskIds = currentIds.slice(-6);
  state.graphNotice = "선택 요소를 집중 위젯에 핀업했습니다.";
  saveState();
  renderProjectDetail();
  
  if (window.workshopApp?.refreshFocusWidget) {
    window.workshopApp.refreshFocusWidget();
  }
}

export function addQuickSubtask(projectId, taskName) {
  const numericProjectId = Number(projectId);
  const taskId = createId(state.tasks);
  state.tasks = [{
    id: taskId,
    name: taskName,
    projectId: numericProjectId,
    progress: 0,
    advance: 0,
    contributionMode: "both",
    note: ""
  }, ...state.tasks];
  state.graphNotice = `"${taskName}" 할 일을 추가했습니다.`;
  saveState();
  render();
}

export function openBottleneckPopover(triggerEl, type, id) {
  closeBottleneckPopover();
  
  const popover = document.createElement("div");
  popover.className = "bottleneck-popover";
  
  let targetName = "";
  let targetDesc = "";
  let actionButtons = "";
  
  if (type === "node") {
    const isProject = id.startsWith("project-");
    const targetId = Number(id.replace("project-", "").replace("task-", ""));
    if (isProject) {
      const proj = getProject(targetId);
      targetName = proj?.name || "하위 프로젝트";
      targetDesc = `완성도 미달 (${getRollupProgress(targetId)}%)`;
      actionButtons = `
        <button type="button" data-bottleneck-action="focus" data-target-type="project" data-target-id="${targetId}">🔍 원인 추적</button>
        <button type="button" data-bottleneck-action="pin" data-target-type="project" data-target-id="${targetId}">📌 집중 등록</button>
        <div class="popover-split-section">
          <input type="text" class="bottleneck-split-input" placeholder="새 하위 할 일 이름..." />
          <button type="button" data-bottleneck-action="split" data-target-type="project" data-target-id="${targetId}">🚀 쪼개기</button>
        </div>
      `;
    } else {
      const task = state.tasks.find(t => t.id === targetId);
      targetName = task?.name || "할 일";
      targetDesc = `미진한 진행률 (${clampProgress(task?.progress)}%)`;
      actionButtons = `
        <button type="button" data-bottleneck-action="focus" data-target-type="task" data-target-id="${targetId}">🔍 원인 추적</button>
        <button type="button" data-bottleneck-action="pin" data-target-type="task" data-target-id="${targetId}">📌 집중 등록</button>
      `;
    }
  } else if (type === "external") {
    const parts = id.split(":");
    const sourceId = Number(parts[1]);
    const metric = parts[3];
    const sourceProj = getProject(sourceId);
    targetName = sourceProj?.name || "외부 반영선";
    targetDesc = `외부 지연 유입 (${metric === "advance" ? "진행도" : "완성도"})`;
    actionButtons = `
      <button type="button" data-bottleneck-action="focus" data-target-type="project" data-target-id="${sourceId}">🔍 원인 추적</button>
      <button type="button" data-bottleneck-action="pin" data-target-type="project" data-target-id="${sourceId}">📌 집중 등록</button>
    `;
  } else if (type === "internal") {
    const parts = id.split(":");
    const key = parts[1];
    const isProject = key.startsWith("project-");
    const targetId = Number(key.replace("project-", "").replace("task-", ""));
    
    if (isProject) {
      const proj = getProject(targetId);
      targetName = proj?.name || "하위 프로젝트";
      targetDesc = `내부 반영비 하락 요인`;
      actionButtons = `
        <button type="button" data-bottleneck-action="focus" data-target-type="project" data-target-id="${targetId}">🔍 원인 추적</button>
        <button type="button" data-bottleneck-action="pin" data-target-type="project" data-target-id="${targetId}">📌 집중 등록</button>
        <div class="popover-split-section">
          <input type="text" class="bottleneck-split-input" placeholder="새 하위 할 일 이름..." />
          <button type="button" data-bottleneck-action="split" data-target-type="project" data-target-id="${targetId}">🚀 쪼개기</button>
        </div>
      `;
    } else {
      const task = state.tasks.find(t => t.id === targetId);
      targetName = task?.name || "할 일";
      targetDesc = `내부 반영비 하락 요인`;
      actionButtons = `
        <button type="button" data-bottleneck-action="focus" data-target-type="task" data-target-id="${targetId}">🔍 원인 추적</button>
        <button type="button" data-bottleneck-action="pin" data-target-type="task" data-target-id="${targetId}">📌 집중 등록</button>
      `;
    }
  }
  
  popover.innerHTML = `
    <div class="popover-arrow"></div>
    <div class="popover-title">⚠️ 병목 탐지</div>
    <div class="popover-name">${escapeHtml(targetName)}</div>
    <div class="popover-desc">${targetDesc}</div>
    <div class="popover-actions">
      ${actionButtons}
    </div>
  `;
  
  document.body.appendChild(popover);
  
  const rect = triggerEl.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  
  let left = rect.left + rect.width / 2 - popoverRect.width / 2;
  let top = rect.top - popoverRect.height - 10;
  
  if (left < 10) left = 10;
  if (left + popoverRect.width > window.innerWidth - 10) {
    left = window.innerWidth - popoverRect.width - 10;
  }
  if (top < 10) {
    top = rect.bottom + 10;
    popover.classList.add("placed-below");
  }
  
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  
  const splitInput = popover.querySelector(".bottleneck-split-input");
  splitInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      popover.querySelector('[data-bottleneck-action="split"]')?.click();
    }
  });
}

export function closeBottleneckPopover() {
  document.querySelectorAll(".bottleneck-popover").forEach(el => el.remove());
}

// ── CORE RENDER ──

export function render() {
  saveState();
  applyPanelState();
  renderSearch();
  renderProjectList();
  renderProjectDetail();
}

window.updateTaskFromFocusWidget = (taskId, patch = {}) => {
  const task = state.tasks.find((item) => item.id === Number(taskId));
  if (!task) return { ok: false };
  if (patch.progress !== undefined) task.progress = clampProgress(patch.progress);
  if (patch.advance !== undefined) task.advance = clampProgress(patch.advance);
  logActivity("focus", `${task.name} 위젯에서 조정`, task.projectId);
  saveState();
  renderProjectList();
  renderProjectDetail();
  return { ok: true, task };
};

// ── INIT & SYNC ─────────────────────────────────────────────────────────

async function syncPinState() {
  await setPinnedState(state.appSettings.alwaysOnTop !== false, false);
}

// 초기화 실행
loadState();
applyTheme();
applyPanelState();
render();
syncPinState();
initEvents();

export async function openResource(path, type) {
  if (window.workshopApp?.openResource) {
    const res = await window.workshopApp.openResource(path, type);
    if (res && !res.ok) {
      state.graphNotice = `에러: ${res.error}`;
    } else {
      state.graphNotice = "리소스를 열었습니다.";
    }
  } else {
    window.open(path, "_blank");
  }
  render();
}

export function addArchiveResource(name, type, path, desc = "", linkTarget = null, tags = []) {
  state.archiveResources = state.archiveResources || [];
  state.archiveResourceLinks = state.archiveResourceLinks || [];
  const id = createArchiveResourceId(state.archiveResources);
  state.archiveResources.push({
    id,
    name,
    type: ["file", "folder", "link"].includes(type) ? type : "file",
    path,
    desc,
    tags: normalizeArchiveTags(tags),
    createdAt: new Date().toISOString()
  });
  if (linkTarget?.targetType && linkTarget?.targetId) {
    state.archiveResourceLinks.push({
      resourceId: id,
      targetType: linkTarget.targetType === "task" ? "task" : "project",
      targetId: Number(linkTarget.targetId)
    });
  }
  state.graphNotice = `"${name}" 리소스를 추가했습니다.`;
  saveState();
  render();
  return id;
}

export function deleteArchiveResource(resourceId) {
  const id = Number(resourceId);
  state.archiveResources = (state.archiveResources || []).filter((resource) => resource.id !== id);
  state.archiveResourceLinks = (state.archiveResourceLinks || []).filter((link) => link.resourceId !== id);
  state.appSettings.graphArchiveNodes = (state.appSettings.graphArchiveNodes || []).filter((node) => node.resourceId !== id);
  state.appSettings.graphArchiveLinks = (state.appSettings.graphArchiveLinks || []).filter((link) => {
    return state.appSettings.graphArchiveNodes.some((node) => node.id === link.sourceId);
  });
  state.graphNotice = "리소스를 제거했습니다.";
  saveState();
  render();
}

export function updateArchiveResource(resourceId, patch) {
  const result = updateArchiveResourceModel(state.archiveResources || [], resourceId, patch);
  if (!result.updated) return false;
  state.archiveResources = result.resources;
  state.graphNotice = `"${result.updated.name}" 리소스를 수정했습니다.`;
  saveState();
  render();
  return true;
}

export function attachArchiveResourceToProject(resourceId, projectId) {
  if (!state.archiveResources.some((resource) => resource.id === Number(resourceId))) return;
  if (!getProject(Number(projectId))) return;
  state.archiveResourceLinks = addArchiveResourceLink(
    state.archiveResourceLinks || [],
    resourceId,
    "project",
    projectId
  );
  state.graphNotice = "아카이브를 프로젝트에 연결했습니다.";
  saveState();
  render();
}

export function detachArchiveResourceFromProject(resourceId, projectId) {
  state.archiveResourceLinks = removeArchiveResourceLink(
    state.archiveResourceLinks || [],
    resourceId,
    "project",
    projectId
  );
  state.graphNotice = "아카이브 프로젝트 연결을 해제했습니다.";
  saveState();
  render();
}

export function createGraphArchiveNode(point, resourceId = null) {
  state.appSettings.graphArchiveNodes = state.appSettings.graphArchiveNodes || [];
  const id = createId(state.appSettings.graphArchiveNodes);
  
  let title = "새 리소스 폴더";
  let type = "folder";
  let path = "C:\\";

  if (resourceId !== null) {
    const mappedRes = (state.archiveResources || []).find((r) => r.id === Number(resourceId));
    if (mappedRes) {
      title = mappedRes.name;
      type = mappedRes.type;
      path = mappedRes.path;
    }
  }

  state.appSettings.graphArchiveNodes.push({
    id,
    resourceId: resourceId !== null ? Number(resourceId) : null,
    title,
    type,
    path,
    x: point.x,
    y: point.y
  });
  state.graphNotice = "아카이브 노드를 생성했습니다.";
  saveState();
  renderProjectDetail();
}

export async function scanArchivePaths(container = document) {
  if (!container) return;
  const items = container.querySelectorAll(".js-archive-item");
  if (items.length === 0) return;

  const promises = Array.from(items).map(async (item) => {
    const filePath = item.getAttribute("data-resource-path");
    if (!filePath) return;
    try {
      if (window.workshopApp && typeof window.workshopApp.checkPathExists === "function") {
        const exists = await window.workshopApp.checkPathExists(filePath);
        if (exists === false) {
          item.classList.add("is-missing");
        } else {
          item.classList.remove("is-missing");
        }
      }
    } catch (error) {
      console.error("Failed to check path existence:", filePath, error);
    }
  });

  await Promise.all(promises);
}
