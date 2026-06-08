const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const state = {
  projects: [
    { id: 10, parentId: null, name: "Levinas Study", note: "levinas totality infinity explanation", progress: 20 }
  ],
  tasks: [
    { id: 20, projectId: 10, name: "Levinas explanation cleanup", note: "truth justice being", progress: 10 }
  ],
  projectLinks: [],
  archiveResources: [
    { id: 1, name: "Levinas totality infinity.pdf", type: "file", path: "G:/levinas/a.pdf", desc: "levinas truth justice explanation", tags: [], semanticEmbedding: [1, 0, 0] },
    { id: 2, name: "Levinas otherwise than being.pdf", type: "file", path: "G:/levinas/b.pdf", desc: "levinas responsibility subjectivity proximity", tags: [], semanticEmbedding: [0.96, 0.04, 0] },
    { id: 3, name: "Typography grid layout.pdf", type: "file", path: "G:/type/c.pdf", desc: "typography grid layout type system", tags: ["typography"], semanticEmbedding: [0, 1, 0] }
  ],
  archiveResourceLinks: [
    { resourceId: 1, targetType: "task", targetId: 20 }
  ],
  appSettings: {
    archiveViewMode: "graph",
    archiveGraphDisplayMode: "graph3d",
    archiveGraphDepth: 2,
    archiveGraphLabelDensity: "focus",
    globalGraphView: false,
    graphZoom: 1,
    graphCanvasScale: 1.25,
    graphNodeScale: 1,
    graphNodePositions: {},
    graphTaskPositions: {},
    graphMemoNodes: [],
    graphFormulaNodes: [],
    graphFormulaLinks: [],
    graphFormulaInputLinks: [],
    graphNodePortSettings: {},
    graphCustomPortLinks: [],
    graphArchiveNodes: [],
    graphArchiveLinks: [],
    graphScope: "all",
    graphShowTasks: true,
    graphShowExternal: true,
    focusedTaskIds: [],
    history: [],
    activityLog: [],
    shortcuts: {
      toggleGraph: "g",
      openFocusWidget: "f",
      toggleSearch: "s",
      toggleTheme: "m"
    }
  },
  selectedProjectId: 10,
  selectedArchiveResourceId: 1,
  archiveEditMode: false,
  projectFilter: "all",
  detailFilter: "all",
  searchQuery: "",
  viewMode: "archive",
  expandedProjectIds: []
};

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hashText(value) {
  let hash = 2166136261;
  const text = normalizeText(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

state.appSettings.archiveEmbeddingCache = {
  model: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  items: Object.fromEntries(state.archiveResources.map((resource) => [
    `resource:${Number(resource.id)}`,
    {
      hash: hashText([
        resource.name,
        resource.desc,
        resource.note,
        Array.isArray(resource.tags) ? resource.tags.join(" ") : resource.tags
      ].filter(Boolean).join(" ")),
      vector: resource.semanticEmbedding,
      updatedAt: "2026-06-07T00:00:00.000Z"
    }
  ]))
};

function onceFinished(win) {
  return new Promise((resolve, reject) => {
    win.webContents.once("did-finish-load", resolve);
    win.webContents.once("did-fail-load", (_event, code, description) => {
      reject(new Error(`load failed ${code}: ${description}`));
    });
  });
}

async function poll(win, script, timeout = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await win.webContents.executeJavaScript(script);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for archive 3D graph canvas");
}

app.whenReady().then(async () => {
  ipcMain.handle("set-window-size", () => true);
  ipcMain.handle("set-always-on-top", () => true);
  ipcMain.handle("get-always-on-top", () => false);
  ipcMain.handle("open-focus-widget", () => true);
  ipcMain.handle("open-main-window", () => true);
  ipcMain.handle("set-focus-opacity", () => true);
  ipcMain.handle("get-workspace-state", () => state);
  ipcMain.handle("update-focus-task", () => true);
  ipcMain.handle("export-data", () => ({ ok: true }));
  ipcMain.handle("import-data", () => null);
  ipcMain.handle("open-resource", () => true);
  ipcMain.handle("select-file-or-folder", () => null);
  ipcMain.handle("check-path-exists", () => false);

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(projectRoot, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  const rendererLogs = [];
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    rendererLogs.push({ level, message, line, sourceId });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    rendererLogs.push({ level: "gone", message: JSON.stringify(details), line: 0, sourceId: "" });
  });

  try {
    await win.loadFile(path.join(projectRoot, "index.html"));
    await win.webContents.executeJavaScript(
      `localStorage.setItem("studio-project-widget-state-v1", ${JSON.stringify(JSON.stringify(state))});`
    );
    const reloaded = onceFinished(win);
    win.reload();
    await reloaded;

    try {
      await poll(win, `Boolean(document.querySelector("[data-archive-graph-3d-canvas] canvas"))`);
    } catch (error) {
      const diagnostics = await win.webContents.executeJavaScript(`(() => ({
        viewModeText: document.body?.textContent?.slice(0, 600) || "",
        hasArchiveView: Boolean(document.querySelector("[data-main-view='archive']")),
        hasGraphView: Boolean(document.querySelector("[data-archive-graph-view]")),
        hasGraph3dHost: Boolean(document.querySelector("[data-archive-graph-3d]")),
        hasGraph3dCanvasHost: Boolean(document.querySelector("[data-archive-graph-3d-canvas]")),
        hasCanvas: Boolean(document.querySelector("[data-archive-graph-3d-canvas] canvas")),
        localState: localStorage.getItem("studio-project-widget-state-v1")?.slice(0, 300) || ""
      }))()`);
      console.error(JSON.stringify({ diagnostics, rendererLogs }, null, 2));
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 900));

    const result = await win.webContents.executeJavaScript(`(() => {
      const host = document.querySelector("[data-archive-graph-3d-canvas]");
      const canvas = host && host.querySelector("canvas");
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      const payloadText = document.querySelector("[data-archive-graph-3d-payload]")?.textContent || "{}";
      let payload = {};
      try {
        payload = JSON.parse(payloadText);
      } catch (error) {
        payload = { parseError: String(error), rawLength: payloadText.length };
      }
      let webglContext = false;
      try {
        webglContext = Boolean(canvas && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
      } catch (error) {
        webglContext = false;
      }
      return {
        hasHost: Boolean(host),
        hasCanvas: Boolean(canvas),
        canvasWidth: Math.round(rect?.width || 0),
        canvasHeight: Math.round(rect?.height || 0),
        webglContext,
        nodeCount: payload.nodes?.length || 0,
        linkCount: payload.links?.length || 0,
        materialOnly: (payload.nodes || []).every((node) => String(node.id || "").startsWith("resource:"))
          && (payload.links || []).every((link) => String(link.source || "").startsWith("resource:") && String(link.target || "").startsWith("resource:")),
        activeNode: payload.nodes?.find((node) => node.active)?.id || null,
        modeButtonActive: document.querySelector("[data-archive-graph-display-mode='graph3d']")?.classList.contains("active") || false
        ,
        sidebarItems: document.querySelectorAll("[data-select-archive-id]").length,
        payloadTextLength: document.querySelector("[data-archive-graph-3d-payload]")?.textContent?.length || 0,
        archiveHeader: document.querySelector(".archive-sidebar-content")?.textContent?.replace(/\\s+/g, " ").trim().slice(0, 160) || ""
      };
    })()`);

    if (!result.hasCanvas || result.canvasWidth < 320 || result.canvasHeight < 260 || !result.webglContext || result.nodeCount < 3 || result.linkCount < 1 || !result.materialOnly || result.activeNode !== "resource:1" || !result.modeButtonActive) {
      throw new Error(`Archive 3D graph runtime check failed: ${JSON.stringify(result)}`);
    }

    console.log(JSON.stringify(result, null, 2));
  } finally {
    win.destroy();
    app.quit();
  }
}).catch(async (error) => {
  console.error(error);
  app.quit();
  process.exit(1);
});
