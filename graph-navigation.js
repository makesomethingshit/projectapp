export function applyGraphProjectDoubleClickNavigation(appState, projectId) {
  const selectedProjectId = Number(projectId);
  if (!selectedProjectId) return false;

  appState.selectedProjectId = selectedProjectId;
  appState.detailFilter = "all";
  appState.appSettings.globalGraphView = true;
  appState.appSettings.graphScope = "local";
  appState.selectedGraphProjectIds = new Set([selectedProjectId]);

  return true;
}
