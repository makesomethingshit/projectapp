import {
  state,
  saveState,
  createId,
  logActivity,
  normalizeProjectLinks
} from "./state.js";

import {
  getProject,
  getDescendantProjectIds,
  setCompletionWeight,
  getCompletionItemKey,
  clampProgress,
  getCompletionWeight,
  revealProjectPath,
  pruneCompletionWeights
} from "./calculator.js";

import {
  escapeHtml,
  dateFromOffset
} from "./ui-components.js";

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
  openPreferencesModal,
  closePreferencesModal,
  openProjectModal,
  closeProjectModal,
  openWeightSliderPopup,
  hideWeightSliderPopup,
  addExternalLinkRow,
  activeWeightRefs,
  getAllProjectRows,
  openArchiveSelectModal,
  closeArchiveSelectModal
} from "./app-modals.js";

import {
  applyGraphConnection,
  applyGraphFormulaConnection,
  applyGraphFormulaInputConnection,
  removeGraphEdge
} from "./app-graph-actions.js";

import {
  applyGraphProjectDoubleClickNavigation
} from "./graph-navigation.js";

import {
  applyBottleneckDetailNavigation
} from "./detail-navigation.js";

import {
  getGraphSelectionRect,
  isGraphPointInRect
} from "./graph-selection.js";

import {
  render,
  renderProjectList,
  renderProjectDetail,
  renderSearch,
  renderGraphKeepingViewport,
  updateGraphMinimapViewport,
  closeFileMenu,
  toggleFileMenu,
  toggleThemeMode,
  setPinnedState,
  applyPanelState,
  
  // Graph helpers
  graphPointFromEvent,
  graphPointFromElement,
  updateGraphConnectionPreview,
  clearGraphConnectionPreview,
  applyGraphWheelZoom,
  finishGraphTaskDrop,
  createGraphMemoNode,
  createGraphFormulaNode,
  createGraphArchiveNode,
  openResource,
  addArchiveResource,
  deleteArchiveResource,
  updateArchiveResource,
  attachArchiveResourceToProject,
  detachArchiveResourceFromProject,
  deleteGraphFreeNode,
  openGraphInlineEdit,
  syncGraphPortEdges,
  
  // Bottleneck Action Helpers
  focusGraphNode,
  navigateToAndFocusNode,
  pinToFocusWidget,
  addQuickSubtask,
  openBottleneckPopover,
  closeBottleneckPopover
} from "./app.js";

const $ = (selector) => document.querySelector(selector);

let spacePressed = false;

let lastClickedProjectId = null;
let lastClickedProjectTime = 0;

function getGraphSelectableProjectNodes(canvas) {
  return [...canvas.querySelectorAll("[data-graph-project-node]")]
    .filter((node) => Number(node.dataset.graphProjectNode));
}

function getGraphSelectableFreeNodes(canvas) {
  return [...canvas.querySelectorAll("[data-graph-free-node]")]
    .filter((node) => node.dataset.graphFreeNode);
}

function getGraphNodePoint(node) {
  return {
    x: Number.parseFloat(node.style.getPropertyValue("--x")) || 50,
    y: Number.parseFloat(node.style.getPropertyValue("--y")) || 50
  };
}

function getGraphFreeNode(type, nodeId) {
  if (type === "memo") return state.appSettings.graphMemoNodes?.find((item) => item.id === nodeId);
  if (type === "formula") return state.appSettings.graphFormulaNodes?.find((item) => item.id === nodeId);
  if (type === "archive") return state.appSettings.graphArchiveNodes?.find((item) => item.id === nodeId);
  return null;
}

function getSelectedFreeNodeInitialPositions(canvas, fallbackKey = null) {
  const keys = new Set(state.selectedGraphFreeNodeKeys || []);
  if (fallbackKey) keys.add(fallbackKey);
  const initialPositions = {};
  keys.forEach((key) => {
    const [type, idText] = String(key).split(":");
    const nodeId = Number(idText);
    const data = getGraphFreeNode(type, nodeId);
    const el = canvas.querySelector(`[data-graph-free-node="${key}"]`);
    if (!data || !el) return;
    initialPositions[key] = {
      type,
      nodeId,
      x: Number.parseFloat(el.style.getPropertyValue("--x")) || Number(data.x) || 50,
      y: Number.parseFloat(el.style.getPropertyValue("--y")) || Number(data.y) || 50
    };
    el.classList.add("multi-selected");
  });
  return initialPositions;
}

function getSelectedProjectInitialPositions(canvas, start, fallbackId = null) {
  const ids = new Set(state.selectedGraphProjectIds || []);
  if (fallbackId) ids.add(fallbackId);
  const initialPositions = {};
  [...ids].filter((id) => getProject(id)).forEach((id) => {
    const node = canvas.querySelector(`[data-graph-project-node="${id}"]`);
    const savedPosition = state.appSettings.graphNodePositions?.[id];
    initialPositions[id] = {
      x: Number.parseFloat(node?.style.getPropertyValue("--x")) || Number(savedPosition?.x) || start.x,
      y: Number.parseFloat(node?.style.getPropertyValue("--y")) || Number(savedPosition?.y) || start.y
    };
    node?.classList.add("multi-selected");
  });
  return initialPositions;
}

function ensureGraphSelectionBox(canvas) {
  let box = canvas.querySelector(".graph-selection-box");
  if (!box) {
    box = document.createElement("div");
    box.className = "graph-selection-box";
    canvas.appendChild(box);
  }
  return box;
}

function updateGraphSelectionBox(drag, current) {
  const rect = getGraphSelectionRect(drag.start, current);
  const box = ensureGraphSelectionBox(drag.canvas);
  box.style.setProperty("--select-left", `${rect.left}%`);
  box.style.setProperty("--select-top", `${rect.top}%`);
  box.style.setProperty("--select-width", `${rect.width}%`);
  box.style.setProperty("--select-height", `${rect.height}%`);
  return rect;
}

function clearGraphSelectionBox(canvas) {
  canvas?.querySelector?.(".graph-selection-box")?.remove();
}

function previewGraphSelection(drag, rect) {
  getGraphSelectableProjectNodes(drag.canvas).forEach((node) => {
    const projectId = Number(node.dataset.graphProjectNode);
    const selected = isGraphPointInRect(getGraphNodePoint(node), rect);
    node.classList.toggle("multi-selected", selected || drag.initialSelection.has(projectId));
  });
  getGraphSelectableFreeNodes(drag.canvas).forEach((node) => {
    const key = node.dataset.graphFreeNode;
    const selected = isGraphPointInRect(getGraphNodePoint(node), rect);
    node.classList.toggle("multi-selected", selected || drag.initialFreeSelection.has(key));
  });
}

export function getSpacePressed() {
  return spacePressed;
}

export function initEvents() {
  const taskModal = $("#taskModal");
  const noteModal = $("#noteModal");
  const deleteProjectModal = $("#deleteProjectModal");
  const deleteTaskModal = $("#deleteTaskModal");
  const projectDeadlineModal = $("#projectDeadlineModal");
  const preferencesModal = $("#preferencesModal");
  const projectModal = $("#projectModal");
  const weightSliderPopup = $("#weightSliderPopup");
  const weightSliderInput = $("#weightSliderInput");
  const weightSliderValue = $("#weightSliderValue");
  const searchInput = $("#searchInput");
  const taskProjectInput = $("#taskProjectInput");
  const darkModeInput = $("#darkModeInput");
  const preferencesPinInput = $("#preferencesPinInput");
  const shortcutToggleGraph = $("#shortcutToggleGraph");
  const shortcutOpenFocusWidget = $("#shortcutOpenFocusWidget");
  const shortcutToggleSearch = $("#shortcutToggleSearch");
  const shortcutToggleTheme = $("#shortcutToggleTheme");
  const clearProjectDeadline = $("#clearProjectDeadline");
  const newProjectNoDeadline = $("#newProjectNoDeadline");
  const deleteProjectInput = $("#deleteProjectInput");
  const confirmDeleteProject = $("#confirmDeleteProject");
  const pinToggle = $("#pinToggle");
  const taskCompletionInput = $("#taskCompletionInput");
  const taskCompletionValue = $("#taskCompletionValue");
  const taskAdvanceInput = $("#taskAdvanceInput");
  const taskAdvanceValue = $("#taskAdvanceValue");
  const noteTaskCompletionInput = $("#noteTaskCompletionInput");
  const noteTaskCompletionValue = $("#noteTaskCompletionValue");
  const noteTaskAdvanceInput = $("#noteTaskAdvanceInput");
  const noteTaskAdvanceValue = $("#noteTaskAdvanceValue");
  const noteTaskProjectInput = $("#noteTaskProjectInput");
  const noteTaskNameInput = $("#noteTaskNameInput");
  const noteTaskContributionModeInput = $("#noteTaskContributionModeInput");
  const noteInput = $("#noteInput");
  const taskContributionModeInput = $("#taskContributionModeInput");
  const projectNameInput = $("#projectNameInput");
  const projectParentInput = $("#projectParentInput");
  const projectStatusInput = $("#projectStatusInput");
  const newProjectDeadlineInput = $("#newProjectDeadlineInput");
  const projectNoteInput = $("#projectNoteInput");
  const editProjectNameInput = $("#editProjectNameInput");
  const editProjectParentInput = $("#editProjectParentInput");
  const editContributionModeInput = $("#editContributionModeInput");
  const editProjectNoteInput = $("#editProjectNoteInput");
  const externalLinksList = $("#externalLinksList");
  const projectDeadlineInput = $("#projectDeadlineInput");

  document.addEventListener("click", (event) => {
    // ── topbar 메인 뷰 탭 (상세 / 구조 지도 / 아카이브) - 최우선 처리 ──
    const mainViewBtn = event.target.closest("[data-main-view]");
    if (mainViewBtn) {
      const v = mainViewBtn.dataset.mainView;
      console.log('[click] data-main-view hit:', v);
      if (v === "graph") {
        state.appSettings.globalGraphView = true;
      } else {
        state.appSettings.globalGraphView = false;
        state.viewMode = v;
      }
      saveState();
      render();
      return;
    }

    // ── 병목 팝오버 및 해결 액션 처리 ──
    const bottleneckTrigger = event.target.closest("[data-bottleneck-trigger-type]");
    if (bottleneckTrigger) {
      event.preventDefault();
      event.stopPropagation();
      const triggerType = bottleneckTrigger.dataset.bottleneckTriggerType;
      const triggerId = bottleneckTrigger.dataset.bottleneckTriggerId;
      openBottleneckPopover(bottleneckTrigger, triggerType, triggerId);
      return;
    }

    // 팝오버 내부 해결 조치 버튼들
    const actionBtn = event.target.closest("[data-bottleneck-action]");
    if (actionBtn) {
      event.preventDefault();
      event.stopPropagation();
      const action = actionBtn.dataset.bottleneckAction;
      const type = actionBtn.dataset.targetType;
      const id = actionBtn.dataset.targetId;

      if (action === "focus") {
        navigateToAndFocusNode(type, id);
        closeBottleneckPopover();
      } else if (action === "pin") {
        pinToFocusWidget(type, id);
        closeBottleneckPopover();
      } else if (action === "split") {
        const splitInput = $(".bottleneck-split-input");
        const taskName = splitInput?.value?.trim();
        if (taskName) {
          addQuickSubtask(Number(id), taskName);
          closeBottleneckPopover();
        }
      }
      return;
    }

    // 상세 패널 내 병목 진단 카드 해결 버튼들
    const detailFocusBtn = event.target.closest("[data-bottleneck-focus-node]");
    if (detailFocusBtn) {
      event.preventDefault();
      event.stopPropagation();
      const rawTargetId = detailFocusBtn.dataset.bottleneckFocusNode; // e.g. "project-12" or "task-45"
      const isProject = rawTargetId.startsWith("project-");
      const targetId = Number(rawTargetId.replace("project-", "").replace("task-", ""));
      const nextProjectId = applyBottleneckDetailNavigation(state, isProject ? "project" : "task", targetId);
      if (nextProjectId) {
        revealProjectPath(nextProjectId);
        saveState();
        render();
      }
      return;
    }

    const detailAddTaskBtn = event.target.closest("[data-bottleneck-add-task]");
    if (detailAddTaskBtn) {
      event.preventDefault();
      event.stopPropagation();
      const targetProjectId = Number(detailAddTaskBtn.dataset.bottleneckAddTask);
      openTaskModal(targetProjectId);
      return;
    }

    const detailPinFocusedBtn = event.target.closest("[data-bottleneck-pin-focused]");
    if (detailPinFocusedBtn) {
      event.preventDefault();
      event.stopPropagation();
      const targetProjectId = Number(detailPinFocusedBtn.dataset.bottleneckPinFocused);
      pinToFocusWidget("project", targetProjectId);
      return;
    }

    const detailPinTaskBtn = event.target.closest("[data-bottleneck-pin-task]");
    if (detailPinTaskBtn) {
      event.preventDefault();
      event.stopPropagation();
      const targetTaskId = Number(detailPinTaskBtn.dataset.bottleneckPinTask);
      pinToFocusWidget("task", targetTaskId);
      return;
    }

    // 팝오버 외부 클릭 시 닫기
    if (!event.target.closest(".bottleneck-popover")) {
      closeBottleneckPopover();
    }

    // -- OS 파일/폴더 선택기 이벤트 --
    const newFileBtn = event.target.closest("#newArchiveSelectFile");
    if (newFileBtn) {
      event.preventDefault();
      window.workshopApp.selectFileOrFolder("file").then((selectedPath) => {
        if (selectedPath) {
          const pathInput = document.getElementById("newArchivePath");
          const typeSelect = document.getElementById("newArchiveType");
          if (pathInput) pathInput.value = selectedPath;
          if (typeSelect) typeSelect.value = "file";
        }
      }).catch((err) => console.error("Failed to select file:", err));
      return;
    }

    const newFolderBtn = event.target.closest("#newArchiveSelectFolder");
    if (newFolderBtn) {
      event.preventDefault();
      window.workshopApp.selectFileOrFolder("folder").then((selectedPath) => {
        if (selectedPath) {
          const pathInput = document.getElementById("newArchivePath");
          const typeSelect = document.getElementById("newArchiveType");
          if (pathInput) pathInput.value = selectedPath;
          if (typeSelect) typeSelect.value = "folder";
        }
      }).catch((err) => console.error("Failed to select folder:", err));
      return;
    }

    const editFileBtn = event.target.closest(".edit-archive-select-file");
    if (editFileBtn) {
      event.preventDefault();
      window.workshopApp.selectFileOrFolder("file").then((selectedPath) => {
        if (selectedPath) {
          const form = editFileBtn.closest("form");
          const pathInput = form?.querySelector("[data-edit-archive-path]");
          const typeSelect = form?.querySelector("[data-edit-archive-type]");
          if (pathInput) pathInput.value = selectedPath;
          if (typeSelect) typeSelect.value = "file";
        }
      }).catch((err) => console.error("Failed to select file for editing:", err));
      return;
    }

    const editFolderBtn = event.target.closest(".edit-archive-select-folder");
    if (editFolderBtn) {
      event.preventDefault();
      window.workshopApp.selectFileOrFolder("folder").then((selectedPath) => {
        if (selectedPath) {
          const form = editFolderBtn.closest("form");
          const pathInput = form?.querySelector("[data-edit-archive-path]");
          const typeSelect = form?.querySelector("[data-edit-archive-type]");
          if (pathInput) pathInput.value = selectedPath;
          if (typeSelect) typeSelect.value = "folder";
        }
      }).catch((err) => console.error("Failed to select folder for editing:", err));
      return;
    }

    const openResBtn = event.target.closest("[data-open-archive-path]");
    if (openResBtn) {
      event.preventDefault();
      const path = openResBtn.dataset.openArchivePath;
      const type = openResBtn.dataset.archiveType;
      openResource(path, type);
      return;
    }

    const delResBtn = event.target.closest("[data-delete-archive-id]");
    if (delResBtn) {
      event.preventDefault();
      const resId = Number(delResBtn.dataset.deleteArchiveId);
      deleteArchiveResource(resId);
      return;
    }

    const archiveViewModeBtn = event.target.closest("[data-archive-view-mode]");
    if (archiveViewModeBtn) {
      event.preventDefault();
      const mode = archiveViewModeBtn.dataset.archiveViewMode;
      state.appSettings.archiveViewMode = ["topic", "type", "all"].includes(mode) ? mode : "topic";
      saveState();
      render();
      return;
    }

    const detachArchiveProjectBtn = event.target.closest("[data-detach-archive-project]");
    if (detachArchiveProjectBtn) {
      event.preventDefault();
      detachArchiveResourceFromProject(
        detachArchiveProjectBtn.dataset.detachArchiveProject,
        detachArchiveProjectBtn.dataset.projectId
      );
      return;
    }

    const weightBadge = event.target.closest("[data-graph-weight-badge], [data-graph-internal-weight]");
    if (weightBadge) {
      event.preventDefault();
      openWeightSliderPopup(weightBadge);
      return;
    }

    const removeEdgeButton = event.target.closest("[data-graph-remove-edge]");
    if (removeEdgeButton) {
      if (removeEdgeButton.matches(".graph-lines path") && !event.altKey) return;
      event.preventDefault();
      removeGraphEdge(removeEdgeButton.dataset.graphRemoveEdge, removeEdgeButton.closest(".graph-canvas"));
      return;
    }

    const formulaSlotDeleteBtn = event.target.closest(".formula-slot-delete-btn");
    if (formulaSlotDeleteBtn) {
      event.preventDefault();
      const formulaId = Number(formulaSlotDeleteBtn.dataset.formulaId);
      const sourceId = Number(formulaSlotDeleteBtn.dataset.sourceId);
      const sourceType = formulaSlotDeleteBtn.dataset.sourceType;
      const metric = formulaSlotDeleteBtn.dataset.metric;
      const edgeId = `formulaIn:${sourceType}:${sourceId}:${formulaId}:${metric}`;
      removeGraphEdge(edgeId, formulaSlotDeleteBtn.closest(".graph-canvas"));
      return;
    }

    if (event.target.closest("#closeWeightPopup")) {
      hideWeightSliderPopup();
      return;
    }

    if (weightSliderPopup && !weightSliderPopup.hidden && !event.target.closest(".graph-view") && !event.target.closest(".weight-popup-content") && !event.target.closest("[data-graph-weight-badge]") && !event.target.closest("[data-graph-internal-weight]")) {
      hideWeightSliderPopup();
    }

    let projectButton = event.target.closest("[data-select-project]");
    if (!projectButton) {
      const nodeEl = event.target.closest("[data-graph-project-node]");
      if (nodeEl) {
        projectButton = nodeEl.querySelector("[data-select-project]");
      }
    }
    let noteButton = event.target.closest("[data-open-note]");
    if (!noteButton) {
      const nodeEl = event.target.closest("[data-graph-task-node]");
      if (nodeEl) {
        noteButton = nodeEl.querySelector("[data-open-note]");
      }
    }
    const deleteTaskButton = event.target.closest("[data-delete-task]");
    const focusTaskButton = event.target.closest("[data-focus-task]");
    const projectTab = event.target.closest('[data-tabs="projects"] button');
    const detailTab = event.target.closest('[data-tabs="detail"] button');
    const viewButton = event.target.closest("[data-view-mode]");
    const rollupToggle = event.target.closest("[data-rollup-toggle]");
    const menuButton = event.target.closest("[data-menu-action]");

    if (event.target.closest("[data-completion-weight]")) return;

    const inlineEditButton = event.target.closest("[data-graph-inline-edit]");
    if (inlineEditButton) {
      event.preventDefault();
      openGraphInlineEdit(inlineEditButton.closest(".graph-node"));
      return;
    }

    const minimapButton = event.target.closest("[data-graph-minimap]");
    if (minimapButton) {
      event.preventDefault();
      const view = minimapButton.closest(".graph-view");
      const stage = view?.querySelector(".graph-stage");
      const canvas = view?.querySelector(".graph-canvas");
      const minimapSvg = minimapButton.querySelector("svg");
      if (stage && canvas && minimapSvg) {
        const rect = minimapSvg.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        stage.scrollLeft = x * canvas.offsetWidth - stage.clientWidth / 2;
        stage.scrollTop = y * canvas.offsetHeight - stage.clientHeight / 2;
        updateGraphMinimapViewport();
      }
      return;
    }

    const graphContextAction = event.target.closest("[data-graph-context-action]");
    if (graphContextAction) {
      const contextMenu = state.graphContextMenu;
      const projectId = contextMenu?.projectId || state.selectedProjectId;
      const action = graphContextAction.dataset.graphContextAction;
      state.graphContextMenu = null;
      const point = {
        x: Math.max(5, Math.min(95, Number(contextMenu?.canvasX) || 52)),
        y: Math.max(7, Math.min(93, Number(contextMenu?.canvasY) || 52))
      };
      if (action === "root-project") {
        openProjectModal(null);
        return;
      }
      if (action === "memo-node") {
        createGraphMemoNode(point);
        return;
      }
      if (action === "formula-node") {
        createGraphFormulaNode(point);
        return;
      }
      if (action === "archive-node") {
        openArchiveSelectModal(point);
        return;
      }
      state.selectedProjectId = Number(projectId);
      revealProjectPath(state.selectedProjectId);
      if (action === "child-project") {
        openProjectModal(state.selectedProjectId);
        return;
      }
      if (action === "task") {
        openTaskModal();
        return;
      }
    }

    if (projectButton) {
      if (state.suppressGraphClick) {
        state.suppressGraphClick = false;
        return;
      }
      const projectId = Number(projectButton.dataset.selectProject);
      const now = Date.now();
      
      // Custom double-click detection (handles DOM replacement on click)
      if (lastClickedProjectId === projectId && (now - lastClickedProjectTime) < 300) {
        lastClickedProjectId = null;
        lastClickedProjectTime = 0;
        if (projectButton.closest(".graph-view")) {
          applyGraphProjectDoubleClickNavigation(state, projectId);
          revealProjectPath(projectId);
          saveState();
          render();
        }
        return;
      }
      
      lastClickedProjectId = projectId;
      lastClickedProjectTime = now;
      
      state.selectedProjectId = projectId;
      const graphProjectNode = projectButton.closest("[data-graph-project-node]");
      if (graphProjectNode) {
        if (event.shiftKey) {
          state.selectedGraphProjectIds.add(state.selectedProjectId);
        } else if (event.ctrlKey || event.metaKey) {
          state.selectedGraphProjectIds.delete(state.selectedProjectId);
          state.selectedProjectId = [...state.selectedGraphProjectIds][0] || state.selectedProjectId;
        } else {
          state.selectedGraphProjectIds = new Set([state.selectedProjectId]);
        }
        state.detailFilter = "all";
        render();
        return;
      }
      if (event.target.closest("[data-project-row]")) {
        state.expandedProjectIds.add(state.selectedProjectId);
        revealProjectPath(state.selectedProjectId);
      }
      state.detailFilter = "all";
      render();
    }

    const graphAddChild = event.target.closest("[data-graph-add-child]");
    const graphEditProject = event.target.closest("[data-graph-edit-project]");
    const graphDeleteProject = event.target.closest("[data-graph-delete-project]");
    const graphDeleteFreeNode = event.target.closest("[data-graph-delete-free-node]");
    const graphEditMemo = event.target.closest("[data-graph-edit-memo]");
    if (graphAddChild) {
      const parentId = Number(graphAddChild.dataset.graphAddChild);
      state.selectedProjectId = parentId;
      revealProjectPath(parentId);
      openProjectModal(parentId);
      return;
    }
    if (graphEditProject) {
      const projectId = Number(graphEditProject.dataset.graphEditProject);
      state.selectedProjectId = projectId;
      revealProjectPath(projectId);
      openProjectDeadlineModal(projectId);
      return;
    }
    if (graphDeleteProject) {
      const projectId = Number(graphDeleteProject.dataset.graphDeleteProject);
      state.selectedProjectId = projectId;
      revealProjectPath(projectId);
      openDeleteProjectModal(projectId);
      return;
    }
    if (graphDeleteFreeNode) {
      deleteGraphFreeNode(graphDeleteFreeNode.dataset.graphDeleteFreeNode, graphDeleteFreeNode.closest(".graph-canvas"));
      return;
    }
    if (graphEditMemo) {
      const editor = graphEditMemo.closest(".graph-node")?.querySelector("[data-graph-memo-body]");
      editor?.focus();
      editor?.select();
      return;
    }
    const graphEditArchive = event.target.closest("[data-graph-edit-archive]");
    if (graphEditArchive) {
      const select = graphEditArchive.closest(".graph-node")?.querySelector(".graph-archive-select");
      if (select) {
        select.focus();
      }
      return;
    }

    if (noteButton) {
      if (state.suppressGraphClick) {
        state.suppressGraphClick = false;
        return;
      }
      openNoteModal(Number(noteButton.dataset.openNote));
    }
    if (focusTaskButton) {
      const taskId = Number(focusTaskButton.dataset.focusTask);
      const task = state.tasks.find((item) => item.id === taskId);
      const currentIds = Array.isArray(state.appSettings.focusedTaskIds) ? state.appSettings.focusedTaskIds.map(Number) : [];
      state.appSettings.focusedTaskIds = currentIds.includes(taskId)
        ? currentIds.filter((id) => id !== taskId)
        : [...currentIds, taskId].slice(-6);
      if (task) logActivity("focus", `${task.name} 집중 ${currentIds.includes(taskId) ? "해제" : "선택"}`, task.projectId);
      saveState();
      renderProjectDetail();
      return;
    }
    if (deleteTaskButton) openDeleteTaskModal(Number(deleteTaskButton.dataset.deleteTask));

    if (projectTab) {
      document.querySelectorAll('[data-tabs="projects"] button').forEach((button) => button.classList.remove("active"));
      projectTab.classList.add("active");
      state.projectFilter = projectTab.dataset.filter;
      saveState();
      renderProjectList();
    }

    if (detailTab) {
      state.detailFilter = detailTab.dataset.filter;
      saveState();
      renderProjectDetail();
    }

    if (viewButton) {
      state.viewMode = viewButton.dataset.viewMode;
      saveState();
      renderProjectDetail();
    }

    if (rollupToggle) {
      const metric = rollupToggle.dataset.rollupToggle;
      state.expandedRollupMetric = state.expandedRollupMetric === metric ? null : metric;
      renderProjectDetail();
    }

    if (menuButton) {
      const action = menuButton.dataset.menuAction;
      if (action === "file") toggleFileMenu();
      if (action === "preferences") {
        closeFileMenu();
        openPreferencesModal();
      }
      if (action === "focus-widget") {
        closeFileMenu();
        window.workshopApp?.openFocusWidget?.();
      }
    }

    if (event.target.closest('[data-action="search"]')) {
      state.isSearchOpen = !state.isSearchOpen;
      renderSearch();
      if (state.isSearchOpen) searchInput?.focus();
    }
    if (event.target.closest("#clearSearch")) {
      state.searchQuery = "";
      render();
      searchInput?.focus();
    }
    if (event.target.closest("#focusTaskInput")) openTaskModal();
    const graphZoomButton = event.target.closest("[data-graph-zoom]");
    if (graphZoomButton) {
      const action = graphZoomButton.dataset.graphZoom;
      const currentZoom = clampProgress(state.appSettings.graphZoom); // Using clampProgress or clampGraphZoom helper in calculator
      const nextZoom = action === "in"
        ? state.appSettings.graphZoom + 0.2
        : action === "out"
          ? state.appSettings.graphZoom - 0.2
          : 1;
      state.appSettings.graphZoom = Math.max(0.4, Math.min(2.8, nextZoom));
      saveState();
      renderProjectDetail();
      return;
    }
    const graphCanvasButton = event.target.closest("[data-graph-canvas]");
    if (graphCanvasButton) {
      const action = graphCanvasButton.dataset.graphCanvas;
      const currentScale = state.appSettings.graphCanvasScale || 1.25;
      state.appSettings.graphCanvasScale = Math.max(0.8, Math.min(4, action === "larger" ? currentScale + 0.3 : currentScale - 0.3));
      saveState();
      renderProjectDetail();
      return;
    }
    const graphNodeSizeButton = event.target.closest("[data-graph-node-size]");
    if (graphNodeSizeButton) {
      const action = graphNodeSizeButton.dataset.graphNodeSize;
      const currentScale = state.appSettings.graphNodeScale || 1.0;
      const nextScale = action === "larger"
        ? currentScale + 0.1
        : action === "smaller"
          ? currentScale - 0.1
          : 1.0;
      state.appSettings.graphNodeScale = Math.max(0.5, Math.min(2.0, nextScale));
      saveState();
      renderProjectDetail();
      return;
    }
    const graphFilterButton = event.target.closest("[data-graph-filter]");
    if (graphFilterButton) {
      const filter = graphFilterButton.dataset.graphFilter;
      if (filter === "scope") {
        state.appSettings.graphScope = graphFilterButton.dataset.value === "local" ? "local" : "all";
      }
      if (filter === "tasks") {
        state.appSettings.graphShowTasks = state.appSettings.graphShowTasks === false;
      }
      if (filter === "external") {
        state.appSettings.graphShowExternal = state.appSettings.graphShowExternal === false;
      }
      saveState();
      renderProjectDetail();
      return;
    }
    if (event.target.closest("[data-graph-layout]")) {
      state.appSettings.graphNodePositions = {};
      state.appSettings.graphTaskPositions = {};
      if (state.appSettings.graphMemoNodes) {
        state.appSettings.graphMemoNodes.forEach((node) => {
          delete node.x;
          delete node.y;
        });
      }
      if (state.appSettings.graphFormulaNodes) {
        state.appSettings.graphFormulaNodes.forEach((node) => {
          delete node.x;
          delete node.y;
        });
      }
      if (state.appSettings.graphArchiveNodes) {
        state.appSettings.graphArchiveNodes.forEach((node) => {
          delete node.x;
          delete node.y;
        });
      }
      state.graphNotice = "노드 위치를 자동 정렬했습니다.";
      saveState();
      renderProjectDetail();
      return;
    }
    if (event.target.closest("#panelCollapseHandle")) {
      state.appSettings.leftPanelCollapsed = !state.appSettings.leftPanelCollapsed;
      applyPanelState();
      saveState();
    }
    if (event.target.closest("#deleteProjectButton")) openDeleteProjectModal();
    if (event.target.closest("#editProjectDeadline")) openProjectDeadlineModal();
    if (event.target.closest("#newProjectButton") || event.target.closest("#addProject")) openProjectModal();
    if (event.target.closest("#addExternalLink")) addExternalLinkRow();
    if (event.target.closest("[data-remove-external-link]")) {
      const row = event.target.closest(".external-link-row");
      row?.remove();
      if (externalLinksList && !externalLinksList.querySelector(".external-link-row")) addExternalLinkRow();
    }

    if (event.target.closest("#closeTaskModal") || event.target.closest("#cancelTaskModal") || event.target === taskModal) closeTaskModal();
    if (event.target.closest("#clearNoteModal")) noteInput.value = "";
    if (event.target.closest("#closeNoteModal") || event.target.closest("#cancelNoteModal") || event.target === noteModal) closeNoteModal();
    if (event.target.closest("#closeDeleteProjectModal") || event.target.closest("#cancelDeleteProjectModal") || event.target === deleteProjectModal) closeDeleteProjectModal();
    if (event.target.closest("#closeDeleteTaskModal") || event.target.closest("#cancelDeleteTaskModal") || event.target === deleteTaskModal) closeDeleteTaskModal();
    if (event.target.closest("#closeProjectDeadlineModal") || event.target.closest("#cancelProjectDeadlineModal") || event.target === projectDeadlineModal) closeProjectDeadlineModal();
    if (event.target.closest("#closePreferencesModal") || event.target.closest("#cancelPreferencesModal") || event.target === preferencesModal) closePreferencesModal();
    if (event.target.closest("#closeProjectModal") || event.target.closest("#cancelProjectModal") || event.target === projectModal) closeProjectModal();

    const archiveSelectModal = document.getElementById("archiveSelectModal");
    if (event.target.closest("#closeArchiveSelectModal") || event.target.closest("#cancelArchiveSelectModal") || event.target === archiveSelectModal) {
      closeArchiveSelectModal();
    }

    if (event.target.closest("#goToArchiveTabBtn")) {
      state.appSettings.globalGraphView = false;
      state.viewMode = "archive";
      saveState();
      closeArchiveSelectModal();
      render();
      return;
    }

    const archiveSelectItemBtn = event.target.closest(".archive-select-item-btn");
    if (archiveSelectItemBtn) {
      const resourceId = Number(archiveSelectItemBtn.dataset.resourceId);
      if (resourceId && state.tempArchiveNodePoint) {
        createGraphArchiveNode(state.tempArchiveNodePoint, resourceId);
      }
      closeArchiveSelectModal();
      return;
    }

    if (!event.target.closest(".app-menu") && !event.target.closest("#fileMenu")) closeFileMenu();
    if (state.graphContextMenu && !event.target.closest(".graph-context-menu")) {
      const canvas = document.querySelector(".graph-canvas");
      state.graphContextMenu = null;
      renderGraphKeepingViewport(canvas);
    }
  });

  document.addEventListener("dblclick", (event) => {
    const canvas = event.target.closest(".graph-canvas");
    if (!canvas) return;

    if (
      event.target.closest(".graph-node") ||
      event.target.closest(".graph-child-project-card") ||
      event.target.closest(".graph-edge-weight-badge") ||
      event.target.closest("button") ||
      event.target.closest("a") ||
      event.target.closest("select") ||
      event.target.closest("textarea") ||
      event.target.closest(".graph-context-menu")
    ) {
      return;
    }

    event.preventDefault();
    const currentProj = getProject(state.selectedProjectId);
    if (currentProj && currentProj.parentId) {
      state.selectedProjectId = Number(currentProj.parentId);
      revealProjectPath(state.selectedProjectId);
      state.graphNotice = "상위 프로젝트 뷰로 올라갔습니다.";
      saveState();
      render();
    }
  });

  document.addEventListener("contextmenu", (event) => {
    if (state.suppressGraphContextMenu) {
      event.preventDefault();
      state.suppressGraphContextMenu = false;
      return;
    }
    const graphSurface = event.target.closest(".graph-canvas, .graph-node");
    if (!graphSurface) return;
    event.preventDefault();
    const canvas = event.target.closest(".graph-canvas");
    const canvasPoint = canvas ? graphPointFromEvent(canvas, event) : { x: 52, y: 52 };

    const childProjectCard = event.target.closest(".graph-child-project-card");
    const projectNode = event.target.closest("[data-graph-project-node]");

    let projectId = state.selectedProjectId;
    if (childProjectCard?.dataset.selectProject) {
      projectId = Number(childProjectCard.dataset.selectProject);
    } else if (projectNode?.dataset.graphProjectNode) {
      projectId = Number(projectNode.dataset.graphProjectNode);
    }

    state.graphContextMenu = {
      x: event.clientX,
      y: event.clientY,
      canvasX: canvasPoint.x,
      canvasY: canvasPoint.y,
      projectId: getProject(projectId) ? projectId : state.selectedProjectId
    };
    renderGraphKeepingViewport(canvas);
  });

  document.addEventListener("pointerdown", (event) => {
    const isRightClick = event.button === 2;
    const isLeftClickWithSpace = event.button === 0 && spacePressed;

    if (isRightClick || isLeftClickWithSpace) {
      const graphStage = event.target.closest(".graph-stage");
      if (graphStage && !event.target.closest(".graph-context-menu") && !event.target.closest(".weight-slider-popup")) {
        event.preventDefault();
        state.graphPan = {
          view: graphStage,
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: graphStage.scrollLeft,
          scrollTop: graphStage.scrollTop,
          moved: false
        };
        graphStage.classList.add("graph-panning");
        return;
      }
    }

    if (event.button === 0 && event.shiftKey) {
      const canvas = event.target.closest(".graph-canvas");
      const interactiveTarget = event.target.closest(".graph-node, .graph-context-menu, .weight-slider-popup, button, input, select, textarea, [data-graph-connect-start], [data-graph-connect-end]");
      if (canvas && !interactiveTarget) {
        event.preventDefault();
        const start = graphPointFromEvent(canvas, event);
        state.graphSelectionDrag = {
          canvas,
          start,
          current: start,
          pointerId: event.pointerId,
          initialSelection: new Set(state.selectedGraphProjectIds || []),
          initialFreeSelection: new Set(state.selectedGraphFreeNodeKeys || []),
          additive: event.shiftKey,
          moved: false
        };
        updateGraphSelectionBox(state.graphSelectionDrag, start);
        canvas.classList.add("graph-selecting");
        canvas.setPointerCapture?.(event.pointerId);
        return;
      }
    }

    const freeNodeDragHandle = event.target.closest("[data-graph-drag-free-node]");
    if (freeNodeDragHandle) {
      const canvas = freeNodeDragHandle.closest(".graph-canvas");
      const nodeElement = freeNodeDragHandle.closest("[data-graph-free-node]");
      if (!canvas || !nodeElement) return;
      event.preventDefault();
      const [type, idText] = freeNodeDragHandle.dataset.graphDragFreeNode.split(":");
      const nodeId = Number(idText);
      const node = type === "memo"
        ? state.appSettings.graphMemoNodes?.find((item) => item.id === nodeId)
        : type === "formula"
          ? state.appSettings.graphFormulaNodes?.find((item) => item.id === nodeId)
          : type === "archive"
            ? state.appSettings.graphArchiveNodes?.find((item) => item.id === nodeId)
            : null;
      if (!node) return;
      const start = graphPointFromEvent(canvas, event);
      const freeKey = `${type}:${nodeId}`;
      if (state.selectedGraphFreeNodeKeys?.has?.(freeKey)) {
        event.preventDefault();
        const freeInitialPositions = getSelectedFreeNodeInitialPositions(canvas, freeKey);
        state.graphDrag = {
          projectId: 0,
          projectIds: [...(state.selectedGraphProjectIds || [])].filter((id) => getProject(id)),
          freeInitialPositions,
          canvas,
          startX: start.x,
          startY: start.y,
          initialPositions: getSelectedProjectInitialPositions(canvas, start),
          pointerId: event.pointerId,
          moved: false
        };
        Object.keys(freeInitialPositions).forEach((key) => {
          canvas.querySelector(`[data-graph-free-node="${key}"]`)?.classList.add("dragging");
        });
        freeNodeDragHandle.setPointerCapture?.(event.pointerId);
        return;
      }
      state.graphFreeNodeDrag = {
        type,
        nodeId,
        canvas,
        startX: start.x,
        startY: start.y,
        initialX: Number(node.x) || start.x,
        initialY: Number(node.y) || start.y,
        pointerId: event.pointerId,
        moved: false
      };
      nodeElement.classList.add("dragging");
      freeNodeDragHandle.setPointerCapture?.(event.pointerId);
      return;
    }

    const dragHandle = event.target.closest("[data-graph-drag-node]");
    if (dragHandle) {
      const canvas = dragHandle.closest(".graph-canvas");
      if (!canvas) return;
      event.preventDefault();
      const projectId = Number(dragHandle.dataset.graphDragNode);
      if (!state.selectedGraphProjectIds.has(projectId)) {
        state.selectedGraphProjectIds = new Set([projectId]);
        state.selectedGraphFreeNodeKeys = new Set();
      }
      const start = graphPointFromEvent(canvas, event);
      const projectIds = [...state.selectedGraphProjectIds].filter((id) => getProject(id));
      const initialPositions = getSelectedProjectInitialPositions(canvas, start, projectId);
      const freeInitialPositions = getSelectedFreeNodeInitialPositions(canvas);
      state.graphDrag = {
        projectId,
        projectIds,
        freeInitialPositions,
        canvas,
        startX: start.x,
        startY: start.y,
        initialPositions,
        pointerId: event.pointerId,
        moved: false
      };
      dragHandle.setPointerCapture?.(event.pointerId);
      return;
    }

    const childProjectDragHandle = event.target.closest("[data-graph-drag-child-project]");
    if (childProjectDragHandle) {
      const canvas = childProjectDragHandle.closest(".graph-canvas");
      const section = childProjectDragHandle.closest(".graph-child-project-section");
      if (!canvas || !section) return;
      event.preventDefault();
      state.graphChildProjectDrag = {
        projectId: Number(childProjectDragHandle.dataset.graphDragChildProject),
        canvas,
        section,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false
      };
      section.classList.add("dragging");
      canvas.classList.add("graph-child-dragging");
      childProjectDragHandle.setPointerCapture?.(event.pointerId);
      return;
    }

    const taskDragHandle = event.target.closest("[data-graph-drag-task]");
    if (taskDragHandle) {
      const canvas = taskDragHandle.closest(".graph-canvas");
      const card = taskDragHandle.closest(".graph-task-card") || taskDragHandle.closest(".graph-node.task") || taskDragHandle;
      const taskId = Number(taskDragHandle.dataset.graphDragTask);
      const task = state.tasks.find((item) => item.id === taskId);
      if (!canvas || !card || !task) return;
      event.preventDefault();
      state.graphTaskDrag = {
        taskId,
        sourceProjectId: task.projectId,
        canvas,
        card,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false
      };
      card.classList.add("dragging");
      canvas.classList.add("graph-task-dragging");
      taskDragHandle.setPointerCapture?.(event.pointerId);
      return;
    }

    const startPort = event.target.closest("[data-graph-connect-start]");
    const endPortDown = event.target.closest("[data-graph-connect-end]");
    if (!startPort && !endPortDown) return;
    event.preventDefault();
    const canvas = (startPort || endPortDown).closest(".graph-canvas");
    if (canvas) {
      if (startPort) {
        state.graphConnectionDirection = "forward";
        state.graphConnectionStartId = Number(startPort.dataset.graphConnectStart);
        state.graphConnectionSourceType = startPort.dataset.graphConnectSource || "project";
        state.graphConnectionMetric = startPort.dataset.graphConnectMetric || "completion";
      } else {
        state.graphConnectionDirection = "backward";
        state.graphConnectionStartId = Number(endPortDown.dataset.graphConnectEnd);
        state.graphConnectionSourceType = endPortDown.dataset.graphConnectTarget || "project";
        state.graphConnectionMetric = endPortDown.dataset.graphConnectMetric || "completion";
      }
      state.graphConnectionDrag = {
        canvas,
        start: graphPointFromElement(canvas, startPort || endPortDown) || graphPointFromEvent(canvas, event)
      };
      updateGraphConnectionPreview(event);
    }
    state.graphNotice = `${state.graphConnectionMetric === "advance" ? "진행도" : "완성도"}를 연결할 프로젝트 포트에 놓으세요.`;
  });

  document.addEventListener("pointermove", (event) => {
    if (state.graphPan) {
      const dx = event.clientX - state.graphPan.startX;
      const dy = event.clientY - state.graphPan.startY;
      state.graphPan.view.scrollLeft = state.graphPan.scrollLeft - dx;
      state.graphPan.view.scrollTop = state.graphPan.scrollTop - dy;
      if (Math.abs(dx) + Math.abs(dy) > 4) state.graphPan.moved = true;
      return;
    }

    if (state.graphSelectionDrag) {
      const current = graphPointFromEvent(state.graphSelectionDrag.canvas, event);
      const rect = updateGraphSelectionBox(state.graphSelectionDrag, current);
      state.graphSelectionDrag.current = current;
      if (rect.width + rect.height > 0.8) state.graphSelectionDrag.moved = true;
      previewGraphSelection(state.graphSelectionDrag, rect);
      return;
    }

    if (state.graphConnectionDrag) {
      updateGraphConnectionPreview(event);
      return;
    }

    if (state.graphFreeNodeDrag) {
      const current = graphPointFromEvent(state.graphFreeNodeDrag.canvas, event);
      const dx = current.x - state.graphFreeNodeDrag.startX;
      const dy = current.y - state.graphFreeNodeDrag.startY;
      const x = Math.max(5, Math.min(1000, state.graphFreeNodeDrag.initialX + dx));
      const y = Math.max(7, Math.min(1000, state.graphFreeNodeDrag.initialY + dy));
      state.graphFreeNodeDrag.moved = true;
      const node = state.graphFreeNodeDrag.type === "memo"
        ? state.appSettings.graphMemoNodes?.find((item) => item.id === state.graphFreeNodeDrag.nodeId)
        : state.graphFreeNodeDrag.type === "formula"
          ? state.appSettings.graphFormulaNodes?.find((item) => item.id === state.graphFreeNodeDrag.nodeId)
          : state.graphFreeNodeDrag.type === "archive"
            ? state.appSettings.graphArchiveNodes?.find((item) => item.id === state.graphFreeNodeDrag.nodeId)
            : null;
      if (node) {
        node.x = x;
        node.y = y;
      }
      const nodeEl = state.graphFreeNodeDrag.canvas.querySelector(`[data-graph-free-node="${state.graphFreeNodeDrag.type}:${state.graphFreeNodeDrag.nodeId}"]`);
      if (nodeEl) {
        nodeEl.style.setProperty("--x", `${x}%`);
        nodeEl.style.setProperty("--y", `${y}%`);
      }
      syncGraphPortEdges(state.graphFreeNodeDrag.canvas);
      return;
    }

    if (state.graphChildProjectDrag) {
      const dx = event.clientX - state.graphChildProjectDrag.startClientX;
      const dy = event.clientY - state.graphChildProjectDrag.startClientY;
      if (Math.abs(dx) + Math.abs(dy) > 4) state.graphChildProjectDrag.moved = true;
      state.graphChildProjectDrag.section.style.transform = `translate(${dx}px, ${dy}px)`;
      state.graphChildProjectDrag.section.style.visibility = "hidden";
      const el = document.elementFromPoint(event.clientX, event.clientY);
      state.graphChildProjectDrag.section.style.visibility = "";
      
      document.querySelectorAll(".graph-node.drop-target, .graph-docking-guide-slot.drop-target").forEach((n) => n.classList.remove("drop-target"));
      
      const hoverSlot = el?.closest?.(".graph-docking-guide-slot");
      const hoverNode = el?.closest?.("[data-graph-project-node]");
      
      if (hoverSlot) {
        hoverSlot.classList.add("drop-target");
        hoverSlot.closest("[data-graph-project-node]")?.classList.add("drop-target");
      } else if (hoverNode) {
        hoverNode.classList.add("drop-target");
        hoverNode.querySelector(".graph-docking-guide-slot")?.classList.add("drop-target");
      }
      return;
    }

    if (state.graphTaskDrag) {
      const dx = event.clientX - state.graphTaskDrag.startClientX;
      const dy = event.clientY - state.graphTaskDrag.startClientY;
      state.graphTaskDrag.moved = true;
      state.graphTaskDrag.card.style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }

    if (!state.graphDrag) return;
    const current = graphPointFromEvent(state.graphDrag.canvas, event);
    const dx = current.x - state.graphDrag.startX;
    const dy = current.y - state.graphDrag.startY;
    state.appSettings.graphNodePositions = { ...(state.appSettings.graphNodePositions || {}) };
    state.graphDrag.moved = true;
    state.graphDrag.projectIds.forEach((projectId) => {
      const initialPosition = state.graphDrag.initialPositions[projectId];
      if (!initialPosition) return;
      const x = Math.max(5, Math.min(1000, initialPosition.x + dx));
      const y = Math.max(7, Math.min(1000, initialPosition.y + dy));
      state.appSettings.graphNodePositions[projectId] = { x, y };
      const node = state.graphDrag.canvas.querySelector(`[data-graph-project-node="${projectId}"]`);
      if (node) {
        node.style.setProperty("--x", `${x}%`);
        node.style.setProperty("--y", `${y}%`);
      }
    });
    Object.entries(state.graphDrag.freeInitialPositions || {}).forEach(([key, initialPosition]) => {
      if (!initialPosition) return;
      const x = Math.max(5, Math.min(1000, initialPosition.x + dx));
      const y = Math.max(7, Math.min(1000, initialPosition.y + dy));
      const nodeData = getGraphFreeNode(initialPosition.type, initialPosition.nodeId);
      if (nodeData) {
        nodeData.x = x;
        nodeData.y = y;
      }
      const node = state.graphDrag.canvas.querySelector(`[data-graph-free-node="${key}"]`);
      if (node) {
        node.style.setProperty("--x", `${x}%`);
        node.style.setProperty("--y", `${y}%`);
      }
    });
    syncGraphPortEdges(state.graphDrag.canvas);

    if (state.graphDrag.projectIds.length === 1 && !Object.keys(state.graphDrag.freeInitialPositions || {}).length) {
      const draggedId = state.graphDrag.projectIds[0];
      const pos = state.appSettings.graphNodePositions[draggedId];
      document.querySelectorAll(".graph-node.drop-target").forEach((n) => n.classList.remove("drop-target"));
      state.graphDrag.dropTargetId = 0;
      if (pos) {
        let closestNode = null;
        let closestDist = 10;
        state.graphDrag.canvas.querySelectorAll("[data-graph-project-node]").forEach((nodeEl) => {
          const id = Number(nodeEl.dataset.graphProjectNode);
          if (id === draggedId) return;
          const nx = Number.parseFloat(nodeEl.style.getPropertyValue("--x")) || 50;
          const ny = Number.parseFloat(nodeEl.style.getPropertyValue("--y")) || 50;
          const dist = Math.sqrt((pos.x - nx) ** 2 + (pos.y - ny) ** 2);
          if (dist < closestDist) { closestDist = dist; closestNode = nodeEl; }
        });
        if (closestNode) {
          closestNode.classList.add("drop-target");
          state.graphDrag.dropTargetId = Number(closestNode.dataset.graphProjectNode);
        }
      }
    }
  });

  document.addEventListener("pointerup", (event) => {
    if (state.graphPan) {
      state.graphPan.view.classList.remove("graph-panning");
      if (state.graphPan.moved) {
        state.suppressGraphContextMenu = true;
        setTimeout(() => {
          state.suppressGraphContextMenu = false;
        }, 0);
      }
      state.graphPan = null;
      return;
    }

    if (state.graphSelectionDrag) {
      const drag = state.graphSelectionDrag;
      const rect = getGraphSelectionRect(drag.start, drag.current || graphPointFromEvent(drag.canvas, event));
      const selectedIds = getGraphSelectableProjectNodes(drag.canvas)
        .filter((node) => isGraphPointInRect(getGraphNodePoint(node), rect))
        .map((node) => Number(node.dataset.graphProjectNode));
      const selectedFreeKeys = getGraphSelectableFreeNodes(drag.canvas)
        .filter((node) => isGraphPointInRect(getGraphNodePoint(node), rect))
        .map((node) => node.dataset.graphFreeNode);
      const nextSelection = new Set(drag.additive ? drag.initialSelection : []);
      const nextFreeSelection = new Set(drag.additive ? drag.initialFreeSelection : []);
      selectedIds.forEach((id) => nextSelection.add(id));
      selectedFreeKeys.forEach((key) => nextFreeSelection.add(key));
      state.selectedGraphProjectIds = nextSelection;
      state.selectedGraphFreeNodeKeys = nextFreeSelection;
      if (selectedIds.length) {
        state.selectedProjectId = selectedIds[selectedIds.length - 1];
      }
      const totalSelected = nextSelection.size + nextFreeSelection.size;
      state.graphNotice = totalSelected
        ? `${totalSelected}개 노드를 선택했습니다. 이동 핸들을 잡으면 함께 움직입니다.`
        : "";
      clearGraphSelectionBox(drag.canvas);
      drag.canvas.classList.remove("graph-selecting");
      state.graphSelectionDrag = null;
      state.suppressGraphClick = true;
      renderGraphKeepingViewport(drag.canvas);
      return;
    }

    if (state.graphFreeNodeDrag) {
      document.querySelectorAll(".graph-node.dragging").forEach((node) => node.classList.remove("dragging"));
      if (state.graphFreeNodeDrag.moved) {
        state.suppressGraphClick = true;
        saveState();
        renderGraphKeepingViewport(state.graphFreeNodeDrag.canvas);
      }
      state.graphFreeNodeDrag = null;
      return;
    }

    if (state.graphChildProjectDrag) {
      const { projectId, section, moved, canvas } = state.graphChildProjectDrag;
      section.classList.remove("dragging");
      section.style.transform = "";
      canvas?.classList?.remove?.("graph-child-dragging");
      document.querySelectorAll(".graph-node.drop-target").forEach((n) => n.classList.remove("drop-target"));
      state.graphChildProjectDrag = null;

      if (moved) {
        state.suppressGraphClick = true;
        section.style.visibility = "hidden";
        const dropEl = document.elementFromPoint(event.clientX, event.clientY);
        section.style.visibility = "";

        const dropSlot = dropEl?.closest?.(".graph-docking-guide-slot");
        const targetProjectNode = dropEl?.closest?.("[data-graph-project-node]");
        const targetChildCard = dropEl?.closest?.(".graph-child-project-card")
          || dropEl?.closest?.(".graph-child-project-wrap")?.querySelector?.(".graph-child-project-card");
        let targetProjectId = 0;
        if (dropSlot?.dataset.graphDockZone) {
          targetProjectId = Number(dropSlot.dataset.graphDockZone);
        } else if (targetChildCard?.dataset.selectProject) {
          targetProjectId = Number(targetChildCard.dataset.selectProject);
        } else if (targetProjectNode?.dataset.graphProjectNode) {
          targetProjectId = Number(targetProjectNode.dataset.graphProjectNode);
        }

        if (!targetProjectId) {
          const project = getProject(projectId);
          if (project && project.parentId) {
            project.parentId = null;
            const canvas = document.querySelector(".graph-canvas");
            if (canvas) {
              const rect = canvas.getBoundingClientRect();
              const x = Math.max(8, Math.min(1000, ((event.clientX - rect.left) / rect.width) * 100));
              const y = Math.max(8, Math.min(1000, ((event.clientY - rect.top) / rect.height) * 100));
              state.appSettings.graphNodePositions = state.appSettings.graphNodePositions || {};
              state.appSettings.graphNodePositions[projectId] = { x, y };
            }
            state.graphNotice = `${project.name}을 독립 프로젝트로 분리했습니다.`;
            logActivity("project", state.graphNotice, projectId);
            saveState();
          }
        } else if (targetProjectId !== projectId) {
          const blocked = new Set([projectId, ...getDescendantProjectIds(projectId)]);
          if (blocked.has(targetProjectId)) {
            state.graphNotice = "순환 구조가 생기는 이동은 할 수 없습니다.";
          } else {
            const project = getProject(projectId);
            if (project) {
              project.parentId = targetProjectId;
              state.graphNotice = `${project.name}을 ${getProject(targetProjectId)?.name || ""}의 하위로 이동했습니다.`;
              logActivity("project", state.graphNotice, targetProjectId);
              saveState();
            }
          }
        }
      }
      render();
      return;
    }

    if (state.graphDrag) {
      if (state.graphDrag.moved) {
        state.suppressGraphClick = true;
        document.querySelectorAll(".graph-node.drop-target").forEach((n) => n.classList.remove("drop-target"));
        const dropTargetId = state.graphDrag.dropTargetId || 0;
        const draggedId = state.graphDrag.projectIds.length === 1 ? state.graphDrag.projectIds[0] : 0;

        if (dropTargetId && draggedId && dropTargetId !== draggedId) {
          const blocked = new Set([dropTargetId, ...getDescendantProjectIds(dropTargetId)]);
          if (!blocked.has(draggedId)) {
            const project = getProject(draggedId);
            if (project) {
              project.parentId = dropTargetId;
              state.graphNotice = `${project.name}을 ${getProject(dropTargetId)?.name || ""}의 하위로 편입했습니다.`;
              logActivity("project", state.graphNotice, dropTargetId);
              saveState();
              state.graphDrag = null;
              render();
              return;
            }
          }
        }

        saveState();
        renderGraphKeepingViewport(state.graphDrag.canvas);
      }
      state.graphDrag = null;
      return;
    }

    if (state.graphTaskDrag) {
      const canvas = state.graphTaskDrag.canvas;
      if (state.graphTaskDrag.moved) {
        state.suppressGraphClick = true;
        finishGraphTaskDrop(event);
      } else {
        state.graphTaskDrag.card.classList.remove("dragging");
        state.graphTaskDrag.card.style.transform = "";
        state.graphTaskDrag = null;
      }
      canvas?.classList?.remove?.("graph-task-dragging");
      return;
    }

    if (!state.graphConnectionStartId) return;

    let sourceId = null;
    let sourceType = null;
    let targetId = null;
    let targetType = null;
    let metric = null;

    if (state.graphConnectionDirection === "backward") {
      const dropPort = event.target.closest("[data-graph-connect-start]")
        || document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-graph-connect-start]");
      if (dropPort) {
        sourceId = Number(dropPort.dataset.graphConnectStart);
        sourceType = dropPort.dataset.graphConnectSource || "project";
        targetId = state.graphConnectionStartId;
        targetType = state.graphConnectionSourceType || "project";
        metric = state.graphConnectionMetric || dropPort.dataset.graphConnectMetric || "completion";
      }
    } else {
      const endPort = event.target.closest("[data-graph-connect-end]")
        || document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-graph-connect-end]");
      if (endPort) {
        sourceId = state.graphConnectionStartId;
        sourceType = state.graphConnectionSourceType || "project";
        targetId = Number(endPort.dataset.graphConnectEnd);
        targetType = endPort.dataset.graphConnectTarget || "project";
        metric = endPort.dataset.graphConnectMetric || state.graphConnectionMetric || "completion";
      } else if (state.graphConnectionSourceType === "archive") {
        const pointEl = document.elementFromPoint(event.clientX, event.clientY);
        const taskCard = pointEl?.closest?.("[data-graph-task-node]") || pointEl?.closest?.(".graph-task-card") || pointEl?.closest?.("[data-graph-drag-task]");
        
        if (taskCard) {
          sourceId = state.graphConnectionStartId;
          sourceType = "archive";
          const rawId = taskCard.dataset.graphTaskNode || taskCard.dataset.openNote || taskCard.dataset.graphDragTask;
          targetId = Number(rawId);
          targetType = "task";
        }
      }
    }

    if (sourceId && targetId) {
      if (sourceType === "archive") {
        if (targetType === "archiveProject") {
          targetType = "project";
        } else if (targetType !== "task") {
          state.graphNotice = "아카이브는 자료 연결 포트나 업무 카드에 연결할 수 있습니다.";
          sourceId = null;
        }
      }

      if (sourceId && sourceType === "archive") {
        state.appSettings.graphArchiveLinks = state.appSettings.graphArchiveLinks || [];
        const linkId = `archive:${sourceId}:${targetType}:${targetId}`;
        if (!state.appSettings.graphArchiveLinks.some(l => l.id === linkId)) {
          state.appSettings.graphArchiveLinks.push({
            id: linkId,
            sourceId,
            targetType,
            targetId
          });
          state.graphNotice = "아카이브 리소스를 연결했습니다.";
          saveState();
        }
      } else if (sourceId && targetType === "formula") {
        applyGraphFormulaInputConnection({
          sourceType,
          sourceId,
          targetId,
          metric,
          weight: 30
        });
      } else if (sourceId && sourceType === "formula") {
        applyGraphFormulaConnection({
          sourceId,
          targetId,
          metric,
          weight: 30
        });
      } else if (sourceId) {
        applyGraphConnection({
          sourceId,
          targetId,
          connectionType: "external",
          metric,
          weight: 30
        });
      }
    } else {
      state.graphNotice = "";
    }
    state.graphConnectionStartId = null;
    state.graphConnectionSourceType = null;
    state.graphConnectionMetric = null;
    state.graphConnectionDirection = null;
    clearGraphConnectionPreview();
    render();
  });

  document.addEventListener("scroll", (event) => {
    if (event.target?.classList?.contains("graph-stage")) {
      updateGraphMinimapViewport();
    }
  }, true);

  document.addEventListener("wheel", (event) => {
    const stage = event.target.closest?.(".graph-stage");
    if (!stage) return;
    if (!stage.closest(".graph-view-full") && !event.ctrlKey && !event.metaKey) return;
    applyGraphWheelZoom(stage, event);
  }, { passive: false });

  window.addEventListener("resize", updateGraphMinimapViewport);

  document.addEventListener("input", (event) => {
    if (event.target === searchInput) {
      state.searchQuery = searchInput.value.trim();
      if (state.viewMode === "archive" && state.appSettings.globalGraphView !== true) {
        render();
      } else {
        renderProjectList();
        renderProjectDetail();
      }
    }

    const taskProgressInput = event.target.closest("[data-task-progress]");
    const taskAdvanceRange = event.target.closest("[data-task-advance]");
    if (taskProgressInput) {
      const task = state.tasks.find((item) => item.id === Number(taskProgressInput.dataset.taskProgress));
      if (!task) return;
      task.progress = clampProgress(taskProgressInput.value);
      const valueLabel = taskProgressInput.closest(".task-completion-control")?.querySelector("strong");
      if (valueLabel) valueLabel.textContent = `${task.progress}%`;
      saveState();
      renderProjectList();
    }

    if (taskAdvanceRange) {
      const task = state.tasks.find((item) => item.id === Number(taskAdvanceRange.dataset.taskAdvance));
      if (!task) return;
      task.advance = clampProgress(taskAdvanceRange.value);
      const valueLabel = taskAdvanceRange.closest(".task-completion-control")?.querySelector("strong");
      if (valueLabel) valueLabel.textContent = `${task.advance}%`;
      saveState();
      renderProjectList();
    }

    if (event.target === taskCompletionInput) {
      taskCompletionValue.textContent = `${clampProgress(taskCompletionInput.value)}%`;
    }
    if (event.target === taskAdvanceInput) {
      taskAdvanceValue.textContent = `${clampProgress(taskAdvanceInput.value)}%`;
    }
    if (event.target === noteTaskCompletionInput) {
      noteTaskCompletionValue.textContent = `${clampProgress(noteTaskCompletionInput.value)}%`;
    }
    if (event.target === noteTaskAdvanceInput) {
      noteTaskAdvanceValue.textContent = `${clampProgress(noteTaskAdvanceInput.value)}%`;
    }
    const memoEditor = event.target.closest("[data-graph-memo-body]");
    if (memoEditor) {
      const memoId = Number(memoEditor.dataset.graphMemoBody);
      const memo = state.appSettings.graphMemoNodes?.find((node) => node.id === memoId);
      if (!memo) return;
      memo.body = memoEditor.value;
      saveState();
    }

    const formulaCompletionInput = event.target.closest("[data-graph-formula-completion]");
    const formulaAdvanceInput = event.target.closest("[data-graph-formula-advance]");
    if (formulaCompletionInput || formulaAdvanceInput) {
      const formulaId = Number(formulaCompletionInput?.dataset.graphFormulaCompletion || formulaAdvanceInput?.dataset.graphFormulaAdvance);
      const formula = state.appSettings.graphFormulaNodes?.find((node) => node.id === formulaId);
      if (!formula) return;
      if (formulaCompletionInput) formula.completion = clampProgress(formulaCompletionInput.value);
      if (formulaAdvanceInput) formula.advance = clampProgress(formulaAdvanceInput.value);
      const label = (formulaCompletionInput || formulaAdvanceInput).closest("label")?.querySelector("strong");
      if (label) label.textContent = `${formulaCompletionInput ? formula.completion : formula.advance}%`;
      saveState();
      renderProjectList();
    }
  });

  document.addEventListener("change", (event) => {
    const archiveSelect = event.target.closest(".graph-archive-select");
    if (archiveSelect) {
      const nodeId = Number(archiveSelect.dataset.archiveNodeId);
      const resourceId = Number(archiveSelect.value) || null;
      const node = state.appSettings.graphArchiveNodes?.find(n => n.id === nodeId);
      if (node) {
        node.resourceId = resourceId;
        
        const mappedRes = (state.archiveResources || []).find((r) => r.id === resourceId);
        if (mappedRes) {
          node.title = mappedRes.name;
          node.path = mappedRes.path;
          node.type = mappedRes.type;
        } else {
          node.title = "[연결할 리소스 선택]";
          node.path = "";
          node.type = "file";
        }
        
        saveState();
        render();
      }
      return;
    }

    if (event.target && event.target.id === "archiveProjectSelect") {
      const selectedId = Number(event.target.value);
      if (selectedId) {
        state.selectedProjectId = selectedId;
        revealProjectPath(selectedId);
        render();
      }
      return;
    }
    const attachArchiveProjectSelect = event.target.closest("[data-attach-archive-project]");
    if (attachArchiveProjectSelect) {
      const projectId = Number(attachArchiveProjectSelect.value);
      if (projectId) {
        attachArchiveResourceToProject(attachArchiveProjectSelect.dataset.attachArchiveProject, projectId);
      }
      return;
    }
    if (event.target === taskProjectInput) {
      const selectedProj = getProject(Number(taskProjectInput.value));
      if (selectedProj) {
        modalProjectName.textContent = selectedProj.name;
      }
      return;
    }
    if (event.target === darkModeInput) {
      toggleThemeMode();
      return;
    }
    if (event.target === preferencesPinInput) {
      setPinnedState(preferencesPinInput.checked);
      return;
    }

    const typeSelect = event.target.closest(".graph-formula-type-select");
    if (typeSelect) {
      const formulaId = Number(typeSelect.dataset.formulaId);
      const formula = state.appSettings.graphFormulaNodes?.find((node) => node.id === formulaId);
      if (formula) {
        formula.formulaType = typeSelect.value;
        saveState();
        const canvas = typeSelect.closest(".graph-canvas");
        if (canvas) {
          renderGraphKeepingViewport(canvas);
        } else {
          renderProjectDetail();
        }
      }
      return;
    }

    const weightInput = event.target.closest(".formula-slot-weight-input");
    if (weightInput) {
      const formulaId = Number(weightInput.dataset.formulaId);
      const sourceId = Number(weightInput.dataset.sourceId);
      const sourceType = weightInput.dataset.sourceType;
      const metric = weightInput.dataset.metric;
      const value = Math.max(0, Math.min(100, Number(weightInput.value) || 0));

      const link = (state.appSettings.graphFormulaInputLinks || []).find((l) =>
        l.targetId === formulaId &&
        l.sourceId === sourceId &&
        l.sourceType === sourceType &&
        l.metric === metric
      );
      if (link) {
        link.weight = value;
        saveState();
        const canvas = weightInput.closest(".graph-canvas");
        if (canvas) {
          renderGraphKeepingViewport(canvas);
        } else {
          renderProjectDetail();
        }
      }
      return;
    }

    const completionWeightInput = event.target.closest("[data-completion-weight]");
    if (completionWeightInput) {
      setCompletionWeight(
        Number(completionWeightInput.dataset.weightProject),
        completionWeightInput.dataset.completionWeight,
        completionWeightInput.value
      );
      saveState();
      renderProjectList();
      renderProjectDetail();
      return;
    }
    const changedTaskProgress = event.target.closest("[data-task-progress]");
    const changedTaskAdvance = event.target.closest("[data-task-advance]");
    if (changedTaskProgress || changedTaskAdvance) {
      const taskId = Number(changedTaskProgress?.dataset.taskProgress || changedTaskAdvance?.dataset.taskAdvance);
      const task = state.tasks.find((item) => item.id === taskId);
      if (task) logActivity("task", `${task.name} ${changedTaskProgress ? "완성도" : "진행도"} 조정`, task.projectId);
      saveState();
      renderProjectDetail();
    }
    if (event.target.closest("[data-graph-formula-completion], [data-graph-formula-advance]")) {
      saveState();
      renderProjectDetail();
      return;
    }
    if (event.target === taskContributionModeInput) updateTaskContributionFields(taskContributionModeInput.value);
    if (event.target === noteTaskContributionModeInput) updateNoteContributionFields(noteTaskContributionModeInput.value);
  });

  document.addEventListener("submit", (event) => {
    event.preventDefault();

    if (event.target.matches("#projectForm")) {
      const name = projectNameInput.value.trim();
      if (!name) return;
      const id = createId(state.projects);
      state.projects = [...state.projects, {
        id,
        parentId: projectParentInput?.value ? Number(projectParentInput.value) : null,
        name,
        status: projectStatusInput.value,
        progress: 0,
        advance: 0,
        contributionMode: "both",
        deadline: newProjectNoDeadline.checked ? null : newProjectDeadlineInput.value,
        note: projectNoteInput.value.trim() || "새 프로젝트"
      }];
      state.selectedProjectId = id;
      state.projectFilter = "all";
      state.detailFilter = "all";
      closeProjectModal();
      render();
      return;
    }

    if (event.target.matches("#projectDeadlineForm")) {
      const project = getProject(state.editingProjectDeadlineId);
      if (project) {
        const name = editProjectNameInput.value.trim();
        if (!name) return;
        const previousParentId = project.parentId;
        const nextParentId = editProjectParentInput.value ? Number(editProjectParentInput.value) : null;
        const blockedParentIds = new Set([project.id, ...getDescendantProjectIds(project.id)]);
        if (nextParentId && blockedParentIds.has(nextParentId)) return;
        project.name = name;
        project.parentId = nextParentId;
        project.contributionMode = editContributionModeInput.value || "both";
        project.note = editProjectNoteInput.value.trim();
        project.deadline = clearProjectDeadline.checked ? null : projectDeadlineInput.value;
        state.projectLinks = state.projectLinks.filter((link) => link.sourceId !== project.id);
        const targets = new Set();
        externalLinksList?.querySelectorAll(".external-link-row").forEach((row) => {
          const targetId = Number(row.querySelector("[data-external-target]")?.value || 0);
          const metric = row.querySelector("[data-external-metric]")?.value || "completion";
          const weight = Math.max(5, Math.min(90, Number(row.querySelector("[data-external-weight]")?.value) || 30));
          const key = `${targetId}:${metric}`;
          if (!targetId || targetId === project.id || targets.has(key)) return;
          targets.add(key);
          state.projectLinks.push({ sourceId: project.id, targetId, metric, weight });
        });
        state.projectLinks = normalizeProjectLinks(state.projectLinks, state.projects);
        if (previousParentId) pruneCompletionWeights(previousParentId);
        if (nextParentId) pruneCompletionWeights(nextParentId);
      }
      closeProjectDeadlineModal();
      render();
      return;
    }

    if (event.target.matches("#deleteProjectForm")) {
      const project = getProject(state.deletingProjectId);
      if (!project || deleteProjectInput.value.trim() !== project.name) return;
      const deleteIds = [state.deletingProjectId, ...getDescendantProjectIds(state.deletingProjectId)];
      const affectedWeightParentIds = Object.keys(state.completionWeights || {}).map(Number);
      state.projects = state.projects.filter((item) => !deleteIds.includes(item.id));
      state.tasks = state.tasks.filter((task) => !deleteIds.includes(task.projectId));
      state.appSettings.focusedTaskIds = (state.appSettings.focusedTaskIds || []).filter((id) => state.tasks.some((task) => task.id === Number(id)));
      state.projectLinks = state.projectLinks.filter((link) => !deleteIds.includes(link.sourceId) && !deleteIds.includes(link.targetId));
      state.appSettings.graphFormulaLinks = (state.appSettings.graphFormulaLinks || []).filter((link) => !deleteIds.includes(link.targetId));
      state.appSettings.graphFormulaInputLinks = (state.appSettings.graphFormulaInputLinks || [])
        .filter((link) => !(link.sourceType === "project" && deleteIds.includes(link.sourceId)));
      affectedWeightParentIds.forEach((id) => pruneCompletionWeights(id));
      deleteIds.forEach((id) => state.expandedProjectIds.delete(id));
      state.selectedProjectId = state.projects[0]?.id || null;
      closeDeleteProjectModal();
      render();
      return;
    }

    if (event.target.matches("#deleteTaskForm")) {
      const deletingTask = state.tasks.find((task) => task.id === state.deletingTaskId);
      state.tasks = state.tasks.filter((task) => task.id !== state.deletingTaskId);
      state.appSettings.focusedTaskIds = (state.appSettings.focusedTaskIds || []).filter((id) => Number(id) !== Number(state.deletingTaskId));
      if (deletingTask?.projectId) pruneCompletionWeights(deletingTask.projectId);
      closeDeleteTaskModal();
      render();
      return;
    }

    if (event.target.matches("#noteForm")) {
      const task = state.tasks.find((item) => item.id === state.editingNoteTaskId);
      if (task) {
        const name = noteTaskNameInput.value.trim();
        if (!name) return;
        const originalProjectId = task.projectId;
        const targetProjectId = noteTaskProjectInput.value ? Number(noteTaskProjectInput.value) : null;
        task.name = name;
        task.contributionMode = noteTaskContributionModeInput.value || "both";
        task.note = noteInput.value.trim();
        
        if (noteTaskCompletionInput) {
          task.progress = clampProgress(noteTaskCompletionInput.value);
        }
        if (noteTaskAdvanceInput) {
          task.advance = clampProgress(noteTaskAdvanceInput.value);
        }
        
        if (targetProjectId !== originalProjectId) {
          task.projectId = targetProjectId;
          if (targetProjectId && state.appSettings.graphTaskPositions) {
            delete state.appSettings.graphTaskPositions[task.id];
          }
          logActivity("task", targetProjectId ? `${task.name}의 소속 프로젝트를 이동했습니다.` : `${task.name}을 독립 할일로 전환했습니다.`, targetProjectId);
        }
        if (originalProjectId) pruneCompletionWeights(originalProjectId);
        if (targetProjectId && targetProjectId !== originalProjectId) pruneCompletionWeights(targetProjectId);
      }
      closeNoteModal();
      saveState();
      render();
      return;
    }

    if (event.target.matches("#taskForm")) {
      const input = $("#taskInput");
      const name = input.value.trim();
      if (!name) return;
      const targetProjectId = Number(taskProjectInput.value || state.selectedProjectId);
      state.tasks = [{
        id: createId(state.tasks),
        name,
        projectId: targetProjectId,
        progress: clampProgress(taskCompletionInput.value),
        advance: clampProgress(taskAdvanceInput.value),
        contributionMode: taskContributionModeInput.value || "both",
        note: ""
      }, ...state.tasks];
      input.value = "";
      closeTaskModal();
      render();
    }

    if (event.target.matches("#preferencesForm")) {
      state.appSettings.theme = darkModeInput.checked ? "dark" : "light";
      if (!state.appSettings.shortcuts) state.appSettings.shortcuts = {};
      state.appSettings.shortcuts.toggleGraph = shortcutToggleGraph.value || "g";
      state.appSettings.shortcuts.openFocusWidget = shortcutOpenFocusWidget.value || "f";
      state.appSettings.shortcuts.toggleSearch = shortcutToggleSearch.value || "s";
      state.appSettings.shortcuts.toggleTheme = shortcutToggleTheme.value || "m";
      applyTheme();
      saveState();
      setPinnedState(preferencesPinInput.checked);
      closePreferencesModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea, select") && !event.target.classList.contains("shortcut-input")) return;
    if (event.target.classList.contains("shortcut-input")) return;

    if (event.target.closest?.("[data-completion-weight]")) return;
    const rollupToggle = event.target.closest?.("[data-rollup-toggle]");
    if (rollupToggle && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      const metric = rollupToggle.dataset.rollupToggle;
      state.expandedRollupMetric = state.expandedRollupMetric === metric ? null : metric;
      renderProjectDetail();
      return;
    }

    if (event.key === " " && !event.target.matches("input, textarea, select")) {
      if (!spacePressed) {
        spacePressed = true;
        const graphStage = document.querySelector(".graph-stage");
        graphStage?.classList.add("space-panning-active");
      }
    }

    const key = event.key === " " ? "Space" : (event.key.length === 1 ? event.key.toLowerCase() : event.key);
    const shortcuts = state.appSettings.shortcuts || {
      toggleGraph: "g",
      openFocusWidget: "f",
      toggleSearch: "s",
      toggleTheme: "m"
    };

    if (key === shortcuts.toggleGraph) {
      event.preventDefault();
      closeFileMenu();
      // 3단계 순환: 상세 → 구조 지도 → 아카이브 → 상세
      if (state.appSettings.globalGraphView === true) {
        // 구조 지도 → 아카이브
        state.appSettings.globalGraphView = false;
        state.viewMode = "archive";
      } else if (state.viewMode === "archive") {
        // 아카이브 → 상세
        state.viewMode = "detail";
      } else {
        // 상세(또는 기타) → 구조 지도
        state.appSettings.globalGraphView = true;
      }
      saveState();
      render();
      return;
    }

    if (key === shortcuts.openFocusWidget) {
      event.preventDefault();
      closeFileMenu();
      window.workshopApp?.openFocusWidget?.();
      return;
    }

    if (key === shortcuts.toggleSearch) {
      event.preventDefault();
      state.isSearchOpen = !state.isSearchOpen;
      renderSearch();
      if (state.isSearchOpen) searchInput?.focus();
      return;
    }

    if (key === shortcuts.toggleTheme) {
      event.preventDefault();
      closeFileMenu();
      toggleThemeMode();
      return;
    }

    if (event.key !== "Escape") return;
    if (!taskModal.hidden) closeTaskModal();
    if (!noteModal.hidden) closeNoteModal();
    if (!deleteProjectModal.hidden) closeDeleteProjectModal();
    if (!deleteTaskModal.hidden) closeDeleteTaskModal();
    if (!projectDeadlineModal.hidden) closeProjectDeadlineModal();
    if (!preferencesModal.hidden) closePreferencesModal();
    if (!projectModal.hidden) closeProjectModal();
    if (!weightSliderPopup.hidden) hideWeightSliderPopup();
    closeFileMenu();
  });

  clearProjectDeadline.addEventListener("change", () => {
    projectDeadlineInput.disabled = clearProjectDeadline.checked;
  });

  newProjectNoDeadline.addEventListener("change", () => {
    newProjectDeadlineInput.disabled = newProjectNoDeadline.checked;
  });

  deleteProjectInput.addEventListener("input", () => {
    const project = getProject(state.deletingProjectId);
    confirmDeleteProject.disabled = !project || deleteProjectInput.value.trim() !== project.name;
  });

  pinToggle.addEventListener("click", async () => {
    const next = pinToggle.getAttribute("aria-pressed") !== "true";
    setPinnedState(next);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === " ") {
      spacePressed = false;
      const graphStage = document.querySelector(".graph-stage");
      graphStage?.classList.remove("space-panning-active");
    }
  });

  const shortcutInputs = [shortcutToggleGraph, shortcutOpenFocusWidget, shortcutToggleSearch, shortcutToggleTheme];
  shortcutInputs.forEach((input) => {
    if (!input) return;
    input.addEventListener("keydown", (e) => {
      e.preventDefault();
      let key = e.key;
      if (key === " ") key = "Space";
      if (key.length === 1) key = key.toLowerCase();
      if (["control", "shift", "alt", "meta", "escape", "tab"].includes(key.toLowerCase())) return;
      input.value = key;
    });
  });

  weightSliderInput.addEventListener("input", (e) => {
    const activeLinkRef = activeWeightRefs.activeLinkRef;
    const activeFormulaLinkRef = activeWeightRefs.activeFormulaLinkRef;
    const activeFormulaInputLinkRef = activeWeightRefs.activeFormulaInputLinkRef;
    const activeInternalWeightRef = activeWeightRefs.activeInternalWeightRef;
    const activeWeightBadgeEl = activeWeightRefs.activeWeightBadgeEl;

    if (!activeLinkRef && !activeFormulaLinkRef && !activeFormulaInputLinkRef && !activeInternalWeightRef) return;
    const nextVal = Number(e.target.value);
    weightSliderValue.textContent = `${nextVal}%`;
    if (activeLinkRef) {
      activeLinkRef.weight = nextVal;
    }
    if (activeFormulaLinkRef) {
      activeFormulaLinkRef.weight = nextVal;
    }
    if (activeFormulaInputLinkRef) {
      activeFormulaInputLinkRef.weight = nextVal;
    }
    if (activeInternalWeightRef) {
      setCompletionWeight(activeInternalWeightRef.projectId, activeInternalWeightRef.key, nextVal);
    }
    if (activeWeightBadgeEl?.isConnected) {
      activeWeightBadgeEl.textContent = activeWeightBadgeEl.dataset.graphWeightBadge ? `${nextVal}%` : `\uBC18\uC601\uBE44 ${nextVal}%`;
      const ariaText = activeWeightBadgeEl.getAttribute("aria-label") || "\uBC18\uC601 \uBE44\uC728";
      activeWeightBadgeEl.setAttribute("aria-label", ariaText.includes("%") ? ariaText.replace(/\d+%/, `${nextVal}%`) : `${ariaText} ${nextVal}%`);
    }
    saveState();
  });

  weightSliderInput.addEventListener("change", () => {
    const activeLinkRef = activeWeightRefs.activeLinkRef;
    const activeFormulaLinkRef = activeWeightRefs.activeFormulaLinkRef;
    const activeFormulaInputLinkRef = activeWeightRefs.activeFormulaInputLinkRef;
    const activeInternalWeightRef = activeWeightRefs.activeInternalWeightRef;

    if (!activeLinkRef && !activeFormulaLinkRef && !activeFormulaInputLinkRef && !activeInternalWeightRef) return;
    renderProjectList();
    renderProjectDetail();
  });

  document.addEventListener("submit", (event) => {
    const editArchiveForm = event.target.closest("[data-edit-archive-form]");
    if (editArchiveForm) {
      event.preventDefault();
      const resourceId = Number(editArchiveForm.dataset.editArchiveForm);
      updateArchiveResource(resourceId, {
        name: editArchiveForm.querySelector("[data-edit-archive-name]")?.value || "",
        type: editArchiveForm.querySelector("[data-edit-archive-type]")?.value || "file",
        desc: editArchiveForm.querySelector("[data-edit-archive-desc]")?.value || "",
        path: editArchiveForm.querySelector("[data-edit-archive-path]")?.value || "",
        tags: editArchiveForm.querySelector("[data-edit-archive-tags]")?.value || ""
      });
      return;
    }

    const addForm = event.target.closest("#addArchiveForm");
    if (addForm) {
      event.preventDefault();
      const nameInput = $("#newArchiveName");
      const typeInput = $("#newArchiveType");
      const descInput = $("#newArchiveDesc");
      const pathInput = $("#newArchivePath");
      const tagsInput = $("#newArchiveTags");
      if (nameInput && typeInput && pathInput) {
        const desc = descInput ? descInput.value : "";
        const tags = tagsInput ? tagsInput.value : "";
        addArchiveResource(nameInput.value, typeInput.value, pathInput.value, desc, null, tags);
        nameInput.value = "";
        pathInput.value = "";
        if (descInput) descInput.value = "";
        if (tagsInput) tagsInput.value = "";
      }
    }
  });

  // ── 아카이브 드래그 앤 드롭 파일 인제스트 ──
  const archiveFullViewEl = document.getElementById("archiveFullView");

  if (archiveFullViewEl) {
    archiveFullViewEl.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const overlay = document.getElementById("archiveDropOverlay");
      if (overlay) overlay.hidden = false;
    });

    archiveFullViewEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const overlay = document.getElementById("archiveDropOverlay");
      if (overlay) overlay.hidden = false;
    });

    archiveFullViewEl.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!archiveFullViewEl.contains(e.relatedTarget)) {
        const overlay = document.getElementById("archiveDropOverlay");
        if (overlay) overlay.hidden = true;
      }
    });

    archiveFullViewEl.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const overlay = document.getElementById("archiveDropOverlay");
      if (overlay) overlay.hidden = true;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.path) {
            const type = file.type === "" && !file.name.includes(".") ? "folder" : "file";
            addArchiveResource(file.name, type, file.path);
          }
        }
      }
    });
  }
}
