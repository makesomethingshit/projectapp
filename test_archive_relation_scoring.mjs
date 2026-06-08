import assert from "node:assert/strict";
import { state } from "./state.js";
import { renderArchiveView } from "./ui-components.js";

function strongRelationRows(html) {
  const start = html.indexOf("<h3>Strong Relations</h3>");
  assert.ok(start >= 0, "Strong Relations section should render");
  const end = html.indexOf("<section", start + 1);
  const section = html.slice(start, end > start ? end : undefined);
  return [...section.matchAll(/<button[\s\S]*?archive-graph-insight-row relation[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<b>(\d+)<\/b>([\s\S]*?)<\/span>[\s\S]*?<\/button>/g)]
    .map((match) => ({
      title: match[1].replace(/<[^>]+>/g, ""),
      score: Number(match[2]),
      reason: match[3].replace(/<[^>]+>/g, "")
    }));
}

state.projects = [
  { id: 10, name: "Levinas Study", parentId: null, note: "levinas totality infinity explanation", semanticEmbedding: [1, 0, 0] },
  { id: 11, name: "Typography Site", parentId: null, note: "typography layout type system", semanticEmbedding: [0, 1, 0] }
];
state.tasks = [
  { id: 20, projectId: 11, name: "Typography system cleanup", note: "typography type grid", semanticEmbedding: [0, 1, 0] }
];
state.archiveResources = [
  {
    id: 1,
    name: "Levinas totality infinity explanation.pdf",
    type: "file",
    path: "G:\\archive\\levinas-a.pdf",
    desc: "levinas totality infinity truth justice explanation",
    tags: [],
    semanticEmbedding: [1, 0, 0]
  },
  {
    id: 2,
    name: "Levinas otherwise than being explanation.pdf",
    type: "file",
    path: "G:\\archive\\levinas-b.pdf",
    desc: "levinas subjectivity proximity responsibility explanation",
    tags: [],
    semanticEmbedding: [0.95, 0.05, 0]
  },
  {
    id: 3,
    name: "Typography space structure.pdf",
    type: "file",
    path: "G:\\archive\\type.pdf",
    desc: "typography type grid layout",
    tags: ["typography"],
    semanticEmbedding: [0, 1, 0]
  }
];
state.archiveResourceLinks = [
  { resourceId: 3, targetType: "task", targetId: 20 }
];
state.selectedArchiveResourceId = 1;
state.appSettings.archiveViewMode = "graph";

const html = renderArchiveView();
const rows = strongRelationRows(html);
assert.ok(rows.length > 0, "relation rows should be scored");

const levinasRows = rows.filter((row) => row.title.toLowerCase().includes("levinas"));
const typographyRows = rows.filter((row) => row.title.toLowerCase().includes("typography"));
assert.ok(levinasRows.length > 0, "selected context should surface Levinas rows");
assert.match(html, /Typography space structure/, "fixture should include unrelated typography material in the graph");

const bestLevinas = Math.max(...levinasRows.map((row) => row.score));
if (typographyRows.length > 0) {
  const bestTypography = Math.max(...typographyRows.map((row) => row.score));
  assert.ok(
    bestLevinas > bestTypography,
    `Levinas context score ${bestLevinas} should outrank unrelated typography score ${bestTypography}`
  );
  assert.ok(
    typographyRows.some((row) => row.reason.includes("outside active context")),
    "unrelated typography backlink should be marked as outside active context"
  );
}

console.log("archive relation scoring ok");
