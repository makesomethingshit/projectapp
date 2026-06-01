const STORAGE_KEY = "studio-project-widget-state-v1";

const primaryTask = document.querySelector("#primaryTask");
const primaryProject = document.querySelector("#primaryProject");
const focusList = document.querySelector("#focusList");
const refreshButton = document.querySelector("#refreshButton");
const openMainButton = document.querySelector("#openMainButton");
const opacityInput = document.querySelector("#opacityInput");

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

async function readWorkspaceState() {
  const raw = await window.workshopApp?.getWorkspaceState?.();
  const fallback = localStorage.getItem(STORAGE_KEY);
  const stateText = raw || fallback;
  if (!stateText) return null;
  try {
    return JSON.parse(stateText);
  } catch {
    return null;
  }
}

function projectPath(projects, projectId) {
  const path = [];
  let current = projects.find((project) => Number(project.id) === Number(projectId));
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    path.unshift(current.name);
    seen.add(current.id);
    current = projects.find((project) => Number(project.id) === Number(current.parentId));
  }
  return path.join(" / ");
}

function pickFocusTasks(state) {
  const projects = Array.isArray(state?.projects) ? state.projects : [];
  const tasks = Array.isArray(state?.tasks) ? state.tasks : [];
  const focusedIds = Array.isArray(state?.appSettings?.focusedTaskIds)
    ? state.appSettings.focusedTaskIds.map(Number)
    : [];
  const mappedTasks = tasks
    .map((task) => {
      const completion = clampProgress(task.progress);
      const advance = clampProgress(task.advance ?? task.progress);
      const project = projects.find((item) => Number(item.id) === Number(task.projectId));
      return {
        ...task,
        completion,
        advance,
        projectName: project?.name || "프로젝트 없음",
        projectPath: projectPath(projects, task.projectId),
        score: completion + advance * 0.25
      };
    })
    .filter((task) => task.completion < 100);

  const pickedTasks = focusedIds
    .map((id) => mappedTasks.find((task) => Number(task.id) === id))
    .filter(Boolean);

  if (pickedTasks.length) return pickedTasks.slice(0, 3);

  return mappedTasks
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
}

function renderEmpty() {
  primaryTask.textContent = "집중할 일이 없습니다";
  primaryProject.textContent = "작업실에서 새 할 일을 추가하면 여기에 표시됩니다.";
  focusList.innerHTML = `<p class="focus-empty">완성도 100% 미만의 할 일을 찾지 못했습니다. 지금은 숨 돌려도 됩니다.</p>`;
}

function renderTasks(tasks) {
  if (!tasks.length) {
    renderEmpty();
    return;
  }

  const first = tasks[0];
  primaryTask.textContent = first.name;
  primaryProject.textContent = first.projectPath || first.projectName;
  focusList.innerHTML = tasks.map((task, index) => `
    <article class="focus-card ${index === 0 ? "is-primary" : ""}">
      <header>
        <strong>${escapeHtml(task.name)}</strong>
        <small>${task.completion}%</small>
      </header>
      <div class="focus-project">${escapeHtml(task.projectPath || task.projectName)}</div>
      <span class="focus-meter" aria-label="완성도 ${task.completion}%">
        <i style="--value:${task.completion}%"></i>
      </span>
      <label class="focus-control">
        <span>완성도</span>
        <input type="range" min="0" max="100" step="5" value="${task.completion}" data-widget-progress="${task.id}" />
      </label>
      <label class="focus-control">
        <span>진행도</span>
        <input type="range" min="0" max="100" step="5" value="${task.advance}" data-widget-advance="${task.id}" />
      </label>
    </article>
  `).join("");
}

async function refreshFocusWidget() {
  const state = await readWorkspaceState();
  if (!state) {
    renderEmpty();
    return;
  }
  
  // Apply theme dynamically to document element
  const theme = state.appSettings?.theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;

  renderTasks(pickFocusTasks(state));
}

refreshButton.addEventListener("click", refreshFocusWidget);
openMainButton.addEventListener("click", () => {
  window.workshopApp?.openMainWindow?.();
});
opacityInput.addEventListener("input", () => {
  window.workshopApp?.setFocusOpacity?.(Number(opacityInput.value) / 100);
});

focusList.addEventListener("input", async (event) => {
  const progressInput = event.target.closest("[data-widget-progress]");
  const advanceInput = event.target.closest("[data-widget-advance]");
  if (!progressInput && !advanceInput) return;
  const target = progressInput || advanceInput;
  const taskId = Number(target.dataset.widgetProgress || target.dataset.widgetAdvance);
  const patch = progressInput
    ? { progress: Number(progressInput.value) }
    : { advance: Number(advanceInput.value) };
  await window.workshopApp?.updateFocusTask?.(taskId, patch);
  refreshFocusWidget();
});

// Refresh when widget window is focused or becomes visible to follow theme changes instantly
window.addEventListener("focus", refreshFocusWidget);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshFocusWidget();
});

refreshFocusWidget();
setInterval(refreshFocusWidget, 15000);
