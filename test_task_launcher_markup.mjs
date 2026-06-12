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
  { id: 24, name: "Behance board", type: "link", path: "https://www.behance.net/", desc: "visual mood design" },
  { id: 25, name: "Manual unknown site", type: "link", path: "https://example.org/manual", desc: "linked by hand" }
];
state.archiveResourceLinks = [
  { resourceId: 1, targetType: "task", targetId: 100, relationStrength: "strong", relationScore: 90, relationNote: "Use for cover export" },
  { resourceId: 2, targetType: "task", targetId: 100 },
  { resourceId: 3, targetType: "task", targetId: 100 },
  { resourceId: 4, targetType: "project", targetId: 1 },
  { resourceId: 5, targetType: "task", targetId: 102 },
  { resourceId: 20, targetType: "task", targetId: 103, relationNote: "Branding first" },
  { resourceId: 21, targetType: "task", targetId: 103 },
  { resourceId: 22, targetType: "task", targetId: 103 },
  { resourceId: 23, targetType: "task", targetId: 103 },
  { resourceId: 24, targetType: "task", targetId: 103 },
  { resourceId: 25, targetType: "task", targetId: 103, relationStrength: "medium", relationScore: 60, relationNote: "Manual pick" }
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
assert.match(launcherHtml, /\uc8fc\uc694 \ud30c\uc77c/);
assert.match(launcherHtml, /\ud3f4\ub354/);
assert.match(launcherHtml, /\ucc38\uace0 \ub9c1\ud06c/);
assert.match(launcherHtml, /data-open-archive-path="C:\\Work\\cover.indd"/);
assert.match(launcherHtml, /data-archive-type="file"/);
assert.match(launcherHtml, /data-archive-type="folder"/);
assert.match(launcherHtml, /data-archive-type="link"/);
assert.match(launcherHtml, /archive-relation-badge strong/);
assert.match(launcherHtml, /archive-relation-adjust/);
assert.match(launcherHtml, /<summary>조정<\/summary>/);
assert.match(launcherHtml, /data-archive-relation-strength="strong"/);
assert.match(launcherHtml, /data-target-type="task"/);
assert.match(launcherHtml, /archive-relation-evidence/);
assert.match(launcherHtml, /수동 조정/);
assert.match(launcherHtml, /메모 반영/);
assert.match(launcherHtml, /신뢰도 90/);
assert.match(launcherHtml, /data-archive-relation-note="true"/);
assert.match(launcherHtml, /Use for cover export/);
assert.match(launcherHtml, /archive-relation-note-preview/);
assert.match(launcherHtml, /\uba54\ubaa8 \u00b7 Use for cover export/);
assert.match(launcherHtml, /archive-relation-reason/);
assert.match(launcherHtml, /\uadfc\uac70 \u00b7/);
assert.match(launcherHtml, /\uc2e0\ub8b0\ub3c4 90/);
assert.equal((launcherHtml.match(/class="task-launcher-group"/g) || []).length, 3);

const emptyHtml = taskLauncherMarkup(101);
assert.match(emptyHtml, /id="taskLauncherGoArchive"/);
assert.doesNotMatch(emptyHtml, /data-open-archive-path/);

const curatedHtml = taskLauncherMarkup(103);
assert.match(curatedHtml, /task-launcher-curation/);
assert.match(curatedHtml, /data-curation-lane="first"/);
assert.match(curatedHtml, /data-curation-lane="medium"/);
assert.match(curatedHtml, /data-curation-lane="low"/);
assert.match(curatedHtml, /task-launcher-curation-review/);
assert.match(curatedHtml, /\ube0c\ub79c\ub529\/\ud0c0\uc785 \uc804\ubb38 \ucc38\uace0\uc6d0/);
assert.match(curatedHtml, /\uac80\uc99d\ub41c \uc6f9\ub514\uc790\uc778 \uac24\ub7ec\ub9ac/);
assert.match(curatedHtml, /\ub2e8\ubc1c\uc131 \uae00\uc774\ub77c \uc791\uc5c5 \ub9e5\ub77d \ud655\uc778 \ud544\uc694/);
assert.match(curatedHtml, /task-launcher-confidence high/);
assert.match(curatedHtml, /task-launcher-confidence low/);
assert.doesNotMatch(curatedHtml, /task-launcher-direct/);
assert.match(curatedHtml, /Manual unknown site/);
assert.match(curatedHtml, /Manual unknown site[\s\S]*data-archive-relation-strength="medium"[\s\S]*aria-pressed="true"/);
assert.match(curatedHtml, /archive-relation-reason/);
assert.match(curatedHtml, /\ube0c\ub79c\ub529\/\ud0c0\uc785 \uc804\ubb38 \ucc38\uace0\uc6d0[\s\S]*\uc2e0\ub8b0\ub3c4/);
assert.match(curatedHtml, /archive-relation-badge strong/);
assert.match(curatedHtml, /\uba54\ubaa8 \u00b7 Branding first/);
assert.match(curatedHtml, /자동 큐레이션/);
assert.match(curatedHtml, /data-archive-relation-strength="strong"\s+data-resource-id="20"[\s\S]*?aria-pressed="true"/);
assert.match(curatedHtml, /data-archive-relation-strength="weak"\s+data-resource-id="23"[\s\S]*?aria-pressed="true"/);

state.archiveResourceLinks = state.archiveResourceLinks.map((link) => (
  Number(link.resourceId) === 23 && Number(link.targetId) === 103
    ? { ...link, relationStrength: "medium", relationScore: 60 }
    : link
));
const mediumCuratedHtml = taskLauncherMarkup(103);
assert.match(mediumCuratedHtml, /data-curation-lane="medium"[\s\S]*Random design blog/);
assert.match(mediumCuratedHtml, /Random design blog[\s\S]*data-archive-relation-strength="medium"[\s\S]*aria-pressed="true"/);

state.archiveResourceLinks = state.archiveResourceLinks.map((link) => (
  Number(link.resourceId) === 23 && Number(link.targetId) === 103
    ? { ...link, relationStrength: "weak", relationScore: 30 }
    : link
));
const lowCuratedHtml = taskLauncherMarkup(103);
const lowLaneStart = lowCuratedHtml.indexOf('data-curation-lane="low"');
const lowReviewStart = lowCuratedHtml.indexOf("task-launcher-curation-review");
const lowBlogStart = lowCuratedHtml.indexOf("Random design blog");
assert.ok(lowLaneStart >= 0);
assert.ok(lowBlogStart > lowLaneStart);
assert.ok(lowReviewStart === -1 || lowBlogStart < lowReviewStart);

state.archiveResourceLinks = state.archiveResourceLinks.map((link) => (
  Number(link.resourceId) === 23 && Number(link.targetId) === 103
    ? { ...link, relationStrength: "strong", relationScore: 90 }
    : link
));
const adjustedCuratedHtml = taskLauncherMarkup(103);
assert.match(adjustedCuratedHtml, /data-archive-relation-strength="strong"\s+data-resource-id="23"[\s\S]*?aria-pressed="true"/);

state.archiveResources = state.archiveResources.filter((resource) => [20, 21, 23].includes(Number(resource.id)));
state.archiveResourceLinks = state.archiveResourceLinks.filter((link) => [20, 21, 23].includes(Number(link.resourceId)));
const sparseCuratedHtml = taskLauncherMarkup(103);
assert.match(sparseCuratedHtml, /data-curation-lane="medium"/);
assert.match(sparseCuratedHtml, /task-launcher-lane-empty/);

state.archiveResources = [];
state.archiveResourceLinks = [];
for (let index = 0; index < 22; index += 1) {
  const resourceId = 200 + index;
  state.archiveResources.push({
    id: resourceId,
    name: `Mobbin clone ${index}`,
    type: "link",
    path: `https://mobbin.com/${index}`,
    desc: "ui pattern design"
  });
  state.archiveResourceLinks.push({ resourceId, targetType: "task", targetId: 103 });
}
state.archiveResources.push({
  id: 999,
  name: "Manual blog",
  type: "link",
  path: "https://blog.naver.com/example",
  desc: "design note"
});
state.archiveResourceLinks.push({
  resourceId: 999,
  targetType: "task",
  targetId: 103,
  relationStrength: "medium",
  relationScore: 60
});
const crowdedMediumHtml = taskLauncherMarkup(103);
const crowdedMediumStart = crowdedMediumHtml.indexOf('data-curation-lane="medium"');
const crowdedReviewStart = crowdedMediumHtml.indexOf("task-launcher-curation-review");
const manualBlogStart = crowdedMediumHtml.indexOf("Manual blog");
assert.ok(crowdedMediumStart >= 0);
assert.ok(manualBlogStart > crowdedMediumStart);
assert.ok(crowdedReviewStart === -1 || manualBlogStart < crowdedReviewStart);
assert.match(crowdedMediumHtml, /task-launcher-overflow-details/);
assert.match(crowdedMediumHtml, /13&#44060; &#45908; &#48372;&#44592;/);

console.log("task launcher markup test passed");
