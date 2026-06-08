export const ARCHIVE_EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

const DEFAULT_BATCH_LIMIT = 24;
let embeddingExtractorPromise = null;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value) {
  let hash = 2166136261;
  const text = normalizeText(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizeVector(vector) {
  const values = Array.from(vector || []).map(Number).filter(Number.isFinite);
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return [];
  return values.map((value) => value / magnitude);
}

function getEmbeddingCache(stateLike) {
  const appSettings = stateLike.appSettings || (stateLike.appSettings = {});
  const cache = appSettings.archiveEmbeddingCache && typeof appSettings.archiveEmbeddingCache === "object"
    ? appSettings.archiveEmbeddingCache
    : {};
  if (cache.model !== ARCHIVE_EMBEDDING_MODEL || !cache.items || typeof cache.items !== "object") {
    appSettings.archiveEmbeddingCache = {
      model: ARCHIVE_EMBEDDING_MODEL,
      items: {}
    };
  }
  return appSettings.archiveEmbeddingCache;
}

function getDocumentText(document) {
  return normalizeText([
    document.name,
    document.desc,
    document.note,
    Array.isArray(document.tags) ? document.tags.join(" ") : document.tags
  ].filter(Boolean).join(" "));
}

function archiveResourceDocuments(stateLike) {
  return (Array.isArray(stateLike.archiveResources) ? stateLike.archiveResources : []).map((resource) => ({
    key: `resource:${Number(resource.id)}`,
    target: resource,
    text: getDocumentText(resource)
  }));
}

function projectDocuments(stateLike) {
  const tasks = Array.isArray(stateLike.tasks) ? stateLike.tasks : [];
  return (Array.isArray(stateLike.projects) ? stateLike.projects : []).map((project) => {
    const projectTasks = tasks.filter((task) => Number(task.projectId) === Number(project.id));
    return {
      key: `project:${Number(project.id)}`,
      target: project,
      text: normalizeText([
        project.name,
        project.note,
        ...projectTasks.flatMap((task) => [task.name, task.note])
      ].filter(Boolean).join(" "))
    };
  });
}

function taskDocuments(stateLike) {
  const projects = Array.isArray(stateLike.projects) ? stateLike.projects : [];
  return (Array.isArray(stateLike.tasks) ? stateLike.tasks : []).map((task) => {
    const project = projects.find((item) => Number(item.id) === Number(task.projectId));
    return {
      key: `task:${Number(task.id)}`,
      target: task,
      text: normalizeText([
        task.name,
        task.note,
        project?.name,
        project?.note
      ].filter(Boolean).join(" "))
    };
  });
}

function allDocuments(stateLike) {
  return [
    ...archiveResourceDocuments(stateLike),
    ...projectDocuments(stateLike),
    ...taskDocuments(stateLike)
  ].filter((document) => document.key && document.text);
}

async function defaultEmbeddingProvider(text) {
  if (!embeddingExtractorPromise) {
    embeddingExtractorPromise = import("@huggingface/transformers")
      .then(async ({ pipeline }) => pipeline("feature-extraction", ARCHIVE_EMBEDDING_MODEL));
  }
  const extractor = await embeddingExtractorPromise;
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return normalizeVector(output.data);
}

export function hydrateArchiveSemanticEmbeddings(stateLike) {
  const cache = getEmbeddingCache(stateLike);
  allDocuments(stateLike).forEach((document) => {
    const hash = hashText(document.text);
    const cached = cache.items[document.key];
    if (cached?.hash === hash && Array.isArray(cached.vector) && cached.vector.length) {
      document.target.semanticEmbedding = cached.vector;
      document.target.semanticEmbeddingHash = hash;
      document.target.semanticEmbeddingModel = cache.model;
    }
  });
}

export async function ensureArchiveSemanticEmbeddings(stateLike, options = {}) {
  const cache = getEmbeddingCache(stateLike);
  const provider = options.provider || defaultEmbeddingProvider;
  const limit = Math.max(1, Number(options.limit) || DEFAULT_BATCH_LIMIT);
  let computed = 0;

  hydrateArchiveSemanticEmbeddings(stateLike);

  for (const document of allDocuments(stateLike)) {
    if (computed >= limit) break;
    const hash = hashText(document.text);
    const cached = cache.items[document.key];
    if (cached?.hash === hash && Array.isArray(cached.vector) && cached.vector.length) continue;

    const vector = normalizeVector(await provider(document.text, document));
    if (!vector.length) continue;
    cache.items[document.key] = {
      hash,
      vector,
      updatedAt: new Date().toISOString()
    };
    document.target.semanticEmbedding = vector;
    document.target.semanticEmbeddingHash = hash;
    document.target.semanticEmbeddingModel = cache.model;
    computed += 1;
  }

  return {
    computed,
    model: cache.model,
    totalCached: Object.keys(cache.items).length
  };
}
