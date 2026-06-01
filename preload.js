const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workshopApp", {
  setAlwaysOnTop: (value) => ipcRenderer.invoke("set-always-on-top", value),
  getAlwaysOnTop: () => ipcRenderer.invoke("get-always-on-top"),
  openFocusWidget: () => ipcRenderer.invoke("open-focus-widget"),
  openMainWindow: () => ipcRenderer.invoke("open-main-window"),
  setFocusOpacity: (value) => ipcRenderer.invoke("set-focus-opacity", value),
  getWorkspaceState: () => ipcRenderer.invoke("get-workspace-state"),
  updateFocusTask: (taskId, patch) => ipcRenderer.invoke("update-focus-task", taskId, patch),
  exportData: (data) => ipcRenderer.invoke("export-data", data),
  importData: () => ipcRenderer.invoke("import-data"),
  setWindowSize: (width, height) => ipcRenderer.invoke("set-window-size", width, height),
  openResource: (path, type) => ipcRenderer.invoke("open-resource", path, type)
});
