const ARCHIVE_TYPES = ["file", "folder", "link"];

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
      targetId: Number(link.targetId)
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
        targetId: Number(project.id)
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
    targetId: Number(targetId)
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
