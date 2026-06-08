import assert from "node:assert/strict";
import { state } from "./state.js";
import { taskCardMarkup, taskLauncherMarkup } from "./ui-components.js";

state.projects = [
  { id: 1, name: "Magazine" }
];
state.tasks = [
  { id: 100, projectId: 1, name: "Cover layout", progress: 20, advance: 40, contributionMode: "both", note: "Check CMYK" },
  { id: 101, projectId: 1, name: "No resources", progress: 0, advance: 0, contributionMode: "both", note: "" },
  { id: 102, projectId: 1, name: "Other task", progress: 0, advance: 0, contributionMode: "both", note: "" },
  { id: 103, projectId: 1, name: "Design sites", progress: 0, advance: 0, contributionMode: "both", note: "" }
];
state.archiveResources = [
  { id: 1, name: "Cover INDD", type: "file", path: "C:\\Work\\cover.indd", desc: "Main file" },
  { id: 2, name: "Cover folder", type: "folder", path: "C:\\Work\\Cover", desc: "" },
  { id: 3, name: "Reference board", type: "link", path: "https://example.com/ref", desc: "" },
  { id: 4, name: "Project brief", type: "file", path: "C:\\Work\\brief.pdf", desc: "" },
  { id: 5, name: "Other task file", type: "file", path: "C:\\Work\\other.indd", desc: "" },
  { id: 20, name: "BP&O", type: "link", path: "https://bpando.org/logo-reviews/", desc: "branding design reference" },
  { id: 21, name: "Siteinspire", type: "link", path: "https://www.siteinspire.com/", desc: "web design gallery" },
  { id: 22, name: "Mobbin", type: "link", path: "https://mobbin.com/", desc: "ui pattern design" },
  { id: 23, name: "Random design blog", type: "link", path: "https://blog.naver.com/example", desc: "design note" },
  { id: 24, name: "Behance board", type: "link", path: "https://www.behance.net/", desc: "visual mood design" }
];
state.archiveResourceLinks = [
  { resourceId: 1, targetType: "task", targetId: 100 },
  { resourceId: 2, targetType: "task", targetId: 100 },
  { resourceId: 3, targetType: "task", targetId: 100 },
  { resourceId: 4, targetType: "project", targetId: 1 },
  { resourceId: 5, targetType: "task", targetId: 102 },
  { resourceId: 20, targetType: "task", targetId: 103 },
  { resourceId: 21, targetType: "task", targetId: 103 },
  { resourceId: 22, targetType: "task", targetId: 103 },
  { resourceId: 23, targetType: "task", targetId: 103 },
  { resourceId: 24, targetType: "task", targetId: 103 }
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

const curatedHtml = taskLauncherMarkup(103);
assert.match(curatedHtml, /task-launcher-curation/);
assert.match(curatedHtml, /data-curation-lane="first"/);
assert.match(curatedHtml, /data-curation-lane="structure"/);
assert.match(curatedHtml, /data-curation-lane="vibe"/);
assert.match(curatedHtml, /task-launcher-curation-review/);
assert.match(curatedHtml, /Known branding or type reference/);
assert.match(curatedHtml, /Known web design gallery/);
assert.match(curatedHtml, /One-off article or task context needs review/);
assert.match(curatedHtml, /task-launcher-confidence high/);
assert.match(curatedHtml, /task-launcher-confidence low/);

console.log("task launcher markup test passed");
