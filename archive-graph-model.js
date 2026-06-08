import {
  cosineSimilarity,
  getArchiveContentTerms
} from "./archive-model.js";

const DEFAULT_NODE_LIMIT = 120;
const DEFAULT_EDGE_LIMIT = 220;
const RELATION_STOP_TERMS = new Set([
  "file",
  "folder",
  "link",
  "archive",
  "resource",
  "resources",
  "reference",
  "references",
  "project",
  "projects",
  "task",
  "tasks",
  "study",
  "text",
  "note",
  "notes",
  "paper",
  "papers",
  "material",
  "materials"
]);

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9\uac00-\ud7af-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueTerms(terms, limit = 12) {
  const seen = new Set();
  const result = [];
  (Array.isArray(terms) ? terms : []).forEach((term) => {
    const key = normalizeKey(term);
    if (!key || key.length < 2 || RELATION_STOP_TERMS.has(key) || seen.has(key)) return;
    seen.add(key);
    result.push(key);
  });
  return result.slice(0, limit);
}

function addNode(nodes, nodeMap, node) {
  if (nodeMap.has(node.id)) {
    const existing = nodeMap.get(node.id);
    existing.score = Math.max(existing.score || 0, node.score || 0);
    existing.active = Boolean(existing.active || node.active);
    existing.count = Math.max(existing.count || 0, node.count || 0);
    return existing;
  }
  nodeMap.set(node.id, node);
  nodes.push(node);
  return node;
}

function addLink(links, linkKeys, nodeMap, link) {
  if (!nodeMap.has(link.source) || !nodeMap.has(link.target)) return;
  const key = `${link.source}->${link.target}:${link.type || "link"}`;
  if (linkKeys.has(key)) return;
  linkKeys.add(key);
  links.push(link);
}

function assignGraphDistances(nodes, links, activeId) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
  links.forEach((link) => {
    if (!adjacency.has(link.source) || !adjacency.has(link.target)) return;
    adjacency.get(link.source).add(link.target);
    adjacency.get(link.target).add(link.source);
  });

  const distance = new Map();
  if (activeId && adjacency.has(activeId)) {
    const queue = [activeId];
    distance.set(activeId, 0);
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      const nextDistance = (distance.get(id) || 0) + 1;
      adjacency.get(id)?.forEach((neighborId) => {
        if (distance.has(neighborId)) return;
        distance.set(neighborId, nextDistance);
        queue.push(neighborId);
      });
    }
  }

  nodes.forEach((node) => {
    node.graphDistance = distance.get(node.id) ?? null;
    node.connectedToActive = node.graphDistance === 1;
  });
}

function buildLinksByResource(stateLike) {
  const projectsById = new Map((Array.isArray(stateLike?.projects) ? stateLike.projects : [])
    .map((project) => [Number(project.id), project]));
  const tasksById = new Map((Array.isArray(stateLike?.tasks) ? stateLike.tasks : [])
    .map((task) => [Number(task.id), task]));
  const linksByResource = new Map();

  (Array.isArray(stateLike?.archiveResourceLinks) ? stateLike.archiveResourceLinks : []).forEach((link) => {
    const resourceId = Number(link?.resourceId);
    if (!resourceId) return;
    const targetType = link.targetType === "task" ? "task" : "project";
    const target = targetType === "task"
      ? tasksById.get(Number(link.targetId))
      : projectsById.get(Number(link.targetId));
    if (!target) return;
    const summary = {
      targetType,
      targetId: Number(target.id),
      label: target.name || `${targetType} ${target.id}`,
      relationStatus: link.relationStatus || "confirmed",
      relationType: link.relationType || "reference",
      relationStrength: link.relationStrength || "medium",
      relationScore: Number.isFinite(Number(link.relationScore)) ? Number(link.relationScore) : null
    };
    const summaries = linksByResource.get(resourceId) || [];
    summaries.push(summary);
    linksByResource.set(resourceId, summaries);
  });

  return linksByResource;
}

function scoreMaterial(resource, selectedResource, selectedEmbedding, linksByResource) {
  const terms = uniqueTerms(getArchiveContentTerms(resource), 16);
  const selected = selectedResource && Number(resource.id) === Number(selectedResource.id);
  const embedding = Array.isArray(resource?.semanticEmbedding) ? resource.semanticEmbedding : [];
  const semanticScore = selected ? 1 : cosineSimilarity(embedding, selectedEmbedding);
  const backlinks = linksByResource.get(Number(resource.id)) || [];
  let score = selected ? 100 : 8;
  score += semanticScore * 72;
  score += Math.min(18, backlinks.length * 6);
  if (!selected && selectedEmbedding.length && semanticScore < 0.3) {
    score -= backlinks.length ? 12 : 4;
  }
  return {
    score: Math.max(1, Math.min(100, Math.round(score))),
    terms,
    semanticScore,
    embedding,
    backlinks
  };
}

function edgeWeight(type, sourceScore = 0, targetScore = 0, semanticScore = 0) {
  const base = type === "similarity" ? 48 : 30;
  return Math.max(1, Math.min(100, Math.round(base + semanticScore * 18 + Math.sqrt(sourceScore + targetScore))));
}

export function buildArchiveGraphModel(stateLike, options = {}) {
  const resources = (Array.isArray(stateLike?.archiveResources) ? stateLike.archiveResources : [])
    .filter((resource) => resource && resource.type !== "folder");
  const focusDepth = clampNumber(options.depth, 1, 4, 2);
  const depthScale = focusDepth === 1 ? 0.45 : focusDepth === 2 ? 1 : focusDepth === 3 ? 1.45 : 2;
  const nodeLimit = clampNumber((Number(options.limit) || DEFAULT_NODE_LIMIT) * depthScale, 20, 240, DEFAULT_NODE_LIMIT);
  const edgeLimit = clampNumber((Number(options.edgeLimit) || DEFAULT_EDGE_LIMIT) * depthScale, 40, 600, DEFAULT_EDGE_LIMIT);
  const selectedId = Number(stateLike?.selectedArchiveResourceId);
  const selectedResource = resources.find((resource) => Number(resource.id) === selectedId) || resources[0] || null;
  const selectedTerms = uniqueTerms(selectedResource ? getArchiveContentTerms(selectedResource) : [], 16);
  const focusTerms = new Set(selectedTerms);
  const selectedEmbedding = Array.isArray(selectedResource?.semanticEmbedding) ? selectedResource.semanticEmbedding : [];
  const nodes = [];
  const links = [];
  const nodeMap = new Map();
  const linkKeys = new Set();
  const linksByResource = buildLinksByResource(stateLike);

  const materialCandidates = resources
    .map((resource) => ({
      resource,
      ...scoreMaterial(resource, selectedResource, selectedEmbedding, linksByResource)
    }))
    .sort((a, b) => b.score - a.score || String(a.resource.name || "").localeCompare(String(b.resource.name || "")));
  const visibleMaterials = materialCandidates.slice(0, nodeLimit);
  visibleMaterials.forEach(({ resource, score, terms, semanticScore, backlinks }) => {
    addNode(nodes, nodeMap, {
      id: `resource:${resource.id}`,
      kind: resource.type === "link" ? "link" : "file",
      label: resource.name || "Untitled material",
      meta: resource.type || "file",
      score,
      terms,
      semanticScore,
      explicitLinkCount: backlinks.length,
      backlinks: backlinks.slice(0, 4),
      active: selectedResource && Number(resource.id) === Number(selectedResource.id),
      resourceId: Number(resource.id)
    });
  });

  for (let i = 0; i < visibleMaterials.length; i += 1) {
    for (let j = i + 1; j < visibleMaterials.length; j += 1) {
      if (links.length >= edgeLimit) break;
      const a = visibleMaterials[i];
      const b = visibleMaterials[j];
      const bTerms = new Set(b.terms);
      const sharedTerms = a.terms.filter((term) => bTerms.has(term));
      const semanticScore = cosineSimilarity(a.embedding, b.embedding);
      if (semanticScore < 0.5 && !sharedTerms.some((term) => focusTerms.has(term))) continue;
      addLink(links, linkKeys, nodeMap, {
        source: `resource:${a.resource.id}`,
        target: `resource:${b.resource.id}`,
        type: "similarity",
        label: sharedTerms.length ? `shares ${sharedTerms[0]}` : "semantic match",
        score: edgeWeight("similarity", a.score, b.score, semanticScore),
        sharedTerms: sharedTerms.slice(0, 4)
      });
    }
  }

  const orderedLinks = links
    .sort((a, b) => b.score - a.score || String(a.source).localeCompare(String(b.source)))
    .slice(0, edgeLimit);
  const activeNodeId = selectedResource ? `resource:${selectedResource.id}` : null;
  assignGraphDistances(nodes, orderedLinks, activeNodeId);

  return {
    nodes,
    links: orderedLinks,
    meta: {
      selectedId: selectedResource ? Number(selectedResource.id) : null,
      focusDepth,
      topTerms: selectedTerms,
      materialCount: visibleMaterials.length,
      nodeCount: nodes.length,
      relationCount: orderedLinks.length,
      backlinkCount: Array.from(linksByResource.values()).reduce((total, summaries) => total + summaries.length, 0),
      hiddenMaterialCount: Math.max(0, resources.length - visibleMaterials.length)
    }
  };
}
