import {
  clampProgress,
  clampGraphZoom,
  clampGraphCanvasScale,
  clampGraphNodeScale,
  getRollupProgress,
  getRollupAdvance,
  getProject,
  getBottleneckRecommendations
} from "./calculator.js";

import {
  buildAutomaticArchiveResourceLinks,
  addArchiveResourceLink,
  migrateProjectResourcesToArchive,
  normalizeArchiveResources,
  normalizeArchiveResourceLinks,
  normalizeArchiveTags
} from "./archive-model.js";

import { DEFAULT_ARCHIVE_SOURCES } from "./archive-seed-sources.js";
import { hydrateArchiveSemanticEmbeddings } from "./archive-embeddings.js";

// ==============================================================
// FUNCTION INDEX (state.js)
// --------------------------------------------------------------
// L97    createId
// L102   normalizeProjects
// L133   normalizeTasks
// L145   normalizeGraphMemoNodes
// L155   normalizeGraphFormulaNodes
// L167   normalizeGraphFormulaLinks
// L183   normalizeGraphFormulaInputLinks
// L200   normalizeProjectLinks
// L216   readSavedState
// L234   loadState
// L245   getSerializableState
// L262   todayKey
// L266   recordWorkspaceHistory
// L291   logActivity
// L302   applyLoadedState
// L353   saveState
// ==============================================================



const STORAGE_KEY = "studio-project-widget-state-v1";
const BACKUP_STORAGE_KEY = `${STORAGE_KEY}-backup`;

const defaultProjects = [
  { id: 1, parentId: null, name: "브랜드 리뉴얼", status: "진행 중", progress: 68, deadline: "2026-05-28", note: "콘셉트와 시안 흐름 정리" },
  { id: 7, parentId: 1, name: "콘셉트 설계", status: "진행 중", progress: 74, deadline: "2026-05-25", note: "핵심 키워드와 무드보드 정리" },
  { id: 8, parentId: 1, name: "시안 제작", status: "진행 중", progress: 42, deadline: "2026-05-27", note: "메인 비주얼과 적용 예시 만들기" },
  { id: 2, parentId: null, name: "포트폴리오 업데이트", status: "진행 중", progress: 45, deadline: "2026-06-03", note: "작업물 설명과 케이스 스터디 보강" },
  { id: 3, parentId: 2, name: "개인 웹사이트", status: "진행 중", progress: 30, deadline: "2026-06-10", note: "정보 구조와 타이포 시스템 정리" },
  { id: 4, parentId: null, name: "일러스트 시리즈", status: "보류", progress: 10, deadline: null, note: "스케치 방향만 유지" },
  { id: 5, parentId: null, name: "온라인 클래스 준비", status: "계획 중", progress: 0, deadline: "2026-06-21", note: "커리큘럼 줄기 잡기" },
  { id: 6, parentId: null, name: "독립 출판 프로젝트", status: "보류", progress: 0, deadline: null, note: "기획 메모만 보관" }
];

const defaultTasks = [
  { id: 1, name: "콘셉트 보드 작성", projectId: 7, progress: 45, note: "레퍼런스 6개 정도로만 압축하기." },
  { id: 2, name: "클라이언트 미팅 준비", projectId: 1, progress: 70, note: "" },
  { id: 3, name: "브랜드 리서치 자료 수집", projectId: 7, progress: 100, note: "" },
  { id: 4, name: "컬러 팔레트 초안 정리", projectId: 8, progress: 100, note: "" },
  { id: 5, name: "메인 비주얼 시안 2종 제작", projectId: 8, progress: 35, note: "" },
  { id: 6, name: "작업물 설명 보강", projectId: 2, progress: 20, note: "" },
  { id: 7, name: "타이포그래피 시스템 정리", projectId: 3, progress: 50, note: "" },
  { id: 8, name: "와이어프레임 업데이트", projectId: 3, progress: 25, note: "" },
  { id: 13, name: "디자인 사이트 보기", projectId: 3, progress: 0, advance: 0, contributionMode: "advance", note: "디자인 참고 사이트를 둘러보고 개인 웹사이트 방향에 반영할 것." },
  { id: 9, name: "시리즈 스케치", projectId: 4, progress: 10, note: "" },
  { id: 10, name: "커리큘럼 구성", projectId: 5, progress: 0, note: "" }
];

// 전역 데이터 및 UI 상태를 관리하는 단일 객체
export const state = {
  projects: [...defaultProjects],
  tasks: [...defaultTasks],
  projectLinks: [],
  archiveResources: [],
  archiveResourceLinks: [],
  completionWeights: {},
  appSettings: {
    theme: "light",
    alwaysOnTop: true,
    graphZoom: 1,
    graphCanvasScale: 1.25,
    graphNodeScale: 1.0,
    graphNodePositions: {},
    graphTaskPositions: {},
    graphMemoNodes: [],
    graphFormulaNodes: [],
    graphFormulaLinks: [],
    graphFormulaInputLinks: [],
    graphNodePortSettings: {},
    graphCustomPortLinks: [],
    graphOpenPortSettingsKey: null,
    graphScope: "all",
    graphShowTasks: true,
    graphShowExternal: true,
    archiveViewMode: "topic",
    archiveGraphDisplayMode: "graph3d",
    archiveGraphDepth: 2,
    archiveGraphLabelDensity: "focus",
    graphArchiveNodes: [],
    graphArchiveLinks: [],
    focusedTaskIds: [],
    history: [],
    activityLog: [],
    shortcuts: {
      toggleGraph: "g",
      openFocusWidget: "f",
      toggleSearch: "s",
      toggleTheme: "m"
    }
  },
  selectedProjectId: 1,
  selectedArchiveResourceId: null,
  archiveEditMode: false,
  projectFilter: "all",
  detailFilter: "all",
  viewMode: "detail",
  expandedProjectIds: new Set(),
  expandedRollupMetric: null,
  searchQuery: "",
  isSearchOpen: false,
  editingNoteTaskId: null,
  deletingProjectId: null,
  deletingTaskId: null,
  editingProjectDeadlineId: null,
  graphContextMenu: null,
  graphConnectionStartId: null,
  graphConnectionSourceType: null,
  graphConnectionMetric: null,
  graphConnectionSourcePort: null,
  graphConnectionTargetPort: null,
  graphConnectionDirection: null,
  graphOpenPortSectionKey: null,
  graphNotice: "",
  graphDrag: null,
  graphFreeNodeDrag: null,
  graphTaskDrag: null,
  graphPan: null,
  graphSelectionDrag: null,
  graphConnectionDrag: null,
  suppressGraphClick: false,
  suppressGraphContextMenu: false,
  selectedGraphProjectIds: new Set(),
  selectedGraphFreeNodeKeys: new Set()
};

export function createId(items) {
  const maxExistingId = Math.max(0, ...items.map((item) => Number(item.id) || 0));
  return Math.max(Date.now(), maxExistingId + 1);
}

function createSeedArchiveResourceId(resources, offset = 0) {
  return Math.max(Date.now() + offset, 1 + Math.max(0, ...resources.map((resource) => Number(resource.id) || 0)) + offset);
}

export function ensureDefaultArchiveSources() {
  const existingPaths = new Set((Array.isArray(state.archiveResources) ? state.archiveResources : [])
    .map((resource) => String(resource.path || "").toLowerCase())
    .filter(Boolean));
  let added = 0;
  let selectedId = null;

  DEFAULT_ARCHIVE_SOURCES.forEach((source) => {
    const resources = Array.isArray(source.resources) ? source.resources : [];
    resources.forEach((resource, index) => {
      const path = String(resource.path || "").trim();
      if (!path || existingPaths.has(path.toLowerCase())) return;
      const id = createSeedArchiveResourceId(state.archiveResources, added + index + 1);
      const nextResource = {
        id,
        name: resource.name || path,
        type: ["file", "folder", "link"].includes(resource.type) ? resource.type : "file",
        path,
        desc: resource.desc || "",
        tags: normalizeArchiveTags(resource.tags || source.classification || "reference-library"),
        createdAt: resource.createdAt || source.scannedAt || new Date().toISOString()
      };
      state.archiveResources.push(nextResource);
      existingPaths.add(path.toLowerCase());
      added += 1;
      if (!selectedId && path.toLowerCase() === String(source.sourceRoot || "").toLowerCase()) {
        selectedId = id;
      }
    });
  });

  if (selectedId && !state.selectedArchiveResourceId) {
    state.selectedArchiveResourceId = selectedId;
  }
  return added;
}

function normalizeDesignSiteTaskName(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function isDesignSiteTask(task) {
  const normalizedTarget = normalizeDesignSiteTaskName("디자인 사이트 보기");
  const normalizedName = normalizeDesignSiteTaskName(task?.name);
  return normalizedName === normalizedTarget
    || (normalizedName.includes("디자인") && normalizedName.includes("사이트") && normalizedName.includes("보기"));
}

function findDesignSiteTask(projectId) {
  const candidates = (Array.isArray(state.tasks) ? state.tasks : []).filter((task) => {
    return isDesignSiteTask(task);
  });
  return candidates.find((task) => Number(task.projectId) === Number(projectId))
    || candidates[0]
    || null;
}

function findDesignSiteLinkResources() {
  return (Array.isArray(state.archiveResources) ? state.archiveResources : []).filter((resource) => {
    const tags = Array.isArray(resource.tags) ? resource.tags : [];
    const desc = String(resource.desc || "");
    return resource.type === "link"
      && tags.includes("디자인 참고 사이트")
      && desc.includes("디자인 참고 사이트.html");
  });
}

export function ensureDesignSiteTaskLink(targetTaskId = null) {
  const taskName = "디자인 사이트 보기";
  const targetTask = targetTaskId !== null
    ? state.tasks.find((item) => Number(item.id) === Number(targetTaskId))
    : null;
  const fallbackProject = state.projects.find((item) => item.name === "개인 웹사이트")
    || state.projects.find((item) => Number(item.id) === 3);
  const project = targetTask
    ? (state.projects.find((item) => Number(item.id) === Number(targetTask.projectId)) || fallbackProject)
    : fallbackProject;
  if (!project) return 0;

  let changed = 0;
  let task = targetTask && isDesignSiteTask(targetTask)
    ? targetTask
    : findDesignSiteTask(project.id);
  if (!task) {
    task = {
      id: createId(state.tasks),
      name: taskName,
      projectId: Number(project.id),
      progress: 0,
      advance: 0,
      contributionMode: "advance",
      note: "디자인 참고 사이트를 둘러보고 개인 웹사이트 방향에 반영할 것."
    };
    state.tasks.push(task);
    changed += 1;
  }

  const designSiteResources = findDesignSiteLinkResources();
  if (!designSiteResources.length) return changed;

  let nextLinks = state.archiveResourceLinks;
  let addedLinks = 0;
  designSiteResources.forEach((resource) => {
    const hadLink = (Array.isArray(nextLinks) ? nextLinks : []).some((link) => (
      Number(link.resourceId) === Number(resource.id)
      && link.targetType === "task"
      && Number(link.targetId) === Number(task.id)
    ));
    nextLinks = addArchiveResourceLink(nextLinks, resource.id, "task", task.id);
    if (!hadLink) addedLinks += 1;
  });
  state.archiveResourceLinks = normalizeArchiveResourceLinks(
    nextLinks,
    state.projects,
    state.tasks,
    state.archiveResources
  );
  changed += state.archiveResourceLinks.filter((link) => (
    link.targetType === "task"
    && Number(link.targetId) === Number(task.id)
    && designSiteResources.some((resource) => Number(resource.id) === Number(link.resourceId))
  )).length ? addedLinks : 0;

  return changed;
}
function migrateLegacyProjectResources() {
  const migrated = migrateProjectResourcesToArchive(
    state.projects,
    state.archiveResources,
    state.archiveResourceLinks
  );
  state.projects = migrated.projects;
  state.archiveResources = migrated.archiveResources;
  state.archiveResourceLinks = normalizeArchiveResourceLinks(
    migrated.archiveResourceLinks,
    state.projects,
    state.tasks,
    state.archiveResources
  );
  return migrated.resourceMap;
}

export function applyAutomaticArchiveLinks() {
  hydrateArchiveSemanticEmbeddings(state);
  const result = buildAutomaticArchiveResourceLinks(
    state.projects,
    state.tasks,
    state.archiveResources,
    state.archiveResourceLinks
  );
  if (!result.added) return 0;
  state.archiveResourceLinks = normalizeArchiveResourceLinks(
    result.links,
    state.projects,
    state.tasks,
    state.archiveResources
  );
  return result.added;
}

export function normalizeProjects(nextProjects) {
  const knownIds = new Set(nextProjects.map((project) => Number(project.id)));
  const normalized = nextProjects.map((project) => {
    const parentId = project.parentId === undefined || project.parentId === null ? null : Number(project.parentId);
    return {
      id: Number(project.id),
      parentId: parentId && parentId !== Number(project.id) && knownIds.has(parentId) ? parentId : null,
      name: project.name || "이름 없는 프로젝트",
      status: project.status || "진행 중",
      progress: clampProgress(project.progress),
      advance: clampProgress(project.advance ?? project.progress),
      contributionMode: ["completion", "advance", "both"].includes(project.contributionMode) ? project.contributionMode : "both",
      deadline: project.deadline || null,
      note: project.note || "",
      resources: Array.isArray(project.resources) ? project.resources.map(res => ({
        id: Number(res.id),
        name: res.name || "이름 없는 리소스",
        type: ["file", "folder", "link"].includes(res.type) ? res.type : "file",
        path: res.path || "",
        desc: res.desc || ""
      })) : []
    };
  });
  normalized.forEach((project) => {
    const seen = new Set([project.id]);
    let current = project;
    while (current?.parentId) {
      if (seen.has(current.parentId)) {
        project.parentId = null;
        return;
      }
      seen.add(current.parentId);
      current = normalized.find((item) => item.id === current.parentId);
    }
  });
  return normalized;
}

export function normalizeTasks(nextTasks) {
  return nextTasks.map((task) => ({
    id: Number(task.id),
    name: task.name || "이름 없는 할 일",
    projectId: Number(task.projectId) || null,
    progress: clampProgress(task.progress ?? (task.status === "done" ? 100 : 0)),
    advance: clampProgress(task.advance ?? task.progress ?? (task.status === "done" ? 100 : 0)),
    contributionMode: ["completion", "advance", "both"].includes(task.contributionMode) ? task.contributionMode : "both",
    note: task.note || ""
  }));
}

export function normalizeGraphMemoNodes(nextNodes) {
  return (Array.isArray(nextNodes) ? nextNodes : []).map((node) => ({
    id: Number(node.id),
    title: node.title || "메모",
    body: node.body || "",
    x: Math.max(5, Math.min(1000, Number(node.x) || 50)),
    y: Math.max(7, Math.min(1000, Number(node.y) || 50))
  })).filter((node) => Number.isFinite(node.id));
}

export function normalizeGraphFormulaNodes(nextNodes) {
  return (Array.isArray(nextNodes) ? nextNodes : []).map((node) => ({
    id: Number(node.id),
    title: node.title || "수식",
    formulaType: ["fixed", "average", "weighted", "min", "max"].includes(node.formulaType) ? node.formulaType : "fixed",
    completion: clampProgress(node.completion ?? 50),
    advance: clampProgress(node.advance ?? node.completion ?? 50),
    x: Math.max(5, Math.min(1000, Number(node.x) || 56)),
    y: Math.max(7, Math.min(1000, Number(node.y) || 52))
  })).filter((node) => Number.isFinite(node.id));
}

export function normalizeGraphFormulaLinks(nextLinks, nextProjects = state.projects, nextFormulaNodes = state.appSettings.graphFormulaNodes) {
  const knownProjectIds = new Set(nextProjects.map((project) => Number(project.id)));
  const knownFormulaIds = new Set((Array.isArray(nextFormulaNodes) ? nextFormulaNodes : []).map((node) => Number(node.id)));
  return (Array.isArray(nextLinks) ? nextLinks : [])
    .map((link) => ({
      sourceId: Number(link.sourceId),
      targetId: Number(link.targetId),
      metric: ["completion", "advance", "both"].includes(link.metric) ? link.metric : "completion",
      weight: Math.max(5, Math.min(90, Number(link.weight) || 30))
    }))
    .filter((link) => {
      return knownFormulaIds.has(link.sourceId)
        && knownProjectIds.has(link.targetId);
    });
}

export function normalizeGraphFormulaInputLinks(nextLinks, nextProjects = state.projects, nextFormulaNodes = state.appSettings.graphFormulaNodes) {
  const knownProjectIds = new Set(nextProjects.map((project) => Number(project.id)));
  const knownFormulaIds = new Set((Array.isArray(nextFormulaNodes) ? nextFormulaNodes : []).map((node) => Number(node.id)));
  return (Array.isArray(nextLinks) ? nextLinks : [])
    .map((link) => ({
      sourceType: link.sourceType === "formula" ? "formula" : "project",
      sourceId: Number(link.sourceId),
      targetId: Number(link.targetId),
      metric: ["completion", "advance", "both"].includes(link.metric) ? link.metric : "completion",
      weight: Math.max(5, Math.min(90, Number(link.weight) || 30))
    }))
    .filter((link) => {
      const validSource = link.sourceType === "formula" ? knownFormulaIds.has(link.sourceId) : knownProjectIds.has(link.sourceId);
      return validSource && knownFormulaIds.has(link.targetId) && !(link.sourceType === "formula" && link.sourceId === link.targetId);
    });
}

function normalizeCustomPortId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function normalizeGraphNodePortSettings(nextSettings) {
  if (!nextSettings || typeof nextSettings !== "object") return {};
  return Object.fromEntries(Object.entries(nextSettings).map(([nodeKey, config]) => {
    const enabled = Array.isArray(config?.enabled)
      ? [...new Set(config.enabled.map((key) => normalizeCustomPortId(key)).filter(Boolean))]
      : [];
    const custom = Array.isArray(config?.custom)
      ? config.custom.map((port) => {
        const label = String(port?.label || "").trim().slice(0, 32);
        const id = normalizeCustomPortId(port?.id || label);
        return id && label ? { id, label } : null;
      }).filter(Boolean)
      : [];
    return [String(nodeKey), { enabled, custom }];
  }));
}

export function normalizeGraphCustomPortLinks(
  nextLinks,
  nextProjects = state.projects,
  nextFormulaNodes = state.appSettings.graphFormulaNodes,
  nextArchiveNodes = state.appSettings.graphArchiveNodes
) {
  const knownIds = {
    project: new Set(nextProjects.map((project) => Number(project.id))),
    formula: new Set((Array.isArray(nextFormulaNodes) ? nextFormulaNodes : []).map((node) => Number(node.id))),
    archive: new Set((Array.isArray(nextArchiveNodes) ? nextArchiveNodes : []).map((node) => Number(node.id)))
  };
  return (Array.isArray(nextLinks) ? nextLinks : [])
    .map((link) => {
      const sourceType = ["project", "formula", "archive"].includes(link.sourceType) ? link.sourceType : "project";
      const targetType = ["project", "formula", "archive"].includes(link.targetType) ? link.targetType : "project";
      const sourceId = Number(link.sourceId);
      const targetId = Number(link.targetId);
      const sourcePort = normalizeCustomPortId(link.sourcePort || link.metric || "custom");
      const targetPort = normalizeCustomPortId(link.targetPort || link.metric || "custom");
      return {
        id: link.id || `custom:${sourceType}:${sourceId}:${sourcePort}:${targetType}:${targetId}:${targetPort}`,
        sourceType,
        sourceId,
        sourcePort,
        targetType,
        targetId,
        targetPort,
        weight: Math.max(5, Math.min(90, Number(link.weight) || 30))
      };
    })
    .filter((link) => {
      const validSource = knownIds[link.sourceType]?.has(link.sourceId);
      const validTarget = knownIds[link.targetType]?.has(link.targetId);
      const sameNode = link.sourceType === link.targetType && link.sourceId === link.targetId;
      return validSource && validTarget && !sameNode && link.sourcePort && link.targetPort;
    });
}

export function normalizeProjectLinks(nextLinks, nextProjects = state.projects) {
  const knownIds = new Set(nextProjects.map((project) => Number(project.id)));
  return (Array.isArray(nextLinks) ? nextLinks : [])
    .map((link) => ({
      sourceId: Number(link.sourceId),
      targetId: Number(link.targetId),
      metric: ["completion", "advance", "both"].includes(link.metric) ? link.metric : "completion",
      weight: Math.max(5, Math.min(90, Number(link.weight) || 30))
    }))
    .filter((link) => {
      return link.sourceId !== link.targetId
        && knownIds.has(link.sourceId)
        && knownIds.has(link.targetId);
    });
}

export function normalizeGraphArchiveNodes(nextNodes) {
  return (Array.isArray(nextNodes) ? nextNodes : []).map((node) => ({
    id: Number(node.id),
    resourceId: node.resourceId ? Number(node.resourceId) : null,
    title: node.title || "새 리소스",
    type: ["file", "folder", "link"].includes(node.type) ? node.type : "file",
    path: node.path || "",
    x: Math.max(5, Math.min(1000, Number(node.x) || 50)),
    y: Math.max(7, Math.min(1000, Number(node.y) || 50))
  })).filter((node) => Number.isFinite(node.id));
}

export function normalizeGraphArchiveLinks(nextLinks, nextProjects = state.projects, nextTasks = state.tasks, nextArchiveNodes = state.appSettings.graphArchiveNodes) {
  const knownArchiveIds = new Set((Array.isArray(nextArchiveNodes) ? nextArchiveNodes : []).map((node) => Number(node.id)));
  const knownProjectIds = new Set(nextProjects.map((project) => Number(project.id)));
  const knownTaskIds = new Set(nextTasks.map((task) => Number(task.id)));
  
  return (Array.isArray(nextLinks) ? nextLinks : [])
    .map((link) => ({
      id: link.id || `archive:${link.sourceId}:${link.targetType}:${link.targetId}`,
      sourceId: Number(link.sourceId),
      targetType: link.targetType === "task" ? "task" : "project",
      targetId: Number(link.targetId)
    }))
    .filter((link) => {
      const validSource = knownArchiveIds.has(link.sourceId);
      const validTarget = link.targetType === "task" ? knownTaskIds.has(link.targetId) : knownProjectIds.has(link.targetId);
      return validSource && validTarget;
    });
}

export function readSavedState() {
  const primaryState = localStorage.getItem(STORAGE_KEY);
  if (!primaryState) return null;
  try {
    return JSON.parse(primaryState);
  } catch {
    const backupState = localStorage.getItem(BACKUP_STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    if (!backupState) return null;
    try {
      return JSON.parse(backupState);
    } catch {
      localStorage.removeItem(BACKUP_STORAGE_KEY);
      return null;
    }
  }
}

function injectDemoData() {
  const demoProjects = [
    { 
      id: 9, 
      parentId: null, 
      name: "⚠️ 병목 진단 테스트", 
      status: "진행 중", 
      progress: 52, 
      deadline: "2026-06-15", 
      note: "병목 연동 및 추천 해결 액션을 테스트하는 데모 프로젝트입니다.",
      resources: [
        { id: 1, name: "📁 로컬 탐색기 테스트(윈도우 C드라이브)", type: "folder", path: "C:\\" },
        { id: 2, name: "🔗 작업실 GitHub 저장소", type: "link", path: "https://github.com" }
      ]
    },
    { id: 10, parentId: 9, name: "지연 유발 하위 프로젝트", status: "진행 중", progress: 15, deadline: "2026-06-12", note: "이 프로젝트의 완성도가 낮아 상위 프로젝트의 완성도를 갉아먹습니다." },
    { id: 11, parentId: 9, name: "정상 진행 하위 프로젝트", status: "진행 중", progress: 95, deadline: "2026-06-14", note: "정상적으로 완성도를 달성하고 있는 프로젝트입니다." }
  ];
  
  const demoTasks = [
    { id: 11, name: "병목 지연 해소 태스크 1", projectId: 10, progress: 15, advance: 15, contributionMode: "both", note: "이 할 일의 완성도를 쪼개서 추가하거나 집중해보세요." },
    { id: 12, name: "정상 완료 태스크", projectId: 11, progress: 95, advance: 95, contributionMode: "both", note: "순조롭게 진행 중" }
  ];
  
  demoProjects.forEach(dp => {
    if (!state.projects.some(p => p.id === dp.id)) {
      state.projects.push(dp);
    }
  });
  
  demoTasks.forEach(dt => {
    if (!state.tasks.some(t => t.id === dt.id)) {
      state.tasks.push(dt);
    }
  });
  
  const demoLink = { sourceId: 2, targetId: 9, metric: "completion", weight: 50 };
  if (!state.projectLinks.some(l => l.sourceId === demoLink.sourceId && l.targetId === demoLink.targetId && l.metric === demoLink.metric)) {
    state.projectLinks.push(demoLink);
  }

  // 데모 아카이브 노드 및 링크 삽입
  if (!state.appSettings.graphArchiveNodes) state.appSettings.graphArchiveNodes = [];
  if (!state.appSettings.graphArchiveLinks) state.appSettings.graphArchiveLinks = [];
  
  const demoArchiveNodeId = 901;
  if (!state.appSettings.graphArchiveNodes.some(n => n.id === demoArchiveNodeId)) {
    state.appSettings.graphArchiveNodes.push({
      id: demoArchiveNodeId,
      title: "🔗 병목 진단 가이드라인 문서",
      type: "link",
      path: "https://github.com",
      x: 65,
      y: 45
    });
  }
  
  const demoArchiveLinkId = `archive:${demoArchiveNodeId}:task:11`;
  if (!state.appSettings.graphArchiveLinks.some(l => l.id === demoArchiveLinkId)) {
    state.appSettings.graphArchiveLinks.push({
      id: demoArchiveLinkId,
      sourceId: demoArchiveNodeId,
      targetType: "task",
      targetId: 11
    });
  }
}

export function loadState() {
  try {
    const saved = readSavedState();
    if (!saved) {
      injectDemoData();
      migrateLegacyProjectResources();
      ensureDefaultArchiveSources();
      ensureDesignSiteTaskLink();
      applyAutomaticArchiveLinks();
      saveState();
      return;
    }
    applyLoadedState(saved);
    const addedDefaultArchiveSources = ensureDefaultArchiveSources();
    const ensuredDesignSiteTaskLink = ensureDesignSiteTaskLink();
    const addedAutomaticArchiveLinks = applyAutomaticArchiveLinks();
    if (addedDefaultArchiveSources || ensuredDesignSiteTaskLink || addedAutomaticArchiveLinks) saveState();
    
    if (!state.projects.some(p => p.id === 9)) {
      injectDemoData();
      ensureDesignSiteTaskLink();
      applyAutomaticArchiveLinks();
      saveState();
    }
  } catch (error) {
    console.error("작업실 상태 로드 중 오류:", error);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getSerializableState() {
  const withoutTransientEmbedding = (item) => {
    const {
      semanticEmbedding,
      semanticEmbeddingHash,
      semanticEmbeddingModel,
      ...serializable
    } = item || {};
    return serializable;
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: state.projects.map(withoutTransientEmbedding),
    tasks: state.tasks.map(withoutTransientEmbedding),
    projectLinks: state.projectLinks,
    archiveResources: state.archiveResources.map(withoutTransientEmbedding),
    archiveResourceLinks: state.archiveResourceLinks,
    completionWeights: state.completionWeights,
    appSettings: state.appSettings,
    selectedProjectId: state.selectedProjectId,
    selectedArchiveResourceId: state.selectedArchiveResourceId,
    archiveEditMode: state.archiveEditMode,
    projectFilter: state.projectFilter,
    detailFilter: state.detailFilter,
    viewMode: state.viewMode,
    expandedProjectIds: [...state.expandedProjectIds]
  };
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function recordWorkspaceHistory() {
  const key = todayKey();
  const topProjects = state.projects.filter((project) => !project.parentId);
  const snapshotProjects = topProjects.map((project) => ({
    id: project.id,
    name: project.name,
    completion: getRollupProgress(project.id),
    advance: getRollupAdvance(project.id)
  }));
  const totalCompletion = snapshotProjects.length
    ? Math.round(snapshotProjects.reduce((sum, project) => sum + project.completion, 0) / snapshotProjects.length)
    : 0;
  const totalAdvance = snapshotProjects.length
    ? Math.round(snapshotProjects.reduce((sum, project) => sum + project.advance, 0) / snapshotProjects.length)
    : 0;
  const nextEntry = {
    date: key,
    completion: totalCompletion,
    advance: totalAdvance,
    projects: snapshotProjects
  };
  const history = Array.isArray(state.appSettings.history) ? state.appSettings.history.filter((entry) => entry.date !== key) : [];
  state.appSettings.history = [...history, nextEntry].slice(-45);
}

export function logActivity(type, label, projectId = state.selectedProjectId) {
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    type,
    label,
    projectId: Number(projectId) || null
  };
  state.appSettings.activityLog = [entry, ...(Array.isArray(state.appSettings.activityLog) ? state.appSettings.activityLog : [])].slice(0, 80);
}

export function applyLoadedState(saved) {
  if (!saved || !Array.isArray(saved.projects) || !Array.isArray(saved.tasks)) {
    throw new Error("Invalid workshop data");
  }
  state.projects = normalizeProjects(saved.projects);
  state.tasks = normalizeTasks(saved.tasks).filter((task) => !task.projectId || getProject(task.projectId));
  state.projectLinks = normalizeProjectLinks(saved.projectLinks, state.projects);
  state.archiveResources = normalizeArchiveResources(saved.archiveResources || []);
  state.archiveResourceLinks = normalizeArchiveResourceLinks(
    saved.archiveResourceLinks || [],
    state.projects,
    state.tasks,
    state.archiveResources
  );
  const migratedArchiveResourceMap = migrateLegacyProjectResources();
  state.completionWeights = saved.completionWeights && typeof saved.completionWeights === "object" ? saved.completionWeights : {};
  state.appSettings = { ...state.appSettings, ...(saved.appSettings || {}) };
  state.appSettings.shortcuts = {
    toggleGraph: "g",
    openFocusWidget: "f",
    toggleSearch: "s",
    toggleTheme: "m",
    ...(state.appSettings.shortcuts || {})
  };
  state.appSettings.theme = state.appSettings.theme === "dark" ? "dark" : "light";
  state.appSettings.alwaysOnTop = state.appSettings.alwaysOnTop !== false;
  state.appSettings.graphZoom = clampGraphZoom(state.appSettings.graphZoom);
  state.appSettings.graphCanvasScale = clampGraphCanvasScale(state.appSettings.graphCanvasScale);
  state.appSettings.graphNodeScale = clampGraphNodeScale(state.appSettings.graphNodeScale);
  state.appSettings.graphNodePositions = state.appSettings.graphNodePositions && typeof state.appSettings.graphNodePositions === "object" ? state.appSettings.graphNodePositions : {};
  state.appSettings.graphTaskPositions = state.appSettings.graphTaskPositions && typeof state.appSettings.graphTaskPositions === "object" ? state.appSettings.graphTaskPositions : {};
  state.appSettings.graphMemoNodes = normalizeGraphMemoNodes(state.appSettings.graphMemoNodes);
  state.appSettings.graphFormulaNodes = normalizeGraphFormulaNodes(state.appSettings.graphFormulaNodes);
  state.appSettings.graphFormulaLinks = normalizeGraphFormulaLinks(
    state.appSettings.graphFormulaLinks,
    state.projects,
    state.appSettings.graphFormulaNodes
  );
  state.appSettings.graphFormulaInputLinks = normalizeGraphFormulaInputLinks(
    state.appSettings.graphFormulaInputLinks,
    state.projects,
    state.appSettings.graphFormulaNodes
  );
  const graphArchiveNodes = (saved.appSettings?.graphArchiveNodes || []).map((node) => {
    const resourceId = Number(node.resourceId);
    if (!resourceId || state.archiveResources.some((resource) => resource.id === resourceId)) return node;
    const migratedId = migratedArchiveResourceMap.get(`legacy:${resourceId}`);
    return migratedId ? { ...node, resourceId: migratedId } : node;
  });
  state.appSettings.graphArchiveNodes = normalizeGraphArchiveNodes(graphArchiveNodes);
  state.appSettings.graphArchiveLinks = normalizeGraphArchiveLinks(
    saved.appSettings?.graphArchiveLinks || [],
    state.projects,
    state.tasks,
    state.appSettings.graphArchiveNodes
  );
  state.appSettings.graphNodePortSettings = normalizeGraphNodePortSettings(state.appSettings.graphNodePortSettings);
  state.appSettings.graphOpenPortSettingsKey = typeof state.appSettings.graphOpenPortSettingsKey === "string"
    ? state.appSettings.graphOpenPortSettingsKey
    : null;
  state.appSettings.graphCustomPortLinks = normalizeGraphCustomPortLinks(
    state.appSettings.graphCustomPortLinks,
    state.projects,
    state.appSettings.graphFormulaNodes,
    state.appSettings.graphArchiveNodes
  );
  state.appSettings.graphScope = state.appSettings.graphScope === "local" ? "local" : "all";
  state.appSettings.graphShowTasks = state.appSettings.graphShowTasks !== false;
  state.appSettings.graphShowExternal = state.appSettings.graphShowExternal !== false;
  state.appSettings.archiveViewMode = ["topic", "type", "all", "graph"].includes(state.appSettings.archiveViewMode)
    ? state.appSettings.archiveViewMode
    : "topic";
  state.appSettings.archiveGraphDisplayMode = ["graph3d", "graph2d"].includes(state.appSettings.archiveGraphDisplayMode)
    ? state.appSettings.archiveGraphDisplayMode
    : "graph3d";
  state.appSettings.archiveGraphDepth = [1, 2, 3, 4].includes(Number(state.appSettings.archiveGraphDepth))
    ? Number(state.appSettings.archiveGraphDepth)
    : 2;
  state.appSettings.archiveGraphLabelDensity = ["focus", "all", "none"].includes(state.appSettings.archiveGraphLabelDensity)
    ? state.appSettings.archiveGraphLabelDensity
    : "focus";
  hydrateArchiveSemanticEmbeddings(state);
  state.appSettings.focusedTaskIds = Array.isArray(state.appSettings.focusedTaskIds)
    ? state.appSettings.focusedTaskIds.map(Number).filter((id) => state.tasks.some((task) => task.id === id))
    : [];
  state.appSettings.history = Array.isArray(state.appSettings.history) ? state.appSettings.history : [];
  state.appSettings.activityLog = Array.isArray(state.appSettings.activityLog) ? state.appSettings.activityLog : [];
  state.selectedProjectId = saved.selectedProjectId || state.selectedProjectId;
  state.selectedArchiveResourceId = saved.selectedArchiveResourceId !== undefined ? saved.selectedArchiveResourceId : null;
  state.archiveEditMode = saved.archiveEditMode !== undefined ? saved.archiveEditMode : false;
  state.projectFilter = saved.projectFilter || state.projectFilter;
  state.detailFilter = saved.detailFilter || state.detailFilter;
  state.viewMode = saved.viewMode || state.viewMode;
  state.expandedProjectIds = new Set(Array.isArray(saved.expandedProjectIds) ? saved.expandedProjectIds.map(Number) : []);
  if (!getProject(state.selectedProjectId)) state.selectedProjectId = state.projects[0]?.id || null;
}

export function saveState() {
  try {
    recordWorkspaceHistory();

    // 집중 위젯에서 상태 불일치 없이 정확히 사용할 수 있도록 전체 활성 병목 목록 캐시 생성
    const cache = [];
    const seen = new Set();
    state.projects.forEach((p) => {
      const recommendations = getBottleneckRecommendations(p.id);
      recommendations.forEach((item) => {
        const key = `${item.sourceType}:${item.sourceId}`;
        if (seen.has(key)) return;
        seen.add(key);
        cache.push({
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          level: item.level,
          drag: item.drag,
          metric: item.metric
        });
      });
    });
    state.appSettings.bottleneckCache = cache;

    if (typeof localStorage === "undefined") return;
    const previousState = localStorage.getItem(STORAGE_KEY);
    if (previousState) localStorage.setItem(BACKUP_STORAGE_KEY, previousState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getSerializableState()));
  } catch (error) {
    console.warn("작업실 상태를 저장하지 못했습니다.", error);
  }
}
