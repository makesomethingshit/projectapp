const { app, BrowserWindow, Menu, nativeTheme, ipcMain, dialog, shell } = require("electron");
const fs = require("fs");
const path = require("path");

let mainWindow;
let focusWindow;
let devReloadTimer;

function createWindow() {
  nativeTheme.themeSource = "light";

  mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 520,
    minHeight: 520,
    title: "작업실",
    backgroundColor: "#eeeeee",
    autoHideMenuBar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer LOG] ${message}`);
  });
  // mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function reloadOpenWindows() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.reloadIgnoringCache();
  }
  if (focusWindow && !focusWindow.isDestroyed()) {
    focusWindow.webContents.reloadIgnoringCache();
  }
}

function setupDevReload() {
  if (app.isPackaged) return;
  const watchedFiles = [
    "index.html",
    "styles.css",
    "variables.css",
    "layout.css",
    "components.css",
    "modals.css",
    "graph.css",
    "graph-interactions.css",
    "app.js",
    "app-graph-actions.js",
    "app-graph-events.js",
    "app-modals.js",
    "archive-model.js",
    "detail-navigation.js",
    "graph-navigation.js",
    "graph-selection.js",
    "state.js",
    "calculator.js",
    "ui-components.js",
    "graph-components.js",
    "focus-widget.html",
    "focus-widget.css",
    "focus-widget.js"
  ];

  watchedFiles.forEach((fileName) => {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) return;
    fs.watch(filePath, { persistent: false }, () => {
      clearTimeout(devReloadTimer);
      devReloadTimer = setTimeout(reloadOpenWindows, 120);
    });
  });
}

function createFocusWindow() {
  if (focusWindow && !focusWindow.isDestroyed()) {
    focusWindow.show();
    focusWindow.focus();
    return;
  }

  focusWindow = new BrowserWindow({
    width: 320,
    height: 430,
    minWidth: 260,
    minHeight: 260,
    title: "집중 위젯",
    backgroundColor: "#202020",
    autoHideMenuBar: true,
    alwaysOnTop: true,
    resizable: true,
    frame: true,
    opacity: 0.94,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  focusWindow.loadFile(path.join(__dirname, "focus-widget.html"));
  focusWindow.on("closed", () => {
    focusWindow = null;
  });
}

ipcMain.handle("set-always-on-top", (_event, value) => {
  if (!mainWindow) return false;
  mainWindow.setAlwaysOnTop(Boolean(value));
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle("set-window-size", (event, width, height) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setSize(Number(width), Number(height));
  }
});

ipcMain.handle("open-focus-widget", () => {
  createFocusWindow();
  return true;
});

ipcMain.handle("open-main-window", () => {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.focus();
  return true;
});

ipcMain.handle("set-focus-opacity", (_event, value) => {
  if (!focusWindow || focusWindow.isDestroyed()) return 1;
  const opacity = Math.max(0.55, Math.min(1, Number(value) || 0.94));
  focusWindow.setOpacity(opacity);
  return focusWindow.getOpacity();
});

ipcMain.handle("get-workspace-state", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  try {
    return await mainWindow.webContents.executeJavaScript(
      "localStorage.getItem('studio-project-widget-state-v1')",
      true
    );
  } catch {
    return null;
  }
});

ipcMain.handle("update-focus-task", async (_event, taskId, patch) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
  try {
    const safeTaskId = Number(taskId);
    const safePatch = JSON.stringify(patch || {});
    return await mainWindow.webContents.executeJavaScript(
      `window.updateTaskFromFocusWidget?.(${safeTaskId}, ${safePatch}) || { ok: false }`,
      true
    );
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("get-always-on-top", () => {
  return mainWindow ? mainWindow.isAlwaysOnTop() : false;
});

ipcMain.handle("export-data", async (_event, data) => {
  if (!mainWindow) return { ok: false, canceled: true };
  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "작업실 데이터 내보내기",
    defaultPath: `작업실-backup-${stamp}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), "utf8");
  return { ok: true, path: result.filePath };
});

ipcMain.handle("import-data", async () => {
  if (!mainWindow) return { ok: false, canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "작업실 데이터 가져오기",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
  const data = fs.readFileSync(result.filePaths[0], "utf8");
  return { ok: true, path: result.filePaths[0], data };
});

ipcMain.handle("open-resource", async (_event, path, type) => {
  try {
    if (!path) return { ok: false, error: "경로가 없습니다." };
    const isWebLink = type === "link" || path.startsWith("http://") || path.startsWith("https://");
    if (isWebLink) {
      await shell.openExternal(path);
    } else {
      const err = await shell.openPath(path);
      if (err) return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.whenReady().then(() => {
  createWindow();
  setupDevReload();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
