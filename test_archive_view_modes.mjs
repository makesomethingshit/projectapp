import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

state.projects = [
  { id: 10, name: "Brand Project", parentId: null, note: "" }
];
state.tasks = [
  { id: 20, name: "Review mood board", projectId: 10, note: "" }
];
state.archiveResourceLinks = [
  { resourceId: 1, targetType: "project", targetId: 10 },
  { resourceId: 2, targetType: "task", targetId: 20 }
];
state.selectedArchiveResourceId = 1;
state.archiveResources = [
  { id: 1, name: "Logo guide", type: "file", path: "C:\\logo.pdf", desc: "", tags: ["Brand", "pdf", "g-drive"] },
  { id: 2, name: "Mood board", type: "link", path: "https://example.com", desc: "", tags: ["Reference"] },
  { id: 3, name: "Asset folder", type: "folder", path: "C:\\assets", desc: "", tags: [] },
  { id: 4, name: "Logo reference", type: "file", path: "C:\\logo-reference.pdf", desc: "logo system notes", tags: ["Brand"] },
  ...Array.from({ length: 19 }, (_, index) => ({
    id: 100 + index,
    name: `Levinas seminar note ${index + 1}`,
    type: "file",
    path: `C:\\levinas\\note-${index + 1}.pdf`,
    desc: "levinas ethics seminar material",
    tags: ["Levinas"]
  }))
];

state.appSettings.archiveViewMode = "topic";
let html = renderArchiveView();
assert.match(html, /data-archive-view-mode="topic" class="active"/);
assert.match(html, />Brand \(2\)</);
assert.match(html, />Levinas \(19\)</);
assert.match(html, />Reference \(1\)</);
assert.match(html, /class="archive-explorer-open-link"[^>]*data-open-archive-path="https:\/\/example\.com"[^>]*data-archive-type="link"/);
assert.match(html, /class="archive-explorer-open-link"[^>]*data-open-archive-path="C:\\logo\.pdf"[^>]*data-archive-type="file"/);
assert.match(html, /class="archive-explorer-open-link"[^>]*data-open-archive-path="C:\\assets"[^>]*data-archive-type="folder"/);
assert.match(html, /class="archive-explorer-open-link"[\s\S]*?>열기<\/button>/);

state.appSettings.archiveViewMode = "type";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="type" class="active"/);
assert.match(html, /작업 폴더/);
assert.match(html, /문서와 파일/);
assert.match(html, /웹 링크/);

state.appSettings.archiveViewMode = "all";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="all" class="active"/);
assert.match(html, />전체 \(23\)</);

state.appSettings.archiveViewMode = "graph";
state.appSettings.archiveGraphDisplayMode = "graph3d";
html = renderArchiveView();
assert.match(html, /data-archive-view-mode="graph" class="active"/);
assert.match(html, /data-archive-graph-view/);
assert.match(html, /Archive Graph/);
assert.match(html, /archive-main graph-mode/);
assert.match(html, /archive-backlinks graph-mode/);
assert.match(html, /data-archive-graph-3d/);
assert.match(html, /data-archive-graph-3d-canvas/);
assert.match(html, /data-archive-graph-display-mode="graph3d"/);
assert.doesNotMatch(html, /data-archive-graph-pan-catcher/);

state.appSettings.archiveGraphDisplayMode = "graph2d";
html = renderArchiveView();
assert.match(html, /data-archive-graph-display-mode="graph2d"/);
assert.match(html, /data-archive-graph-node="resource:1"/);
assert.doesNotMatch(html, /data-archive-graph-node="tag:brand"/);
assert.doesNotMatch(html, /data-archive-graph-node="tag:pdf"/);
assert.doesNotMatch(html, /data-archive-graph-node="tag:g-drive"/);
assert.doesNotMatch(html, /data-archive-graph-node="similarity:logo"/);
assert.doesNotMatch(html, /data-archive-graph-node="source:archive-index"/);
assert.doesNotMatch(html, /data-archive-graph-node="collection:source:archive-index:brand"/);
assert.match(html, /Brand Project/);
assert.doesNotMatch(html, /archive-graph-view-edge link/);
assert.doesNotMatch(html, /archive-graph-view-edge tag/);
assert.doesNotMatch(html, /archive-graph-view-edge similarity/);
assert.match(html, /archive-graph-view-edge related/);
assert.match(html, /archive-graph-workspace/);
assert.match(html, /archive-graph-inspector/);
assert.match(html, /Active Context/);
assert.match(html, /Strong Relations/);
assert.match(html, /<b>\d+<\/b>/);
assert.match(html, /selected material|shared topic|semantic match/);
assert.doesNotMatch(html, /touches/);
assert.doesNotMatch(html, /supports project/);
assert.match(html, /data-archive-graph-edge-label/);
assert.match(html, /marker-end="url\(#archive-graph-arrow-/);
assert.match(html, /archive-graph-arrow-related/);
assert.match(html, /archive-graph-arrow-similarity/);
assert.match(html, /Visible Materials/);
assert.match(html, /Topic Touchpoints/);
assert.match(html, /Similar Documents/);
assert.match(html, /project\s*·\s*medium\s*·\s*reference/);
assert.doesNotMatch(html, /similar to/);
assert.match(html, /Folder Candidates/);
assert.match(html, /make a folder/);
assert.doesNotMatch(html, /data-archive-graph-node="similarity:levinas"/);
assert.match(html, /Needs Sorting/);
assert.match(html, /data-archive-node-degree/);
assert.match(html, /archive-graph-canvas-top/);
assert.match(html, /archive-graph-node-mark/);
assert.match(html, /data-archive-graph-pan-catcher/);
assert.match(html, /data-archive-graph-pan-layer/);
assert.match(html, /data-archive-graph-control-hint/);
assert.match(html, /archive-graph-control-hint/);
assert.match(html, /Archive Relation Map/);

state.selectedArchiveResourceId = 300;
state.archiveResources = [
  {
    id: 300,
    name: "설 - ringringring.pdf",
    type: "file",
    path: "G:\\귀한거\\악보\\설 - ringringring.pdf",
    desc: "Indexed external reference from G:\\귀한거. Kind: note/doc. Size: 0.2 MB.",
    tags: ["reference-library", "g-drive", "귀한거", "악보", "note/doc", "pdf"]
  },
  {
    id: 301,
    name: "혁오 - mer.pdf",
    type: "file",
    path: "G:\\귀한거\\악보\\혁오 - mer.pdf",
    desc: "Indexed external reference from G:\\귀한거. Kind: note/doc. Size: 0.2 MB.",
    tags: ["reference-library", "g-drive", "귀한거", "악보", "note/doc", "pdf"]
  },
  {
    id: 302,
    name: "타이포그래피 공간의 구조.pdf",
    type: "file",
    path: "G:\\귀한거\\type\\타이포그래피 공간의 구조.pdf",
    desc: "typography layout structure",
    tags: ["타이포"]
  }
];
state.archiveResourceLinks = [];
html = renderArchiveView();
const topicStart = html.indexOf("<h3>Topic Touchpoints</h3>");
const topicEnd = html.indexOf("<section", topicStart + 1);
const topicSection = html.slice(topicStart, topicEnd > topicStart ? topicEnd : undefined);
assert.match(topicSection, /#악보/);
assert.match(topicSection, /active context/);
assert.doesNotMatch(topicSection, /#kind|#size|#mb|#items/);

const similarityStart = html.indexOf("<h3>Similar Documents</h3>");
const similarityEnd = html.indexOf("<section", similarityStart + 1);
const similaritySection = html.slice(similarityStart, similarityEnd > similarityStart ? similarityEnd : undefined);
assert.doesNotMatch(similaritySection, /~\s*(kind|size|mb|items)/);
const folderStart = html.indexOf("<h3>Folder Candidates</h3>");
const folderEnd = html.indexOf("<section", folderStart + 1);
const folderSection = html.slice(folderStart, folderEnd > folderStart ? folderEnd : undefined);
assert.doesNotMatch(folderSection, /\b(kind|size|mb|items)\b/);

const eventSource = readFileSync("app-graph-events.js", "utf8");
const stateSource = readFileSync("state.js", "utf8");
const styleSource = readFileSync("components.css", "utf8");
const appSource = readFileSync("app.js", "utf8");
const indexSource = readFileSync("index.html", "utf8");
const packageSource = readFileSync("package.json", "utf8");
const d3Source = readFileSync("archive-graph-d3.js", "utf8");
const mainSource = readFileSync("main.js", "utf8");
const openingBraces = (styleSource.match(/{/g) || []).length;
const closingBraces = (styleSource.match(/}/g) || []).length;
assert.match(eventSource, /\["topic", "type", "all", "graph"\]\.includes\(mode\)/);
assert.match(eventSource, /archiveGraphPanDrag/);
assert.match(eventSource, /applyArchiveGraphPan/);
assert.match(eventSource, /document\.addEventListener\("pointerdown"[\s\S]*?\[data-archive-graph-view\]/);
assert.match(eventSource, /document\.addEventListener\("pointermove"[\s\S]*?applyArchiveGraphPan/);
assert.match(eventSource, /document\.addEventListener\("wheel"[\s\S]*?applyArchiveGraphPan/);
assert.match(stateSource, /\["topic", "type", "all", "graph"\]\.includes\(state\.appSettings\.archiveViewMode\)/);
assert.equal(openingBraces, closingBraces);
assert.match(styleSource, /\.archive-backlinks\.graph-mode\s*{[\s\S]*?display: none;/);
assert.match(styleSource, /\.archive-graph-view-node\s*{[\s\S]*?border-radius: 8px;/);
assert.match(styleSource, /\.archive-graph-view-node\.source\s*{/);
assert.match(styleSource, /\.archive-graph-view-node\.collection\s*{/);
assert.match(styleSource, /\.archive-graph-view-node\.topic\s*{/);
assert.match(styleSource, /\.archive-graph-view-node\.similarity\s*{/);
assert.match(styleSource, /\.archive-graph-view-node\.file,/);
assert.match(styleSource, /\.archive-graph-view-edge-label\s*{/);
assert.match(styleSource, /\.archive-graph-insight-row span b\s*{/);
assert.match(styleSource, /\.archive-graph-view-edge\.related\s*{/);
assert.match(styleSource, /\.archive-graph-view-edge\.similarity\s*{/);
assert.match(styleSource, /\.archive-graph-view-edge-label\.related\s*{/);
assert.match(styleSource, /\.archive-graph-view-edge-label\.similarity\s*{/);
assert.match(styleSource, /\.archive-graph-relationship-row\s*{/);
assert.match(styleSource, /\.archive-graph-relationship-row\.related span\s*{/);
assert.match(styleSource, /\.archive-graph-relationship-row\.similarity span,/);
assert.match(styleSource, /\.archive-graph-view-canvas\s*{[\s\S]*?#161718/);
assert.match(styleSource, /\.archive-graph-canvas-top\s*{/);
assert.match(styleSource, /\.archive-graph-pan-catcher\s*{[\s\S]*?touch-action: none;/);
assert.match(styleSource, /\.archive-graph-pan-layer\s*{/);
assert.match(styleSource, /\.archive-graph-control-hint\s*{/);
assert.match(styleSource, /\.archive-graph-workspace\s*{/);
assert.match(styleSource, /\.archive-graph-inspector\s*{/);
assert.match(styleSource, /\.archive-graph-folder-candidate\s*{/);
assert.match(html, /data-archive-graph-payload/);
assert.match(appSource, /initArchiveGraphD3/);
assert.match(appSource, /lastWorkspaceWindowMode/);
assert.match(appSource, /windowMode = isGlobalGraph \? "graph" : isArchive \? "archive" : "detail"/);
assert.match(appSource, /setWindowSize\(1360, 900\)/);
assert.match(indexSource, /node_modules\/d3\/dist\/d3\.min\.js/);
assert.match(packageSource, /"d3": "\^7\.9\.0"/);
assert.match(packageSource, /"archive-graph-d3\.js"/);
assert.match(packageSource, /"node_modules\/d3\/dist\/d3\.min\.js"/);
assert.match(d3Source, /d3\.forceSimulation/);
assert.match(d3Source, /d3\.drag/);
assert.match(d3Source, /link\.type === "related"/);
assert.match(d3Source, /link\.type === "similarity"/);
assert.doesNotMatch(d3Source, /addEventListener\("pointerdown"/);
assert.doesNotMatch(d3Source, /addEventListener\("wheel"/);
assert.match(d3Source, /node\.degree/);
assert.match(d3Source, /labelSelection/);
assert.match(mainSource, /"archive-graph-d3\.js"/);

state.projects = [
  { id: 30, name: "Levinas reading", parentId: null, note: "레비나스 전체성과무한 해설" },
  { id: 31, name: "Typography web", parentId: null, note: "타이포그래피 시스템" }
];
state.tasks = [
  { id: 40, name: "타이포그래피 시스템 정리", projectId: 31, note: "타이포그래피 활자 글꼴" }
];
state.archiveResourceLinks = [
  { resourceId: 303, targetType: "task", targetId: 40 }
];
state.selectedArchiveResourceId = 301;
state.archiveResources = [
  { id: 301, name: "레비나스 전체성과 무한 1부 해설.pdf", type: "file", path: "G:\\archive\\levinas-1.pdf", desc: "레비나스 전체성과무한 진리 정의 해설", tags: [] },
  { id: 302, name: "레비나스 존재와 달리 심층 해설.pdf", type: "file", path: "G:\\archive\\levinas-2.pdf", desc: "레비나스 존재성 주체성 무한 해설", tags: [] },
  { id: 303, name: "타이포그래피 공간의 구조.pdf", type: "file", path: "G:\\archive\\type.pdf", desc: "타이포그래피 글꼴 활자 구조", tags: ["타이포"] }
];
state.appSettings.archiveViewMode = "graph";
state.appSettings.archiveGraphDisplayMode = "graph2d";
html = renderArchiveView();
const strongRelationsStart = html.indexOf("<h3>Strong Relations</h3>");
const firstLevinasRelation = html.indexOf("레비나스", strongRelationsStart);
const firstTypographyRelation = html.indexOf("타이포그래피 공간", strongRelationsStart);
assert.ok(firstLevinasRelation > -1, "selected Levinas context should surface Levinas relations");
assert.ok(firstTypographyRelation === -1 || firstLevinasRelation < firstTypographyRelation, "irrelevant typography task backlinks should not outrank Levinas relations");

console.log("archive view modes test passed");
