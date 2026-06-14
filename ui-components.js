import { state } from "./state.js";
import { buildArchiveGraphModel } from "./archive-graph-model.js";
import { cosineSimilarity, getArchiveContentTerms } from "./archive-model.js";
import {
  archiveGraphEdgeAttrs,
  archiveGraphEdgeClass,
  archiveRelationAdjustMarkup,
  archiveRelationConfidenceBadgeMarkup,
  archiveRelationConfidenceState,
  archiveRelationGraphEdgeData,
  archiveRelationNotePreviewMarkup,
  archiveRelationReasonMarkup,
  archiveRelationReviewDeskMarkup,
  archiveRelationScopeLabel,
  selectedArchiveBacklinks as getSelectedArchiveBacklinks
} from "./archive-relation-ui.js";
import {
// ==============================================================
// FUNCTION INDEX (ui-components.js)
// --------------------------------------------------------------
// L24    escapeHtml
// L34    daysUntil
// L39    dateFromOffset
// L45    formatDueLabel
// L56    progressSegmentsMarkup
// L61    advanceSegmentsMarkup
// L66    rollupStructureMarkup
// L94    rollupPanelMarkup
// L120   benchmarkInsightMarkup
// L177   reviewPanelMarkup
// L213   workFlowSummaryMarkup
// L264   segmentsMarkup
// L276   renderImpactTrail
// L303   renderExternalInfluence
// L347   taskCardMarkup
// L390   taskSectionMarkup
// L403   getProjectMetricTypes
// L410   metricBadgesMarkup
// L432   projectListGraphsMarkup
// L452   renderViewSwitch
// L461   renderDetailHeader
// L496   projectDeadlineInfo
// L505   renderChildProjects
// L562   renderBottleneckAlertCard
// L614   renderArchiveView
// ==============================================================

  clampProgress,
  getProjectDisplayProgress,
  getProjectDisplayAdvance,
  getProject,
  getChildProjects,
  getDescendantProjectIds,
  getProjectPath,
  getProjectPathObjects,
  getProjectTasks,
  getCompletionItemKey,
  getCompletionWeight,
  getCompletionContributors,
  getRollupExplanation,
  getIncomingLinks,
  getOutgoingLinks,
  getProgressSegments,
  getAdvanceSegments,
  getBottleneckDetails,
  getBottleneckRecommendations
} from "./calculator.js";

const today = new Date();
today.setHours(0, 0, 0, 0);

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function jsonScriptContent(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const ARCHIVE_GRAPH_KIND_FILTERS = [
  { value: "all", label: "\uc804\uccb4" },
  { value: "files", label: "\ud30c\uc77c" },
  { value: "links", label: "\ub9c1\ud06c" }
];

const ARCHIVE_GRAPH_STRENGTH_FILTERS = [
  { value: "all", label: "\uc804\uccb4" },
  { value: "strong", label: "\uac15\ud55c \uc5f0\uacb0" },
  { value: "review", label: "\ud655\uc778 \ud544\uc694" }
];

function getArchiveGraphLinkTier(link) {
  const score = Number(link?.score);
  if (Number.isFinite(score) && score >= 72) return "strong";
  if (Number.isFinite(score) && score <= 58) return "review";
  return "medium";
}

function getArchiveGraphNodeTier(node) {
  const backlinks = Array.isArray(node?.backlinks) ? node.backlinks : [];
  if (backlinks.some((link) => link?.relationStatus === "suggested" || link?.relationStrength === "weak")) {
    return "review";
  }
  if (backlinks.some((link) => link?.relationStrength === "strong")) {
    return "strong";
  }
  const score = Number(node?.score);
  if (Number.isFinite(score) && score >= 78) return "strong";
  if (Number.isFinite(score) && score <= 42) return "review";
  return "medium";
}

function archiveGraphNodeMatchesKind(node, kindFilter) {
  if (kindFilter === "files") return node?.kind === "file";
  if (kindFilter === "links") return node?.kind === "link";
  return true;
}

function archiveGraphNodeMatchesStrength(node, strengthFilter) {
  if (strengthFilter === "strong") return getArchiveGraphNodeTier(node) === "strong";
  if (strengthFilter === "review") return getArchiveGraphNodeTier(node) === "review";
  return true;
}

function archiveGraphLinkMatchesStrength(link, strengthFilter) {
  if (strengthFilter === "strong") return getArchiveGraphLinkTier(link) === "strong";
  if (strengthFilter === "review") return getArchiveGraphLinkTier(link) === "review";
  return true;
}

function filterArchiveGraphPayload(payload, filters = {}) {
  const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  const links = Array.isArray(payload?.links) ? payload.links : [];
  const kindFilter = ["all", "files", "links"].includes(filters.kindFilter) ? filters.kindFilter : "all";
  const strengthFilter = ["all", "strong", "review"].includes(filters.strengthFilter) ? filters.strengthFilter : "all";
  const activeIds = new Set(nodes.filter((node) => node.active).map((node) => node.id));
  const nodeById = new Map(nodes.map((node) => [node.id, {
    ...node,
    graphFilterTier: getArchiveGraphNodeTier(node)
  }]));
  const candidateIds = new Set();

  nodes.forEach((node) => {
    if (activeIds.has(node.id)) {
      candidateIds.add(node.id);
      return;
    }
    if (!archiveGraphNodeMatchesKind(node, kindFilter)) return;
    if (!archiveGraphNodeMatchesStrength(node, strengthFilter)) return;
    candidateIds.add(node.id);
  });

  const filteredLinks = links
    .map((link) => ({
      ...link,
      graphFilterTier: getArchiveGraphLinkTier(link)
    }))
    .filter((link) => {
      if (!candidateIds.has(link.source) || !candidateIds.has(link.target)) return false;
      if (!archiveGraphLinkMatchesStrength(link, strengthFilter)) return false;
      return true;
    });

  const connectedIds = new Set(activeIds);
  filteredLinks.forEach((link) => {
    connectedIds.add(link.source);
    connectedIds.add(link.target);
  });
  if (!filteredLinks.length && !connectedIds.size) {
    nodes.slice(0, 1).forEach((node) => connectedIds.add(node.id));
  }

  const filteredNodes = nodes
    .filter((node) => candidateIds.has(node.id) && (connectedIds.has(node.id) || activeIds.has(node.id)))
    .map((node) => nodeById.get(node.id) || node);

  return {
    ...payload,
    nodes: filteredNodes,
    links: filteredLinks,
    meta: {
      ...(payload?.meta || {}),
      nodeCount: filteredNodes.length,
      relationCount: filteredLinks.length,
      graphKindFilter: kindFilter,
      graphStrengthFilter: strengthFilter,
      graphFileCount: nodes.filter((node) => node.kind === "file").length,
      graphLinkCount: nodes.filter((node) => node.kind === "link").length,
      graphStrongCount: nodes.filter((node) => getArchiveGraphNodeTier(node) === "strong").length,
      graphReviewCount: nodes.filter((node) => getArchiveGraphNodeTier(node) === "review").length,
      hiddenByGraphFilters: Math.max(0, nodes.length - filteredNodes.length)
    }
  };
}

function archiveGraphFilterButtons(filters, activeValue, dataAttribute) {
  return filters.map((filter) => `
    <button type="button" data-${dataAttribute}="${filter.value}" class="${activeValue === filter.value ? "active" : ""}">${escapeHtml(filter.label)}</button>
  `).join("");
}

function parseMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Strikethrough: ~~text~~
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // Code: `code`
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");

  // Links: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" onclick="event.stopPropagation();">$1</a>');

  // Task checkboxes: - [ ] or - [x]
  html = html.replace(/- \[\s\]\s(.*?)/g, '<label style="display: flex; align-items: center; gap: 6px; margin: 4px 0;"><input type="checkbox" disabled style="margin:0;"> <span>$1</span></label>');
  html = html.replace(/- \[x\]\s(.*?)/g, '<label style="display: flex; align-items: center; gap: 6px; margin: 4px 0;"><input type="checkbox" checked disabled style="margin:0;"> <span style="text-decoration: line-through; color: var(--muted);">$1</span></label>');

  // Bullet Lists: - item or * item
  html = html.replace(/^- (.*?)$/gm, "<ul><li>$1</li></ul>");
  html = html.replace(/^\* (.*?)$/gm, "<ul><li>$1</li></ul>");
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

export function renderArchiveView() {
  const allResources = state.archiveResources || [];
  const archiveLinks = state.archiveResourceLinks || [];
  const query = (state.searchQuery || "").trim().toLowerCase();

  const archiveSearchText = (resource) => {
    const linkedTargets = archiveLinks
      .filter((link) => Number(link.resourceId) === Number(resource.id))
      .map((link) => {
        const target = link.targetType === "task"
          ? state.tasks.find((task) => task.id === Number(link.targetId))
          : state.projects.find((project) => project.id === Number(link.targetId));
        return target?.name || "";
      });
    return [
      resource.name,
      resource.desc,
      resource.path,
      resource.type,
      ...(resource.tags || []),
      ...linkedTargets
    ].join(" ").toLowerCase();
  };

  const resources = query
    ? allResources.filter((resource) => archiveSearchText(resource).includes(query))
    : allResources;

  const archiveIcon = (type) => type === "folder" ? "\ud83d\udcc1" : type === "link" ? "\ud83d\udd17" : "\ud83d\udcc4";
  const archiveTopic = (resource) => resource.tags?.[0] || "\ubbf8\ubd84\ub958";
  const relationMetaText = (link) => {
    const strength = link.relationStrength || "medium";
    const type = link.relationType || "reference";
    const score = Number.isFinite(Number(link.relationScore)) ? `score ${Number(link.relationScore)}` : "";
    return [strength, type, score].filter(Boolean).join(" \u00b7 ");
  };
  const viewMode = ["topic", "type", "all", "graph"].includes(state.appSettings.archiveViewMode)
    ? state.appSettings.archiveViewMode
    : "topic";

  const topicGroups = resources.reduce((groups, resource) => {
    const topic = archiveTopic(resource);
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(resource);
    return groups;
  }, new Map());

  const sortedTopicEntries = [...topicGroups.entries()].sort(([a], [b]) => {
    if (a === "\ubbf8\ubd84\ub958") return 1;
    if (b === "\ubbf8\ubd84\ub958") return -1;
    return a.localeCompare(b, "ko");
  });

  const typeEntries = [
    ["\uc791\uc5c5 \ud3f4\ub354", resources.filter((resource) => resource.type === "folder")],
    ["\ubb38\uc11c\uc640 \ud30c\uc77c", resources.filter((resource) => resource.type === "file")],
    ["\uc6f9 \ub9c1\ud06c", resources.filter((resource) => resource.type === "link")]
  ];

  const archiveSections = viewMode === "type"
    ? typeEntries
    : viewMode === "all"
      ? [["\uc804\uccb4", [...resources].sort((a, b) => b.id - a.id)]]
      : sortedTopicEntries;

  const archiveViewControls = [
    ["topic", "\uc8fc\uc81c\ubcc4"],
    ["type", "\uc885\ub958\ubcc4"],
    ["all", "\uc804\uccb4"]
    , ["graph", "Graph"]
  ].map(([mode, label]) => `
    <button type="button" data-archive-view-mode="${mode}" class="${viewMode === mode ? "active" : ""}" aria-pressed="${viewMode === mode}" style="min-height: 24px; border: 0; border-radius: 4px; padding: 0 8px; background: ${viewMode === mode ? "var(--text)" : "transparent"}; color: ${viewMode === mode ? "var(--surface)" : "var(--muted)"}; font-size: 11px; font-weight: 700; cursor: pointer;">${label}</button>
  `).join("");

  const getProjectTreeSorted = (projects) => {
    const result = [];
    const visited = new Set();
    const traverse = (parentId, depth) => {
      const children = projects.filter((p) => {
        const pParentId = p.parentId === undefined ? null : p.parentId;
        const targetParentId = parentId === null ? null : Number(parentId);
        if (pParentId === null || pParentId === undefined) {
          return targetParentId === null;
        }
        return Number(pParentId) === targetParentId;
      });
      children.sort((a, b) => a.name.localeCompare(b.name, "ko"));
      for (const child of children) {
        if (visited.has(child.id)) continue;
        visited.add(child.id);
        result.push({ project: child, depth });
        traverse(child.id, depth + 1);
      }
    };
    traverse(null, 0);
    const remaining = projects.filter((p) => !visited.has(p.id));
    for (const p of remaining) {
      result.push({ project: p, depth: 0 });
    }
    return result;
  };

  // Determine Selected Resource (Obsidian Active File)
  let selectedId = state.selectedArchiveResourceId;
  if (!selectedId && resources.length > 0) {
    selectedId = resources[0].id;
  }
  const selectedResource = resources.find(r => r.id === selectedId);

  // Left Sidebar Content (Explorer List)
  const buildExplorerList = () => {
    return archiveSections.map(([sectionTitle, items]) => {
      if (!items.length) return "";
      return `
        <div class="archive-explorer-section" style="margin-bottom: 16px;">
          <h4 style="font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; padding-left: 8px; text-align: left;">${sectionTitle} (${items.length})</h4>
          <div>
            ${items.map(item => `
              <div class="archive-explorer-item-row ${Number(item.id) === Number(selectedId) ? "active" : ""}">
                <button type="button" class="archive-explorer-item js-archive-item ${Number(item.id) === Number(selectedId) ? "active" : ""}" data-select-archive-id="${item.id}" data-resource-id="${item.id}" data-resource-path="${escapeHtml(item.path)}">
                  <span class="archive-explorer-item-icon">${archiveIcon(item.type)}</span>
                  <span class="archive-explorer-item-name">${escapeHtml(item.name)}</span>
                </button>
                ${item.path ? `
                  <button type="button" class="archive-explorer-open-link" data-open-archive-path="${escapeHtml(item.path)}" data-archive-type="${escapeHtml(item.type)}" title="\uc5f4\uae30" aria-label="${escapeHtml(item.name)} \uc5f4\uae30">\uc5f4\uae30</button>
                ` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("");
  };

  // Right Panel Content (Backlinks / Connections)
  const buildBacklinksPanel = () => {
    if (!selectedResource) return `<p class="notice" style="font-size: 11px;">\uc120\ud0dd\ud55c \ud56d\ubaa9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</p>`;

    const linked = archiveLinks
      .filter((link) => Number(link.resourceId) === Number(selectedResource.id))
      .map((link) => {
        const target = link.targetType === "task"
          ? state.tasks.find((task) => task.id === Number(link.targetId))
          : state.projects.find((project) => project.id === Number(link.targetId));
        return { link, target };
      })
      .filter(item => item.target);

    const linkedMarkup = linked.length ? linked.map(({ link, target }) => `
      <div class="backlink-item">
        <div class="backlink-item-top">
          <span class="backlink-item-title" title="${escapeHtml(target.name)}">${escapeHtml(target.name)}</span>
          <button type="button" class="mock-button delete-archive-btn" data-detach-archive-target="${selectedResource.id}" data-target-id="${target.id}" data-target-type="${link.targetType}" title="\uc5f0\uacb0 \ud574\uc81c" style="background:none; border:none; color:var(--coral); cursor:pointer; font-size:14px; line-height:1; padding:0;">\u00d7</button>
        </div>
        <div class="backlink-item-meta">
          <span>${link.targetType === "task" ? "할 일" : "프로젝트"}</span>
          ${archiveRelationConfidenceBadgeMarkup(link)}
        </div>
        ${archiveRelationNotePreviewMarkup(link)}
        ${archiveRelationReasonMarkup(link)}
        ${target.note ? `<p class="backlink-item-desc">${escapeHtml(target.note)}</p>` : ""}
        ${archiveRelationAdjustMarkup(link)}
      </div>
    `).join("") : `<p class="notice" style="font-size: 11px; margin-bottom: 12px;">\ud560 \uc77c\uacfc \uc5f0\uacb0\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</p>`;

    const linkedTaskIds = new Set(linked.filter(item => item.link.targetType === "task").map(item => Number(item.target.id)));
    const sortedProjectIds = getProjectTreeSorted(state.projects).map((item) => item.project.id);
    const taskProjectRank = new Map(sortedProjectIds.map((id, index) => [Number(id), index]));
    const availableTasks = state.tasks
      .filter((task) => !linkedTaskIds.has(Number(task.id)))
      .sort((a, b) => {
        const projectOrder = (taskProjectRank.get(Number(a.projectId)) ?? 9999) - (taskProjectRank.get(Number(b.projectId)) ?? 9999);
        return projectOrder || String(a.name || "").localeCompare(String(b.name || ""), "ko");
      });

    const optionsMarkup = availableTasks
      .map((task) => {
        const project = getProject(task.projectId);
        const prefix = project ? `${project.name} \u00b7 ` : "";
        return `<option value="${task.id}">${escapeHtml(prefix)}${escapeHtml(task.name)}</option>`;
      })
      .join("");

    const selectMarkup = availableTasks.length ? `
      <select data-attach-archive-target="${selectedResource.id}" data-target-type="task" aria-label="\uc544\uce74\uc774\ube0c \ud560 \uc77c \uc5f0\uacb0" style="width: 100%; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 11px; margin-top: 8px;">
        <option value="">+ \ud560 \uc77c\uc5d0 \uc5f0\uacb0</option>
        ${optionsMarkup}
      </select>
    ` : "";

    return `
      <div>
        <div style="margin-bottom: 16px;">
          ${linkedMarkup}
        </div>
        ${selectMarkup}
      </div>
    `;
  };

  const buildKnowledgeGraphPanel = () => {
    if (!selectedResource) return "";

    const selectedTags = new Set((selectedResource.tags || []).map((tag) => String(tag).toLowerCase()));
    const linkedTargets = archiveLinks
      .filter((link) => Number(link.resourceId) === Number(selectedResource.id))
      .map((link) => {
        const target = link.targetType === "task"
          ? state.tasks.find((task) => task.id === Number(link.targetId))
          : state.projects.find((project) => project.id === Number(link.targetId));
        return target ? { link, target } : null;
      })
      .filter(Boolean);
    const graphScopeResources = query ? resources : allResources;
    const relatedResources = graphScopeResources
      .filter((resource) => Number(resource.id) !== Number(selectedResource.id))
      .map((resource) => {
        const sharedTags = (resource.tags || []).filter((tag) => selectedTags.has(String(tag).toLowerCase()));
        return { resource, sharedTags };
      })
      .filter((item) => item.sharedTags.length)
      .slice(0, 6);
    const graphNodes = [
      `<span class="archive-graph-node active" title="${escapeHtml(selectedResource.path)}">${escapeHtml(selectedResource.name)}</span>`,
      ...linkedTargets.map(({ link, target }) => (
        `<span class="archive-graph-node ${link.targetType === "task" ? "task" : "project"}" title="${link.targetType}">${escapeHtml(target.name)}</span>`
      )),
      ...relatedResources.map(({ resource, sharedTags }) => (
        `<span class="archive-graph-node resource" title="${escapeHtml(sharedTags.join(", "))}">${escapeHtml(resource.name)}</span>`
      ))
    ];
    const relationRows = [
      ...linkedTargets.map(({ link, target }) => `
        <div class="archive-graph-edge">
          <strong>${escapeHtml(selectedResource.name)}</strong>
          <span>linked to</span>
          <strong>${escapeHtml(target.name)}</strong>
          <em>${link.targetType}</em>
        </div>
      `),
      ...relatedResources.map(({ resource, sharedTags }) => `
        <div class="archive-graph-edge">
          <strong>${escapeHtml(selectedResource.name)}</strong>
          <span>shares tag</span>
          <strong>${escapeHtml(resource.name)}</strong>
          <em>${escapeHtml(sharedTags.join(", "))}</em>
        </div>
      `)
    ];
    const indexRows = graphScopeResources
      .map((resource) => {
        const linkCount = archiveLinks.filter((link) => Number(link.resourceId) === Number(resource.id)).length;
        return { resource, linkCount };
      })
      .sort((a, b) => b.linkCount - a.linkCount || String(a.resource.name).localeCompare(String(b.resource.name), "ko"))
      .slice(0, 8)
      .map(({ resource, linkCount }) => `
        <div class="archive-agent-index-row">
          <span class="archive-agent-index-name">${escapeHtml(resource.name)}</span>
          <span>${escapeHtml((resource.tags || []).join(", ") || "untagged")}</span>
          <strong>${linkCount}</strong>
        </div>
      `)
      .join("");

    return `
      <section class="archive-knowledge-graph" aria-label="Archive knowledge graph">
        <div class="archive-panel-title">
          <h4>Knowledge Graph</h4>
          <span>${linkedTargets.length + relatedResources.length} links</span>
        </div>
        <div class="archive-graph-map">
          ${graphNodes.join("")}
        </div>
        <div class="archive-graph-edges">
          ${relationRows.length ? relationRows.join("") : `<p class="notice">No graph signal yet.</p>`}
        </div>
      </section>
      <section class="archive-agent-index" aria-label="Archive agent index">
        <div class="archive-panel-title">
          <h4>Agent Index</h4>
          <span>${graphScopeResources.length} notes</span>
        </div>
        <div class="archive-agent-index-head">
          <span>note</span>
          <span>tags</span>
          <span>links</span>
        </div>
        ${indexRows || `<p class="notice">No archive resources.</p>`}
      </section>
    `;
  };

  const buildArchiveGraphView = () => {
    const graphLimit = 72;
    const nodes = [];
    const edges = [];
    const nodeById = new Map();
    const edgeKeys = new Set();
    const addNode = (node) => {
      if (nodeById.has(node.id)) {
        const existing = nodeById.get(node.id);
        existing.count = Math.max(existing.count || 0, node.count || 0);
        existing.active = existing.active || node.active;
        if (!existing.attrs && node.attrs) existing.attrs = node.attrs;
        return existing;
      }
      nodeById.set(node.id, node);
      nodes.push(node);
      return node;
    };
    const addEdge = (edge) => {
      if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return;
      const key = `${edge.from}->${edge.to}:${edge.type || "link"}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push(edge);
    };
    const normalizeKey = (value) => String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\uac00-\ud7a3-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled";
    const resourcePath = (resource) => String(resource.path || "");
    const resourceTags = (resource) => Array.isArray(resource.tags) ? resource.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
    const hasTag = (resource, tag) => resourceTags(resource).some((value) => value.toLowerCase() === tag);
    const isPreciousReference = (resource) => {
      const path = resourcePath(resource).toLowerCase();
      return path.startsWith("g:\\글쓴거".toLowerCase())
        || hasTag(resource, "reference-library")
        || hasTag(resource, "\uae00\uc4f4\uac70");
    };
    const getSource = (resource) => {
      return { id: "source:archive-index", label: "Archive Index", root: "Archive", meta: "migration candidates" };
    };
    const getCollection = (resource, source) => {
      const label = resourceTags(resource).find((tag) => !["reference-library", "g-drive", "source"].includes(tag.toLowerCase())) || resource.type || "Resources";
      return { id: `collection:${source.id}:${normalizeKey(label)}`, label, meta: "collection" };
    };
    const topicStopTags = new Set(["reference-library", "g-drive", "c-drive", "d-drive", "source", "storage", "collection", "folder", "file", "link", "note/doc", "note-doc", "image/design", "image-design", "media", "archive", "local", "drive", "root", "asset", "assets", "resource", "resources", "reference", "references", "doc", "docs", "document", "documents", "google", "pdf", "txt", "md", "hwp", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "webp", "gif", "zip", "rar", "mp4", "mp3", "psd", "indd", "gpt", "글쓴거", "주신거", "선생님이", "교수님이"]);
    ["kind", "size", "mb", "items", "item"].forEach((term) => topicStopTags.add(term));
    const contentStopWords = new Set([...topicStopTags, "copy", "draft", "external", "final", "scan", "temp", "new", "old", "version", "ver", "note", "notes", "paper", "papers", "seminar", "material", "materials", "guide", "summary", "indexed", "index", "google", "docs", "the", "and", "for", "from", "with", "of"]);
    const isManagementTerm = (value) => {
      const key = normalizeKey(value).replace(/^\./, "");
      if (!key || key.length < 2) return true;
      if (topicStopTags.has(key)) return true;
      if (key.includes("주신거") || key.includes("글쓴거")) return true;
      if (/^[a-z]:$/.test(key) || /^[a-z]-drive$/.test(key)) return true;
      if (/^\d+$/.test(key)) return true;
      return false;
    };
    const getTopics = (resource) => getArchiveContentTerms(resource).slice(0, 4);
    const similarityStopWords = new Set([...contentStopWords, "project", "projects", "study", "text"]);
    const getSimilarityTerms = (resource) => {
      const terms = new Set();
      getTopics(resource).forEach((topic) => {
        const key = normalizeKey(topic);
        if (key.length > 2 && !similarityStopWords.has(key)) terms.add(key);
      });
      return [...terms].slice(0, 10);
    };
    const semanticSimilarityBetween = (a, b) => {
      const aEmbedding = Array.isArray(a?.semanticEmbedding) ? a.semanticEmbedding : [];
      const bEmbedding = Array.isArray(b?.semanticEmbedding) ? b.semanticEmbedding : [];
      return aEmbedding.length && bEmbedding.length ? cosineSimilarity(aEmbedding, bEmbedding) : 0;
    };
    const scopeResources = resources.slice(0, graphLimit);
    const selectedTerms = new Set(selectedResource ? [...getTopics(selectedResource), ...getSimilarityTerms(selectedResource)].map((term) => normalizeKey(term)) : []);
    const relationScore = (resource) => {
      if (selectedResource && Number(resource.id) === Number(selectedResource.id)) return 4;
      const semanticScore = semanticSimilarityBetween(resource, selectedResource);
      if (semanticScore >= 0.5) return 3.5 + semanticScore;
      const terms = [...getTopics(resource), ...getSimilarityTerms(resource)].map((term) => normalizeKey(term));
      return terms.some((term) => selectedTerms.has(term)) ? 3 : 1;
    };
    const selectedLinks = selectedResource
      ? archiveLinks
        .filter((link) => Number(link.resourceId) === Number(selectedResource.id))
        .map((link) => {
          const target = link.targetType === "task"
            ? state.tasks.find((task) => Number(task.id) === Number(link.targetId))
            : state.projects.find((project) => Number(project.id) === Number(link.targetId));
          return target ? { link, target } : null;
        })
        .filter(Boolean)
      : [];
    const graphResources = scopeResources
      .filter((resource) => resource.type !== "folder")
      .sort((a, b) => relationScore(b) - relationScore(a) || Number(b.id) - Number(a.id))
      .slice(0, 18);
    graphResources.forEach((resource, index, list) => {
      const isSelected = Number(resource.id) === Number(selectedResource?.id);
      const angle = (Math.PI * 2 * index) / Math.max(list.length, 1) - Math.PI / 2;
      const radiusX = isSelected ? 0 : 30;
      const radiusY = isSelected ? 0 : 27;
      addNode({
        id: `resource:${resource.id}`,
        type: resource.type === "link" ? "link" : "file",
        label: resource.name,
        meta: resource.type,
        x: isSelected ? 50 : 50 + Math.cos(angle) * radiusX,
        y: isSelected ? 50 : 50 + Math.sin(angle) * radiusY,
        active: isSelected,
        score: isSelected ? 100 : Math.round(relationScore(resource) * 20),
        semanticScore: semanticSimilarityBetween(resource, selectedResource),
        relationClass: isSelected ? "selected-resource" : "",
        attrs: `data-select-archive-id="${resource.id}" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}"`
      });
    });
    selectedLinks.slice(0, 8).forEach(({ link, target }, index, list) => {
      const confidence = archiveRelationConfidenceState(link);
      const targetType = link.targetType === "task" ? "task" : "project";
      const nodeId = `${targetType}:${Number(target.id)}`;
      const row = list.length <= 1 ? 0.5 : index / Math.max(1, list.length - 1);
      addNode({
        id: nodeId,
        type: targetType,
        label: target.name,
        meta: targetType === "task" ? "linked task" : "linked project",
        x: 84,
        y: 22 + row * 56,
        active: false,
        count: confidence.score,
        relationClass: `direct-relation ${confidence.strength} ${link.relationStatus === "suggested" ? "review" : ""}`,
        attrs: targetType === "task" ? `data-open-note="${Number(target.id)}"` : `data-select-project="${Number(target.id)}"`
      });
      addEdge({
        from: `resource:${selectedResource.id}`,
        to: nodeId,
        type: "link",
        label: targetType === "task" ? "\ud560\uc77c \uc5f0\uacb0" : "\ud504\ub85c\uc81d\ud2b8 \uc5f0\uacb0",
        score: confidence.score,
        ...archiveRelationGraphEdgeData(link)
      });
    });

    const topicCounts = new Map();
    graphResources.forEach((resource) => getTopics(resource).forEach((topic) => {
      const key = normalizeKey(topic);
      const entry = topicCounts.get(topic) || { count: 0, active: false };
      entry.count += 1;
      entry.active = entry.active || selectedTerms.has(key);
      topicCounts.set(topic, entry);
    }));
    const topicEntries = [...topicCounts.entries()]
      .filter(([, entry]) => entry.count >= 1)
      .sort((a, b) => Number(b[1].active) - Number(a[1].active) || b[1].count - a[1].count || a[0].localeCompare(b[0], "ko"))
      .slice(0, 8);
    const visibleFileNodes = nodes.filter((node) => node.type === "file" || node.type === "link");
    const resourceByNodeId = new Map(scopeResources.map((resource) => [`resource:${resource.id}`, resource]));
    const visibleFileNodeIds = new Set(visibleFileNodes.map((node) => node.id));
    const similarityGroups = new Map();
    scopeResources
      .filter((resource) => resource.type !== "folder")
      .forEach((resource) => {
        getSimilarityTerms(resource).forEach((term) => {
          if (!similarityGroups.has(term)) similarityGroups.set(term, []);
          similarityGroups.get(term).push(resource);
        });
      });
    const similarityEntries = [...similarityGroups.entries()]
      .map(([term, groupResources]) => ({
        term,
        resources: groupResources.filter((resource) => visibleFileNodeIds.has(`resource:${resource.id}`)),
        total: groupResources.length,
        selected: selectedResource ? groupResources.some((resource) => Number(resource.id) === Number(selectedResource.id)) : false
      }))
      .filter((entry) => entry.resources.length >= 2)
      .filter((entry) => entry.total <= 18)
      .sort((a, b) => Number(b.selected) - Number(a.selected) || b.total - a.total || a.term.localeCompare(b.term, "ko"))
      .slice(0, 2);
    const folderCandidateRows = [...similarityGroups.entries()]
      .map(([term, groupResources]) => ({
        term,
        total: groupResources.length,
        selected: selectedResource ? groupResources.some((resource) => Number(resource.id) === Number(selectedResource.id)) : false,
        examples: groupResources.slice(0, 3).map((resource) => resource.name)
      }))
      .filter((entry) => entry.total > 18)
      .sort((a, b) => Number(b.selected) - Number(a.selected) || b.total - a.total || a.term.localeCompare(b.term, "ko"))
      .slice(0, 5)
      .map((entry) => `
        <div class="archive-graph-folder-candidate ${entry.selected ? "active" : ""}">
          <strong>${escapeHtml(entry.term)}</strong>
          <span>${entry.total} materials - make a folder</span>
          <em>${escapeHtml(entry.examples.join(", "))}</em>
        </div>
      `).join("");
    const relatedEdgeLimit = 18;
    let relatedEdgeCount = 0;
    for (let i = 0; i < visibleFileNodes.length; i += 1) {
      for (let j = i + 1; j < visibleFileNodes.length; j += 1) {
        if (relatedEdgeCount >= relatedEdgeLimit) break;
        const a = resourceByNodeId.get(visibleFileNodes[i].id);
        const b = resourceByNodeId.get(visibleFileNodes[j].id);
        if (!a || !b) continue;
        const aTopics = new Set(getTopics(a).map((topic) => topic.toLowerCase()));
        const sharedTopics = getTopics(b).filter((topic) => aTopics.has(topic.toLowerCase()));
        const semanticScore = semanticSimilarityBetween(a, b);
        if (!sharedTopics.length && semanticScore < 0.5) continue;
        addEdge({
          from: visibleFileNodes[i].id,
          to: visibleFileNodes[j].id,
          type: "related",
          label: sharedTopics.length ? `resonates ${sharedTopics[0]}` : "semantic match",
          score: Math.round(semanticScore * 100)
        });
        relatedEdgeCount += 1;
      }
    }

    const degreeMap = new Map(nodes.map((node) => [node.id, 0]));
    edges.forEach((edge) => {
      degreeMap.set(edge.from, (degreeMap.get(edge.from) || 0) + 1);
      degreeMap.set(edge.to, (degreeMap.get(edge.to) || 0) + 1);
    });
    const edgeMarkup = edges.map((edge, index) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      const edgeId = edge.relationEdgeKey || `edge:${index}:${edge.from}->${edge.to}`;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const edgeClass = archiveGraphEdgeClass(edge);
      const edgeAttrs = archiveGraphEdgeAttrs(edge);
      return `
        <line class="archive-graph-view-edge ${edgeClass}" data-archive-graph-edge="${escapeHtml(edgeId)}" ${edgeAttrs} x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" marker-end="url(#archive-graph-arrow-${edge.type || "link"})" />
        <text class="archive-graph-view-edge-label ${edgeClass}" data-archive-graph-edge-label="${escapeHtml(edgeId)}" ${edgeAttrs} x="${midX}" y="${midY}">${escapeHtml(edge.label || edge.type || "links")}</text>
      `;
    }).join("");
    const nodeMarkup = nodes.map((node) => `
      <button type="button" class="archive-graph-view-node ${node.type} ${node.relationClass || ""} ${node.active ? "active" : ""} ${(degreeMap.get(node.id) || 0) >= 4 ? "hub" : ""}" ${node.attrs || ""} style="--x:${node.x}%; --y:${node.y}%;" data-archive-graph-node="${escapeHtml(node.id)}" data-archive-node-degree="${degreeMap.get(node.id) || 0}">
        <i class="archive-graph-node-mark" aria-hidden="true"></i>
        <span class="archive-graph-node-copy">
          <strong>${escapeHtml(node.label)}</strong>
          <span>${escapeHtml(node.meta || node.type)}</span>
        </span>
        <em>${node.count || degreeMap.get(node.id) || 0}</em>
      </button>
    `).join("");
    const hiddenCount = Math.max(0, resources.length - graphResources.length);
    const selectedNodeId = selectedResource ? `resource:${selectedResource.id}` : null;
    const relationTopicFrequency = new Map();
    edges.forEach((edge) => {
      const sharedMatch = String(edge.label || "").match(/resonates\s+(.+)/);
      if (sharedMatch) {
        const key = normalizeKey(sharedMatch[1]);
        relationTopicFrequency.set(key, (relationTopicFrequency.get(key) || 0) + 1);
      }
      if (edge.type === "similarity") {
        const similarityNode = nodeById.get(edge.from)?.type === "similarity" ? nodeById.get(edge.from) : nodeById.get(edge.to);
        const key = normalizeKey(String(similarityNode?.label || "").replace(/^~\s*/, ""));
        if (key) relationTopicFrequency.set(key, (relationTopicFrequency.get(key) || 0) + 1);
      }
    });
    const scoreRelationship = (edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      let score = edge.type === "link" ? 72 : edge.type === "related" ? 46 : edge.type === "similarity" ? 34 : 12;
      const reasons = [];
      if (edge.type === "link") reasons.push("project/task backlink");
      if (edge.type === "related") reasons.push(edge.label === "semantic match" ? "semantic match" : "shared topic");
      if (edge.type === "similarity") reasons.push("small similarity cluster");
      if (selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId)) {
        score += 14;
        reasons.push("selected material");
      }
      const fromDegree = degreeMap.get(edge.from) || 0;
      const toDegree = degreeMap.get(edge.to) || 0;
      score += Math.min(8, Math.ceil(Math.sqrt(fromDegree + toDegree)));
      if (fromDegree + toDegree >= 4) reasons.push("well connected");
      const sharedMatch = String(edge.label || "").match(/resonates\s+(.+)/);
      if (sharedMatch) {
        const frequency = relationTopicFrequency.get(normalizeKey(sharedMatch[1])) || 0;
        if (frequency >= 4) score -= Math.min(12, frequency * 2);
        reasons.push(`#${sharedMatch[1]}`);
      }
      if (edge.type === "similarity") {
        const similarityNode = from?.type === "similarity" ? from : to;
        const frequency = relationTopicFrequency.get(normalizeKey(String(similarityNode?.label || "").replace(/^~\s*/, ""))) || 0;
        if (frequency >= 4) score -= Math.min(10, frequency * 2);
      }
      if (selectedNodeId && edge.from !== selectedNodeId && edge.to !== selectedNodeId) {
        const edgeTerms = new Set();
        [edge.from, edge.to].forEach((nodeId) => {
          const node = nodeById.get(nodeId);
          const resource = resourceByNodeId.get(nodeId);
          if (resource) {
            [...getTopics(resource), ...getSimilarityTerms(resource)].forEach((term) => edgeTerms.add(normalizeKey(term)));
          }
          if (node?.type === "topic") {
            edgeTerms.add(normalizeKey(String(node.label || "").replace(/^#/, "")));
          }
          if (node?.type === "similarity") {
            edgeTerms.add(normalizeKey(String(node.label || "").replace(/^~\s*/, "")));
          }
        });
        const matchesSelectedContext = [...edgeTerms].some((term) => selectedTerms.has(term));
        if (!matchesSelectedContext) {
          score = Math.round(score * 0.42);
          reasons.push("outside active context");
        }
      }
      if (from?.active || to?.active) {
        score += 8;
        if (!reasons.includes("selected material")) reasons.push("active context");
      }
      const cap = edge.type === "link" ? 92 : edge.type === "related" ? 68 : edge.type === "similarity" ? 56 : 40;
      return { edge, from, to, score: Math.max(1, Math.min(cap, score)), reasons };
    };
    const relationshipStrengthRows = edges
      .filter((edge) => edge.type === "similarity" || edge.type === "related" || edge.type === "link")
      .map(scoreRelationship)
      .sort((a, b) => b.score - a.score || String(a.edge.label || "").localeCompare(String(b.edge.label || ""), "ko"))
      .slice(0, 5)
      .map(({ edge, from, to, score, reasons }) => {
        return `
          <button type="button" class="archive-graph-insight-row relation ${edge.type || "link"}" data-archive-graph-node-ref="${escapeHtml(edge.from)}">
            <strong>${escapeHtml(from?.label || edge.from)} -> ${escapeHtml(to?.label || edge.to)}</strong>
            <span><b>${score}</b> ${escapeHtml(reasons.slice(0, 3).join(" / ") || edge.label || edge.type || "links")}</span>
          </button>
        `;
      }).join("");
    const materialRows = [...nodes]
      .filter((node) => node.type === "file" || node.type === "link")
      .sort((a, b) => Number(b.active) - Number(a.active) || (b.score || 0) - (a.score || 0) || (degreeMap.get(b.id) || 0) - (degreeMap.get(a.id) || 0))
      .slice(0, 7)
      .map((node) => `
        <button type="button" class="archive-graph-insight-row" data-archive-graph-node-ref="${escapeHtml(node.id)}">
          <strong>${escapeHtml(node.label)}</strong>
          <span>${degreeMap.get(node.id) || 0} connections</span>
        </button>
      `).join("");
    const topicRows = topicEntries
      .slice(0, 7)
      .map(([topic, entry]) => `
        <button type="button" class="archive-graph-insight-row">
          <strong>#${escapeHtml(topic)}</strong>
          <span>${entry.active ? "active context / " : ""}${entry.count || 0} references</span>
        </button>
      `).join("");
    const similarityRows = similarityEntries
      .slice(0, 7)
      .map((entry) => `
        <button type="button" class="archive-graph-insight-row similarity">
          <strong>~ ${escapeHtml(entry.term)}</strong>
          <span>${entry.total || 0} similar materials</span>
        </button>
      `).join("");
    const selectedBacklinkRows = selectedLinks.slice(0, 5).map(({ link, target }) => `
      <button type="button" class="archive-graph-insight-row" ${link.targetType === "task" ? `data-open-note="${target.id}"` : `data-select-project="${target.id}"`}>
        <strong>${escapeHtml(target.name)}</strong>
        <span>${link.targetType} \u00b7 ${escapeHtml(relationMetaText(link))}</span>
      </button>
    `).join("");
    const unclusteredRows = scopeResources
      .filter((resource) => !getTopics(resource).length)
      .slice(0, 5)
      .map((resource) => `
        <button type="button" class="archive-graph-insight-row weak" data-select-archive-id="${resource.id}">
          <strong>${escapeHtml(resource.name)}</strong>
          <span>needs tags</span>
        </button>
      `).join("");
    const relationshipRows = edges
      .filter((edge) => edge.type === "similarity" || edge.type === "related" || edge.type === "link")
      .map(scoreRelationship)
      .sort((a, b) => b.score - a.score || String(a.edge.label || "").localeCompare(String(b.edge.label || ""), "ko"))
      .slice(0, 6)
      .map(({ edge }) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        return `
          <div class="archive-graph-relationship-row ${edge.type || "link"}">
            <strong>${escapeHtml(from?.label || edge.from)}</strong>
            <span>${escapeHtml(edge.label || edge.type || "links")}</span>
            <strong>${escapeHtml(to?.label || edge.to)}</strong>
          </div>
        `;
      }).join("");
    const graphPayload = {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        meta: node.meta || node.type,
        x: node.x,
        y: node.y,
        active: Boolean(node.active),
        degree: degreeMap.get(node.id) || 0,
        relationClass: node.relationClass || ""
      })),
      links: edges.map((edge) => ({
        source: edge.from,
        target: edge.to,
        from: edge.from,
        to: edge.to,
        type: edge.type || "link",
        label: edge.label || edge.type || "link",
        relationEdgeKey: edge.relationEdgeKey || "",
        resourceId: edge.resourceId || null,
        targetType: edge.targetType || "",
        targetId: edge.targetId || null,
        relationStrength: edge.relationStrength || "",
        relationScore: Number.isFinite(Number(edge.relationScore)) ? Number(edge.relationScore) : null,
        relationStatus: edge.relationStatus || ""
      }))
    };
    const graphDisplayMode = state.appSettings.archiveGraphDisplayMode === "graph2d" ? "graph2d" : "graph3d";
    const graphDepth = [1, 2, 3, 4].includes(Number(state.appSettings.archiveGraphDepth))
      ? Number(state.appSettings.archiveGraphDepth)
      : 2;
    const graphKindFilter = ["all", "files", "links"].includes(state.appSettings.archiveGraphKindFilter)
      ? state.appSettings.archiveGraphKindFilter
      : "all";
    const graphStrengthFilter = ["all", "strong", "review"].includes(state.appSettings.archiveGraphStrengthFilter)
      ? state.appSettings.archiveGraphStrengthFilter
      : "all";
    const graphFiltersCollapsed = state.appSettings.archiveGraphFiltersCollapsed === true;
    const rawGraph3dPayload = buildArchiveGraphModel(state, {
      depth: graphDepth,
      limit: 72,
      edgeLimit: 120
    });
    const graph3dPayload = filterArchiveGraphPayload(rawGraph3dPayload, {
      kindFilter: graphKindFilter,
      strengthFilter: graphStrengthFilter
    });
    const graphDepthLabel = graphDepth === 1
      ? "\uc9c1\uc811 \uc5f0\uacb0"
      : graphDepth === 2
        ? "\ud55c \ubc88 \ub354"
        : "\ub113\uac8c \ubcf4\uae30";
    const graphDepthHelp = graphDepth === 1
      ? "\uc120\ud0dd \uc790\ub8cc\uc5d0\uc11c \uc5b4\ub514\uae4c\uc9c0 \ud3bc\uce60\uc9c0 \u00b7 \uc9c1\uc811 \uc5f0\uacb0\ub9cc"
      : graphDepth === 2
        ? "\uc120\ud0dd \uc790\ub8cc\uc5d0\uc11c \uc5b4\ub514\uae4c\uc9c0 \ud3bc\uce60\uc9c0 \u00b7 \uc9c1\uc811 \uc5f0\uacb0\uc5d0\uc11c \ud55c \ubc88 \ub354 \ud655\uc7a5"
        : "\uc120\ud0dd \uc790\ub8cc\uc5d0\uc11c \uc5b4\ub514\uae4c\uc9c0 \ud3bc\uce60\uc9c0 \u00b7 \uad00\ub828 \uc790\ub8cc\ub97c \ub113\uac8c \ud3bc\uce68";
    const graphFilterHelp = graph3dPayload.meta.hiddenByGraphFilters
      ? `${graph3dPayload.meta.hiddenByGraphFilters} hidden by filters`
      : "filters show the full local space";
    const graphKindLabel = ARCHIVE_GRAPH_KIND_FILTERS.find((item) => item.value === graphKindFilter)?.label || "\uc804\uccb4";
    const graphStrengthLabel = ARCHIVE_GRAPH_STRENGTH_FILTERS.find((item) => item.value === graphStrengthFilter)?.label || "\uc804\uccb4";
    const graphFilterSummary = `${graphDepthLabel} \u00b7 ${graphKindLabel} \u00b7 ${graphStrengthLabel}`;
    const graphFiltersDirty = graphDepth !== 2 || graphKindFilter !== "all" || graphStrengthFilter !== "all";

    return `
      <section class="archive-graph-view" data-archive-graph-view aria-label="Archive graph view">
        <div class="archive-graph-view-header">
          <div>
            <p>Space Observatory</p>
            <h2>Space</h2>
            <span>\uc120\ud0dd \uc790\ub8cc\ub97c \uc911\uc2ec\uc73c\ub85c \uc2e0\ub8b0\ub3c4\uc640 \uad00\uacc4\ub97c \uad00\uce21</span>
            <div class="archive-graph-mode-toggle" role="group" aria-label="Space graph renderer">
              <button type="button" class="${graphDisplayMode === "graph3d" ? "active" : ""}" data-archive-graph-display-mode="graph3d">3D Graph</button>
              <button type="button" class="${graphDisplayMode === "graph2d" ? "active" : ""}" data-archive-graph-display-mode="graph2d">2D Map</button>
            </div>
          </div>
          <dl>
            <div><dt>materials</dt><dd>${rawGraph3dPayload.meta.materialCount}</dd></div>
            <div><dt>visible</dt><dd>${graph3dPayload.meta.nodeCount}</dd></div>
            <div><dt>depth</dt><dd>${graph3dPayload.meta.focusDepth}</dd></div>
            <div><dt>relations</dt><dd>${graph3dPayload.meta.relationCount}</dd></div>
          </dl>
        </div>
        <div class="archive-graph-workspace">
          ${graphDisplayMode === "graph3d" ? `
          <section class="archive-graph-3d" data-archive-graph-3d aria-label="Archive 3D graph">
            <div class="archive-graph-3d-toolbar">
              <span>Focus neighborhood</span>
              <small class="archive-graph-depth-note">${escapeHtml(graphDepthHelp)} \u00b7 ${escapeHtml(graphFilterHelp)}</small>
            </div>
            <div class="archive-graph-filter-rail${graphFiltersCollapsed ? " collapsed" : ""}" aria-label="Space graph filters">
              <div class="archive-graph-filter-actions">
                <button
                  type="button"
                  class="archive-graph-filter-summary-button"
                  data-archive-graph-filters-collapsed="${graphFiltersCollapsed ? "false" : "true"}"
                  aria-expanded="${graphFiltersCollapsed ? "false" : "true"}"
                  title="Space filters"
                >
                  <span>\ud544\ud130</span>
                  <strong class="archive-graph-filter-summary">${escapeHtml(graphFilterSummary)}</strong>
                  <i aria-hidden="true">${graphFiltersCollapsed ? "\u25be" : "\u25b4"}</i>
                </button>
                ${graphFiltersDirty ? `
                  <button
                    type="button"
                    class="archive-graph-filter-reset-button"
                    data-archive-graph-filter-reset
                    aria-label="Space \ud544\ud130 \ucd08\uae30\ud654"
                    title="Space \ud544\ud130 \ucd08\uae30\ud654"
                  >\u21ba</button>
                ` : ""}
              </div>
              <div class="archive-graph-filter-group" role="group" aria-label="\ubc94\uc704">
                <span>\ubc94\uc704</span>
                <div>
                  <button type="button" data-archive-graph-depth="1" class="${graphDepth === 1 ? "active" : ""}">\uc9c1\uc811 \uc5f0\uacb0</button>
                  <button type="button" data-archive-graph-depth="2" class="${graphDepth === 2 ? "active" : ""}">\ud55c \ubc88 \ub354</button>
                  <button type="button" data-archive-graph-depth="3" class="${graphDepth === 3 ? "active" : ""}">\ub113\uac8c \ubcf4\uae30</button>
                </div>
              </div>
              <div class="archive-graph-filter-group" role="group" aria-label="\uc790\ub8cc\uc885\ub958">
                <span>\uc790\ub8cc\uc885\ub958</span>
                <div>${archiveGraphFilterButtons(ARCHIVE_GRAPH_KIND_FILTERS, graphKindFilter, "archive-graph-kind-filter")}</div>
              </div>
              <div class="archive-graph-filter-group" role="group" aria-label="\uc2e0\ub8b0\ub3c4">
                <span>\uc2e0\ub8b0\ub3c4</span>
                <div>${archiveGraphFilterButtons(ARCHIVE_GRAPH_STRENGTH_FILTERS, graphStrengthFilter, "archive-graph-strength-filter")}</div>
              </div>
            </div>
            <div class="archive-graph-3d-canvas" data-archive-graph-3d-canvas></div>
            <div class="archive-graph-3d-hint">\uc120\ud0dd \uc790\ub8cc \u00b7 \uc9c1\uc811 \uc5f0\uacb0 \u00b7 \ud55c \ubc88 \ub354 \ud655\uc7a5</div>
            <script type="application/json" data-archive-graph-3d-payload>${jsonScriptContent(graph3dPayload)}</script>
          </section>
          ` : `
          <div class="archive-graph-view-canvas">
            <div class="archive-graph-canvas-top">
              <span>Material Map</span>
              <strong>Archive Relation Map</strong>
            </div>
            <div class="archive-graph-axis archive-graph-axis-tags">nearest relations</div>
            <div class="archive-graph-axis archive-graph-axis-targets">wider references</div>
            <div class="archive-graph-pan-catcher" data-archive-graph-pan-catcher aria-hidden="true"></div>
            <div class="archive-graph-pan-layer" data-archive-graph-pan-layer>
              <svg class="archive-graph-view-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <marker id="archive-graph-arrow-source" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                  <marker id="archive-graph-arrow-tag" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                  <marker id="archive-graph-arrow-link" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                  <marker id="archive-graph-arrow-related" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                  <marker id="archive-graph-arrow-similarity" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker>
                </defs>
                ${edgeMarkup}
              </svg>
              ${nodeMarkup || `<p class="archive-graph-empty">No archive nodes yet.</p>`}
            </div>
            <div class="archive-graph-control-hint" data-archive-graph-control-hint>drag background to pan \u00b7 wheel to zoom \u00b7 drag nodes to arrange</div>
            <script type="application/json" data-archive-graph-payload>${jsonScriptContent(graphPayload)}</script>
          </div>
          `}
          ${archiveGraphInspectorMarkup(selectedResource, graph3dPayload, { mode: graphDisplayMode })}
        </div>
        <div class="archive-graph-view-legend">
          <span><i class="file"></i>file</span>
          <span><i class="similarity"></i>material relation</span>
          ${hiddenCount ? `<em>${hiddenCount} more hidden by graph limit</em>` : ""}
        </div>
      </section>
    `;
  };
  // Center Panel Content (Obsidian Note Editor / Viewer)
  const buildMainPanel = () => {
    if (viewMode === "graph") {
      return buildArchiveGraphView();
    }

    if (!selectedResource) {
      return `
        <div style="flex: 1; display: grid; place-items: center; height: 100%; color: var(--muted); padding: 40px; text-align: center;">
          <div>
            <svg style="width: 48px; height: 48px; stroke-width: 1; margin-bottom: 12px; opacity: 0.5;" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 6px; color: var(--text);">\uc790\ub8cc\uac00 \ube44\uc5b4 \uc788\uc2b5\ub2c8\ub2e4</h3>
            <p style="font-size: 12px; margin: 0;">\uc67c\ucabd \uc544\ub798 \ud0d0\uc0c9\uae30 \ud328\ub110\uc5d0\uc11c \uc0c8 \uc544\uce74\uc774\ube0c \ub9ac\uc18c\uc2a4\ub97c \ucd94\uac00\ud574\ubcf4\uc138\uc694.</p>
          </div>
        </div>
      `;
    }

    const isEditMode = state.archiveEditMode === true;

    const editorMarkup = `
      <form data-edit-archive-form="${selectedResource.id}" class="archive-edit-form">
        <div class="archive-edit-row">
          <input data-edit-archive-name class="archive-field archive-field-name" type="text" value="${escapeHtml(selectedResource.name)}" aria-label="\uc544\uce74\uc774\ube0c \uc774\ub984" required />
          <select data-edit-archive-type class="archive-field archive-field-type" aria-label="\uc544\uce74\uc774\ube0c \uc885\ub958">
            <option value="file" ${selectedResource.type === "file" ? "selected" : ""}>\ud83d\udcc4 \ud30c\uc77c</option>
            <option value="folder" ${selectedResource.type === "folder" ? "selected" : ""}>\ud83d\udcc1 \ud3f4\ub354</option>
            <option value="link" ${selectedResource.type === "link" ? "selected" : ""}>\ud83d\udd17 \ub9c1\ud06c</option>
          </select>
        </div>

        <div class="archive-edit-row archive-edit-row-center">
          <input data-edit-archive-path class="archive-field archive-field-path" type="text" value="${escapeHtml(selectedResource.path)}" aria-label="\uc544\uce74\uc774\ube0c \uacbd\ub85c \ub610\ub294 URL" placeholder="\ub85c\uceec \uacbd\ub85c \ub610\ub294 \uc6f9 URL" required />
          <button type="button" class="edit-archive-select-file archive-picker-button" data-resource-id="${selectedResource.id}">\ud83d\udcc4 \ud30c\uc77c</button>
          <button type="button" class="edit-archive-select-folder archive-picker-button" data-resource-id="${selectedResource.id}">\ud83d\udcc1 \ud3f4\ub354</button>
        </div>

        <div class="archive-edit-grid">
          <input data-edit-archive-tags class="archive-field" type="text" value="${escapeHtml((selectedResource.tags || []).join(", "))}" aria-label="\uc544\uce74\uc774\ube0c \uc8fc\uc81c" placeholder="\ud0dc\uadf8/\uc8fc\uc81c \uc608: \ube0c\ub79c\ub529, \ub808\ud37c\ub7f0\uc2a4 (\uc27c\ud45c \uad6c\ubd84)" />
        </div>

        <div class="archive-note-body archive-edit-note-body">
          <textarea data-edit-archive-desc class="archive-textarea-editor" placeholder="\uc774 \ub9ac\uc18c\uc2a4\uc640 \uad00\ub828\ub41c \uc544\uc774\ub514\uc5b4, \ud560 \uc77c \ubaa9\ub85d(- [ ] \ud560\uc77c), \ub9c8\ud06c\ub2e4\uc6b4 \ud615\uc2dd \uba54\ubaa8\ub97c \uc801\uc5b4\ubcf4\uc138\uc694...">${escapeHtml(selectedResource.desc || "")}</textarea>
        </div>

        <div class="archive-edit-actions">
          <button type="submit" class="archive-save-button">\uc800\uc7a5</button>
        </div>
      </form>
    `;

    const viewerMarkup = `
      <div class="archive-note-container" style="height: 100%; display: flex; flex-direction: column;">
        <div class="archive-note-title-area">
          <h2 class="archive-note-title" style="margin: 0; font-size: 24px;">${escapeHtml(selectedResource.name)}</h2>
          <button type="button" id="toggleArchiveEditMode" class="mock-button" style="padding: 6px 12px; font-size: 11px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); color: var(--text); cursor: pointer; font-weight: 700; white-space: nowrap;">\ud3b8\uc9d1 \ubaa8\ub4dc</button>
        </div>

        <div class="archive-note-meta" style="margin-top: 4px; margin-bottom: 12px;">
          <span class="meta-chip status-chip">${archiveIcon(selectedResource.type)} ${selectedResource.type === "folder" ? "\ud3f4\ub354" : selectedResource.type === "link" ? "\uc6f9 \ub9c1\ud06c" : "\ub85c\uceec \ud30c\uc77c"}</span>
          <span class="meta-chip" style="cursor: pointer; max-width: 380px;" data-open-archive-path="${escapeHtml(selectedResource.path)}" data-archive-type="${selectedResource.type}" title="\ub354\ube14 \ud074\ub9ad \uc2dc \uc5f4\uae30">\ud83d\udd17 ${escapeHtml(selectedResource.path || "\uacbd\ub85c \uc5c6\uc74c")}</span>
          ${(selectedResource.tags || []).map(tag => `<span class="meta-chip">${escapeHtml(tag)}</span>`).join("")}
        </div>

        <div class="archive-note-body" style="flex: 1; overflow-y: auto;">
          <div class="archive-markdown-view">
            ${parseMarkdown(selectedResource.desc || "*\uba54\ubaa8\uac00 \ube44\uc5b4 \uc788\uc2b5\ub2c8\ub2e4. \uc624\ub978\ucabd \uc0c1\ub2e8\uc758 \ud3b8\uc9d1 \ubaa8\ub4dc \ubc84\ud2bc\uc744 \ub20c\ub7ec \uba54\ubaa8\ub97c \uc801\uc5b4\ubcf4\uc138\uc694.*")}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px;">
          <button type="button" class="mock-button delete-archive-btn subtle-danger" data-delete-archive-id="${selectedResource.id}" style="padding: 6px 10px; font-size: 11px; border-radius: 6px; border: 1px solid var(--coral); background: transparent; color: var(--coral); cursor: pointer;">\ub9ac\uc18c\uc2a4 \uc0ad\uc81c</button>
          <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(selectedResource.path)}" data-archive-type="${selectedResource.type}" style="padding: 6px 14px; font-size: 11px; border-radius: 6px; border: 1px solid var(--border); background: var(--panel-raised); cursor: pointer; color: var(--text); font-weight: 600;">\ub9ac\uc18c\uc2a4 \uc5f4\uae30</button>
        </div>
      </div>
    `;

    return isEditMode ? editorMarkup : viewerMarkup;
  };

  return `
    <div class="archive-drop-overlay" id="archiveDropOverlay" hidden>
      <div class="overlay-content">
        <svg style="width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-bottom: 8px; color: var(--accent);" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        <span>\uc804\uc5ed \uc544\uce74\uc774\ube0c\uc5d0 \ub9ac\uc18c\uc2a4 \ucd94\uac00</span>
      </div>
    </div>

    <!-- archive explorer sidebar -->
    <aside class="archive-sidebar ${viewMode === "graph" ? "graph-mode" : ""}">
      <div class="archive-sidebar-header">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>\ud0d0\uc0c9\uae30</h3>
          <div class="archive-view-toggle" aria-label="\uc544\uce74\uc774\ube0c \ubcf4\uae30 \ubc29\uc2dd" style="display: inline-flex; align-items: center; gap: 2px; border: 1px solid var(--line); border-radius: 6px; padding: 2px; background: var(--panel-soft);">
            ${archiveViewControls}
          </div>
        </div>
      </div>
      <div class="archive-sidebar-content">
        ${query ? `<p class="notice" style="font-size: 10px; color: var(--muted); padding: 4px; border: 1px solid var(--line); border-radius: 6px; margin: 0 0 10px 0; text-align: left;">\uac80\uc0c9 \uacb0\uacfc ${resources.length}\uac1c</p>` : ""}
        ${buildExplorerList()}
      </div>

      <!-- add resource panel -->
      <div class="archive-add-shell">
        <details class="archive-add-panel">
          <summary class="archive-add-summary">\uc0c8 \ub9ac\uc18c\uc2a4 \ucd94\uac00</summary>
          <form id="addArchiveForm" class="archive-add-form">
            <div class="archive-add-row">
              <input type="text" id="newArchiveName" class="archive-add-field archive-add-name" placeholder="\uc774\ub984" required />
              <select id="newArchiveType" class="archive-add-field archive-add-type" aria-label="\uc544\uce74\uc774\ube0c \uc885\ub958">
                <option value="file">\ud30c\uc77c</option>
                <option value="folder">\ud3f4\ub354</option>
                <option value="link">\ub9c1\ud06c</option>
              </select>
            </div>
            <input type="text" id="newArchiveDesc" class="archive-add-field" placeholder="\uac04\ub2e8\ud55c \ub9c8\ud06c\ub2e4\uc6b4 \uc124\uba85..." />
            <div class="archive-add-row">
              <input type="text" id="newArchivePath" class="archive-add-field archive-add-path" placeholder="\ub85c\uceec \uacbd\ub85c \ub610\ub294 \uc6f9 URL" required />
              <button type="button" id="newArchiveSelectFile" class="archive-add-picker">\ud30c\uc77c</button>
              <button type="button" id="newArchiveSelectFolder" class="archive-add-picker">\ud3f4\ub354</button>
            </div>
            <div class="archive-add-row">
              <input type="text" id="newArchiveTags" class="archive-add-field archive-add-tags" placeholder="\uc8fc\uc81c (\uc27c\ud45c \uad6c\ubd84)" />
              <button type="submit" class="archive-add-submit">\ucd94\uac00</button>
            </div>
          </form>
        </details>
      </div>
    </aside>

    <!-- archive main panel -->
    <section class="archive-main ${viewMode === "graph" ? "graph-mode" : ""}">
      <div class="archive-main-content">
        ${buildMainPanel()}
      </div>
    </section>

    <!-- backlinks panel -->
    <aside class="archive-backlinks ${viewMode === "graph" ? "graph-mode" : ""}">
      <div class="archive-backlinks-header">
        <h3>\ubc31\ub9c1\ud06c</h3>
      </div>
      <div class="archive-backlinks-content">
        ${buildBacklinksPanel()}
        ${buildKnowledgeGraphPanel()}
      </div>
    </aside>
  `;
}

export function daysUntil(dateString) {
  const due = new Date(`${dateString}T00:00:00`);
  return Math.round((due - today) / 86400000);
}

export function dateFromOffset(offset) {
  const date = new Date(today);
  date.setDate(today.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function formatDueLabel(dateString) {
  const days = daysUntil(dateString);
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  if (days === -1) return "어제";
  if (days < 0) return `${Math.abs(days)}일 지남`;
  const date = new Date(`${dateString}T00:00:00`);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}.${date.getDate()} ${weekdays[date.getDay()]}`;
}

export function progressSegmentsMarkup(projectId) {
  const segments = getProgressSegments(projectId);
  return segmentsMarkup(segments, "\uc644\uc131\ub3c4 \ud569\uc0b0");
}

export function advanceSegmentsMarkup(projectId) {
  const segments = getAdvanceSegments(projectId);
  return segmentsMarkup(segments, "\uc9c4\ud589\ub960 \ud569\uc0b0");
}

function rollupRowTypeLabel(row) {
  if (row.sourceType === "formula") return "\uc218\uc2dd";
  if (row.sourceType === "project") return "\uc678\ubd80 \ubc18\uc601";
  if (row.type === "project") return "\ud558\uc704 \ud504\ub85c\uc81d\ud2b8";
  if (row.type === "task") return "할 일";
  return "기본값";
}

function rollupRowMeta(row, metric) {
  if (row.sourceType) {
    return `\uc694\uccad ${Math.round(row.requestedWeight)}% / \ubc18\uc601 ${Math.round(row.effectiveWeight)}%`;
  }
  if (row.type === "fallback") {
    return "\uae30\uc5ec \ud56d\ubaa9 \uc5c6\uc74c. \ud504\ub85c\uc81d\ud2b8 \uae30\ubcf8\uac12\uc744 \uc0ac\uc6a9\ud569\ub2c8\ub2e4.";
  }
  if (metric === "completion") {
    return `\uac00\uc911\uce58 ${Math.round(row.weight)}%`;
  }
  return `\ud3c9\uade0 \ubaab ${Math.round(row.share)}%`;
}

export function rollupStructureMarkup(projectId, metric) {
  const explanation = getRollupExplanation(projectId, metric);
  const rows = [
    ...explanation.contributors,
    ...explanation.incoming.map((item) => ({ ...item, external: true }))
  ];
  const emptyLabel = metric === "advance" ? "\uc9c4\ud589\ub960\uc5d0 \ubc18\uc601\ub418\ub294 \ud56d\ubaa9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4" : "\uc644\uc131\ub3c4\uc5d0 \ubc18\uc601\ub418\ub294 \ud56d\ubaa9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4";
  if (!rows.length) return `<div class="rollup-breakdown empty">${emptyLabel}</div>`;

  return `
    <div class="rollup-breakdown">
      <div class="rollup-summary">${escapeHtml(explanation.summary)}</div>
      ${rows.map((row) => `
        <div class="rollup-breakdown-row ${row.external ? "external" : ""}" data-rollup-row-type="${escapeHtml(row.sourceType || row.type)}">
          <span class="breakdown-name">
            <strong>${escapeHtml(row.name)}</strong>
            <small>${rollupRowTypeLabel(row)}</small>
          </span>
          <span class="breakdown-meter" aria-hidden="true">
            <i style="--value:${row.value}%"></i>
          </span>
          <span class="breakdown-number">${row.value}%</span>
          <span class="breakdown-weight">
            ${metric === "completion" && !row.external && row.key ? `
              <input type="number" min="0" max="100" step="1" value="${Math.round(row.weight)}" data-completion-weight="${row.key}" data-weight-project="${projectId}" aria-label="${escapeHtml(row.name)} \uc644\uc131\ub3c4 \ud569\uc0b0 \ube44\uc728" />
              <small>\uac00\uc911\uce58 ${Math.round(row.weight)}%</small>
            ` : rollupRowMeta(row, metric)}
          </span>
          <span class="breakdown-influence">+${Math.round(row.influence)}%p</span>
        </div>
      `).join("")}
    </div>
  `;
}

export function rollupPanelMarkup(project, metric) {
  const isAdvance = metric === "advance";
  const isExpanded = state.expandedRollupMetric === metric;
  const hasChildren = getChildProjects(project.id).length > 0;
  const className = isAdvance ? "advance-rollup" : "completion-rollup";
  const title = isAdvance ? "\uc9c4\ud589\ub960 \uad6c\uc870" : "\uc644\uc131\ub3c4 \uad6c\uc870";
  const description = isAdvance
    ? "진행률에 반영되는 하위 프로젝트와 할 일만 합산합니다"
    : hasChildren
      ? "\ud558\uc704 \ud504\ub85c\uc81d\ud2b8 \uc644\uc131\ub3c4\uac00 \uc0c1\uc704 \uc644\uc131\ub3c4\ub97c \ub9cc\ub4ed\ub2c8\ub2e4"
      : "\ud560 \uc77c \uc644\uc131\ub3c4\uac00 \ud504\ub85c\uc81d\ud2b8 \uc644\uc131\ub3c4\ub97c \ub9cc\ub4ed\ub2c8\ub2e4";
  const bar = isAdvance ? advanceSegmentsMarkup(project.id) : progressSegmentsMarkup(project.id);

  return `
    <section class="rollup-panel ${className} ${isExpanded ? "expanded" : ""}" data-rollup-toggle="${metric}" role="button" tabindex="0" aria-expanded="${isExpanded}">
      <div>
        <span>${title}</span>
        <strong>${description}</strong>
        <small class="rollup-hint">${isExpanded ? "\ud074\ub9ad\ud574\uc11c \uc811\uae30" : "\ud074\ub9ad\ud574\uc11c \uad6c\uc870 \ubcf4\uae30"}</small>
      </div>
      ${bar}
      ${isExpanded ? rollupStructureMarkup(project.id, metric) : ""}
    </section>
  `;
}

export function benchmarkInsightMarkup(project, allTasks, nextTask, lowTasks) {
  const children = getChildProjects(project.id);
  const descendantCount = getDescendantProjectIds(project.id).length;
  const incomingCount = state.projectLinks.filter((link) => link.targetId === project.id).length;
  const outgoingCount = state.projectLinks.filter((link) => link.sourceId === project.id).length;
  const overdueCount = project.deadline && daysUntil(project.deadline) < 0 ? 1 : 0;
  const urgentCount = state.projects
    .filter((item) => item.id === project.id || getDescendantProjectIds(project.id).includes(item.id))
    .filter((item) => item.deadline && daysUntil(item.deadline) <= 3).length;
  const completion = getProjectDisplayProgress(project.id);
  const advance = getProjectDisplayAdvance(project.id);
  const gap = Math.abs(completion - advance);
  const focusLabel = nextTask
    ? `${nextTask.name} · ${clampProgress(nextTask.progress)}%`
    : children[0]
      ? `${children[0].name} · 하위 프로젝트`
      : "할 일을 추가해서 시작";
  const riskLabel = overdueCount
    ? "마감 지난 프로젝트 있음"
    : urgentCount
      ? `${urgentCount}개 마감 임박`
      : lowTasks.length
        ? `${lowTasks.length}개 완성도 낮음`
        : "눈에 띄는 위험 없음";
  const structureLabel = descendantCount
    ? `${descendantCount}개 하위 · ${incomingCount + outgoingCount}개 반영`
    : `${allTasks.length}개 할 일 · ${incomingCount + outgoingCount}개 반영`;
  const balanceLabel = gap >= 25
    ? `완성도/진행률 ${gap}% 차이`
    : "완성도와 진행률 균형 양호";

  return `
    <section class="workflow-radar" aria-label="작업 운영 요약">
      <article>
        <span>다음 집중</span>
        <strong>${escapeHtml(focusLabel)}</strong>
        <small>Notion의 작업 페이지처럼 바로 해야 할 항목을 먼저 보여줍니다.</small>
      </article>
      <article class="${urgentCount || overdueCount ? "alert" : ""}">
        <span>리스크</span>
        <strong>${escapeHtml(riskLabel)}</strong>
        <small>마감과 낮은 완성도를 같이 봅니다.</small>
      </article>
      <article>
        <span>구조</span>
        <strong>${escapeHtml(structureLabel)}</strong>
        <small>Linear처럼 프로젝트 관계를 요약합니다.</small>
      </article>
      <article class="${gap >= 25 ? "alert" : ""}">
        <span>균형</span>
        <strong>${escapeHtml(balanceLabel)}</strong>
        <small>진행과 완성도가 서로 맞는 상태를 봅니다.</small>
      </article>
    </section>
  `;
}

export function reviewPanelMarkup(project) {
  const history = Array.isArray(state.appSettings.history) ? state.appSettings.history : [];
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const completionDelta = latest && previous ? latest.completion - previous.completion : 0;
  const advanceDelta = latest && previous ? latest.advance - previous.advance : 0;
  const focused = (state.appSettings.focusedTaskIds || [])
    .map((id) => state.tasks.find((task) => task.id === Number(id)))
    .filter(Boolean)
    .slice(0, 3);
  const projectScope = new Set([project.id, ...getDescendantProjectIds(project.id)]);
  const recent = (state.appSettings.activityLog || [])
    .filter((entry) => !entry.projectId || projectScope.has(Number(entry.projectId)))
    .slice(0, 4);

  return `
    <section class="review-panel" aria-label="작업 회고">
      <div>
        <span>변화 기록</span>
        <strong>완성도 ${completionDelta >= 0 ? "+" : ""}${completionDelta}% · 진행률 ${advanceDelta >= 0 ? "+" : ""}${advanceDelta}%</strong>
        <small>${latest ? `${latest.date} 기준 전체 최상위 프로젝트 평균` : "아직 기록이 충분하지 않습니다."}</small>
      </div>
      <div>
        <span>집중 대열</span>
        <strong>${focused.length ? focused.map((task) => task.name).join(", ") : "선택한 할 일이 없습니다"}</strong>
        <small>${focused.length ? "대열에서 바로 완성도와 진행률을 조절할 수 있습니다." : "할 일 카드에서 집중을 눌러 올려보세요."}</small>
      </div>
      <div>
        <span>최근 만진 것</span>
        <strong>${recent[0] ? escapeHtml(recent[0].label) : "아직 기록 없음"}</strong>
        <small>${recent.length > 1 ? recent.slice(1).map((entry) => escapeHtml(entry.label)).join(" · ") : "오늘의 조작이 여기에 쌓입니다."}</small>
      </div>
    </section>
  `;
}

export function workFlowSummaryMarkup(project, allTasks, nextTask, lowTasks) {
  const incomingCount = state.projectLinks.filter((link) => link.targetId === project.id).length;
  const outgoingCount = state.projectLinks.filter((link) => link.sourceId === project.id).length;
  const urgentCount = state.projects
    .filter((item) => item.id === project.id || getDescendantProjectIds(project.id).includes(item.id))
    .filter((item) => item.deadline && daysUntil(item.deadline) <= 3).length;
  const history = Array.isArray(state.appSettings.history) ? state.appSettings.history : [];
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const completionDelta = latest && previous ? latest.completion - previous.completion : 0;
  const advanceDelta = latest && previous ? latest.advance - previous.advance : 0;
  const focused = (state.appSettings.focusedTaskIds || [])
    .map((id) => state.tasks.find((task) => task.id === Number(id)))
    .filter(Boolean)
    .slice(0, 3);
  const projectScope = new Set([project.id, ...getDescendantProjectIds(project.id)]);
  const recent = (state.appSettings.activityLog || [])
    .filter((entry) => !entry.projectId || projectScope.has(Number(entry.projectId)))
    .slice(0, 3);
  const risk = urgentCount ? `${urgentCount}개 마감 임박` : lowTasks.length ? `${lowTasks.length}개 낮음` : "안정";
  const focus = nextTask ? `${nextTask.name} · ${clampProgress(nextTask.progress)}%` : "집중할 일 없음";

  return `
    <details class="work-flow-summary">
      <summary>
        <span>작업 흐름</span>
        <strong>${escapeHtml(focus)}</strong>
        <em>${escapeHtml(risk)}</em>
      </summary>
      <div class="work-flow-grid">
        <div>
          <span>변화</span>
          <strong>완성도 ${completionDelta >= 0 ? "+" : ""}${completionDelta}% · 진행률 ${advanceDelta >= 0 ? "+" : ""}${advanceDelta}%</strong>
        </div>
        <div>
          <span>구조</span>
          <strong>${getDescendantProjectIds(project.id).length}개 하위 · ${incomingCount + outgoingCount}개 반영 · ${allTasks.length}개 할 일</strong>
        </div>
        <div>
          <span>집중 대열</span>
          <strong>${focused.length ? focused.map((task) => task.name).join(", ") : "선택 없음"}</strong>
        </div>
        <div>
          <span>최근</span>
          <strong>${recent.length ? recent.map((entry) => entry.label).join(" · ") : "기록 없음"}</strong>
        </div>
      </div>
    </details>
  `;
}

function selectedArchiveBacklinks(resourceId) {
  return getSelectedArchiveBacklinks(resourceId, state.projects, state.tasks, state.archiveResourceLinks);
}

function archiveGraphLaneMetricsMarkup(laneCounts = {}) {
  const reviewCount = Number(laneCounts.review || 0) + Number(laneCounts.unverified || 0);
  return `
    <dl class="archive-graph-lane-metrics">
      <div><dt>\uba3c\uc800 \ubcfc \uac83</dt><dd>${Number(laneCounts.first || 0)}</dd></div>
      <div><dt>\uc911\uac04</dt><dd>${Number(laneCounts.middle || 0)}</dd></div>
      <div><dt>\ub0ae\uc74c</dt><dd>${Number(laneCounts.low || 0)}</dd></div>
      <div><dt>\ud655\uc778 \ud544\uc694</dt><dd>${reviewCount}</dd></div>
    </dl>
  `;
}

function archiveGraphQualityLabel(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "\ubbf8\ud655\uc778";
  if (value >= 78) return "\ub192\uc74c";
  if (value >= 50) return "\uc911\uac04";
  return "\ub0ae\uc74c";
}

function archiveGraphInspectorMarkup(selectedResource, graph3dPayload, options = {}) {
  const backlinks = selectedResource ? selectedArchiveBacklinks(selectedResource.id) : [];
  const primaryItem = backlinks[0] || null;
  const primary = primaryItem?.link || null;
  const is2dMap = options.mode === "graph2d";
  const selectedNode = selectedResource
    ? (graph3dPayload?.nodes || []).find((node) => Number(node.resourceId) === Number(selectedResource.id))
    : null;
  const qualityScore = Number.isFinite(Number(selectedNode?.materialQualityScore))
    ? Number(selectedNode.materialQualityScore)
    : null;
  const laneCounts = graph3dPayload?.meta?.relationLaneCounts || {};
  const visibleRelationCount = Number(graph3dPayload?.meta?.relationCount || 0);
  const materialCount = Number(graph3dPayload?.meta?.nodeCount || 0);
  const primaryTargetLabel = primaryItem?.target?.name || "";
  return `
    <aside class="archive-graph-inspector archive-graph-observatory" aria-label="Space observatory inspector">
      <section class="archive-graph-inspector-card">
        <p class="archive-graph-kicker">Space Observatory</p>
        <h3>${selectedResource ? "\uc120\ud0dd \uc790\ub8cc" : "\uc790\ub8cc \uad00\uce21"}</h3>
        <strong>${selectedResource ? escapeHtml(selectedResource.name) : "\uc120\ud0dd\ub41c \uc790\ub8cc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4"}</strong>
        <p>${selectedResource ? escapeHtml(selectedResource.desc || selectedResource.path || "\uc124\uba85 \uc5c6\uc74c") : "\ubcc4\uc744 \uc120\ud0dd\ud558\uba74 \uc2e0\ub8b0\ub3c4, \uba54\ubaa8, \uc5f0\uacb0\ub41c \uc791\uc5c5\uc744 \ud55c\ubc88\uc5d0 \ubcf4\uc5ec\uc90d\ub2c8\ub2e4."}</p>
        <div class="archive-graph-observatory-counts" aria-label="Space visible summary">
          ${qualityScore !== null ? `<span>\uc790\ub8cc \ud488\uc9c8 ${escapeHtml(archiveGraphQualityLabel(qualityScore))} ${qualityScore}</span>` : ""}
          <span>${materialCount} materials</span>
          <span>${visibleRelationCount} relations</span>
        </div>
      </section>
      ${selectedResource && primary ? `
        <section class="archive-graph-inspector-card">
          <h3>\uac00\uc7a5 \uac15\ud55c \uc5f0\uacb0</h3>
          <p class="archive-graph-relation-scope">${archiveRelationScopeLabel(primary)} \u00b7 ${primary.targetType === "task" ? "\ud560\uc77c" : "\ud504\ub85c\uc81d\ud2b8"}${primaryTargetLabel ? ` \u00b7 ${escapeHtml(primaryTargetLabel)}` : ""}</p>
          ${archiveRelationConfidenceBadgeMarkup(primary)}
          ${archiveRelationReasonMarkup(primary)}
          ${archiveRelationNotePreviewMarkup(primary)}
          ${archiveRelationAdjustMarkup(primary)}
        </section>
      ` : ""}
      ${is2dMap ? archiveRelationReviewDeskMarkup(backlinks) : ""}
      <section class="archive-graph-inspector-card">
        <h3>\ud050\ub808\uc774\uc158 \ubd84\ud3ec</h3>
        ${archiveGraphLaneMetricsMarkup(laneCounts)}
      </section>
      ${selectedResource ? `
        <section class="archive-graph-inspector-card">
          <h3>\uc5f0\uacb0\ub41c \uc791\uc5c5</h3>
          ${backlinks.length ? backlinks.slice(0, 6).map(({ link, target }) => `
            <article class="archive-graph-linked-work">
              <strong>${escapeHtml(target.name || "\uc774\ub984 \uc5c6\uc74c")}</strong>
              <span>${link.targetType === "task" ? "\ud560\uc77c" : "\ud504\ub85c\uc81d\ud2b8"} \u00b7 ${archiveRelationScopeLabel(link)}</span>
              ${archiveRelationConfidenceBadgeMarkup(link)}
            </article>
          `).join("") : `<p>\uc5f0\uacb0\ub41c \uc791\uc5c5\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.</p>`}
        </section>
        <div class="archive-graph-context-actions">
          <button type="button" id="toggleArchiveEditMode">\uc790\ub8cc \ud3b8\uc9d1</button>
          <button type="button" data-open-archive-path="${escapeHtml(selectedResource.path)}" data-archive-type="${selectedResource.type}">\uc790\ub8cc \uc5f4\uae30</button>
        </div>
      ` : ""}
    </aside>
  `;
}

export function renderLinkedArchivePanel(project, allTasks = []) {
  const projectId = Number(project?.id);
  const taskIds = new Set(allTasks.map((task) => Number(task?.id || 0)));
  const linked = (state.archiveResourceLinks || [])
    .filter((link) => {
      return (link.targetType === "project" && Number(link.targetId) === projectId)
        || (link.targetType === "task" && taskIds.has(Number(link.targetId)));
    })
    .map((link) => {
      const resource = (state.archiveResources || []).find((item) => item.id === Number(link.resourceId));
      if (!resource) return null;
      const task = link.targetType === "task"
        ? allTasks.find((item) => item.id === Number(link.targetId))
        : null;
      return { link, resource, task };
    })
    .filter(Boolean);

  const typeLabel = (type) => type === "folder" ? "\ud3f4\ub354" : type === "link" ? "\ub9c1\ud06c" : "\ud30c\uc77c";
  const listMarkup = linked.length ? linked.map(({ link, resource, task }) => `
    <div class="archive-resource-row js-archive-item" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; box-shadow: var(--shadow-sm);">
      <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">
        <strong style="display: block; font-size: 12px; color: var(--text);">${typeLabel(resource.type)} \u00b7 ${escapeHtml(resource.name)}</strong>
        <span class="meta-chip ${link.targetType === "task" ? "" : "quiet-chip"}" style="display: inline-flex; margin-top: 5px;">${link.targetType === "task" ? `할 일 · ${escapeHtml(task?.name || "연결된 할 일")}` : "현재 프로젝트에 연결"}</span>
        ${archiveRelationNotePreviewMarkup(link)}
        ${archiveRelationReasonMarkup(link)}
        ${resource.desc ? `<p style="margin: 5px 0 0 0; font-size: 10px; color: var(--muted);">${escapeHtml(resource.desc)}</p>` : ""}
        <small style="display: block; font-size: 9px; color: var(--muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(resource.path)}</small>
      </div>
      <div class="archive-resource-actions">
        ${archiveRelationConfidenceBadgeMarkup(link)}
        <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(resource.path)}" data-archive-type="${resource.type}" style="padding: 4px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid var(--border); background: var(--panel-raised); cursor: pointer; color: var(--text); font-weight: 600; flex-shrink: 0;">\uc5f4\uae30</button>
        ${archiveRelationAdjustMarkup(link)}
      </div>
    </div>
  `).join("") : `<p class="notice" style="font-size: 11px; color: var(--muted); padding: 10px; border: 1px dashed var(--border); border-radius: 8px; margin: 0;">\uc5f0\uacb0\ub41c \uc544\uce74\uc774\ube0c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</p>`;

  return `
    <details class="archive-list-section detail-collapsible-section" aria-label="\uc5f0\uacb0\ub41c \uc544\uce74\uc774\ube0c" style="margin-top: 18px;">
      <summary style="text-align: left; font-size: 12px; margin-bottom: 8px; color: var(--text); display: flex; align-items: center; gap: 6px;">
        <span>\uc5f0\uacb0\ub41c \uc544\uce74\uc774\ube0c</span>
        <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: var(--panel-soft); color: var(--text);">${linked.length}</span>
      </summary>
      <div class="detail-collapsible-body">
        ${listMarkup}
      </div>
    </details>
  `;
}

const DESIGN_REFERENCE_TAG_KEYWORDS = ["design", "branding", "typography", "portfolio", "inspiration", "\uB514\uC790\uC778"];
const DESIGN_CURATION_MIN_LINKS = 20;
const DESIGN_CURATION_FIRST_LIMIT = 12;
const DESIGN_CURATION_LANE_LIMIT = 18;
const DESIGN_CURATION_VISIBLE_LIMIT = 5;

const DESIGN_LABELS = {
  title: "&#46356;&#51088;&#51064; &#49324;&#51060;&#53944; &#53328;&#47112;&#51060;&#49496;",
  total: "&#44060; &#47553;&#53356;&#47484; &#49888;&#47280;&#46020;&#50752; &#44540;&#44144;&#47196; &#51221;&#47532;",
  policy: "&#44540;&#44144; &#50630;&#45716; &#47553;&#53356;&#45716; &#49345;&#50948; &#52628;&#52380;&#50640;&#49436; &#51228;&#50808;",
  first: "&#47676;&#51200; &#48380; &#44163;",
  firstSummary: "&#49888;&#47280;&#46020; &#45458;&#51020;&#47564; &#49345;&#50948;&#47196; &#50732;&#47548;",
  mediumLane: "&#51473;&#44036; &#49888;&#47280;&#46020;",
  mediumLaneSummary: "&#54596;&#50836;&#54620; &#44221;&#50864; &#54869;&#51064;&#54624; &#54980;&#48372;",
  lowLane: "&#45230;&#51020; &#49888;&#47280;&#46020;",
  lowLaneSummary: "&#51649;&#51217; &#45230;&#51020;&#51004;&#47196; &#54869;&#51221;&#54620; &#47553;&#53356;",
  structure: "&#44396;&#51312; &#52280;&#44256;",
  structureSummary: "&#48652;&#47004;&#46377;, &#53440;&#51077;, &#47112;&#51060;&#50500;&#50883; &#48516;&#49437;&#50857;",
  vibe: "&#44048;&#44033; &#52280;&#44256;",
  vibeSummary: "&#53944;&#47116;&#46300;&#50752; &#49884;&#44033; &#47924;&#46300; &#54869;&#51064;&#50857;",
  review: "&#48120;&#54869;&#51064;",
  confidence: "&#49888;&#47280;&#46020;",
  high: "&#45458;&#51020;",
  medium: "&#51473;&#44036;",
  low: "&#45230;&#51020;",
  highHint: "&#49345;&#50948; &#52628;&#52380; &#44032;&#45733;",
  mediumHint: "&#47785;&#51201; &#54869;&#51064; &#54980; &#49324;&#50857;",
  lowHint: "&#54869;&#51064; &#54596;&#50836;",
  noPath: "&#44221;&#47196; &#50630;&#51020;",
  emptyLane: "&#54644;&#45817; &#47553;&#53356; &#50630;&#51020;",
  more: "&#44060; &#45908; &#48372;&#44592;"
};

const DESIGN_CONFIDENCE_LABELS = {
  high: DESIGN_LABELS.high,
  medium: DESIGN_LABELS.medium,
  low: DESIGN_LABELS.low
};

const DESIGN_CONFIDENCE_HINTS = {
  high: DESIGN_LABELS.highHint,
  medium: DESIGN_LABELS.mediumHint,
  low: DESIGN_LABELS.lowHint
};

const DESIGN_CONFIDENCE_SCORES = {
  high: 90,
  medium: 60,
  low: 30
};

function designConfidenceClassFromRelationStrength(strength) {
  if (strength === "strong") return "high";
  if (strength === "weak") return "low";
  return "medium";
}

function getResourceHost(resource) {
  try {
    return new URL(resource.path || "").hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getResourceSearchText(resource) {
  return [
    resource.name,
    resource.path,
    resource.desc,
    getResourceHost(resource),
    ...(Array.isArray(resource.tags) ? resource.tags : [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function isDesignReferenceResource(resource) {
  const text = getResourceSearchText(resource);
  return resource.type === "link" && includesAny(text, DESIGN_REFERENCE_TAG_KEYWORDS);
}

function shouldShowDesignCuration(task, resources) {
  const taskText = `${task?.name || ""} ${task?.note || ""}`.replace(/\s+/g, "").toLowerCase();
  const designLinks = resources.filter(isDesignReferenceResource);
  return designLinks.length >= DESIGN_CURATION_MIN_LINKS
    || (designLinks.length > 0 && (taskText.includes("\uB514\uC790\uC778") || taskText.includes("design")) && (taskText.includes("\uC0AC\uC774\uD2B8") || taskText.includes("site")));
}

function getDesignReferenceSignal(resource) {
  const text = getResourceSearchText(resource);
  const host = getResourceHost(resource);
  const signal = {
    resource,
    lane: "review",
    confidence: "low",
    confidenceClass: "low",
    evidence: "\ucd9c\ucc98\ub098 \uc6a9\ub3c4 \ud655\uc778 \ud544\uc694",
    rank: 10
  };

  if (includesAny(text, ["bpando", "underconsideration", "brand new", "fontsinuse", "typewolf"])) {
    return {
      ...signal,
      lane: "structure",
      confidence: "high",
      confidenceClass: "high",
      evidence: "\ube0c\ub79c\ub529/\ud0c0\uc785 \uc804\ubb38 \ucc38\uace0\uc6d0",
      rank: 100
    };
  }
  if (includesAny(text, ["itsnicethat", "it's nice that", "publicdomainreview", "public domain review"])) {
    return {
      ...signal,
      lane: "vibe",
      confidence: "high",
      confidenceClass: "high",
      evidence: "\uc774\ubbf8\uc9c0+\ud14d\uc2a4\ud2b8 \ud3b8\uc9d1 \ucc38\uace0\uc5d0 \uc801\ud569",
      rank: 98
    };
  }
  if (includesAny(text, ["siteinspire", "awwwards", "land-book", "land-book.com", "godly", "lapa", "onepagelove", "minimal.gallery", "hoverstat", "httpster", "readymag", "muzli"])) {
    return {
      ...signal,
      lane: "vibe",
      confidence: "high",
      confidenceClass: "high",
      evidence: "\uac80\uc99d\ub41c \uc6f9\ub514\uc790\uc778 \uac24\ub7ec\ub9ac",
      rank: 95
    };
  }
  if (includesAny(text, ["mobbin", "refero", "collectui", "calltoidea", "nicelydone", "saas", "dashboard", "ui pattern"])) {
    return {
      ...signal,
      lane: "structure",
      confidence: "medium",
      confidenceClass: "medium",
      evidence: "UI \ud328\ud134 \ucc38\uace0\uc5d0 \uc720\uc6a9",
      rank: 75
    };
  }
  if (includesAny(text, ["behance", "dribbble", "pinterest", "designspiration", "savee", "are.na", "cosmos"])) {
    return {
      ...signal,
      lane: "vibe",
      confidence: "medium",
      confidenceClass: "medium",
      evidence: "\uc2dc\uac01 \ubb34\ub4dc \ucc38\uace0\uc5d0 \uc720\uc6a9",
      rank: 70
    };
  }
  if (includesAny(text, ["case study", "portfolio", "studio", "agency", "identity", "layout", "grid", "editorial", "typography", "font", "design system"])) {
    return {
      ...signal,
      lane: "structure",
      confidence: "medium",
      confidenceClass: "medium",
      evidence: "\uad6c\uc870 \ubd84\uc11d \ud0a4\uc6cc\ub4dc \ud3ec\ud568",
      rank: 65
    };
  }
  if (includesAny(text, ["blog.naver", "tistory", "velog", "medium.com", "quora", "reddit", "stackoverflow", "korean.go.kr", "calculator", "download", "indesign"])) {
    return {
      ...signal,
      confidence: "low",
      confidenceClass: "low",
      evidence: "\ub2e8\ubc1c\uc131 \uae00\uc774\ub77c \uc791\uc5c5 \ub9e5\ub77d \ud655\uc778 \ud544\uc694",
      rank: 20
    };
  }
  if (host) {
    return {
      ...signal,
      confidence: "low",
      confidenceClass: "low",
      evidence: "\ub3c4\uba54\uc778\uc740 \uc788\uc9c0\ub9cc \ud050\ub808\uc774\uc158 \uadfc\uac70\uac00 \uc57d\ud568",
      rank: 30
    };
  }

  return signal;
}

function buildDesignCuration(resources, linkByResourceId = new Map()) {
  const signaled = resources
    .filter((resource) => resource.type === "link")
    .map(getDesignReferenceSignal)
    .map((item) => {
      const link = linkByResourceId.get(Number(item.resource.id));
      const manualConfidence = Number.isFinite(Number(link?.relationScore));
      const confidence = archiveRelationConfidenceState(link, {
        score: DESIGN_CONFIDENCE_SCORES[item.confidenceClass],
        strength: item.confidenceClass === "high" ? "strong" : item.confidenceClass === "low" ? "weak" : "medium"
      });
      const confidenceClass = designConfidenceClassFromRelationStrength(confidence.strength);
      return {
        ...item,
        confidence: confidenceClass,
        confidenceClass,
        confidenceScore: confidence.score,
        manualConfidence
      };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore || b.rank - a.rank || String(a.resource.name).localeCompare(String(b.resource.name)));
  const used = new Set();
  const manualFirst = (items) => [...items].sort((a, b) => (
    Number(b.manualConfidence) - Number(a.manualConfidence)
    || b.confidenceScore - a.confidenceScore
    || b.rank - a.rank
    || String(a.resource.name).localeCompare(String(b.resource.name))
  ));
  const take = (items, limit) => {
    const picked = [];
    for (const item of items) {
      if (used.has(item.resource.id)) continue;
      picked.push(item);
      used.add(item.resource.id);
      if (picked.length >= limit) break;
    }
    return picked;
  };
  const reliable = signaled.filter((item) => item.confidenceClass === "high");
  const first = take(manualFirst(reliable), DESIGN_CURATION_FIRST_LIMIT);
  const medium = take(
    manualFirst(signaled.filter((item) => item.confidenceClass === "medium")),
    DESIGN_CURATION_LANE_LIMIT
  );
  const low = take(
    manualFirst(signaled.filter((item) => item.confidenceClass === "low" && item.manualConfidence)),
    DESIGN_CURATION_LANE_LIMIT
  );
  const structure = take(
    manualFirst(signaled.filter((item) => item.lane === "structure" && item.confidenceClass !== "low")),
    DESIGN_CURATION_LANE_LIMIT
  );
  const vibe = take(
    manualFirst(signaled.filter((item) => item.lane === "vibe" && item.confidenceClass !== "low")),
    DESIGN_CURATION_LANE_LIMIT
  );
  const review = signaled.filter((item) => !used.has(item.resource.id));

  return {
    total: signaled.length,
    sections: [
      { key: "first", label: DESIGN_LABELS.first, summary: DESIGN_LABELS.firstSummary, items: first },
      { key: "medium", label: DESIGN_LABELS.mediumLane, summary: DESIGN_LABELS.mediumLaneSummary, items: medium },
      { key: "low", label: DESIGN_LABELS.lowLane, summary: DESIGN_LABELS.lowLaneSummary, items: low },
      { key: "structure", label: DESIGN_LABELS.structure, summary: DESIGN_LABELS.structureSummary, items: structure },
      { key: "vibe", label: DESIGN_LABELS.vibe, summary: DESIGN_LABELS.vibeSummary, items: vibe }
    ],
    review
  };
}

export function taskLauncherMarkup(taskId) {
  const task = state.tasks.find((item) => Number(item.id) === Number(taskId));
  if (!task) {
    return `
      <div class="task-launcher-empty">
        <strong>\ud560 \uc77c\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.</strong>
        <p>\ubaa9\ub85d\uc774 \uac31\uc2e0\ub418\uc5c8\uc744 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</p>
      </div>
    `;
  }

  const project = getProject(task.projectId);
  const linkedResources = (state.archiveResourceLinks || [])
    .filter((link) => link.targetType === "task" && Number(link.targetId) === Number(task.id))
    .map((link) => {
      const resource = (state.archiveResources || []).find((item) => Number(item.id) === Number(link.resourceId));
      return resource ? { link, resource } : null;
    })
    .filter(Boolean);
  const resources = linkedResources.map((entry) => entry.resource);
  const linkByResourceId = new Map(linkedResources.map((entry) => [Number(entry.resource.id), entry.link]));
  const useDesignCuration = shouldShowDesignCuration(task, resources);
  const designCuration = useDesignCuration ? buildDesignCuration(resources, linkByResourceId) : null;
  const sortedResources = [...resources].sort((a, b) => {
    const aLink = linkByResourceId.get(Number(a.id));
    const bLink = linkByResourceId.get(Number(b.id));
    const aScore = archiveRelationConfidenceState(aLink).score;
    const bScore = archiveRelationConfidenceState(bLink).score;
    return bScore - aScore || String(a.name).localeCompare(String(b.name), "ko");
  });
  const grouped = {
    file: sortedResources.filter((resource) => resource.type === "file"),
    folder: sortedResources.filter((resource) => resource.type === "folder"),
    link: sortedResources.filter((resource) => resource.type === "link" && !useDesignCuration),
    other: sortedResources.filter((resource) => !["file", "folder", "link"].includes(resource.type))
  };
  const groupLabels = {
    file: "\uc8fc\uc694 \ud30c\uc77c",
    folder: "\ud3f4\ub354",
    link: "\ucc38\uace0 \ub9c1\ud06c",
    other: "\uae30\ud0c0 \uc790\ub8cc"
  };
  const typeLabel = (type) => type === "folder" ? "\ud3f4\ub354" : type === "link" ? "\ub9c1\ud06c" : "\ud30c\uc77c";
  const resourceRow = (resource) => `
    <div class="task-launcher-resource js-archive-item" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}">
      <div class="task-launcher-resource-main">
        <strong>${escapeHtml(resource.name)}</strong>
        ${archiveRelationNotePreviewMarkup(linkByResourceId.get(Number(resource.id)))}
        ${archiveRelationReasonMarkup(linkByResourceId.get(Number(resource.id)))}
        ${resource.desc ? `<span>${escapeHtml(resource.desc)}</span>` : ""}
        <small>${escapeHtml(resource.path || "\uacbd\ub85c \uc5c6\uc74c")}</small>
      </div>
      <div class="task-launcher-resource-actions">
        ${archiveRelationConfidenceBadgeMarkup(linkByResourceId.get(Number(resource.id)))}
        <button type="button" class="task-launcher-open" data-open-archive-path="${escapeHtml(resource.path)}" data-archive-type="${resource.type}" ${resource.path ? "" : "disabled"}>${typeLabel(resource.type)} \uc5f4\uae30</button>
        ${archiveRelationAdjustMarkup(linkByResourceId.get(Number(resource.id)))}
      </div>
    </div>
  `;
  const curatedRow = (item) => {
    const resource = item.resource;
    return `
      <div class="task-launcher-resource task-launcher-curated-resource js-archive-item" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}">
        <div class="task-launcher-resource-main">
          <strong>${escapeHtml(resource.name)}</strong>
          ${archiveRelationNotePreviewMarkup(linkByResourceId.get(Number(resource.id)))}
          ${archiveRelationReasonMarkup(linkByResourceId.get(Number(resource.id)), {
            reason: item.evidence,
            score: item.confidenceScore,
            strength: item.confidenceClass === "high" ? "strong" : item.confidenceClass === "low" ? "weak" : "medium"
          })}
          <span>${escapeHtml(item.evidence)}</span>
          <small>${resource.path ? escapeHtml(resource.path) : DESIGN_LABELS.noPath}</small>
          <div class="task-launcher-curation-meta">
            <b class="task-launcher-confidence ${item.confidenceClass}">${DESIGN_LABELS.confidence} ${DESIGN_CONFIDENCE_LABELS[item.confidenceClass]}</b>
            <em>${DESIGN_CONFIDENCE_HINTS[item.confidenceClass]}</em>
          </div>
        </div>
        <div class="task-launcher-resource-actions">
          ${archiveRelationConfidenceBadgeMarkup(linkByResourceId.get(Number(resource.id)), {
            score: item.confidenceScore,
            strength: item.confidenceClass === "high" ? "strong" : item.confidenceClass === "low" ? "weak" : "medium"
          })}
          <button type="button" class="task-launcher-open" data-open-archive-path="${escapeHtml(resource.path)}" data-archive-type="${resource.type}" ${resource.path ? "" : "disabled"}>${typeLabel(resource.type)} &#50676;&#44592;</button>
          ${archiveRelationAdjustMarkup(linkByResourceId.get(Number(resource.id)), {
            score: item.confidenceScore,
            strength: item.confidenceClass === "high" ? "strong" : item.confidenceClass === "low" ? "weak" : "medium"
          })}
        </div>
      </div>
    `;
  };
  const curatedRowsMarkup = (items) => {
    const visible = items.slice(0, DESIGN_CURATION_VISIBLE_LIMIT);
    const hidden = items.slice(DESIGN_CURATION_VISIBLE_LIMIT);
    return `
      ${visible.map(curatedRow).join("")}
      ${hidden.length ? `
        <details class="task-launcher-overflow-details">
          <summary>${hidden.length}${DESIGN_LABELS.more}</summary>
          <div class="task-launcher-list">
            ${hidden.map(curatedRow).join("")}
          </div>
        </details>
      ` : ""}
    `;
  };
  const curationMarkup = designCuration?.total ? `
    <section class="task-launcher-curation">
      <div class="task-launcher-curation-head">
        <div>
          <span>${DESIGN_LABELS.title}</span>
          <strong>${designCuration.total}${DESIGN_LABELS.total}</strong>
        </div>
        <em>${DESIGN_LABELS.policy}</em>
      </div>
      <div class="task-launcher-curation-grid">
        ${designCuration.sections
          .filter((section) => section.items.length || section.key === "medium" || section.key === "low")
          .map((section) => `
            <section class="task-launcher-curation-lane" data-curation-lane="${section.key}">
              <h3>${section.label} <span>${section.items.length}</span></h3>
              <p>${section.summary}</p>
              <div class="task-launcher-list">
                ${section.items.length
                  ? curatedRowsMarkup(section.items)
                  : `<p class="task-launcher-lane-empty">${DESIGN_LABELS.emptyLane}</p>`}
              </div>
            </section>
          `).join("")}
      </div>
      ${designCuration.review.length ? `
        <details class="task-launcher-curation-review">
          <summary>${DESIGN_LABELS.review} <span>${designCuration.review.length}</span></summary>
          <div class="task-launcher-list">
            ${designCuration.review.map(curatedRow).join("")}
          </div>
        </details>
      ` : ""}
    </section>
  ` : "";
  const groupsMarkup = Object.entries(grouped)
    .filter(([, items]) => items.length)
    .map(([type, items]) => `
      <section class="task-launcher-group">
        <h3>${groupLabels[type]} <span>${items.length}</span></h3>
        <div class="task-launcher-list">
          ${items.map(resourceRow).join("")}
        </div>
      </section>
    `)
    .join("");

  return `
    <div class="task-launcher-summary">
      <span>${project ? escapeHtml(getProjectPath(project).join(" / ")) : "입력 없음"}</span>
      <strong>${escapeHtml(task.name)}</strong>
      ${task.note ? `<p>${escapeHtml(task.note)}</p>` : ""}
    </div>
    ${curationMarkup}
    ${groupsMarkup}
    ${curationMarkup || groupsMarkup ? "" : `
      <div class="task-launcher-empty">
        <strong>\uc5f0\uacb0\ub41c \uc790\ub8cc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</strong>
        <p>\uc544\uce74\uc774\ube0c\uc5d0\uc11c \ud30c\uc77c, \ud3f4\ub354, URL\uc744 \uc774 \ud560 \uc77c\uc5d0 \uc5f0\uacb0\ud558\uba74 \uc5ec\uae30\uc11c \ubc14\ub85c \uc5f4 \uc218 \uc788\uc2b5\ub2c8\ub2e4.</p>
        <button type="button" id="taskLauncherGoArchive">\uc544\uce74\uc774\ube0c\ub85c \uc774\ub3d9</button>
      </div>
    `}
  `;
}

export function segmentsMarkup(segments, label) {
  return `
    <span class="rollup-bar" aria-label="${label}">
      ${segments.map((segment) => `
        <i class="${segment.external ? "external" : ""}" style="--segment:${segment.width}%; --fill:${segment.progress}%">
          <b title="${escapeHtml(segment.name)} ${segment.progress}%"></b>
        </i>
      `).join("")}
    </span>
  `;
}

export function renderImpactTrail(project) {
  const path = getProjectPathObjects(project);
  if (path.length <= 1) {
    return `
      <section class="impact-trail">
        <span>상위 반영</span>
        <strong>이 프로젝트가 최상위입니다</strong>
      </section>
    `;
  }

  return `
    <section class="impact-trail">
      <span>상위 반영 경로</span>
      <div class="impact-chain">
        ${path.map((item, index) => `
          <button type="button" data-select-project="${item.id}" class="${item.id === project.id ? "active" : ""}">
            <strong>${escapeHtml(item.name)}</strong>
            <em>${getProjectDisplayProgress(item.id)}%</em>
          </button>
          ${index < path.length - 1 ? '<i aria-hidden="true">→</i>' : ""}
        `).join("")}
      </div>
    </section>
  `;
}

export function renderExternalInfluence(project) {
  const incoming = getIncomingLinks(project.id, "completion");
  const incomingAdvance = getIncomingLinks(project.id, "advance").filter((link) => !incoming.some((item) => item.sourceId === link.sourceId));
  const outgoing = getOutgoingLinks(project.id);
  if (!incoming.length && !incomingAdvance.length && !outgoing.length) return "";

  return `
    <section class="external-influence">
      <span>외부 반영</span>
      <div class="external-influence-grid">
        ${incoming.map((link) => {
          const source = getProject(link.sourceId);
          const metricLabel = link.metric === "advance" ? "진행률" : link.metric === "both" ? "완성도/진행률" : "완성도";
          return `
            <button type="button" data-select-project="${link.sourceId}">
              <strong>${escapeHtml(source?.name || "연결된 프로젝트")}</strong>
              <em>이 프로젝트 ${metricLabel}에 ${link.weight}% 반영</em>
            </button>
          `;
        }).join("")}
        ${incomingAdvance.map((link) => {
          const source = getProject(link.sourceId);
          return `
            <button type="button" data-select-project="${link.sourceId}">
              <strong>${escapeHtml(source?.name || "연결된 프로젝트")}</strong>
              <em>이 프로젝트 진행률에 ${link.weight}% 반영</em>
            </button>
          `;
        }).join("")}
        ${outgoing.map((link) => {
          const target = getProject(link.targetId);
          const metricLabel = link.metric === "advance" ? "진행률" : link.metric === "both" ? "완성도/진행률" : "완성도";
          return `
            <button type="button" data-select-project="${link.targetId}">
              <strong>${escapeHtml(target?.name || "연결된 프로젝트")}</strong>
              <em>${metricLabel}에 ${link.weight}% 기여</em>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function taskCardMarkup(task, showProject = false) {
  const project = getProject(task.projectId);
  const progress = clampProgress(task.progress);
  const advance = clampProgress(task.advance);
  const isFocused = state.appSettings.focusedTaskIds?.includes(task.id);
  const metricTypes = task.contributionMode === "completion"
    ? ["completion"]
    : task.contributionMode === "advance"
      ? ["advance"]
      : ["completion", "advance"];
  const levelLabel = progress < 30 ? "\ub0ae\uc74c" : progress < 60 ? "\uc911\uac04" : "\ub192\uc74c";
  const advanceLabel = advance < 30 ? "\ub0ae\uc74c" : advance < 60 ? "\uc911\uac04" : "\ub192\uc74c";
  const meta = [
    showProject && project ? getProjectPath(project).slice(-2).join(" / ") : "",
    task.note ? "\uba54\ubaa8 \uc788\uc74c" : "",
    metricTypes.includes("completion") ? `\uc644\uc131\ub3c4 ${levelLabel}` : "",
    metricTypes.includes("advance") && !metricTypes.includes("completion") ? `\uc9c4\ud589\ub960 ${advanceLabel}` : ""
  ].filter(Boolean).join(" \u00b7 ");

  const archiveLinks = (state.archiveResourceLinks || [])
    .filter(link => link.targetType === "task" && Number(link.targetId) === Number(task.id));
  const archiveResourceCount = archiveLinks
    .filter(link => (state.archiveResources || []).some(resource => Number(resource.id) === Number(link.resourceId)))
    .length;

  return `
    <article class="task-card ${progress >= 100 ? "done" : ""} ${isFocused ? "focused" : ""}">
      <button class="task-card-main" data-open-note="${task.id}" aria-label="${escapeHtml(task.name)} \uba54\ubaa8 \uc5f4\uae30">
        <strong>${escapeHtml(task.name)}</strong>
        <span>${escapeHtml(meta)}</span>
        ${archiveResourceCount ? `<span class="task-resource-summary">\uc790\ub8cc ${archiveResourceCount}\uac1c</span>` : ""}
      </button>
      <button class="task-launch-button" type="button" data-open-task-launcher="${task.id}" aria-label="${escapeHtml(task.name)} \uc791\uc5c5 \uc790\ub8cc \uc5f4\uae30">\uc791\uc5c5 \uc5f4\uae30</button>
      <button class="task-focus-button" type="button" data-focus-task="${task.id}" aria-pressed="${isFocused}" aria-label="${escapeHtml(task.name)} 집중 위젯 ${isFocused ? "해제" : "선택"}">${isFocused ? "집중중" : "집중"}</button>
      <button class="task-delete-button" type="button" data-delete-task="${task.id}" aria-label="${escapeHtml(task.name)} \uc0ad\uc81c">\u00d7</button>
      ${metricTypes.includes("completion") ? `
        <label class="task-completion-control">
          <span>\uc644\uc131\ub3c4 <strong>${progress}%</strong></span>
          <input type="range" min="0" max="100" step="5" value="${progress}" data-task-progress="${task.id}" aria-label="${escapeHtml(task.name)} 완성도" />
        </label>
      ` : ""}
      ${metricTypes.includes("advance") ? `
        <label class="task-completion-control">
          <span>\uc9c4\ud589\ub960 <strong>${advance}%</strong></span>
          <input type="range" min="0" max="100" step="5" value="${advance}" data-task-advance="${task.id}" aria-label="${escapeHtml(task.name)} 진행률" />
        </label>
      ` : ""}
    </article>
  `;
}

export function taskSectionMarkup(title, items, caption = "", showProject = false) {
  if (!items.length) return "";
  return `
    <section class="task-lane">
      <div class="task-section-title">
        <h3>${escapeHtml(title)}</h3>
        ${caption ? `<span>${escapeHtml(caption)}</span>` : ""}
      </div>
      <div class="task-card-stack">${items.map((task) => taskCardMarkup(task, showProject)).join("")}</div>
    </section>
  `;
}

export function getProjectMetricTypes(project) {
  if (!project.parentId) return ["completion", "advance"];
  if (project.contributionMode === "completion") return ["completion"];
  if (project.contributionMode === "advance") return ["advance"];
  return ["completion", "advance"];
}

export function metricBadgesMarkup(project) {
  const metricTypes = getProjectMetricTypes(project);
  const rollupProgress = getProjectDisplayProgress(project.id);
  const rollupAdvance = getProjectDisplayAdvance(project.id);
  return `
    <span class="metric-badges">
      ${metricTypes.includes("completion") ? `
        <span class="completion-badge">
          <b>${rollupProgress}%</b>
          <small>완성도</small>
        </span>
      ` : ""}
      ${metricTypes.includes("advance") ? `
        <span class="completion-badge advance-badge">
          <b>${rollupAdvance}%</b>
          <small>진행률</small>
        </span>
      ` : ""}
    </span>
  `;
}

export function projectListGraphsMarkup(project) {
  const metricTypes = getProjectMetricTypes(project);
  return `
    <span class="project-item-graphs">
      ${metricTypes.includes("completion") ? `
        <span class="project-mini-graph completion-mini-graph">
          <small>완성도 그래프</small>
          ${progressSegmentsMarkup(project.id)}
        </span>
      ` : ""}
      ${metricTypes.includes("advance") ? `
        <span class="project-mini-graph advance-mini-graph">
          <small>진행률 그래프</small>
          ${advanceSegmentsMarkup(project.id)}
        </span>
      ` : ""}
    </span>
  `;
}

export function renderViewSwitch() {
  return `
    <div class="view-switch" aria-label="보기 전환">
      <button type="button" class="${state.viewMode === "detail" ? "active" : ""}" data-view-mode="detail">상세</button>
      <button type="button" class="${state.viewMode === "graph" ? "active" : ""}" data-view-mode="graph">그래프</button>
    </div>
  `;
}

export function renderDetailHeader(project) {
  const deadline = project.deadline ? projectDeadlineInfo(project.deadline) : null;
  const parent = project.parentId ? getProject(project.parentId) : null;
  const childCount = getChildProjects(project.id).length;
  const rollupProgress = getProjectDisplayProgress(project.id);
  const rollupAdvance = getProjectDisplayAdvance(project.id);

  return `
    <header class="detail-header">
      <div class="detail-title-area">
        <p class="detail-kicker">${parent ? `${escapeHtml(parent.name)} 안의 프로젝트` : escapeHtml(project.status)}</p>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.note)}</p>
        <div class="project-deadline-box ${deadline?.state || "none"}">
          <span>프로젝트 데드라인</span>
          <strong>${project.deadline ? escapeHtml(formatDueLabel(project.deadline)) : "없음"}</strong>
          <button type="button" id="editProjectDeadline">수정</button>
        </div>
      </div>
      <div class="detail-side">
        ${renderViewSwitch()}
        <div class="detail-progress completion-card">
          <strong>${rollupProgress}%</strong>
          <span>${childCount ? "하위 합산" : "할 일 합산"}</span>
        </div>
        <div class="detail-progress advance-card">
          <strong>${rollupAdvance}%</strong>
          <span>진행률</span>
        </div>
        <button class="delete-project-button" type="button" id="deleteProjectButton">프로젝트 삭제</button>
      </div>
    </header>
  `;
}

export function projectDeadlineInfo(dateString) {
  const days = daysUntil(dateString);
  if (days < 0) return { state: "urgent", label: `${Math.abs(days)}일 지남` };
  if (days === 0) return { state: "urgent", label: "오늘" };
  if (days === 1) return { state: "soon", label: "내일" };
  if (days <= 3) return { state: "soon", label: `D-${days}` };
  return { state: "later", label: formatDueLabel(dateString) };
}

export function renderChildProjects(project) {
  const childProjects = getChildProjects(project.id);
  if (!childProjects.length) return "";

  return `
    <section class="child-projects">
      <div class="task-section-title">
        <h3>하위 프로젝트</h3>
        <span>안쪽 완성도가 위로 올라갑니다</span>
      </div>
      <div class="child-project-grid">
        ${childProjects.map((child) => {
          const childTasks = getProjectTasks(child.id, true);
          return `
            <button class="child-project-card" data-select-project="${child.id}">
              <span>${escapeHtml(child.status)}</span>
              <strong>${escapeHtml(child.name)}</strong>
              <em>${child.deadline ? escapeHtml(formatDueLabel(child.deadline)) : "마감 없음"} · ${childTasks.length}개 할 일 · 완성 ${getProjectDisplayProgress(child.id)}% · 진행 ${getProjectDisplayAdvance(child.id)}%</em>
              ${progressSegmentsMarkup(child.id)}
              ${advanceSegmentsMarkup(child.id)}
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderBottleneckAlertCardLegacy(project) {
  const bottlenecks = getBottleneckDetails(project.id);
  if (!bottlenecks.length) return "";

  return `
    <section class="bottleneck-alert-card" aria-label="\ud504\ub85c\uc81d\ud2b8 \uc9c0\uc5f0 \uc694\uc778 \uacbd\uace0">
      <div class="bottleneck-alert-header">
        <span>\ud604\uc7ac \ud504\ub85c\uc81d\ud2b8\ub97c \uc9c0\uc5f0\uc2dc\ud0a4\ub294 \uc694\uc778</span>
      </div>
      <div class="bottleneck-alert-list">
        ${bottlenecks.map((b) => {
          const metricName = b.metric === "advance" ? "진행률" : "완성도";
          const targetTypeLabel = b.sourceType === "task" ? "할 일" : b.sourceType === "formula" ? "수식" : "프로젝트";

          let actionButtons = "";
          if (b.type === "external") {
            actionButtons = `
              <button type="button" class="bottleneck-action-btn" data-bottleneck-focus-node="project-${b.sourceId}">[\ub178\ub4dc\ub85c \uc774\ub3d9]</button>
              <button type="button" class="bottleneck-action-btn" data-bottleneck-add-task="${b.sourceId}">[\ud560 \uc77c \ucd94\uac00]</button>
              <button type="button" class="bottleneck-action-btn" data-bottleneck-pin-focused="${b.sourceId}" data-source-type="${b.sourceType}">[\uc9d1\uc911 \ub4f1\ub85d]</button>
            `;
          } else {
            if (b.sourceType === "project") {
              actionButtons = `
                <button type="button" class="bottleneck-action-btn" data-bottleneck-focus-node="project-${b.sourceId}">[\ub178\ub4dc\ub85c \uc774\ub3d9]</button>
                <button type="button" class="bottleneck-action-btn" data-bottleneck-add-task="${b.sourceId}">[\ud560 \uc77c \ucd94\uac00]</button>
                <button type="button" class="bottleneck-action-btn" data-bottleneck-pin-focused="${b.sourceId}" data-source-type="project">[\uc9d1\uc911 \ub4f1\ub85d]</button>
              `;
            } else {
              actionButtons = `
                <button type="button" class="bottleneck-action-btn" data-bottleneck-focus-node="task-${b.sourceId}">[\ub178\ub4dc\ub85c \uc774\ub3d9]</button>
                <button type="button" class="bottleneck-action-btn" data-bottleneck-pin-task="${b.sourceId}">[\uc9d1\uc911 \ub4f1\ub85d]</button>
              `;
            }
          }

          return `
            <div class="bottleneck-alert-item ${b.level}">
              <p>
                <strong>${escapeHtml(b.sourceName)}</strong>(${targetTypeLabel})\uc774(\uac00) \uc774 \ud504\ub85c\uc81d\ud2b8 ${metricName}\ub97c <strong>${b.drag.toFixed(1)}%p</strong> \uac10\uc18c\uc2dc\ud0a4\ub294 \uc911
              </p>
              <div class="bottleneck-item-actions">
                ${actionButtons}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

export function renderBottleneckAlertCard(project) {
  const bottlenecks = getBottleneckRecommendations(project.id);
  if (!bottlenecks.length) return "";

  const actionButton = (className, attrs, label) => `
    <button type="button" class="bottleneck-action-btn ${className}" ${attrs}>${label}</button>
  `;

  return `
    <section class="bottleneck-alert-card" aria-label="\ud504\ub85c\uc81d\ud2b8 \ubcd1\ubaa9\uc694\uc778 \uacbd\uace0">
      <div class="bottleneck-alert-header">
        <div>
          <span>\ubcd1\ubaa9\uc694\uc778</span>
          <strong>\ud604\uc7ac \ud504\ub85c\uc81d\ud2b8\ub97c \ub2a6\ucd94\ub294 \ud56d\ubaa9</strong>
        </div>
        <em>${bottlenecks.length}\uac1c</em>
      </div>
      <div class="bottleneck-alert-list">
        ${bottlenecks.map((b) => {
          const metricName = b.metric === "advance" ? "진행률" : "완성도";
          const targetTypeLabel = b.sourceType === "task" ? "할 일" : b.sourceType === "formula" ? "수식" : "프로젝트";
          const levelLabel = b.level === "critical" ? "\uc704\ud5d8" : "\uc8fc\uc758";
          const focusTarget = `${b.sourceType === "task" ? "task" : "project"}-${b.sourceId}`;
          const canAddTask = b.sourceType === "project" || b.type === "external";
          const pinAttr = b.sourceType === "task"
            ? `data-bottleneck-pin-task="${b.sourceId}"`
            : `data-bottleneck-pin-focused="${b.sourceId}" data-source-type="${b.sourceType}"`;
          const actionButtons = `
            ${actionButton("trace", `data-bottleneck-focus-node="${focusTarget}"`, "\ucd94\uc801")}
            ${canAddTask ? actionButton("add", `data-bottleneck-add-task="${b.sourceId}"`, "\ud560 \uc77c \ucd94\uac00") : ""}
            ${actionButton("pin", pinAttr, "\uc9d1\uc911")}
          `;

          return `
            <div class="bottleneck-alert-item ${b.level}">
              <div class="bottleneck-item-copy">
                <span class="bottleneck-level">${levelLabel}</span>
                <p>
                  <strong>${escapeHtml(b.sourceName)}</strong>
                  <span>${targetTypeLabel} \u00b7 ${metricName} -${b.drag.toFixed(1)}%p</span>
                </p>
                <small class="bottleneck-recommendation">
                  <b>\ucd94\ucc9c</b>
                  ${escapeHtml(b.recommendation)}
                </small>
              </div>
              <div class="bottleneck-item-actions">
                ${actionButtons}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderProjectArchiveViewLegacy(project) {
  const resources = project.resources || [];

  // 프로젝트 트리 계층 옵션 빌드
  const visited = new Set();
  const options = [];

  function walk(parentId, depth) {
    state.projects
      .filter((p) => p.parentId === parentId)
      .forEach((p) => {
        if (visited.has(p.id)) return;
        visited.add(p.id);
        const prefix = depth > 0 ? "　".repeat(depth) + "└ " : "● ";
        const isSelected = p.id === project.id ? "selected" : "";
        options.push(`<option value="${p.id}" ${isSelected}>${prefix}${escapeHtml(p.name)}</option>`);
        walk(p.id, depth + 1);
      });
  }
  walk(null, 0);
  state.projects.filter((p) => !visited.has(p.id)).forEach((p) => {
    const isSelected = p.id === project.id ? "selected" : "";
    options.push(`<option value="${p.id}" ${isSelected}>● ${escapeHtml(p.name)}</option>`);
  });

  const projectOptionsMarkup = options.join("\n");

  // 카테고리 분류 렌더링
  const folders = resources.filter(r => r.type === "folder");
  const files = resources.filter(r => r.type === "file");
  const links = resources.filter(r => r.type === "link");

  const buildCategorySection = (title, items, defaultIcon) => {
    const listHtml = items.length ? items.map(res => {
      return `
        <div class="archive-resource-row" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; box-shadow: var(--shadow-sm);">
          <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">
            <strong style="display: block; font-size: 12px; color: var(--text);">${defaultIcon} ${escapeHtml(res.name)}</strong>
            ${res.desc ? `<p style="margin: 3px 0 0 0; font-size: 10px; color: var(--muted);">${escapeHtml(res.desc)}</p>` : ""}
            <small style="display: block; font-size: 9px; color: var(--muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(res.path)}</small>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(res.path)}" data-archive-type="${res.type}" style="padding: 4px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid var(--border); background: var(--panel-raised); cursor: pointer; color: var(--text); font-weight: 600;">열기</button>
            <button type="button" class="mock-button delete-archive-btn" data-delete-archive-id="${res.id}" data-project-id="${project.id}" style="padding: 4px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid var(--coral); background: transparent; color: var(--coral); cursor: pointer;">×</button>
          </div>
        </div>
      `;
    }).join("") : `<p class="notice" style="font-size: 11px; color: var(--muted); padding: 8px; border: 1px dashed var(--border); border-radius: 8px; margin: 0 0 16px 0; text-align: center;">등록된 리소스가 없습니다.</p>`;

    return `
      <div class="archive-category-block" style="margin-bottom: 20px;">
        <h4 style="text-align: left; font-size: 11.5px; font-weight: 700; color: var(--muted); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>${title}</span>
          <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: var(--panel-soft); color: var(--text);">${items.length}</span>
        </h4>
        ${listHtml}
      </div>
    `;
  };

  const sectionsMarkup = `
    ${buildCategorySection("작업 디렉토리 / 로컬 폴더", folders, "📁")}
    ${buildCategorySection("작업 문서 / 디자인 에셋", files, "📄")}
    ${buildCategorySection("외부 참고 레퍼런스 / 웹 링크", links, "🔗")}
  `;

  return `
    <div class="archive-drop-overlay" id="archiveDropOverlay" hidden>
      <div class="overlay-content">
        <svg style="width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-bottom: 8px; color: var(--accent);" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        <span>이 프로젝트에 리소스 파일 연결 추가</span>
      </div>
    </div>

    <header class="detail-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; width: 100%;">
      <div class="detail-title-area" style="text-align: left; flex: 1;">
        <p class="detail-kicker">프로젝트 보관소</p>
        <h2>${escapeHtml(project.name)} 아카이브</h2>
        <p>프로젝트와 관련된 로컬 파일, 디렉토리 경로, 참고 웹사이트를 연결하여 바로 실행합니다.</p>
      </div>
      <div class="archive-project-selector-wrap" style="flex-shrink: 0; margin-top: 8px; text-align: right;">
        <label for="archiveProjectSelect" style="display: block; font-size: 10.5px; font-weight: 700; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">프로젝트 전환</label>
        <select id="archiveProjectSelect" style="padding: 6px 12px; font-size: 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; min-width: 180px; max-width: 240px; font-weight: 600; outline: none;">
          ${projectOptionsMarkup}
        </select>
      </div>
    </header>

    <section class="archive-list-section" style="margin-top: 20px;">
      ${sectionsMarkup}
    </section>

    <section class="archive-add-section" style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--border);">
      <h3 style="text-align: left; font-size: 12px; margin-bottom: 8px; color: var(--text);">+ 새 리소스 연결 추가</h3>
      <form id="addArchiveForm" style="display: grid; gap: 8px; text-align: left;">
        <div style="display: flex; gap: 6px;">
          <input type="text" id="newArchiveName" placeholder="리소스 이름 (예: 브랜드 가이드라인)" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
          <select id="newArchiveType" style="width: 100px; padding: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);">
            <option value="file">로컬 파일</option>
            <option value="folder">로컬 폴더</option>
            <option value="link">웹 링크</option>
          </select>
        </div>
        <div style="display: flex; gap: 6px;">
          <input type="text" id="newArchiveDesc" placeholder="리소스 간단 설명 (예: 최종 BI 로고 가이드 문서)" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" />
          <input type="text" id="newArchivePath" placeholder="로컬 경로 또는 웹 URL (예: C:\\Projects\\spec.pdf)" style="flex: 1.5; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
          <button type="submit" style="padding: 6px 16px; border: none; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-weight: bold;">추가</button>
        </div>
      </form>
    </section>
  `;
}
