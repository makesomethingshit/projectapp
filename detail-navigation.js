export function applyBottleneckDetailNavigation(appState, targetType, targetId) {
  const numericId = Number(targetId);
  if (!numericId) return null;

  let projectId = null;
  if (targetType === "task") {
    const task = (appState.tasks || []).find((item) => Number(item.id) === numericId);
    projectId = task?.projectId ? Number(task.projectId) : null;
  } else {
    projectId = numericId;
  }

  if (!projectId || !(appState.projects || []).some((project) => Number(project.id) === projectId)) {
    return null;
  }

  appState.selectedProjectId = projectId;
  appState.detailFilter = "all";
  appState.viewMode = "detail";
  appState.appSettings.globalGraphView = false;
  appState.selectedGraphProjectIds = new Set([projectId]);

  return projectId;
}
