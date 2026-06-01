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
  const archiveResources = Array.isArray(state?.archiveResources) ? state.archiveResources : [];
  const archiveResourceLinks = Array.isArray(state?.archiveResourceLinks) ? state.archiveResourceLinks : [];

  const mappedTasks = tasks
    .map((task) => {
      const completion = clampProgress(task.progress);
      const advance = clampProgress(task.advance ?? task.progress);
      const project = projects.find((item) => Number(item.id) === Number(task.projectId));

      // Task 및 부모 Project에 연결된 아카이브 리소스 가져오기
      const connectedResourceIds = archiveResourceLinks
        .filter((link) => {
          const targetId = Number(link.targetId);
          if (link.targetType === "task" && targetId === Number(task.id)) return true;
          if (link.targetType === "project" && task.projectId && targetId === Number(task.projectId)) return true;
          return false;
        })
        .map((link) => Number(link.resourceId));

      const taskResources = archiveResources.filter((res) => connectedResourceIds.includes(Number(res.id)));

      return {
        ...task,
        completion,
        advance,
        projectName: project?.name || "프로젝트 없음",
        projectPath: projectPath(projects, task.projectId),
        score: completion + advance * 0.25,
        resources: taskResources
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

function renderTasks(tasks, state) {
  if (!tasks.length) {
    renderEmpty();
    return;
  }

  const first = tasks[0];
  primaryTask.textContent = first.name;
  primaryProject.textContent = first.projectPath || first.projectName;

  const bottleneckCache = Array.isArray(state?.appSettings?.bottleneckCache)
    ? state.appSettings.bottleneckCache
    : [];

  focusList.innerHTML = tasks.map((task, index) => {
    const bottleneck = bottleneckCache.find(
      (item) => item.sourceType === "task" && Number(item.sourceId) === Number(task.id)
    );

    const resourcesMarkup = Array.isArray(task.resources) && task.resources.length > 0
      ? `
        <div class="focus-resources">
          ${task.resources.map(res => {
            let icon = "🔗";
            if (res.type === "folder") icon = "📁";
            else if (res.type === "file") icon = "📄";
            return `
              <button class="focus-resource-btn" 
                      data-open-archive-path="${escapeHtml(res.path)}" 
                      data-archive-type="${escapeHtml(res.type)}"
                      title="${escapeHtml(res.name)} (${escapeHtml(res.desc || '')})">
                <span class="focus-resource-icon">${icon}</span>
                <span class="focus-resource-name">${escapeHtml(res.name)}</span>
              </button>
            `;
          }).join("")}
        </div>
      `
      : "";

    return `
      <article class="focus-card ${index === 0 ? "is-primary" : ""}">
        <header class="focus-card-header">
          <div class="focus-card-title-group">
            <strong class="focus-card-title" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</strong>
            ${bottleneck ? `<span class="focus-bottleneck-badge" title="병목요인 작업: 이 작업의 완료가 전체 프로젝트 일정을 지연시키고 있습니다.">⚠️ 병목${bottleneck.drag ? ` (-${Number(bottleneck.drag).toFixed(1)}%p)` : ""}</span>` : ""}
          </div>
          <small class="focus-card-percent">${task.completion}%</small>
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
        ${resourcesMarkup}
      </article>
    `;
  }).join("");
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

  renderTasks(pickFocusTasks(state), state);
}

// 투명도 제어 변수 및 이벤트 통합
let userOpacity = Number(opacityInput.value) / 100;
let isHovered = true; // 최초 상태

function updateOpacity() {
  const targetOpacity = isHovered ? userOpacity : 0.35;
  window.workshopApp?.setFocusOpacity?.(targetOpacity);
  document.body.classList.toggle("is-faded", !isHovered);
}

// 초기 불투명도 적용
updateOpacity();

refreshButton.addEventListener("click", refreshFocusWidget);
openMainButton.addEventListener("click", () => {
  window.workshopApp?.openMainWindow?.();
});
opacityInput.addEventListener("input", () => {
  userOpacity = Number(opacityInput.value) / 100;
  updateOpacity();
});

// 마우스 진입/이탈 이벤트 바인딩
document.addEventListener("mouseenter", () => {
  isHovered = true;
  updateOpacity();
});
document.addEventListener("mouseleave", () => {
  isHovered = false;
  updateOpacity();
});

// 아카이브 리소스 퀵 실행 버튼 위임 이벤트 바인딩
focusList.addEventListener("click", (event) => {
  const btn = event.target.closest(".focus-resource-btn");
  if (!btn) return;
  const path = btn.dataset.openArchivePath;
  const type = btn.dataset.archiveType;
  if (path && type) {
    window.workshopApp?.openResource?.(path, type);
  }
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
