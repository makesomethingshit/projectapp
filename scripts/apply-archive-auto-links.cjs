const { app, BrowserWindow } = require("electron");
const path = require("path");

const storageKey = "studio-project-widget-state-v1";
const repoRoot = path.resolve(__dirname, "..");
const userDataPath = path.join(app.getPath("appData"), "studio-project-widget");

app.setName("studio-project-widget");
app.setPath("userData", userDataPath);

function readSummary(raw) {
  if (!raw) {
    return {
      projects: 0,
      resources: 0,
      links: 0
    };
  }
  const parsed = JSON.parse(raw);
  const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const resources = Array.isArray(parsed.archiveResources) ? parsed.archiveResources : [];
  const links = Array.isArray(parsed.archiveResourceLinks) ? parsed.archiveResourceLinks : [];
  const linkDetails = links.map((link) => {
    const resource = resources.find((item) => Number(item.id) === Number(link.resourceId));
    const target = link.targetType === "task"
      ? tasks.find((item) => Number(item.id) === Number(link.targetId))
      : projects.find((item) => Number(item.id) === Number(link.targetId));
    return {
      resource: resource?.name || `resource:${link.resourceId}`,
      type: resource?.type || "unknown",
      targetType: link.targetType === "task" ? "task" : "project",
      target: target?.name || `${link.targetType}:${link.targetId}`
    };
  });
  return {
    projects: projects.length,
    tasks: tasks.length,
    resources: resources.length,
    links: links.length,
    projectLinks: links.filter((link) => (link.targetType === "task" ? "task" : "project") === "project").length,
    taskLinks: links.filter((link) => (link.targetType === "task" ? "task" : "project") === "task").length,
    linkDetails: linkDetails.slice(0, 40)
  };
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(repoRoot, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await win.loadFile(path.join(repoRoot, "index.html"));
  await new Promise((resolve) => setTimeout(resolve, 700));

  const raw = await win.webContents.executeJavaScript(
    `localStorage.getItem(${JSON.stringify(storageKey)})`,
    true
  );
  const summary = readSummary(raw);
  console.log(JSON.stringify({
    ok: true,
    userDataPath,
    ...summary
  }, null, 2));

  win.destroy();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
