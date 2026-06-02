import assert from "node:assert/strict";
import { state } from "./state.js";
import { taskCardMarkup, taskLauncherMarkup } from "./ui-components.js";

state.projects = [
  { id: 1, name: "Magazine" }
];
state.tasks = [
  { id: 100, projectId: 1, name: "Cover layout", progress: 20, advance: 40, contributionMode: "both", note: "Check CMYK" },
  { id: 101, projectId: 1, name: "No resources", progress: 0, advance: 0, contributionMode: "both", note: "" },
  { id: 102, projectId: 1, name: "Other task", progress: 0, advance: 0, contributionMode: "both", note: "" }
];
state.archiveResources = [
  { id: 1, name: "Cover INDD", type: "file", path: "C:\\Work\\cover.indd", desc: "Main file" },
  { id: 2, name: "Cover folder", type: "folder", path: "C:\\Work\\Cover", desc: "" },
  { id: 3, name: "Reference board", type: "link", path: "https://example.com/ref", desc: "" },
  { id: 4, name: "Project brief", type: "file", path: "C:\\Work\\brief.pdf", desc: "" },
  { id: 5, name: "Other task file", type: "file", path: "C:\\Work\\other.indd", desc: "" }
];
state.archiveResourceLinks = [
  { resourceId: 1, targetType: "task", targetId: 100 },
  { resourceId: 2, targetType: "task", targetId: 100 },
  { resourceId: 3, targetType: "task", targetId: 100 },
  { resourceId: 4, targetType: "project", targetId: 1 },
  { resourceId: 5, targetType: "task", targetId: 102 }
];
state.appSettings = { focusedTaskIds: [] };

const cardHtml = taskCardMarkup(state.tasks[0]);
assert.match(cardHtml, /data-open-task-launcher="100"/);
assert.match(cardHtml, /작업 열기/);
assert.match(cardHtml, /Cover layout 작업 자료 열기/);

const launcherHtml = taskLauncherMarkup(100);
assert.match(launcherHtml, /Cover INDD/);
assert.match(launcherHtml, /Cover folder/);
assert.match(launcherHtml, /Reference board/);
assert.doesNotMatch(launcherHtml, /Project brief/);
assert.doesNotMatch(launcherHtml, /Other task file/);
assert.match(launcherHtml, /data-open-archive-path="C:\\Work\\cover.indd"/);
assert.match(launcherHtml, /data-archive-type="file"/);
assert.match(launcherHtml, /data-archive-type="folder"/);
assert.match(launcherHtml, /data-archive-type="link"/);
assert.equal((launcherHtml.match(/class="task-launcher-group"/g) || []).length, 3);

const emptyHtml = taskLauncherMarkup(101);
assert.match(emptyHtml, /id="taskLauncherGoArchive"/);
assert.doesNotMatch(emptyHtml, /data-open-archive-path/);

console.log("task launcher markup test passed");
