const ARCHIVE_TYPES = ["file", "folder", "link"];
const RELATION_TYPES = ["core", "reference", "evidence", "similar"];
const RELATION_STRENGTHS = ["strong", "medium", "weak"];
const RELATION_STATUSES = ["confirmed", "suggested"];
const MANAGEMENT_TERMS = new Set([
  "reference-library", "g-drive", "c-drive", "d-drive", "source", "storage", "collection",
  "folder", "file", "link", "note/doc", "note-doc", "image/design", "image-design",
  "media", "archive", "local", "drive", "root", "asset", "assets", "resource",
  "resources", "reference", "references", "doc", "docs", "document", "documents",
  "google", "external", "indexed", "index", "copy", "draft", "final", "scan", "temp",
  "new", "old", "version", "ver", "note", "notes", "paper", "papers", "seminar",
  "material", "materials", "guide", "summary", "the", "and", "for", "from", "with",
  "of", "project", "projects", "study", "text", "pdf", "txt", "md", "hwp", "docx",
  "ppt", "pptx", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "webp", "gif", "zip",
  "rar", "mp4", "mp3", "psd", "indd", "gpt", "귀한거", "주신거", "선생님이", "교수님이"
]);
["kind", "size", "mb", "items", "item"].forEach((term) => MANAGEMENT_TERMS.add(term));

function normalizeTerm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isManagementTerm(value) {
  const key = normalizeTerm(value);
  if (!key || MANAGEMENT_TERMS.has(key)) return true;
  if (/^[a-z]:$/.test(key) || /^[a-z]-drive$/.test(key)) return true;
  if (/^\d+$/.test(key)) return true;
  return key.includes("주신거") || key.includes("귀한거");
}

function extractContentTermsFromText(...values) {
  const terms = [];
  values.forEach((value) => {
    const matches = String(value || "").match(/[\p{Script=Hangul}A-Za-z][\p{Script=Hangul}A-Za-z0-9]{1,}/gu) || [];
    matches.forEach((match) => {
      const key = normalizeTerm(match);
      if (!key || isManagementTerm(key)) return;
      terms.push(match);
    });
  });
  return [...new Set(terms.map((term) => normalizeTerm(term)).filter(Boolean))];
}

export function isMarkdownResource(resource) {
  const path = String(resource?.path || "").toLowerCase();
  return /\.m(?:ark)?d$/.test(path) || normalizeArchiveTags(resource?.tags || []).some((tag) => normalizeTerm(tag) === "md");
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  const aValues = Array.isArray(a) ? a : [];
  const bValues = Array.isArray(b) ? b : [];
  const length = Math.min(aValues.length, bValues.length);

  for (let index = 0; index < length; index += 1) {
    const value = Number(aValues[index]) || 0;
    const other = Number(bValues[index]) || 0;
    dot += value * other;
  }
  aValues.forEach((value) => {
    aMagnitude += value * value;
  });
  bValues.forEach((value) => {
    bMagnitude += value * value;
  });

  if (!aMagnitude || !bMagnitude) return 0;
  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}

function sharedTermsFromVectors(a, b) {
  const bSet = new Set(b);
  return a.filter((term) => bSet.has(term));
}

function relationScoreFromSignals(resource, semanticScore, sharedTerms = []) {
  let score = semanticScore * 68;
  score += Math.min(24, sharedTerms.length * 8);
  if (resource?.type === "folder") score -= 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function relationStrengthFromScore(score) {
  if (score >= 78) return "strong";
  if (score >= 62) return "medium";
  return "weak";
}

function relationTypeFromSignals(targetType, semanticScore, sharedTerms = []) {
  if (semanticScore >= 0.82 && sharedTerms.length >= 2) return "core";
  if (targetType === "project" && sharedTerms.length >= 2) return "evidence";
  if (semanticScore >= 0.7 && sharedTerms.length <= 1) return "similar";
  return "reference";
}

function relationMetaFromCandidate(candidate, targetType, status = "confirmed") {
  return {
    relationStatus: RELATION_STATUSES.includes(status) ? status : "confirmed",
    relationType: relationTypeFromSignals(targetType, candidate.semanticScore || 0, candidate.sharedTerms || []),
    relationStrength: relationStrengthFromScore(candidate.score || 0),
    relationScore: Math.max(0, Math.min(100, Math.round(Number(candidate.score) || 0)))
  };
}

function pathSegmentKeys(resource) {
  const path = String(resource?.path || "");
  const parts = path.split(/[\\/]+/).filter(Boolean);
  const folderParts = resource?.type === "folder" ? parts : parts.slice(0, -1);
  return new Set(folderParts.map((part) => normalizeTerm(part)).filter(Boolean));
}

function normalizePathKey(path) {
  return String(path || "")
    .trim()
    .replace(/[\\/]+$/g, "")
    .toLowerCase();
}

function containingFolderKey(resource) {
  const path = String(resource?.path || "").trim();
  if (!path) return "";
  if (resource?.type === "folder") return normalizePathKey(path);
  const parts = path.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 1) return "";
  return normalizePathKey(parts.slice(0, -1).join("\\"));
}

export function getArchiveContentTerms(resource) {
  const explicitTags = normalizeArchiveTags(resource?.tags || [])
    .map((tag) => normalizeTerm(tag))
    .filter((tag) => tag && !isManagementTerm(tag));
  const textTerms = extractContentTermsFromText(resource?.name, resource?.desc);
  return [...new Set([...explicitTags, ...textTerms])].slice(0, 8);
}

export function getProjectContentTerms(project, tasks = []) {
  const projectTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => Number(task.projectId) === Number(project?.id));
  return extractContentTermsFromText(
    project?.name,
    project?.note,
    ...projectTasks.flatMap((task) => [task.name, task.note])
  ).slice(0, 12);
}

export function getTaskContentTerms(task, projects = []) {
  const project = (Array.isArray(projects) ? projects : []).find((item) => Number(item.id) === Number(task?.projectId));
  return extractContentTermsFromText(
    task?.name,
    task?.note,
    project?.name,
    project?.note
  ).slice(0, 12);
}

export function scoreArchiveProjectRelation(resource, project, tasks = []) {
  const resourceEmbedding = Array.isArray(resource?.semanticEmbedding) ? resource.semanticEmbedding : [];
  const projectEmbedding = Array.isArray(project?.semanticEmbedding) ? project.semanticEmbedding : [];
  const semanticScore = cosineSimilarity(resourceEmbedding, projectEmbedding);
  const resourceTerms = getArchiveContentTerms(resource);
  const projectTerms = getProjectContentTerms(project, tasks);
  const sharedTerms = sharedTermsFromVectors(resourceTerms, projectTerms);
  const pendingEmbedding = !resourceEmbedding.length || !projectEmbedding.length;

  return {
    score: pendingEmbedding ? 0 : relationScoreFromSignals(resource, semanticScore, sharedTerms),
    semanticScore,
    sharedTerms,
    pendingEmbedding
  };
}

export function scoreArchiveTaskRelation(resource, task, projects = []) {
  const resourceEmbedding = Array.isArray(resource?.semanticEmbedding) ? resource.semanticEmbedding : [];
  const taskEmbedding = Array.isArray(task?.semanticEmbedding) ? task.semanticEmbedding : [];
  const semanticScore = cosineSimilarity(resourceEmbedding, taskEmbedding);
  const resourceTerms = getArchiveContentTerms(resource);
  const taskTerms = getTaskContentTerms(task, projects);
  const sharedTerms = sharedTermsFromVectors(resourceTerms, taskTerms);
  const pendingEmbedding = !resourceEmbedding.length || !taskEmbedding.length;

  return {
    score: pendingEmbedding ? 0 : relationScoreFromSignals(resource, semanticScore, sharedTerms),
    semanticScore,
    sharedTerms,
    pendingEmbedding
  };
}

export function buildAutomaticArchiveResourceLinks(projects, tasks, resources, existingLinks = [], options = {}) {
  const threshold = Number(options.threshold) || 64;
  const suggestionThreshold = Number(options.suggestionThreshold) || 40;
  const maxPerProject = Number(options.maxPerProject) || 8;
  const maxPerTask = Number(options.maxPerTask) || 5;
  const folderCollapseThreshold = Number(options.folderCollapseThreshold) || 3;
  const links = Array.isArray(existingLinks) ? [...existingLinks] : [];
  const suggestions = [];
  const folderByPath = new Map();
  const existingKeys = new Set(links.map((link) => `${Number(link.resourceId)}:${link.targetType === "task" ? "task" : "project"}:${Number(link.targetId)}`));
  let added = 0;

  (Array.isArray(resources) ? resources : []).forEach((resource) => {
    if (resource?.type !== "folder") return;
    const key = normalizePathKey(resource.path);
    if (key) folderByPath.set(key, resource);
  });

  (Array.isArray(projects) ? projects : []).forEach((project) => {
    const candidates = (Array.isArray(resources) ? resources : [])
      .map((resource) => {
        const relation = scoreArchiveProjectRelation(resource, project, tasks);
        return { resource, ...relation, folderKey: containingFolderKey(resource) };
      })
      .filter((candidate) => candidate.score >= suggestionThreshold && !candidate.pendingEmbedding)
      .sort((a, b) => b.score - a.score || String(a.resource.name || "").localeCompare(String(b.resource.name || "")));

    const grouped = new Map();
    candidates.forEach((candidate) => {
      if (!candidate.folderKey || candidate.resource.type === "folder") return;
      const group = grouped.get(candidate.folderKey) || [];
      group.push(candidate);
      grouped.set(candidate.folderKey, group);
    });

    const collapsedIds = new Set();
    const selected = [];
    grouped.forEach((group, folderKey) => {
      if (group.length < folderCollapseThreshold) return;
      const folder = folderByPath.get(folderKey);
      group.forEach((candidate) => collapsedIds.add(Number(candidate.resource.id)));
      if (folder) {
        selected.push({
          resource: folder,
          score: group[0].score + 10,
          semanticScore: group[0].semanticScore,
          sharedTerms: group[0].sharedTerms
        });
      } else {
        selected.push(...group.slice(0, 2));
      }
    });

    selected.push(...candidates.filter((candidate) => !collapsedIds.has(Number(candidate.resource.id))));
    selected
      .sort((a, b) => b.score - a.score || String(a.resource.name || "").localeCompare(String(b.resource.name || "")))
      .slice(0, maxPerProject)
      .forEach((candidate) => {
        const key = `${Number(candidate.resource.id)}:project:${Number(project.id)}`;
        if (existingKeys.has(key)) return;
        const relationMeta = relationMetaFromCandidate(candidate, "project", candidate.score >= threshold ? "confirmed" : "suggested");
        if (candidate.score < threshold) {
          suggestions.push({
            resourceId: Number(candidate.resource.id),
            targetType: "project",
            targetId: Number(project.id),
            ...relationMeta
          });
          return;
        }
        existingKeys.add(key);
        links.push({
          resourceId: Number(candidate.resource.id),
          targetType: "project",
          targetId: Number(project.id),
          ...relationMeta
        });
        added += 1;
      });
  });

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const candidates = (Array.isArray(resources) ? resources : [])
      .map((resource) => {
        const relation = scoreArchiveTaskRelation(resource, task, projects);
        return { resource, ...relation, folderKey: containingFolderKey(resource) };
      })
      .filter((candidate) => candidate.score >= suggestionThreshold && !candidate.pendingEmbedding)
      .sort((a, b) => b.score - a.score || String(a.resource.name || "").localeCompare(String(b.resource.name || "")));

    const grouped = new Map();
    candidates.forEach((candidate) => {
      if (!candidate.folderKey || candidate.resource.type === "folder") return;
      const group = grouped.get(candidate.folderKey) || [];
      group.push(candidate);
      grouped.set(candidate.folderKey, group);
    });

    const collapsedIds = new Set();
    const selected = [];
    grouped.forEach((group, folderKey) => {
      if (group.length < folderCollapseThreshold) return;
      const folder = folderByPath.get(folderKey);
      group.forEach((candidate) => collapsedIds.add(Number(candidate.resource.id)));
      if (folder) {
        selected.push({
          resource: folder,
          score: group[0].score + 10,
          semanticScore: group[0].semanticScore,
          sharedTerms: group[0].sharedTerms
        });
      } else {
        selected.push(...group.slice(0, 2));
      }
    });

    selected.push(...candidates.filter((candidate) => !collapsedIds.has(Number(candidate.resource.id))));
    selected
      .sort((a, b) => b.score - a.score || String(a.resource.name || "").localeCompare(String(b.resource.name || "")))
      .slice(0, maxPerTask)
      .forEach((candidate) => {
        const key = `${Number(candidate.resource.id)}:task:${Number(task.id)}`;
        if (existingKeys.has(key)) return;
        const relationMeta = relationMetaFromCandidate(candidate, "task", candidate.score >= threshold ? "confirmed" : "suggested");
        if (candidate.score < threshold) {
          suggestions.push({
            resourceId: Number(candidate.resource.id),
            targetType: "task",
            targetId: Number(task.id),
            ...relationMeta
          });
          return;
        }
        existingKeys.add(key);
        links.push({
          resourceId: Number(candidate.resource.id),
          targetType: "task",
          targetId: Number(task.id),
          ...relationMeta
        });
        added += 1;
      });
  });

  return { links, added, suggestions };
}

export function normalizeArchiveTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
  }
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, list) => list.indexOf(tag) === index);
}

export function normalizeArchiveResources(nextResources) {
  return (Array.isArray(nextResources) ? nextResources : [])
    .map((resource) => ({
      id: Number(resource.id),
      name: resource.name || "이름 없는 리소스",
      type: ARCHIVE_TYPES.includes(resource.type) ? resource.type : "file",
      path: resource.path || "",
      desc: resource.desc || "",
      tags: normalizeArchiveTags(resource.tags),
      createdAt: resource.createdAt || null
    }))
    .filter((resource) => Number.isFinite(resource.id));
}

export function normalizeArchiveResourceLinks(nextLinks, projects = [], tasks = [], resources = []) {
  const knownResourceIds = new Set(resources.map((resource) => Number(resource.id)));
  const knownProjectIds = new Set(projects.map((project) => Number(project.id)));
  const knownTaskIds = new Set(tasks.map((task) => Number(task.id)));
  const seen = new Set();

  return (Array.isArray(nextLinks) ? nextLinks : [])
    .map((link) => ({
      resourceId: Number(link.resourceId),
      targetType: link.targetType === "task" ? "task" : "project",
      targetId: Number(link.targetId),
      relationStatus: RELATION_STATUSES.includes(link.relationStatus) ? link.relationStatus : "confirmed",
      relationType: RELATION_TYPES.includes(link.relationType) ? link.relationType : "reference",
      relationStrength: RELATION_STRENGTHS.includes(link.relationStrength) ? link.relationStrength : "medium",
      relationScore: Number.isFinite(Number(link.relationScore))
        ? Math.max(0, Math.min(100, Math.round(Number(link.relationScore))))
        : null
    }))
    .filter((link) => {
      const targetExists = link.targetType === "task"
        ? knownTaskIds.has(link.targetId)
        : knownProjectIds.has(link.targetId);
      const key = `${link.resourceId}:${link.targetType}:${link.targetId}`;
      if (!knownResourceIds.has(link.resourceId) || !targetExists || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function migrateProjectResourcesToArchive(projects, archiveResources = [], archiveResourceLinks = []) {
  const normalizedResources = normalizeArchiveResources(archiveResources);
  const migratedProjects = projects.map((project) => ({ ...project, resources: [] }));
  const resourceMap = new Map();
  const nextResources = [...normalizedResources];
  const nextLinks = [...archiveResourceLinks];
  let nextId = Math.max(0, ...nextResources.map((resource) => Number(resource.id) || 0));

  projects.forEach((project) => {
    const resources = Array.isArray(project.resources) ? project.resources : [];
    resources.forEach((resource) => {
      nextId += 1;
      const migrated = {
        id: nextId,
        name: resource.name || "이름 없는 리소스",
        type: ARCHIVE_TYPES.includes(resource.type) ? resource.type : "file",
        path: resource.path || "",
        desc: resource.desc || "",
        tags: [],
        createdAt: resource.createdAt || null
      };
      nextResources.push(migrated);
      resourceMap.set(`${Number(project.id)}:${Number(resource.id)}`, migrated.id);
      if (!resourceMap.has(`legacy:${Number(resource.id)}`)) {
        resourceMap.set(`legacy:${Number(resource.id)}`, migrated.id);
      }
      nextLinks.push({
        resourceId: migrated.id,
        targetType: "project",
        targetId: Number(project.id),
        relationStatus: "confirmed",
        relationType: "reference",
        relationStrength: "medium",
        relationScore: null
      });
    });
  });

  return {
    projects: migratedProjects,
    archiveResources: nextResources,
    archiveResourceLinks: nextLinks,
    resourceMap
  };
}

export function createArchiveResourceId(resources) {
  return Math.max(Date.now(), 1 + Math.max(0, ...resources.map((resource) => Number(resource.id) || 0)));
}

export function updateArchiveResource(resources, resourceId, patch) {
  const id = Number(resourceId);
  let updated = null;
  const nextResources = (Array.isArray(resources) ? resources : []).map((resource) => {
    if (Number(resource.id) !== id) return resource;
    const next = {
      ...resource,
      name: patch.name?.trim() || resource.name || "이름 없는 리소스",
      type: ARCHIVE_TYPES.includes(patch.type) ? patch.type : resource.type,
      path: patch.path?.trim() || resource.path || "",
      desc: patch.desc?.trim() || "",
      tags: patch.tags !== undefined ? normalizeArchiveTags(patch.tags) : normalizeArchiveTags(resource.tags),
      createdAt: resource.createdAt || null
    };
    updated = next;
    return next;
  });
  return { resources: nextResources, updated };
}

export function addArchiveResourceLink(links, resourceId, targetType, targetId) {
  const nextLink = {
    resourceId: Number(resourceId),
    targetType: targetType === "task" ? "task" : "project",
    targetId: Number(targetId),
    relationStatus: "confirmed",
    relationType: "reference",
    relationStrength: "medium",
    relationScore: null
  };
  const exists = (Array.isArray(links) ? links : []).some((link) => {
    return Number(link.resourceId) === nextLink.resourceId
      && (link.targetType === "task" ? "task" : "project") === nextLink.targetType
      && Number(link.targetId) === nextLink.targetId;
  });
  return exists ? [...links] : [...(Array.isArray(links) ? links : []), nextLink];
}

export function removeArchiveResourceLink(links, resourceId, targetType, targetId) {
  const normalizedType = targetType === "task" ? "task" : "project";
  return (Array.isArray(links) ? links : []).filter((link) => {
    return !(Number(link.resourceId) === Number(resourceId)
      && (link.targetType === "task" ? "task" : "project") === normalizedType
      && Number(link.targetId) === Number(targetId));
  });
}
