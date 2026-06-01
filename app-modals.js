import {
  state,
  saveState
} from "./state.js";

import {
  getProject,
  getCompletionWeight
} from "./calculator.js";

import {
  escapeHtml,
  dateFromOffset
} from "./ui-components.js";

const $ = (selector) => document.querySelector(selector);

// DOM REFS for modals
const taskModal = $("#taskModal");
const modalProjectName = $("#modalProjectName");
const taskContributionModeInput = $("#taskContributionModeInput");
const taskCompletionInput = $("#taskCompletionInput");
const taskCompletionValue = $("#taskCompletionValue");
const taskAdvanceInput = $("#taskAdvanceInput");
const taskAdvanceValue = $("#taskAdvanceValue");
const taskProjectInput = $("#taskProjectInput");

const noteModal = $("#noteModal");
const noteTaskName = $("#noteTaskName");
const noteTaskNameInput = $("#noteTaskNameInput");
const noteTaskContributionModeInput = $("#noteTaskContributionModeInput");
const noteInput = $("#noteInput");
const noteTaskProjectInput = $("#noteTaskProjectInput");
const noteTaskCompletionInput = $("#noteTaskCompletionInput");
const noteTaskCompletionValue = $("#noteTaskCompletionValue");
const noteTaskAdvanceInput = $("#noteTaskAdvanceInput");
const noteTaskAdvanceValue = $("#noteTaskAdvanceValue");

const deleteProjectModal = $("#deleteProjectModal");
const deleteProjectName = $("#deleteProjectName");
const deleteProjectInput = $("#deleteProjectInput");
const confirmDeleteProject = $("#confirmDeleteProject");

const deleteTaskModal = $("#deleteTaskModal");
const deleteTaskName = $("#deleteTaskName");

const projectDeadlineModal = $("#projectDeadlineModal");
const deadlineProjectName = $("#deadlineProjectName");
const editProjectNameInput = $("#editProjectNameInput");
const editProjectParentInput = $("#editProjectParentInput");
const editContributionModeInput = $("#editContributionModeInput");
const editProjectNoteInput = $("#editProjectNoteInput");
const externalLinksList = $("#externalLinksList");
const projectDeadlineInput = $("#projectDeadlineInput");
const clearProjectDeadline = $("#clearProjectDeadline");

const preferencesModal = $("#preferencesModal");
const preferencesPinInput = $("#preferencesPinInput");
const shortcutToggleGraph = $("#shortcutToggleGraph");
const shortcutOpenFocusWidget = $("#shortcutOpenFocusWidget");
const shortcutToggleSearch = $("#shortcutToggleSearch");
const shortcutToggleTheme = $("#shortcutToggleTheme");

const projectModal = $("#projectModal");
const projectNameInput = $("#projectNameInput");
const projectParentInput = $("#projectParentInput");
const projectStatusInput = $("#projectStatusInput");
const newProjectDeadlineInput = $("#newProjectDeadlineInput");
const newProjectNoDeadline = $("#newProjectNoDeadline");
const projectNoteInput = $("#projectNoteInput");

const weightSliderPopup = $("#weightSliderPopup");
const weightSliderInput = $("#weightSliderInput");
const weightSliderValue = $("#weightSliderValue");
const pinToggle = $("#pinToggle");

const archiveSelectModal = $("#archiveSelectModal");
const archiveSelectModalList = $("#archiveSelectModalList");

export const activeWeightRefs = {
  activeLinkRef: null,
  activeFormulaLinkRef: null,
  activeFormulaInputLinkRef: null,
  activeInternalWeightRef: null,
  activeWeightBadgeEl: null
};

// ── UTILITY FUNCTIONS ──
export function getAllProjectRows() {
  const rows = [];
  const visited = new Set();
  function walk(parentId, depth) {
    state.projects.filter((project) => project.parentId === parentId).forEach((project) => {
      if (visited.has(project.id)) return;
      visited.add(project.id);
      rows.push({ project, depth });
      walk(project.id, depth + 1);
    });
  }
  walk(null, 0);
  state.projects.filter((project) => !visited.has(project.id)).forEach((project) => rows.push({ project, depth: 0 }));
  return rows;
}

export function renderParentOptions() {
  if (!projectParentInput) return;
  const rows = getAllProjectRows();
  projectParentInput.innerHTML = [
    '<option value="">없음 - 최상위 프로젝트</option>',
    ...rows.map(({ project, depth }) => `<option value="${project.id}">${"&nbsp;".repeat(depth * 4)}${escapeHtml(project.name)}</option>`)
  ].join("");
}

export function renderEditParentOptions(projectId) {
  if (!editProjectParentInput) return;
  const descendants = new Set();
  function walk(parentId) {
    state.projects.filter(p => p.parentId === parentId).forEach(p => {
      if (descendants.has(p.id)) return;
      descendants.add(p.id);
      walk(p.id);
    });
  }
  walk(Number(projectId));

  const blocked = new Set([Number(projectId), ...descendants]);
  editProjectParentInput.innerHTML = [
    '<option value="">없음 - 최상위 프로젝트</option>',
    ...getAllProjectRows()
      .filter(({ project }) => !blocked.has(project.id))
      .map(({ project, depth }) => `<option value="${project.id}">${"&nbsp;".repeat(depth * 4)}${escapeHtml(project.name)}</option>`)
  ].join("");
}

export function externalTargetOptionsMarkup(projectId, selectedTargetId = "") {
  const blocked = new Set([Number(projectId)]);
  return [
    '<option value="">선택 안 함</option>',
    ...getAllProjectRows()
      .filter(({ project }) => !blocked.has(project.id))
      .map(({ project, depth }) => `<option value="${project.id}" ${Number(selectedTargetId) === project.id ? "selected" : ""}>${"&nbsp;".repeat(depth * 4)}${escapeHtml(project.name)}</option>`)
  ].join("");
}

export function getOutgoingLinks(projectId) {
  return state.projectLinks.filter((link) => link.sourceId === Number(projectId));
}

export function renderExternalLinkRows(projectId) {
  if (!externalLinksList) return;
  const outgoing = getOutgoingLinks(projectId);
  const rows = outgoing.length ? outgoing : [{ targetId: "", metric: "completion", weight: 30 }];
  externalLinksList.innerHTML = rows.map((link) => `
    <div class="external-link-row">
      <select data-external-target>${externalTargetOptionsMarkup(projectId, link.targetId)}</select>
      <select data-external-metric>
        <option value="completion" ${link.metric === "completion" ? "selected" : ""}>완성도</option>
        <option value="advance" ${link.metric === "advance" ? "selected" : ""}>진행도</option>
        <option value="both" ${link.metric === "both" ? "selected" : ""}>둘 다</option>
      </select>
      <input data-external-weight type="number" min="5" max="90" step="5" value="${link.weight || 30}" aria-label="반영 비율" />
      <button type="button" data-remove-external-link aria-label="반영 삭제">×</button>
    </div>
  `).join("");
}

export function addExternalLinkRow() {
  if (!externalLinksList || state.editingProjectDeadlineId === null) return;
  externalLinksList.insertAdjacentHTML("beforeend", `
    <div class="external-link-row">
      <select data-external-target>${externalTargetOptionsMarkup(state.editingProjectDeadlineId)}</select>
      <select data-external-metric>
        <option value="completion">완성도</option>
        <option value="advance">진행도</option>
        <option value="both">둘 다</option>
      </select>
      <input data-external-weight type="number" min="5" max="90" step="5" value="30" aria-label="반영 비율" />
      <button type="button" data-remove-external-link aria-label="반영 삭제">×</button>
    </div>
  `);
}

// ── OPEN/CLOSE MODALS ──
export function openTaskModal() {
  const project = getProject(state.selectedProjectId);
  if (!project) return;

  if (taskProjectInput) {
    const rows = getAllProjectRows();
    taskProjectInput.innerHTML = rows.map(({ project, depth }) => {
      return `<option value="${project.id}">${"&nbsp;".repeat(depth * 4)}${escapeHtml(project.name)}</option>`;
    }).join("");
    taskProjectInput.value = project.id;
  }

  modalProjectName.textContent = project.name;
  taskModal.hidden = false;
  $("#taskInput").value = "";
  taskContributionModeInput.value = "both";
  taskCompletionInput.value = "0";
  taskCompletionValue.textContent = "0%";
  taskAdvanceInput.value = "0";
  taskAdvanceValue.textContent = "0%";
  updateTaskContributionFields(taskContributionModeInput.value);
  $("#taskInput").focus();
}

export function closeTaskModal() {
  taskModal.hidden = true;
}

export function updateTaskContributionFields(mode) {
  taskModal.querySelector('[data-task-field="completion"]')?.toggleAttribute("hidden", mode === "advance");
  taskModal.querySelector('[data-task-field="advance"]')?.toggleAttribute("hidden", mode === "completion");
}

export function updateNoteContributionFields(mode) {
  noteModal.querySelector('[data-note-field="completion"]')?.toggleAttribute("hidden", mode === "advance");
  noteModal.querySelector('[data-note-field="advance"]')?.toggleAttribute("hidden", mode === "completion");
}

export function openNoteModal(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  state.editingNoteTaskId = taskId;

  if (noteTaskProjectInput) {
    const rows = getAllProjectRows();
    noteTaskProjectInput.innerHTML = [
      `<option value="">독립 할일</option>`,
      ...rows.map(({ project, depth }) => {
        return `<option value="${project.id}">${"&nbsp;".repeat(depth * 4)}${escapeHtml(project.name)}</option>`;
      })
    ].join("");
    noteTaskProjectInput.value = task.projectId || "";
  }

  noteTaskName.textContent = task.name;
  noteTaskNameInput.value = task.name;
  noteTaskContributionModeInput.value = task.contributionMode || "both";

  if (noteTaskCompletionInput) {
    noteTaskCompletionInput.value = task.progress || 0;
    noteTaskCompletionValue.textContent = `${task.progress || 0}%`;
  }
  if (noteTaskAdvanceInput) {
    noteTaskAdvanceInput.value = task.advance || 0;
    noteTaskAdvanceValue.textContent = `${task.advance || 0}%`;
  }

  updateNoteContributionFields(task.contributionMode || "both");

  noteInput.value = task.note || "";

  const noteArchiveContainer = noteModal.querySelector(".note-archive-section") 
    || (() => {
         const div = document.createElement("div");
         div.className = "note-archive-section";
         noteModal.querySelector(".modal-actions").before(div);
         return div;
       })();

  const archiveLinks = (state.appSettings.graphArchiveLinks || [])
    .filter(link => link.targetType === "task" && link.targetId === taskId);
  
  if (archiveLinks.length > 0) {
    const listHtml = archiveLinks.map(link => {
      const node = (state.appSettings.graphArchiveNodes || []).find(n => n.id === link.sourceId);
      if (!node) return "";
      let icon = "📄";
      if (node.type === "folder") icon = "📁";
      if (node.type === "link") icon = "🔗";
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--panel-raised); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 4px; font-size: 11px;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">
            ${icon} <strong>${escapeHtml(node.title)}</strong> <small style="color: var(--muted)">(${escapeHtml(node.path)})</small>
          </span>
          <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(node.path)}" data-archive-type="${node.type}" style="padding: 3px 6px; font-size: 10px; border-radius: 4px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; color: var(--text);">열기</button>
        </div>
      `;
    }).join("");
    noteArchiveContainer.innerHTML = `
      <div style="margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 10px; text-align: left;">
        <span style="font-size: 11px; font-weight: bold; color: var(--muted); display: block; margin-bottom: 6px;">연결된 아카이브 리소스</span>
        ${listHtml}
      </div>
    `;
  } else {
    noteArchiveContainer.innerHTML = "";
  }

  noteModal.hidden = false;
  noteTaskNameInput.focus();
}

export function closeNoteModal() {
  noteModal.hidden = true;
  state.editingNoteTaskId = null;
}

export function openDeleteProjectModal(projectId = state.selectedProjectId) {
  state.selectedProjectId = Number(projectId);
  const project = getProject(state.selectedProjectId);
  if (!project) return;
  state.deletingProjectId = state.selectedProjectId;
  deleteProjectName.textContent = project.name;
  deleteProjectInput.value = "";
  confirmDeleteProject.disabled = true;
  deleteProjectModal.hidden = false;
  deleteProjectInput.focus();
}

export function closeDeleteProjectModal() {
  deleteProjectModal.hidden = true;
  state.deletingProjectId = null;
}

export function openDeleteTaskModal(taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  state.deletingTaskId = taskId;
  deleteTaskName.textContent = task.name;
  deleteTaskModal.hidden = false;
}

export function closeDeleteTaskModal() {
  deleteTaskModal.hidden = true;
  state.deletingTaskId = null;
}

export function openProjectDeadlineModal(projectId = state.selectedProjectId) {
  state.selectedProjectId = Number(projectId);
  const project = getProject(state.selectedProjectId);
  if (!project) return;
  state.editingProjectDeadlineId = state.selectedProjectId;
  renderEditParentOptions(project.id);
  renderExternalLinkRows(project.id);
  deadlineProjectName.textContent = project.name;
  editProjectNameInput.value = project.name;
  editProjectParentInput.value = project.parentId || "";
  editContributionModeInput.value = project.contributionMode || "both";
  editProjectNoteInput.value = project.note || "";
  projectDeadlineInput.value = project.deadline || dateFromOffset(7);
  clearProjectDeadline.checked = !project.deadline;
  projectDeadlineInput.disabled = clearProjectDeadline.checked;
  projectDeadlineModal.hidden = false;
  projectDeadlineInput.focus();
}

export function closeProjectDeadlineModal() {
  projectDeadlineModal.hidden = true;
  state.editingProjectDeadlineId = null;
}

export function openWeightSliderPopup(badge) {
  if (!weightSliderPopup || !weightSliderInput || !weightSliderValue) return;
  const badgeId = badge.dataset.graphWeightBadge || "";
  const internalId = badge.dataset.graphInternalWeight || "";
  let weight = null;

  activeWeightRefs.activeLinkRef = null;
  activeWeightRefs.activeFormulaLinkRef = null;
  activeWeightRefs.activeFormulaInputLinkRef = null;
  activeWeightRefs.activeInternalWeightRef = null;
  activeWeightRefs.activeWeightBadgeEl = badge;

  if (badgeId) {
    const parts = badgeId.split(":");
    const linkType = parts.length >= 4 ? parts.shift() : "external";
    const sourceType = linkType === "formulaIn" ? parts.shift() : null;
    const [sourceId, targetId, metric] = parts;
    const linkSource = linkType === "formulaIn"
      ? (state.appSettings.graphFormulaInputLinks || [])
      : linkType === "formula"
        ? (state.appSettings.graphFormulaLinks || [])
        : state.projectLinks;
    const link = linkSource.find((l) => {
      const sameSourceType = linkType !== "formulaIn" || l.sourceType === sourceType;
      return sameSourceType && l.sourceId === Number(sourceId) && l.targetId === Number(targetId) && l.metric === metric;
    });
    if (!link) return;
    if (linkType === "formulaIn") {
      activeWeightRefs.activeFormulaInputLinkRef = link;
    } else if (linkType === "formula") {
      activeWeightRefs.activeFormulaLinkRef = link;
    } else {
      activeWeightRefs.activeLinkRef = link;
    }
    weight = link.weight;
  } else if (internalId) {
    const parts = internalId.split(":");
    const projectId = parts.shift();
    const fallbackText = parts.pop() || "0";
    const key = parts.join(":");
    activeWeightRefs.activeInternalWeightRef = {
      projectId: Number(projectId),
      key,
      fallback: Number(fallbackText) || 0
    };
    weight = getCompletionWeight(activeWeightRefs.activeInternalWeightRef.projectId, activeWeightRefs.activeInternalWeightRef.key, activeWeightRefs.activeInternalWeightRef.fallback);
  } else {
    return;
  }

  weightSliderInput.value = weight;
  weightSliderValue.textContent = `${weight}%`;

  const rect = badge.getBoundingClientRect();
  
  let left = rect.left + rect.width / 2 - 110;
  let top = rect.top - 95;
  if (left < 10) left = 10;
  if (left + 220 > window.innerWidth - 10) left = window.innerWidth - 230;
  if (top < 10) top = rect.bottom + 10; // place below badge if goes off top

  weightSliderPopup.style.left = `${left}px`;
  weightSliderPopup.style.top = `${top}px`;
  weightSliderPopup.hidden = false;
}

export function hideWeightSliderPopup() {
  if (weightSliderPopup) weightSliderPopup.hidden = true;
  activeWeightRefs.activeLinkRef = null;
  activeWeightRefs.activeFormulaLinkRef = null;
  activeWeightRefs.activeFormulaInputLinkRef = null;
  activeWeightRefs.activeInternalWeightRef = null;
  activeWeightRefs.activeWeightBadgeEl = null;
}

export async function openPreferencesModal() {
  if (darkModeInput) darkModeInput.checked = state.appSettings.theme === "dark";
  if (preferencesPinInput) {
    if (window.workshopApp) {
      preferencesPinInput.checked = await window.workshopApp.getAlwaysOnTop();
    } else {
      preferencesPinInput.checked = pinToggle.getAttribute("aria-pressed") === "true";
    }
  }
  if (shortcutToggleGraph) shortcutToggleGraph.value = state.appSettings.shortcuts?.toggleGraph || "g";
  if (shortcutOpenFocusWidget) shortcutOpenFocusWidget.value = state.appSettings.shortcuts?.openFocusWidget || "f";
  if (shortcutToggleSearch) shortcutToggleSearch.value = state.appSettings.shortcuts?.toggleSearch || "s";
  if (shortcutToggleTheme) shortcutToggleTheme.value = state.appSettings.shortcuts?.toggleTheme || "m";
  preferencesModal.hidden = false;
}

export function closePreferencesModal() {
  preferencesModal.hidden = true;
}

export function openProjectModal() {
  if (projectNameInput) projectNameInput.value = "";
  if (newProjectDeadlineInput) newProjectDeadlineInput.value = dateFromOffset(7);
  if (newProjectNoDeadline) {
    newProjectNoDeadline.checked = true;
    newProjectDeadlineInput.disabled = true;
  }
  if (projectNoteInput) projectNoteInput.value = "";
  if (projectStatusInput) projectStatusInput.value = "진행 중";
  renderParentOptions();
  if (projectParentInput) {
    projectParentInput.value = state.selectedProjectId || "";
  }
  projectModal.hidden = false;
  projectNameInput.focus();
}

export function closeProjectModal() {
  projectModal.hidden = true;
}

function openArchiveSelectModalLegacy(point) {
  state.tempArchiveNodePoint = point;
  
  if (!archiveSelectModalList) return;
  
  let html = "";
  let hasAnyResource = false;

  state.projects.forEach(p => {
    const resources = p.resources || [];
    if (resources.length > 0) {
      hasAnyResource = true;
      html += `
        <div class="archive-select-project-group" style="margin-bottom: 8px;">
          <div style="font-size: 11px; font-weight: bold; color: var(--muted); margin-bottom: 4px; padding-bottom: 2px; border-bottom: 1px solid var(--border); text-align: left;">
            ● ${escapeHtml(p.name)}
          </div>
          <div style="display: grid; gap: 4px; padding-left: 8px;">
      `;
      resources.forEach(r => {
        let icon = "📄";
        if (r.type === "folder") icon = "📁";
        if (r.type === "link") icon = "🔗";
        
        html += `
          <button type="button" class="archive-select-item-btn" data-resource-id="${r.id}" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); cursor: pointer; color: var(--text); width: 100%; transition: background 0.15s, border-color 0.15s;">
            <strong style="font-size: 11.5px; display: flex; align-items: center; gap: 4px;">${icon} ${escapeHtml(r.name)}</strong>
            ${r.desc ? `<span style="font-size: 9.5px; color: var(--muted); margin-top: 2px;">${escapeHtml(r.desc)}</span>` : ""}
            <small style="font-size: 8.5px; color: var(--quiet); margin-top: 1px; word-break: break-all;">${escapeHtml(r.path)}</small>
          </button>
        `;
      });
      html += `
          </div>
        </div>
      `;
    }
  });

  if (!hasAnyResource) {
    html = `
      <div style="text-align: center; padding: 20px; color: var(--muted);">
        <p style="font-size: 12px; margin-bottom: 12px;">아카이브에 등록된 리소스가 없습니다.</p>
        <button type="button" id="goToArchiveTabBtn" style="padding: 6px 12px; border: none; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-size: 11px; font-weight: bold;">아카이브 탭으로 이동</button>
      </div>
    `;
  }

  archiveSelectModalList.innerHTML = html;
  
  if (archiveSelectModal) {
    archiveSelectModal.hidden = false;
  }
}

export function closeArchiveSelectModal() {
  if (archiveSelectModal) {
    archiveSelectModal.hidden = true;
  }
  state.tempArchiveNodePoint = null;
}

export function openArchiveSelectModal(point) {
  state.tempArchiveNodePoint = point;
  if (!archiveSelectModalList) return;

  const resources = state.archiveResources || [];
  let html = "";

  if (resources.length) {
    html = `<div style="display: grid; gap: 4px;">`;
    resources.forEach((resource) => {
      let icon = "파일";
      if (resource.type === "folder") icon = "폴더";
      if (resource.type === "link") icon = "링크";

      html += `
        <button type="button" class="archive-select-item-btn" data-resource-id="${resource.id}" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); cursor: pointer; color: var(--text); width: 100%; transition: background 0.15s, border-color 0.15s;">
          <strong style="font-size: 11.5px; display: flex; align-items: center; gap: 4px;">${icon} ${escapeHtml(resource.name)}</strong>
          ${resource.desc ? `<span style="font-size: 9.5px; color: var(--muted); margin-top: 2px;">${escapeHtml(resource.desc)}</span>` : ""}
          <small style="font-size: 8.5px; color: var(--quiet); margin-top: 1px; word-break: break-all;">${escapeHtml(resource.path)}</small>
        </button>
      `;
    });
    html += `</div>`;
  } else {
    html = `
      <div style="text-align: center; padding: 20px; color: var(--muted);">
        <p style="font-size: 12px; margin-bottom: 12px;">아카이브에 등록된 리소스가 없습니다.</p>
        <button type="button" id="goToArchiveTabBtn" style="padding: 6px 12px; border: none; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-size: 11px; font-weight: bold;">아카이브 탭으로 이동</button>
      </div>
    `;
  }

  archiveSelectModalList.innerHTML = html;
  if (archiveSelectModal) archiveSelectModal.hidden = false;
}
