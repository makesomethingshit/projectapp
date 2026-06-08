import { state } from "./state.js";
import {
  clampProgress,
  getProjectDisplayProgress,
  getProjectDisplayAdvance,
  getProject,
  getChildProjects,
  getProjectDepth,
  getScopedProjectIds,
  getProjectTasks,
  getCompletionItemKey,
  getCompletionWeight,
  getCompletionContributors,
  getIncomingLinks,
  getOutgoingLinks,
  clampGraphZoom,
  clampGraphCanvasScale,
  clampGraphNodeScale,
  getFormulaValue,
  getFormulaInputLinks,
  getFormulaNode,
  getExternalLinkDrag,
  getInternalContributorDrag,
  getBottleneckDetails
} from "./calculator.js";
import { escapeHtml, daysUntil, formatDueLabel } from "./ui-components.js";

// ==============================================================
// FUNCTION INDEX (graph-components.js)
// --------------------------------------------------------------
// L25    buildGraphData
// L225   graphEdgePath
// L230   getExternalLinkMidpoint
// L238   graphEdgeControlPosition
// L252   graphEdgeDataAttrs
// L264   getNestedProjectsForGraph
// L272   isGraphPortActive
// L296   graphPortStateClass
// L300   graphPortDataAttrs
// L310   graphProjectCardMarkup
// L384   graphMinimapMarkup
// L401   graphContextMenuMarkup
// L416   graphFormulaControlsMarkup
// L519   renderGraphView
// ==============================================================

export function buildGraphData(selectedProject, options = {}) {
  const includeTasks = options.includeTasks !== false && state.appSettings.graphShowTasks !== false;
  const selectedScope = new Set(getScopedProjectIds(selectedProject.id));
  const graphScope = options.full ? state.appSettings.graphScope || "all" : "local";
  const scopedProjects = graphScope === "local"
    ? state.projects.filter((project) => selectedScope.has(project.id))
    : state.projects;
  const visibleProjects = options.full
    ? scopedProjects.filter((project) => {
      if (!project.parentId) return true;
      return !scopedProjects.some((candidate) => candidate.id === project.parentId);
    })
    : scopedProjects;
  const visibleProjectIds = new Set(visibleProjects.map((project) => project.id));
  const projectNodes = visibleProjects.map((project) => {
    let depth = 0;
    if (!options.full && project.id !== selectedProject.id) {
      let current = project;
      const seen = new Set();
      while (current && current.id !== selectedProject.id && current.parentId && !seen.has(current.parentId) && depth < 8) {
        seen.add(current.parentId);
        current = getProject(current.parentId);
        depth += 1;
      }
    } else {
      depth = getProjectDepth(project);
    }
    const details = getBottleneckDetails(project.id);
    const hasCritical = details.some((d) => d.level === "critical");
    const hasWarning = details.some((d) => d.level === "warning");
    const bottleneckClass = hasCritical ? " bottleneck-critical" : hasWarning ? " bottleneck-warning" : "";
    const warningSymbol = hasCritical || hasWarning ? "⚠️ " : "";

    return {
      id: `project-${project.id}`,
      sourceId: project.id,
      type: "project",
      depth,
      label: warningSymbol + project.name,
      sublabel: project.deadline ? formatDueLabel(project.deadline) : "마감 없음",
      progress: getProjectDisplayProgress(project.id),
      advance: getProjectDisplayAdvance(project.id),
      hasChildren: getChildProjects(project.id).length > 0,
      selected: project.id === selectedProject.id,
      multiSelected: state.selectedGraphProjectIds.has(project.id),
      scoped: selectedScope.has(project.id),
      urgent: project.deadline && daysUntil(project.deadline) <= 3,
      bottleneckClass
    };
  });

  const maxDepth = Math.max(1, ...projectNodes.map((node) => node.depth));
  const projectGroups = new Map();
  projectNodes.forEach((node) => {
    if (!projectGroups.has(node.depth)) projectGroups.set(node.depth, []);
    projectGroups.get(node.depth).push(node);
  });

  // DFS 순서를 기반으로 depth 그룹별 노드를 정렬하여 연결선 엇갈림 방지
  const dfsOrder = [];
  const visited = new Set();
  const traverse = (projectId) => {
    if (visited.has(projectId)) return;
    visited.add(projectId);
    dfsOrder.push(projectId);
    const children = state.projects.filter((p) => p.parentId === projectId);
    children.sort((a, b) => a.id - b.id);
    children.forEach((child) => traverse(child.id));
  };
  const rootProjects = state.projects.filter((p) => !p.parentId);
  rootProjects.sort((a, b) => a.id - b.id);
  rootProjects.forEach((root) => traverse(root.id));
  state.projects.forEach((p) => traverse(p.id));

  projectGroups.forEach((group) => {
    group.sort((a, b) => {
      const idxA = dfsOrder.indexOf(a.sourceId);
      const idxB = dfsOrder.indexOf(b.sourceId);
      return idxA - idxB;
    });
  });

  projectNodes.forEach((node) => {
    const group = projectGroups.get(node.depth);
    const index = group.indexOf(node);
    const xRatio = options.full ? (node.depth / maxDepth) : ((maxDepth - node.depth) / maxDepth);
    node.x = (options.full ? 22 : 16) + xRatio * (options.full ? 48 : 34);
    node.y = 12 + ((index + 1) / (group.length + 1)) * 76;
    const savedPosition = options.full ? state.appSettings.graphNodePositions?.[node.sourceId] : null;
    if (savedPosition) {
      node.x = Math.max(5, Math.min(1000, Number(savedPosition.x) || node.x));
      node.y = Math.max(7, Math.min(1000, Number(savedPosition.y) || node.y));
    }
  });

  const taskGroups = new Map();
  const groupTasksInProjects = options.full === true;
  const taskLimit = options.full ? 60 : 200;
  const visibleTasks = includeTasks && !groupTasksInProjects ? state.tasks
    .filter((task) => {
      const tProjId = Number(task.projectId);
      return visibleProjectIds.has(tProjId) && (options.full || selectedScope.has(tProjId));
    })
    .sort((a, b) => clampProgress(a.progress) - clampProgress(b.progress))
    .slice(0, taskLimit)
    .map((task) => {
      const parentNode = projectNodes.find((node) => node.sourceId === Number(task.projectId));
      const groupIndex = taskGroups.get(task.projectId) || 0;
      taskGroups.set(task.projectId, groupIndex + 1);
      const side = groupIndex % 2 === 0 ? 1 : -1;
      const row = Math.floor(groupIndex / 2);
      return {
        id: `task-${task.id}`,
        sourceId: task.id,
        projectId: task.projectId,
        type: "task",
        label: task.name,
        sublabel: `${clampProgress(task.progress)}% 완성`,
        progress: clampProgress(task.progress),
        urgent: false,
        x: parentNode ? Math.max(5, Math.min(95, parentNode.x + (options.full ? 12 : -14))) : 72,
        y: parentNode ? Math.max(7, Math.min(93, parentNode.y + side * (8 + row * 8))) : 18 + groupIndex * 8
      };
    }) : [];
  const freeTasks = includeTasks ? state.tasks
    .filter((task) => !task.projectId)
    .sort((a, b) => clampProgress(a.progress) - clampProgress(b.progress))
    .map((task, index) => {
      const savedPosition = state.appSettings.graphTaskPositions?.[task.id];
      return {
        id: `task-${task.id}`,
        sourceId: task.id,
        projectId: null,
        type: "task",
        label: task.name,
        sublabel: `${clampProgress(task.progress)}% 완성 · 독립`,
        progress: clampProgress(task.progress),
        urgent: false,
        x: savedPosition ? Math.max(5, Math.min(1000, Number(savedPosition.x) || 74)) : 74 + (index % 3) * 7,
        y: savedPosition ? Math.max(7, Math.min(1000, Number(savedPosition.y) || 18)) : 18 + Math.floor(index / 3) * 10
      };
    }) : [];
  const memoNodes = (state.appSettings.graphMemoNodes || []).map((node, index) => ({
    id: `memo-${node.id}`,
    sourceId: node.id,
    type: "memo",
    multiSelected: state.selectedGraphFreeNodeKeys?.has?.(`memo:${node.id}`),
    label: node.title,
    sublabel: node.body || "메모 없음",
    body: node.body || "",
    x: Math.max(5, Math.min(1000, Number(node.x) || 82)),
    y: Math.max(7, Math.min(1000, Number(node.y) || (15 + index * 12)))
  }));
  const formulaNodes = (state.appSettings.graphFormulaNodes || []).map((node, index) => {
    let sublabel = "고정값";
    if (node.formulaType === "average") sublabel = "단순 평균";
    else if (node.formulaType === "min") sublabel = "최소값";
    else if (node.formulaType === "max") sublabel = "최대값";
    else if (node.formulaType === "weighted") sublabel = "가중 평균";

    return {
      id: `formula-${node.id}`,
      sourceId: node.id,
      type: "formula",
      multiSelected: state.selectedGraphFreeNodeKeys?.has?.(`formula:${node.id}`),
      label: node.title,
      sublabel,
      formulaType: node.formulaType || "fixed",
      progress: getFormulaValue(node.id, "completion"),
      advance: getFormulaValue(node.id, "advance"),
      x: Math.max(5, Math.min(1000, Number(node.x) || 72)),
      y: Math.max(7, Math.min(1000, Number(node.y) || (15 + index * 12)))
    };
  });

  const archiveNodes = (state.appSettings.graphArchiveNodes || []).map((node, index) => {
    let mappedRes = null;
    if (node.resourceId) {
      mappedRes = (state.archiveResources || []).find((resource) => resource.id === node.resourceId);
    }

    return {
      id: `archive-${node.id}`,
      sourceId: node.id,
      type: "archive",
      multiSelected: state.selectedGraphFreeNodeKeys?.has?.(`archive:${node.id}`),
      label: mappedRes ? mappedRes.name : node.title || "[연결할 리소스 선택]",
      sublabel: mappedRes ? mappedRes.path : node.path || "",
      archiveType: mappedRes ? mappedRes.type : node.type || "file",
      resourceId: node.resourceId || null,
      x: Math.max(5, Math.min(1000, Number(node.x) || 92)),
      y: Math.max(7, Math.min(1000, Number(node.y) || (15 + index * 12)))
    };
  });

  const nodes = [...projectNodes, ...visibleTasks, ...freeTasks, ...memoNodes, ...formulaNodes, ...archiveNodes];
  const getGraphNodeId = (type, id) => {
    if (type === "formula") return `formula-${id}`;
    if (type === "archive") return `archive-${id}`;
    return `project-${id}`;
  };
  const getVisibleAncestorId = (projectId) => {
    let currentId = Number(projectId);
    const seen = new Set();
    while (currentId && !seen.has(currentId)) {
      if (visibleProjectIds.has(currentId)) return currentId;
      seen.add(currentId);
      const proj = state.projects.find((p) => p.id === currentId);
      currentId = proj && proj.parentId ? Number(proj.parentId) : null;
    }
    return null;
  };

  const archiveEdges = (state.appSettings.graphArchiveLinks || []).map((link) => {
    const source = archiveNodes.find((node) => node.sourceId === link.sourceId);
    let to = "";
    if (link.targetType === "project") {
      const targetAncestorId = getVisibleAncestorId(link.targetId);
      to = targetAncestorId ? `project-${targetAncestorId}` : null;
    } else {
      to = `task-${link.targetId}`;
    }
    if (!source || !to) return null;
    
    return {
      id: link.id || `archiveLink:${link.sourceId}:${link.targetType}:${link.targetId}`,
      sourceId: link.sourceId,
      sourceType: "archive",
      targetId: link.targetId,
      targetType: link.targetType,
      from: `archive-${link.sourceId}`,
      to,
      type: "external",
      metric: "archive",
      linkKind: "archiveLink",
      external: true,
      removable: true
    };
  }).filter(Boolean);

  const customPortEdges = (state.appSettings.graphCustomPortLinks || []).map((link) => {
    const sourceNodeId = link.sourceType === "project"
      ? getVisibleAncestorId(link.sourceId)
      : link.sourceId;
    const targetNodeId = link.targetType === "project"
      ? getVisibleAncestorId(link.targetId)
      : link.targetId;
    const from = sourceNodeId ? getGraphNodeId(link.sourceType, sourceNodeId) : null;
    const to = targetNodeId ? getGraphNodeId(link.targetType, targetNodeId) : null;
    if (!from || !to || from === to) return null;
    return {
      id: link.id,
      sourceId: link.sourceId,
      sourceType: link.sourceType,
      sourcePort: link.sourcePort,
      targetId: link.targetId,
      targetType: link.targetType,
      targetPort: link.targetPort,
      from,
      to,
      type: "external",
      metric: link.targetPort || "custom",
      linkKind: "custom",
      external: true,
      removable: true
    };
  }).filter(Boolean);

  const edges = [
    ...(options.full ? [] : state.projects.filter((project) => project.parentId && visibleProjectIds.has(Number(project.parentId)) && visibleProjectIds.has(Number(project.id))).map((project) => {
      const parentId = Number(project.parentId);
      const childId = Number(project.id);
      const parentContributors = getCompletionContributors(parentId);
      const parentFallback = parentContributors.length ? Math.round(100 / parentContributors.length) : 0;
      const parentKey = getCompletionItemKey("project", childId);
      const weight = getCompletionWeight(parentId, parentKey, parentFallback);
      return {
        id: `hierarchy:${parentId}:${childId}`,
        sourceId: childId,
        targetId: parentId,
        from: `project-${childId}`,
        to: `project-${parentId}`,
        type: "external",
        linkKind: "hierarchy",
        metric: "completion",
        weight,
        external: true,
        removable: false
      };
    })),
    ...visibleTasks.map((task) => ({ id: `task:${Number(task.projectId)}:${task.id}`, sourceId: Number(task.projectId), targetId: task.id, from: `project-${Number(task.projectId)}`, to: task.id, type: "task", external: false, removable: false })),
    ...(state.appSettings.graphShowExternal === false ? [] : state.projectLinks.map((link) => {
      const sourceAncestorId = getVisibleAncestorId(link.sourceId);
      const targetAncestorId = getVisibleAncestorId(link.targetId);
      if (!sourceAncestorId || !targetAncestorId || sourceAncestorId === targetAncestorId) return null;
      return {
        id: `external:${link.sourceId}:${link.targetId}:${link.metric}`,
        sourceId: link.sourceId,
        sourceType: "project",
        targetId: link.targetId,
        metric: link.metric,
        from: `project-${sourceAncestorId}`,
        to: `project-${targetAncestorId}`,
        type: "external",
        external: true,
        removable: true
      };
    }).filter(Boolean)),
    ...(state.appSettings.graphShowExternal === false ? [] : (state.appSettings.graphFormulaLinks || []).map((link) => {
      const source = formulaNodes.find((node) => node.sourceId === link.sourceId);
      const targetAncestorId = getVisibleAncestorId(link.targetId);
      if (!source || !targetAncestorId) return null;
      return {
        id: `formula:${link.sourceId}:${link.targetId}:${link.metric}`,
        sourceId: link.sourceId,
        targetId: link.targetId,
        metric: link.metric,
        from: `formula-${link.sourceId}`,
        to: `project-${targetAncestorId}`,
        type: "external",
        sourceType: "formula",
        external: true,
        removable: true
      };
    }).filter(Boolean)),
    ...(state.appSettings.graphShowExternal === false ? [] : (state.appSettings.graphFormulaInputLinks || []).map((link) => {
      const target = formulaNodes.find((node) => node.sourceId === link.targetId);
      const sourceFormula = link.sourceType === "formula" ? formulaNodes.find((node) => node.sourceId === link.sourceId) : null;
      const sourceProjectId = link.sourceType === "project" ? getVisibleAncestorId(link.sourceId) : null;
      const from = link.sourceType === "formula" ? sourceFormula?.id : sourceProjectId ? `project-${sourceProjectId}` : null;
      if (!target || !from || from === target.id) return null;

      return {
        id: `formulaIn:${link.sourceType}:${link.sourceId}:${link.targetId}:${link.metric}`,
        sourceId: link.sourceId,
        sourceType: link.sourceType,
        targetId: link.targetId,
        metric: link.metric,
        from,
        to: target.id,
        type: "external",
        linkKind: "formulaIn",
        external: true,
        removable: true
      };
    }).filter(Boolean)),
    ...(state.appSettings.graphShowExternal === false ? [] : customPortEdges),
    ...archiveEdges
  ];

  if (options.full) {
    const visibleNestedProjectIds = new Set(scopedProjects.map((project) => project.id));
    const nestedPortY = new Map();
    projectNodes.forEach((node) => {
      const flattened = [];
      const collect = (items) => {
        items.forEach((item) => {
          flattened.push(item.project.id);
          collect(item.children || []);
        });
      };
      collect(getNestedProjectsForGraph(node.sourceId, visibleNestedProjectIds));
      if (!flattened.length) return;
      const rowStep = 1.28;
      const centerIndex = (flattened.length - 1) / 2;
      flattened.forEach((projectId, index) => {
        nestedPortY.set(`${node.sourceId}:${projectId}`, node.y + (index - centerIndex) * rowStep);
      });
    });

    edges.forEach((edge) => {
      const sourceAncestorId = edge.from?.startsWith?.("project-") ? Number(edge.from.slice("project-".length)) : null;
      const targetAncestorId = edge.to?.startsWith?.("project-") ? Number(edge.to.slice("project-".length)) : null;
      if (sourceAncestorId && Number(edge.sourceId) !== sourceAncestorId) {
        const sourceBaseY = nestedPortY.get(`${sourceAncestorId}:${edge.sourceId}`);
        const sourceOffset = getGraphPortYOffset("project", edge.sourceId, getGraphPortKeyForEdge(edge, "out")) || 0;
        edge.sourcePortY = typeof sourceBaseY === "number" ? sourceBaseY + sourceOffset : sourceBaseY;
      }
      if (targetAncestorId && Number(edge.targetId) !== targetAncestorId) {
        const targetBaseY = nestedPortY.get(`${targetAncestorId}:${edge.targetId}`);
        const targetOffset = getGraphPortYOffset("project", edge.targetId, getGraphPortKeyForEdge(edge, "in")) || 0;
        edge.targetPortY = typeof targetBaseY === "number" ? targetBaseY + targetOffset : targetBaseY;
      }
    });
  }

  return { nodes, edges };
}

const GRAPH_PORT_X_OFFSET = 4.8;
const GRAPH_PORT_Y_OFFSETS = {
  completion: -0.58,
  advance: 0.58,
  archive: 1.74
};
const GRAPH_GROUP_HEADER_PORT_Y = {
  completion: -3.4,
  advance: -2.55,
  archive: -1.7
};
const GRAPH_DYNAMIC_PORT_ROW_STEP = 1.16;

function getGraphPortKeyForEdge(edge, direction) {
  return direction === "out"
    ? (edge?.sourcePort || edge?.metric || "completion")
    : (edge?.targetPort || edge?.metric || "completion");
}

function getGraphPortYOffset(type, id, portKey) {
  const node = { type, sourceId: Number(id), label: "" };
  const ports = getGraphVisiblePorts(node);
  if (!ports.length) return null;
  const index = Math.max(0, ports.findIndex((port) => port.key === portKey));
  const safeIndex = index < 0 ? 0 : index;
  return (safeIndex - ((ports.length - 1) / 2)) * GRAPH_DYNAMIC_PORT_ROW_STEP;
}

function graphEdgeEndpoint(node, direction, edge) {
  if (edge?.type === "task") {
    return { x: node.x, y: node.y };
  }
  const metric = edge?.metric || "completion";
  const nestedPortY = direction === "out" ? edge?.sourcePortY : edge?.targetPortY;
  const portKey = getGraphPortKeyForEdge(edge, direction);
  const endpointId = direction === "out" ? (edge?.sourceId ?? node.sourceId) : (edge?.targetId ?? node.sourceId);
  const endpointType = node.type === "project" ? "project" : node.type;
  const dynamicOffset = getGraphPortYOffset(endpointType, endpointId, portKey);
  const isOwnProjectPort = node.type === "project"
    && ((direction === "out" && Number(edge?.sourceId) === Number(node.sourceId))
      || (direction === "in" && Number(edge?.targetId) === Number(node.sourceId)));
  const yOffset = dynamicOffset ?? (isOwnProjectPort
    ? (GRAPH_GROUP_HEADER_PORT_Y[metric] ?? GRAPH_GROUP_HEADER_PORT_Y.completion)
    : (GRAPH_PORT_Y_OFFSETS[metric] ?? 0));
  const xOffset = direction === "out" ? GRAPH_PORT_X_OFFSET : -GRAPH_PORT_X_OFFSET;
  return {
    x: Math.max(0, Math.min(100, node.x + xOffset)),
    y: Math.max(0, Math.min(100, nestedPortY ?? (node.y + yOffset)))
  };
}

export function graphEdgePath(from, to, edge) {
  const start = graphEdgeEndpoint(from, "out", edge);
  const end = graphEdgeEndpoint(to, "in", edge);
  if (edge.type !== "task" && end.x < start.x) {
    const routeX = Math.min(100, Math.max(start.x, end.x) + 6);
    return `M ${start.x} ${start.y} H ${routeX} V ${end.y} H ${end.x}`;
  }
  const midX = start.x + (end.x - start.x) * (edge.type === "task" ? 0.68 : 0.52);
  return `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`;
}

export function getExternalLinkMidpoint(from, to, edge) {
  const start = graphEdgeEndpoint(from, "out", edge);
  const end = graphEdgeEndpoint(to, "in", edge);
  const midX = start.x + (end.x - start.x) * 0.52;
  return {
    x: midX,
    y: (start.y + end.y) / 2
  };
}

export function graphEdgeControlPosition(from, to, edge) {
  if (edge?.type === "external") {
    const mid = getExternalLinkMidpoint(from, to, edge);
    return {
      x: mid.x + 3.8,
      y: mid.y - 3.8
    };
  }
  return {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2
  };
}

export function graphEdgeDataAttrs(edge) {
  return [
    `data-graph-edge-id="${edge.id}"`,
    `data-graph-edge-type="${edge.type}"`,
    `data-graph-edge-source-id="${edge.sourceId}"`,
    `data-graph-edge-target-id="${edge.targetId}"`,
    `data-graph-edge-metric="${edge.metric || ""}"`,
    `data-graph-edge-source-type="${edge.sourceType || "project"}"`,
    `data-graph-edge-link-kind="${edge.linkKind || ""}"`
  ].join(" ");
}

export function getNestedProjectsForGraph(projectId, visibleProjectIds) {
  const childProjects = getChildProjects(projectId).filter((child) => visibleProjectIds.has(child.id));
  return childProjects.map((child) => ({
    project: child,
    children: getNestedProjectsForGraph(child.id, visibleProjectIds)
  }));
}

export function isGraphPortActive({ direction, id, metric, type = "project" }) {
  const nodeId = Number(id);
  if (direction === "in") {
    if (type === "archiveProject") {
      return (state.appSettings.graphArchiveLinks || [])
        .some((link) => link.targetType === "project" && Number(link.targetId) === nodeId);
    }
    if (type === "formula") {
      return (state.appSettings.graphFormulaInputLinks || [])
        .some((link) => link.targetId === nodeId && link.metric === metric);
    }
    return state.projectLinks.some((link) => link.targetId === nodeId && link.metric === metric)
      || (state.appSettings.graphFormulaLinks || [])
        .some((link) => link.targetId === nodeId && link.metric === metric);
  }

  if (type === "formula") {
    return (state.appSettings.graphFormulaLinks || [])
      .some((link) => link.sourceId === nodeId && link.metric === metric)
      || (state.appSettings.graphFormulaInputLinks || [])
        .some((link) => link.sourceType === "formula" && link.sourceId === nodeId && link.metric === metric);
  }

  if (type === "archive") {
    return (state.appSettings.graphArchiveLinks || [])
      .some((link) => link.sourceId === nodeId);
  }

  return state.projectLinks.some((link) => link.sourceId === nodeId && link.metric === metric)
    || (state.appSettings.graphFormulaInputLinks || [])
      .some((link) => link.sourceType === "project" && link.sourceId === nodeId && link.metric === metric);
}

export function graphPortStateClass({ direction, id, metric, type = "project" }) {
  return isGraphPortActive({ direction, id, metric, type }) ? "is-connected" : "is-idle";
}

export function graphPortDataAttrs({ direction, id, metric, type = "project" }) {
  const role = direction === "out" ? "source" : "target";
  return [
    `data-graph-port-role="${role}"`,
    `data-graph-port-id="${id}"`,
    `data-graph-port-type="${type}"`,
    `data-graph-port-metric="${metric}"`
  ].join(" ");
}

const GRAPH_PORT_FIELD_OPTIONS = {
  project: [
    { key: "name", label: "이름" },
    { key: "status", label: "상태" },
    { key: "completion", label: "완성도" },
    { key: "advance", label: "진행도" },
    { key: "deadline", label: "마감일" },
    { key: "note", label: "메모" },
    { key: "parent", label: "상위" },
    { key: "children", label: "하위" },
    { key: "tasks", label: "작업" },
    { key: "archive", label: "자료" }
  ],
  formula: [
    { key: "title", label: "이름" },
    { key: "formula-type", label: "계산 방식" },
    { key: "completion", label: "완성도" },
    { key: "advance", label: "진행도" },
    { key: "value", label: "계산값" }
  ],
  archive: [
    { key: "title", label: "이름" },
    { key: "path", label: "경로" },
    { key: "type", label: "종류" },
    { key: "resource", label: "자료" },
    { key: "archive", label: "자료 연결" }
  ]
};

const GRAPH_DEFAULT_PORTS = {
  project: ["completion", "advance"],
  formula: ["completion", "advance"],
  archive: ["archive"]
};

function normalizePortKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function getNodePortKey(type, id) {
  return `${type}:${id}`;
}

function getGraphNodePortConfig(type, id) {
  const nodeKey = getNodePortKey(type, id);
  const config = state.appSettings.graphNodePortSettings?.[nodeKey] || {};
  const project = type === "project" ? getProject(Number(id)) : null;
  const defaults = type === "project" && project?.parentId
    ? []
    : (GRAPH_DEFAULT_PORTS[type] || []);
  return {
    nodeKey,
    enabled: Array.isArray(config.enabled) ? config.enabled : defaults,
    custom: Array.isArray(config.custom) ? config.custom : []
  };
}

function getGraphNodePortOptions(type, id) {
  const config = getGraphNodePortConfig(type, id);
  const builtIns = GRAPH_PORT_FIELD_OPTIONS[type] || [];
  const custom = config.custom.map((port) => ({
    key: `custom-${normalizePortKey(port.id || port.label)}`,
    label: port.label || port.id || "Custom"
  }));
  return { ...config, options: [...builtIns, ...custom] };
}

function isGraphCustomPortActive({ direction, type, id, portKey }) {
  const nodeId = Number(id);
  return (state.appSettings.graphCustomPortLinks || []).some((link) => {
    if (direction === "out") {
      return link.sourceType === type && Number(link.sourceId) === nodeId && link.sourcePort === portKey;
    }
    return link.targetType === type && Number(link.targetId) === nodeId && link.targetPort === portKey;
  });
}

function getGraphVisiblePorts(node) {
  if (!["project", "formula", "archive"].includes(node.type)) return [];
  const { enabled, options } = getGraphNodePortOptions(node.type, node.sourceId);
  const enabledSet = new Set(enabled);
  return options.filter((port) => enabledSet.has(port.key));
}

function graphManagedPortStackMarkup(node, direction, { child = false } = {}) {
  const ports = getGraphVisiblePorts(node);
  if (!ports.length) return "";
  const isOut = direction === "out";
  const stackClass = child
    ? `graph-child-port-stack managed ${isOut ? "out" : "in"}`
    : `graph-port-stack graph-managed-port-stack ${isOut ? "graph-port-stack-out" : "graph-port-stack-in"} managed`;
  const portClass = child ? "graph-child-port" : "graph-port";
  const directionClass = child
    ? `graph-child-port-${isOut ? "out" : "in"}`
    : `graph-port-${isOut ? "out" : "in"}`;
  const nodeLabel = escapeHtml(node.label);
  const rows = ports.map((port) => {
    const targetType = node.type === "project" && port.key === "archive" ? "archiveProject" : node.type;
    const allowsOutput = !(node.type === "project" && port.key === "archive");
    const activeClass = isGraphCustomPortActive({ direction, type: node.type, id: node.sourceId, portKey: port.key })
      ? "is-connected"
      : graphPortStateClass({ direction, id: node.sourceId, metric: port.key, type: isOut ? node.type : targetType });
    const metricClass = `metric-${normalizePortKey(port.key)}`;
    const label = `<span class="graph-port-label">${escapeHtml(port.label)}</span>`;
    const button = isOut
      ? (allowsOutput ? `<button type="button" class="${portClass} ${directionClass} ${metricClass} ${activeClass}" ${graphPortDataAttrs({ direction: "out", id: node.sourceId, metric: port.key, type: node.type })}
          data-graph-connect-start="${node.sourceId}"
          data-graph-connect-source="${node.type}"
          data-graph-connect-metric="${port.key}"
          data-graph-source-port="${port.key}"
          aria-label="${nodeLabel} ${escapeHtml(port.label)} 출력"></button>` : `<i class="graph-port-placeholder" aria-hidden="true"></i>`)
      : `<button type="button" class="${portClass} ${directionClass} ${metricClass} ${activeClass}" ${graphPortDataAttrs({ direction: "in", id: node.sourceId, metric: port.key, type: targetType })}
          data-graph-connect-end="${node.sourceId}"
          data-graph-connect-target="${targetType}"
          data-graph-connect-metric="${port.key}"
          data-graph-target-port="${port.key}"
          aria-label="${nodeLabel} ${escapeHtml(port.label)} 입력"></button>`;
    return `<span class="graph-port-item">${isOut ? `${button}${label}` : `${label}${button}`}</span>`;
  }).join("");
  return `<span class="${stackClass}" aria-label="${nodeLabel} ${isOut ? "반영 시작" : "반영 수신"}">${rows}</span>`;
}

function graphPortSlotMarkup(node) {
  if (!["project", "formula", "archive"].includes(node.type)) return "";
  const { enabled, options } = getGraphNodePortOptions(node.type, node.sourceId);
  const enabledSet = new Set(enabled);
  const rows = options.filter((port) => enabledSet.has(port.key)).map((port) => {
    const inClass = isGraphCustomPortActive({ direction: "in", type: node.type, id: node.sourceId, portKey: port.key }) ? "is-connected" : "is-idle";
    const outClass = isGraphCustomPortActive({ direction: "out", type: node.type, id: node.sourceId, portKey: port.key }) ? "is-connected" : "is-idle";
    const targetType = node.type === "project" && port.key === "archive" ? "archiveProject" : node.type;
    const allowsOutput = !(node.type === "project" && port.key === "archive");
    return `
      <div class="graph-free-port-row" data-graph-port-slot="${node.type}:${node.sourceId}:${port.key}"
        data-graph-connect-end="${node.sourceId}"
        data-graph-connect-target="${targetType}"
        data-graph-connect-metric="${port.key}"
        data-graph-target-port="${port.key}">
        <button type="button" class="graph-port graph-free-port-in ${inClass}" ${graphPortDataAttrs({ direction: "in", id: node.sourceId, metric: port.key, type: node.type })} aria-label="${escapeHtml(node.label)} ${escapeHtml(port.label)} 입력"></button>
        <span>${escapeHtml(port.label)}</span>
        ${allowsOutput ? `<button type="button" class="graph-port graph-free-port-out ${outClass}" ${graphPortDataAttrs({ direction: "out", id: node.sourceId, metric: port.key, type: node.type })}
          data-graph-connect-start="${node.sourceId}"
          data-graph-connect-source="${node.type}"
          data-graph-connect-metric="${port.key}"
          data-graph-source-port="${port.key}"
          aria-label="${escapeHtml(node.label)} ${escapeHtml(port.label)} 출력"></button>` : `<i class="graph-port-placeholder" aria-hidden="true"></i>`}
      </div>
    `;
  }).join("");
  return rows ? `<div class="graph-free-port-slots" aria-label="${escapeHtml(node.label)} 자유 포트">${rows}</div>` : "";
}

function graphPortSettingsMarkup(node) {
  if (!["project", "formula", "archive"].includes(node.type)) return "";
  const { nodeKey, enabled, options } = getGraphNodePortOptions(node.type, node.sourceId);
  const enabledSet = new Set(enabled);
  return `
    <details class="graph-port-settings" data-graph-port-settings="${nodeKey}">
      <summary>포트</summary>
      <div class="graph-port-settings-grid">
        ${options.map((port) => `
          <label>
            <input type="checkbox" data-graph-port-toggle="${nodeKey}" value="${port.key}" ${enabledSet.has(port.key) ? "checked" : ""} />
            <span>${escapeHtml(port.label)}</span>
            ${port.key.startsWith("custom-") ? `<button type="button" class="graph-custom-port-delete" data-graph-delete-custom-port="${nodeKey}:${port.key}" aria-label="${escapeHtml(port.label)} 포트 삭제">×</button>` : ""}
          </label>
        `).join("")}
      </div>
      <div class="graph-port-add-row">
        <input type="text" data-graph-custom-port-name="${nodeKey}" maxlength="32" placeholder="새 포트" />
        <button type="button" data-graph-add-custom-port="${nodeKey}">+</button>
      </div>
    </details>
  `;
}

function graphPortSettingsSectionMarkup(node, { open = false } = {}) {
  const { nodeKey, enabled, options } = getGraphNodePortOptions(node.type, node.sourceId);
  const enabledSet = new Set(enabled);
  const openAttr = open || state.graphOpenPortSectionKey === nodeKey ? " open" : "";
  return `
    <details class="graph-port-settings-section" data-graph-port-section="${nodeKey}"${openAttr}>
      <summary>
        <strong>${escapeHtml(node.label)}</strong>
        <span class="graph-port-section-count">${enabled.length}/${options.length}</span>
      </summary>
      <div class="graph-port-section-body">
        <div class="graph-port-settings-grid">
        ${options.map((port) => `
          <label>
            <input type="checkbox" data-graph-port-toggle="${nodeKey}" value="${port.key}" ${enabledSet.has(port.key) ? "checked" : ""} />
            <span>${escapeHtml(port.label)}</span>
            ${port.key.startsWith("custom-") ? `<button type="button" class="graph-custom-port-delete" data-graph-delete-custom-port="${nodeKey}:${port.key}" aria-label="${escapeHtml(port.label)} 포트 삭제">×</button>` : ""}
          </label>
        `).join("")}
        </div>
        <div class="graph-port-add-row">
        <input type="text" data-graph-custom-port-name="${nodeKey}" maxlength="32" placeholder="새 포트" />
        <button type="button" data-graph-add-custom-port="${nodeKey}">+</button>
        </div>
      </div>
    </details>
  `;
}

function graphManagedPortSettingsMarkup(node, managedNodes = []) {
  if (!["project", "formula", "archive"].includes(node.type)) return "";
  const children = managedNodes.filter((item) => ["project", "formula", "archive"].includes(item.type));
  const rootKey = getNodePortKey(node.type, node.sourceId);
  const openAttr = state.appSettings.graphOpenPortSettingsKey === rootKey ? " open" : "";
  return `
    <details class="graph-port-settings" data-graph-port-settings="${rootKey}"${openAttr}>
      <summary>포트</summary>
      <div class="graph-port-settings-sections">
        ${graphPortSettingsSectionMarkup(node, { open: true })}
        ${children.length ? `
          <div class="graph-port-managed-title">하위 프로젝트</div>
          ${children.map((childNode) => graphPortSettingsSectionMarkup(childNode)).join("")}
        ` : ""}
      </div>
    </details>
  `;
}

export function graphProjectCardMarkup(item, depth = 0) {
  const child = item.project;
  const childCount = item.children.reduce((total, nested) => total + 1 + nested.children.length, 0);

  let parentWeightHtml = "";
  let bottleneckClass = "";
  let warningSymbol = "";
  let dragLabelHtml = "";
  let cardTriggerAttrs = "";

  if (child.parentId) {
    const parentContributors = getCompletionContributors(child.parentId);
    const parentFallback = parentContributors.length ? Math.round(100 / parentContributors.length) : 0;
    const parentKey = getCompletionItemKey("project", child.id);
    const parentWeight = getCompletionWeight(child.parentId, parentKey, parentFallback);

    const { drag, level } = getInternalContributorDrag(child.parentId, parentKey);
    let triggerAttrs = "";
    if (level === "critical" || level === "warning") {
      bottleneckClass = ` bottleneck-${level}`;
      warningSymbol = "⚠️ ";
      dragLabelHtml = `<small class="drag-label ${level}">하락 기여: -${drag.toFixed(1)}%p</small>`;
      triggerAttrs = `data-bottleneck-trigger-type="internal" data-bottleneck-trigger-id="${child.parentId}:${parentKey}:${parentFallback}"`;
      cardTriggerAttrs = `data-bottleneck-trigger-type="node" data-bottleneck-trigger-id="project-${child.id}"`;
    }
    parentWeightHtml = `<span class="graph-item-weight-badge project-badge" data-graph-internal-weight="${child.parentId}:${parentKey}:${parentFallback}" ${triggerAttrs} role="button" tabindex="0" style="margin-left: 4px;" aria-label="${escapeHtml(child.name)} 내부 반영비 ${parentWeight}%">${warningSymbol}반영비 ${parentWeight}%</span>`;
  }

  const childTasks = getProjectTasks(child.id, false);
  const childContributors = getCompletionContributors(child.id);
  const childFallback = childContributors.length ? Math.round(100 / childContributors.length) : 0;

  const tasksHtml = (state.appSettings.graphShowTasks !== false && childTasks.length) ? childTasks.map((task) => {
    const taskKey = getCompletionItemKey("task", task.id);
    const taskWeight = getCompletionWeight(child.id, taskKey, childFallback);
    const { drag, level } = getInternalContributorDrag(child.id, taskKey);
    let taskBottleneckClass = "";
    let taskWarningSymbol = "";
    let taskDragLabelHtml = "";
    let taskTriggerAttrs = "";
    if (level === "critical" || level === "warning") {
      taskBottleneckClass = ` bottleneck-${level}`;
      taskWarningSymbol = "⚠️ ";
      taskDragLabelHtml = `<small class="drag-label ${level}">하락 기여: -${drag.toFixed(1)}%p</small>`;
      taskTriggerAttrs = `data-bottleneck-trigger-type="node" data-bottleneck-trigger-id="task-${task.id}"`;
    }
    const taskProgressText = task.contributionMode === "completion"
      ? `${clampProgress(task.progress)}% 완성`
      : task.contributionMode === "advance"
        ? `${clampProgress(task.advance)}% 진행`
        : `${clampProgress(task.progress)}% 완성 · ${clampProgress(task.advance)}% 진행`;
    const taskWeightTriggerAttrs = (level === "critical" || level === "warning")
      ? `data-bottleneck-trigger-type="internal" data-bottleneck-trigger-id="${child.id}:${taskKey}:${childFallback}"`
      : "";
    return `
      <button type="button" class="graph-task-card${taskBottleneckClass}" ${taskTriggerAttrs} data-graph-drag-task="${task.id}" data-open-note="${task.id}" style="--depth:${depth}" aria-label="${escapeHtml(task.name)} 이동 또는 열기">
        <strong style="display: flex; justify-content: space-between; align-items: center; gap: 4px; width: 100%;">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${taskWarningSymbol}${escapeHtml(task.name)}</span>
          <span class="graph-item-weight-badge task-badge" data-graph-internal-weight="${child.id}:${taskKey}:${childFallback}" ${taskWeightTriggerAttrs} role="button" tabindex="0" aria-label="${escapeHtml(task.name)} 내부 반영비 ${taskWeight}%">${taskWarningSymbol}반영비 ${taskWeight}%</span>
        </strong>
        <span>${taskProgressText}</span>
        ${taskDragLabelHtml}
      </button>
    `;
  }).join("") : "";

  // Render outgoing/incoming links between subprojects
  const outgoing = getOutgoingLinks(child.id);
  const incoming = getIncomingLinks(child.id);
  const linksHtml = outgoing.length || incoming.length ? `
    <div class="graph-child-project-links" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; margin-bottom: 4px; margin-left: calc(${depth} * 12px);">
      ${outgoing.map(link => {
        const target = getProject(link.targetId);
        return `<span class="graph-item-link-badge outgoing" title="${escapeHtml(target?.name || "")}에 반영">→ ${escapeHtml(target?.name || "")} (${link.weight}%)</span>`;
      }).join("")}
      ${incoming.map(link => {
        const source = getProject(link.sourceId);
        return `<span class="graph-item-link-badge incoming" title="${escapeHtml(source?.name || "")}로부터 반영">← ${escapeHtml(source?.name || "")} (${link.weight}%)</span>`;
      }).join("")}
    </div>
  ` : "";
  const childNode = { type: "project", sourceId: child.id, label: child.name };
  const childPortStackIn = graphManagedPortStackMarkup(childNode, "in", { child: true });
  const childPortStackOut = graphManagedPortStackMarkup(childNode, "out", { child: true });

  return `
    <div class="graph-child-project-section${bottleneckClass}" style="--depth:${depth}">
      <div class="graph-child-project-wrap">
        <button type="button" class="graph-child-project-drag-handle" data-graph-drag-child-project="${child.id}" aria-label="${escapeHtml(child.name)} 이동">⠿</button>
        ${childPortStackIn}
        <span class="graph-child-port-stack in" aria-label="${escapeHtml(child.name)} 반영 수신">
          <span class="graph-port-item"><span class="graph-port-label">완성</span><button type="button" class="graph-child-port graph-child-port-in metric-completion ${graphPortStateClass({ direction: "in", id: child.id, metric: "completion" })}" ${graphPortDataAttrs({ direction: "in", id: child.id, metric: "completion" })} data-graph-connect-end="${child.id}" data-graph-connect-metric="completion" aria-label="${escapeHtml(child.name)} 완성도에 반영"></button></span>
          <span class="graph-port-item"><span class="graph-port-label">진행</span><button type="button" class="graph-child-port graph-child-port-in metric-advance ${graphPortStateClass({ direction: "in", id: child.id, metric: "advance" })}" ${graphPortDataAttrs({ direction: "in", id: child.id, metric: "advance" })} data-graph-connect-end="${child.id}" data-graph-connect-metric="advance" aria-label="${escapeHtml(child.name)} 진행도에 반영"></button></span>
          <span class="graph-port-item"><span class="graph-port-label">자료</span><button type="button" class="graph-child-port graph-child-port-in metric-archive ${graphPortStateClass({ direction: "in", id: child.id, metric: "archive", type: "archiveProject" })}" ${graphPortDataAttrs({ direction: "in", id: child.id, metric: "archive", type: "archiveProject" })} data-graph-connect-end="${child.id}" data-graph-connect-target="archiveProject" data-graph-connect-metric="archive" aria-label="${escapeHtml(child.name)} 자료 연결"></button></span>
        </span>
        <button type="button" class="graph-child-project-card" ${cardTriggerAttrs} data-select-project="${child.id}">
          <strong style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${warningSymbol}${escapeHtml(child.name)}</span>
            ${parentWeightHtml}
          </strong>
          <span>${getProjectDisplayProgress(child.id)}% 완성 · ${getProjectDisplayAdvance(child.id)}% 진행${childCount ? ` · 하위 ${childCount}` : ""}</span>
          ${dragLabelHtml}
        </button>
        ${childPortStackOut}
        <span class="graph-child-port-stack out" aria-label="${escapeHtml(child.name)} 반영 시작">
          <span class="graph-port-item"><button type="button" class="graph-child-port graph-child-port-out metric-completion ${graphPortStateClass({ direction: "out", id: child.id, metric: "completion" })}" ${graphPortDataAttrs({ direction: "out", id: child.id, metric: "completion" })} data-graph-connect-start="${child.id}" data-graph-connect-metric="completion" aria-label="${escapeHtml(child.name)} 완성도에서 반영 연결 시작"></button><span class="graph-port-label">완성</span></span>
          <span class="graph-port-item"><button type="button" class="graph-child-port graph-child-port-out metric-advance ${graphPortStateClass({ direction: "out", id: child.id, metric: "advance" })}" ${graphPortDataAttrs({ direction: "out", id: child.id, metric: "advance" })} data-graph-connect-start="${child.id}" data-graph-connect-metric="advance" aria-label="${escapeHtml(child.name)} 진행도에서 반영 연결 시작"></button><span class="graph-port-label">진행</span></span>
        </span>
      </div>
      ${tasksHtml ? `<div class="graph-child-project-tasks">${tasksHtml}</div>` : ""}
      ${linksHtml}
      ${item.children.map((nested) => graphProjectCardMarkup(nested, depth + 1)).join("")}
    </div>
  `;
}

export function graphMinimapMarkup(nodes) {
  const dots = nodes.map((node) => `
    <circle class="${node.type} ${node.selected ? "selected" : ""} ${node.scoped ? "scoped" : ""}" cx="${node.x}" cy="${node.y}" r="${node.type === "project" ? 2.8 : 1.8}"></circle>
  `).join("");

  return `
    <button type="button" class="graph-minimap" data-graph-minimap aria-label="그래프 미니맵">
      <span>지도</span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect class="graph-minimap-grid" x="0" y="0" width="100" height="100"></rect>
        ${dots}
        <rect class="graph-minimap-view" x="0" y="0" width="100" height="100"></rect>
      </svg>
    </button>
  `;
}

export function graphContextMenuMarkup() {
  if (!state.graphContextMenu) return "";
  const project = getProject(state.graphContextMenu.projectId) || getProject(state.selectedProjectId);
  const childLabel = project ? `${escapeHtml(project.name)} 하위에 추가` : "선택 프로젝트 하위에 추가";
  return `
    <div class="graph-context-menu" style="left:${state.graphContextMenu.x}px; top:${state.graphContextMenu.y}px">
      <button type="button" data-graph-context-action="root-project">새 최상위 프로젝트</button>
      <button type="button" data-graph-context-action="child-project">${childLabel}</button>
      <button type="button" data-graph-context-action="task">새 할 일</button>
      <button type="button" data-graph-context-action="memo-node">메모 노드</button>
      <button type="button" data-graph-context-action="formula-node">수식 노드</button>
      <button type="button" data-graph-context-action="archive-node">아카이브 노드</button>
    </div>
  `;
}

export function graphFormulaControlsMarkup(node) {
  const formulaId = node.sourceId;
  const formula = state.appSettings.graphFormulaNodes?.find(f => f.id === formulaId);
  if (!formula) return "";
  const formulaType = formula.formulaType || "fixed";

  let dropdownHtml = `
    <div class="graph-formula-select-wrap">
      <select class="graph-formula-type-select" data-formula-id="${formulaId}" aria-label="연산 방식 선택">
        <option value="fixed" ${formulaType === "fixed" ? "selected" : ""}>고정값</option>
        <option value="average" ${formulaType === "average" ? "selected" : ""}>단순 평균</option>
        <option value="min" ${formulaType === "min" ? "selected" : ""}>최소값</option>
        <option value="max" ${formulaType === "max" ? "selected" : ""}>최대값</option>
        <option value="weighted" ${formulaType === "weighted" ? "selected" : ""}>가중 평균</option>
      </select>
    </div>
  `;

  if (formulaType === "fixed") {
    return `
      <div class="graph-formula-controls">
        ${dropdownHtml}
        <div class="graph-formula-fixed-sliders">
          <label><span></span><input type="range" min="0" max="100" value="${node.progress}" data-graph-formula-completion="${formulaId}" aria-label="${escapeHtml(node.label)} 완성도 값"><strong>${node.progress}%</strong></label>
          <label><span></span><input type="range" min="0" max="100" value="${node.advance}" data-graph-formula-advance="${formulaId}" aria-label="${escapeHtml(node.label)} 진행도 값"><strong>${node.advance}%</strong></label>
        </div>
      </div>
    `;
  }

  const renderSlots = (metric) => {
    const links = getFormulaInputLinks(formulaId, metric);
    const slotsHtml = links.map(link => {
      const sourceObj = link.sourceType === "formula" ? getFormulaNode(link.sourceId) : getProject(link.sourceId);
      const sourceName = link.sourceType === "formula" ? (sourceObj?.title || `수식 ${link.sourceId}`) : (sourceObj?.name || `프로젝트 ${link.sourceId}`);
      return `
        <div class="graph-formula-slot-row" data-metric="${metric}">
          <button type="button" class="graph-port graph-formula-slot-port metric-${metric} is-connected"
            data-graph-port-role="target"
            data-graph-port-id="${formulaId}"
            data-graph-port-type="formula"
            data-graph-port-metric="${metric}"
            data-graph-connect-end="${formulaId}"
            data-graph-connect-target="formula"
            data-graph-connect-metric="${metric}"
            data-graph-connect-source-id="${link.sourceId}"
            data-graph-connect-source-type="${link.sourceType}"
            aria-label="${escapeHtml(sourceName)} 연결"></button>
          <span class="graph-formula-slot-name" title="${escapeHtml(sourceName)}">${escapeHtml(sourceName)}</span>
          ${formulaType === "weighted" ? `
            <input type="number" class="formula-slot-weight-input" min="0" max="100" value="${link.weight}" 
              data-formula-id="${formulaId}" 
              data-source-id="${link.sourceId}" 
              data-source-type="${link.sourceType}" 
              data-metric="${metric}" 
              aria-label="${escapeHtml(sourceName)} 반영 비율%">
            <span class="weight-percent">%</span>
          ` : ""}
          <button type="button" class="formula-slot-delete-btn" 
            data-formula-id="${formulaId}" 
            data-source-id="${link.sourceId}" 
            data-source-type="${link.sourceType}" 
            data-metric="${metric}" 
            aria-label="연결 끊기">×</button>
        </div>
      `;
    }).join("");

    const addSlotHtml = `
      <div class="graph-formula-slot-row add-slot" data-metric="${metric}">
        <button type="button" class="graph-port graph-formula-slot-port metric-${metric} is-idle"
          data-graph-port-role="target"
          data-graph-port-id="${formulaId}"
          data-graph-port-type="formula"
          data-graph-port-metric="${metric}"
          data-graph-connect-end="${formulaId}"
          data-graph-connect-target="formula"
          data-graph-connect-metric="${metric}"
          aria-label="새 ${metric === "completion" ? "완성도" : "진행도"} 연결 포트"></button>
        <span class="graph-formula-slot-name add-text">+ 새 ${metric === "completion" ? "완성도" : "진행도"} 연결</span>
      </div>
    `;

    return `
      <div class="graph-formula-slots-section">
        <div class="graph-formula-slots-title">${metric === "completion" ? "완성도 입력" : "진행도 입력"}</div>
        <div class="graph-formula-slots-list">
          ${slotsHtml}
          ${addSlotHtml}
        </div>
      </div>
    `;
  };

  return `
    <div class="graph-formula-controls calculated">
      ${dropdownHtml}
      ${renderSlots("completion")}
      ${renderSlots("advance")}
    </div>
  `;
}

export function renderGraphView(project, options = {}) {
  const { nodes, edges } = buildGraphData(project, options);
  const graphZoom = clampGraphZoom(state.appSettings.graphZoom);
  const canvasScale = clampGraphCanvasScale(state.appSettings.graphCanvasScale);
  const nodeScale = clampGraphNodeScale(state.appSettings.graphNodeScale);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const visibleProjectIds = new Set(nodes.filter((node) => node.type === "project").map((node) => node.sourceId));
  const groupedTasksByProject = new Map();
  if (options.full && state.appSettings.graphShowTasks !== false) {
    state.tasks
      .filter((task) => visibleProjectIds.has(task.projectId))
      .sort((a, b) => clampProgress(a.progress) - clampProgress(b.progress))
      .forEach((task) => {
        if (!groupedTasksByProject.has(task.projectId)) groupedTasksByProject.set(task.projectId, []);
        groupedTasksByProject.get(task.projectId).push(task);
      });
  }
  const nestedProjectsByProject = new Map();
  if (options.full) {
    const selectedScope = new Set(getScopedProjectIds(project.id));
    const allVisibleProjectIds = new Set((state.appSettings.graphScope === "local"
      ? state.projects.filter((candidate) => selectedScope.has(candidate.id))
      : state.projects
    ).map((candidate) => candidate.id));
    nodes
      .filter((node) => node.type === "project")
      .forEach((node) => {
        nestedProjectsByProject.set(node.sourceId, getNestedProjectsForGraph(node.sourceId, allVisibleProjectIds));
      });
  }
  const lines = edges.map((edge) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return "";
    const active = from.scoped || to.type === "task" || edge.type === "external";
    
    let extraClass = "";
    if (edge.type === "external" && edge.linkKind !== "formulaIn") {
      const linkSource = edge.sourceType === "formula"
        ? (state.appSettings.graphFormulaLinks || [])
        : state.projectLinks;
      const linkObj = linkSource.find((link) =>
        link.sourceId === edge.sourceId && link.targetId === edge.targetId && link.metric === edge.metric
      );
      if (linkObj) {
        const linkWithSourceType = edge.sourceType === "formula"
          ? { ...linkObj, sourceType: "formula" }
          : linkObj;
        const { level } = getExternalLinkDrag(linkWithSourceType);
        if (level === "critical") {
          extraClass = " bottleneck-critical";
        } else if (level === "warning") {
          extraClass = " bottleneck-warning";
        }
      }
    }

    return `<path d="${graphEdgePath(from, to, edge)}" class="${edge.type} ${active ? "active" : ""}${extraClass}" ${graphEdgeDataAttrs(edge)} />`;
  }).join("");
  const edgeControls = edges.map((edge) => {
    if (!edge.removable) return "";
    if (edge.type === "external" && edge.linkKind !== "archiveLink") return "";
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return "";
    const position = graphEdgeControlPosition(from, to, edge);
    const label = edge.linkKind === "archiveLink" ? "아카이브 연결 끊기" : edge.type === "hierarchy" ? "위계 연결 끊기" : "반영 연결 끊기";
    return `<button type="button" class="graph-edge-control ${edge.type}" data-graph-edge-control="${edge.id}" data-graph-remove-edge="${edge.id}" style="--x:${position.x}%; --y:${position.y}%" aria-label="${label}">×</button>`;
  }).join("");

  const weightBadges = edges.filter((edge) => edge.type === "external" && edge.linkKind !== "archiveLink").map((edge) => {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) return "";
    const midpoint = getExternalLinkMidpoint(from, to, edge);
    
    let weight = 30;
    let levelClass = "";
    let warningSymbol = "";
    let triggerAttrs = "";

    if (edge.linkKind === "hierarchy") {
      weight = edge.weight || 100;
      const parentId = edge.targetId;
      const parentKey = getCompletionItemKey("project", edge.sourceId);
      const { drag, level } = getInternalContributorDrag(parentId, parentKey);
      if (level === "critical" || level === "warning") {
        levelClass = ` bottleneck-${level}`;
        warningSymbol = "⚠️ ";
        triggerAttrs = `data-bottleneck-trigger-type="internal" data-bottleneck-trigger-id="${parentId}:${parentKey}:${weight}"`;
      }
    } else {
      const linkSource = edge.linkKind === "formulaIn"
        ? (state.appSettings.graphFormulaInputLinks || [])
        : edge.sourceType === "formula"
          ? (state.appSettings.graphFormulaLinks || [])
          : state.projectLinks;
      const linkObj = linkSource.find((link) => {
        const sameSourceType = edge.linkKind !== "formulaIn" || link.sourceType === edge.sourceType;
        return sameSourceType && link.sourceId === edge.sourceId && link.targetId === edge.targetId && link.metric === edge.metric;
      });
      weight = linkObj ? linkObj.weight : 30;

      if (edge.linkKind !== "formulaIn" && linkObj) {
        const linkWithSourceType = edge.sourceType === "formula"
          ? { ...linkObj, sourceType: "formula" }
          : linkObj;
        const { level } = getExternalLinkDrag(linkWithSourceType);
        if (level) {
          levelClass = ` bottleneck-${level}`;
          warningSymbol = "⚠️ ";
          triggerAttrs = `data-bottleneck-trigger-type="external" data-bottleneck-trigger-id="${edge.id}"`;
        }
      }
    }

    const breakBtn = edge.linkKind === "hierarchy"
      ? ""
      : `<button type="button" class="graph-edge-break" data-graph-remove-edge="${edge.id}" aria-label="반영 연결 끊기"></button>`;

    return `
      <span class="graph-edge-weight-badge${levelClass}" data-graph-edge-weight="${edge.id}" style="--x:${midpoint.x}%; --y:${midpoint.y}%">
        <button type="button" data-graph-weight-badge="${edge.id}" ${triggerAttrs} aria-label="반영 비율 ${weight}%">${warningSymbol}${weight}%</button>
        ${breakBtn}
      </span>
    `;
  }).join("");

  const isLocal = !options.full;
  const parentProj = isLocal && project.parentId ? getProject(project.parentId) : null;
  const parentNavHtml = parentProj ? `
    <div style="margin-left: 8px; display: inline-flex; align-items: center;">
      <button type="button" class="mock-button grey-command" data-select-project="${parentProj.id}" style="font-size: 11px; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); background: var(--panel-raised); color: var(--text); cursor: pointer; font-weight: 700; transition: background-color 0.16s var(--ease);">
        <span>상위로 ↑</span>
        <strong>${escapeHtml(parentProj.name)}</strong>
      </button>
    </div>
  ` : "";
  const isFullGraph = options.full || state.appSettings.globalGraphView === true;

  return `
    <section class="graph-view ${isFullGraph ? "graph-view-full" : ""}">
      <div class="graph-note">
        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong>${isFullGraph ? "전체 프로젝트 그래프" : "완성도 지도"}</strong>
            <span>${state.graphNotice || (isFullGraph ? "프로젝트 위계와 서로 반영되는 관계를 한 화면에서 봅니다." : "하위 프로젝트와 할 일 완성도가 상위 완성도를 만듭니다.")}</span>
          </div>
          ${parentNavHtml}
        </div>
        <div class="graph-controls" aria-label="그래프 조작">
          ${isFullGraph ? `
            <div class="graph-filter" aria-label="그래프 필터">
              <button type="button" class="${(state.appSettings.graphScope || "all") === "all" ? "active" : ""}" data-graph-filter="scope" data-value="all">전체</button>
              <button type="button" class="${state.appSettings.graphScope === "local" ? "active" : ""}" data-graph-filter="scope" data-value="local">선택 구조</button>
              <button type="button" class="${state.appSettings.graphShowTasks !== false ? "active" : ""}" data-graph-filter="tasks">할 일</button>
              <button type="button" class="${state.appSettings.graphShowExternal !== false ? "active" : ""}" data-graph-filter="external">반영선</button>
            </div>
          ` : ""}
          <div class="graph-zoom" aria-label="그래프 확대 축소">
            <button type="button" data-graph-zoom="out" aria-label="그래프 축소">−</button>
            <button type="button" data-graph-zoom="reset">${Math.round(graphZoom * 100)}%</button>
            <button type="button" data-graph-zoom="in" aria-label="그래프 확대">+</button>
          </div>
          <div class="graph-zoom graph-size-control" aria-label="캔버스 크기">
            <button type="button" data-graph-canvas="smaller" aria-label="캔버스 줄이기">폭−</button>
            <button type="button" data-graph-layout="reset" aria-label="노드 자동 정렬">정렬</button>
            <button type="button" data-graph-canvas="larger" aria-label="캔버스 늘리기">폭+</button>
          </div>
          <div class="graph-zoom graph-node-size-control" aria-label="노드 크기">
            <button type="button" data-graph-node-size="smaller" aria-label="노드 줄이기">크기−</button>
            <button type="button" data-graph-node-size="reset">${Math.round(nodeScale * 100)}%</button>
            <button type="button" data-graph-node-size="larger" aria-label="노드 키우기">크기+</button>
          </div>
        </div>
      </div>
      <div class="graph-stage">
        <div class="graph-canvas" style="--graph-zoom:${graphZoom}; --graph-canvas-scale:${canvasScale}; --graph-node-scale:${nodeScale}">
          <div class="graph-interaction-hint">휠: 확대/축소 · 우클릭 드래그: 캔버스 이동 · 할일 드래그: 프로젝트 이동 · Alt+드래그: 복사</div>
          <div class="graph-legend" aria-hidden="true">
            <span><i class="project-dot"></i>프로젝트</span>
            <span><i class="task-dot"></i>할 일</span>
            <span><i class="external-dot"></i>반영선</span>
          </div>
          <svg class="graph-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
          ${edgeControls}
          ${weightBadges}
          ${nodes.map((node) => {
            const action = node.type === "project" ? `data-select-project="${node.sourceId}"` : node.type === "task" ? `data-open-note="${node.sourceId}"` : node.type === "memo" ? `data-graph-edit-memo="${node.sourceId}"` : node.type === "archive" ? `data-graph-edit-archive="${node.sourceId}"` : "";
            const groupedTasks = node.type === "project" ? groupedTasksByProject.get(node.sourceId) || [] : [];
            const nestedProjects = node.type === "project" ? nestedProjectsByProject.get(node.sourceId) || [] : [];
            const nestedProjectList = options.full && node.type === "project" ? `
              <div class="graph-project-group-list">
                <span class="graph-task-group-title">하위 프로젝트 ${nestedProjects.length}</span>
                ${nestedProjects.length ? nestedProjects.map((item) => graphProjectCardMarkup(item)).join("") : `<em class="graph-task-empty">하위 프로젝트 없음</em>`}
              </div>
            ` : "";
            const groupedTaskList = options.full && node.type === "project" && state.appSettings.graphShowTasks !== false ? `
              <div class="graph-task-group" data-graph-task-group="${node.sourceId}">
                <span class="graph-task-group-title">할일 ${groupedTasks.length}</span>
                ${groupedTasks.length ? (() => {
                  const contributors = getCompletionContributors(node.sourceId);
                  const fallback = contributors.length ? Math.round(100 / contributors.length) : 0;
                  return groupedTasks.map((task) => {
                    const key = getCompletionItemKey("task", task.id);
                    const weight = getCompletionWeight(node.sourceId, key, fallback);
                    const { drag, level } = getInternalContributorDrag(node.sourceId, key);
                    let taskBottleneckClass = "";
                    let taskWarningSymbol = "";
                    let taskDragLabelHtml = "";
                    let taskTriggerAttrs = "";
                    if (level === "critical" || level === "warning") {
                      taskBottleneckClass = ` bottleneck-${level}`;
                      taskWarningSymbol = "⚠️ ";
                      taskDragLabelHtml = `<small class="drag-label ${level}">하락 기여: -${drag.toFixed(1)}%p</small>`;
                      taskTriggerAttrs = `data-bottleneck-trigger-type="node" data-bottleneck-trigger-id="task-${task.id}"`;
                    }
                    const taskProgressText = task.contributionMode === "completion"
                      ? `${clampProgress(task.progress)}% 완성`
                      : task.contributionMode === "advance"
                        ? `${clampProgress(task.advance)}% 진행`
                        : `${clampProgress(task.progress)}% 완성 · ${clampProgress(task.advance)}% 진행`;
                    const taskWeightTriggerAttrs = (level === "critical" || level === "warning")
                      ? `data-bottleneck-trigger-type="internal" data-bottleneck-trigger-id="${node.sourceId}:${key}:${fallback}"`
                      : "";
                    return `
                      <button type="button" class="graph-task-card${taskBottleneckClass}" ${taskTriggerAttrs} data-graph-drag-task="${task.id}" data-open-note="${task.id}" aria-label="${escapeHtml(task.name)} 이동 또는 열기">
                        <strong style="display: flex; justify-content: space-between; align-items: center; gap: 4px; width: 100%;">
                          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${taskWarningSymbol}${escapeHtml(task.name)}</span>
                          <span class="graph-item-weight-badge task-badge" data-graph-internal-weight="${node.sourceId}:${key}:${fallback}" ${taskWeightTriggerAttrs} role="button" tabindex="0" aria-label="${escapeHtml(task.name)} 내부 반영비 ${weight}%">${taskWarningSymbol}반영비 ${weight}%</span>
                        </strong>
                        <span>${taskProgressText}</span>
                        ${taskDragLabelHtml}
                      </button>
                    `;
                  }).join("");
                })() : `<em class="graph-task-empty">비어 있음</em>`}
              </div>
            ` : "";
            const dockingSlot = node.type === "project" ? `
              <div class="graph-docking-guide-slot" data-graph-dock-zone="${node.sourceId}">
                <span>+ 하위로 도킹</span>
              </div>
            ` : "";
            const projectActions = node.type === "project" ? `
              <span class="graph-node-actions" aria-label="${escapeHtml(node.label)} 관리">
                <button type="button" data-graph-add-child="${node.sourceId}" aria-label="${escapeHtml(node.label)} 하위 프로젝트 추가">+</button>
                <button type="button" data-graph-edit-project="${node.sourceId}" aria-label="${escapeHtml(node.label)} 수정">수정</button>
                <button type="button" data-graph-delete-project="${node.sourceId}" aria-label="${escapeHtml(node.label)} 삭제">×</button>
              </span>
            ` : "";
            const freeNodeActions = (node.type === "memo" || node.type === "formula" || node.type === "archive") ? `
              <span class="graph-node-actions compact" aria-label="${escapeHtml(node.label)} 관리">
                <button type="button" data-graph-delete-free-node="${node.type}:${node.sourceId}" aria-label="${escapeHtml(node.label)} 삭제">×</button>
              </span>
            ` : "";
            const formulaControls = node.type === "formula" ? graphFormulaControlsMarkup(node) : "";
            const managedPortNodes = [];
            const collectManagedPortNodes = (items) => {
              items.forEach((item) => {
                managedPortNodes.push({ type: "project", sourceId: item.project.id, label: item.project.name });
                collectManagedPortNodes(item.children || []);
              });
            };
            if (node.type === "project") collectManagedPortNodes(nestedProjects);
            const portSettings = graphManagedPortSettingsMarkup(node, managedPortNodes);
            const portSlots = "";
            const managedPortStackIn = graphManagedPortStackMarkup(node, "in");
            const managedPortStackOut = graphManagedPortStackMarkup(node, "out");
            return `
              <article class="graph-node ${options.full && node.type === "project" ? "project-group" : ""} ${node.type} ${node.selected ? "selected" : ""} ${node.multiSelected ? "multi-selected" : ""} ${node.scoped ? "scoped" : ""} ${node.urgent ? "urgent" : ""}${node.bottleneckClass || ""}" data-graph-project-node="${node.type === "project" ? node.sourceId : ""}" data-graph-task-node="${node.type === "task" ? node.sourceId : ""}" data-graph-free-node="${node.type === "memo" || node.type === "formula" || node.type === "archive" ? `${node.type}:${node.sourceId}` : ""}" style="--x:${node.x}%; --y:${node.y}%">
                <button type="button" class="graph-inline-trigger" data-graph-inline-edit="${node.type}:${node.sourceId}" aria-label="${escapeHtml(node.label)} 이름 바로 수정">이름</button>
                ${node.type === "project" ? `<button type="button" class="graph-drag-handle" data-graph-drag-handle-node="${node.sourceId}" data-graph-drag-node="${node.sourceId}" aria-label="${escapeHtml(node.label)} 이동">이동</button>` : ""}
                ${node.type === "task" ? `<button type="button" class="graph-drag-handle task-drag-handle" data-graph-drag-task="${node.sourceId}" aria-label="${escapeHtml(node.label)} 이동 또는 복사">이동</button>` : ""}
                ${node.type === "memo" || node.type === "formula" || node.type === "archive" ? `<button type="button" class="graph-drag-handle" data-graph-drag-free-node="${node.type}:${node.sourceId}" aria-label="${escapeHtml(node.label)} 이동">이동</button>` : ""}
                ${managedPortStackIn}
                ${node.type === "project" ? `
                  <span class="graph-port-stack graph-port-stack-in" aria-label="${escapeHtml(node.label)} 반영 수신">
                    <span class="graph-port-item"><span class="graph-port-label">완성</span><button type="button" class="graph-port graph-port-in metric-completion ${graphPortStateClass({ direction: "in", id: node.sourceId, metric: "completion", type: node.type })}" ${graphPortDataAttrs({ direction: "in", id: node.sourceId, metric: "completion", type: node.type })} data-graph-connect-end="${node.sourceId}" data-graph-connect-target="${node.type}" data-graph-connect-metric="completion" aria-label="${escapeHtml(node.label)} 완성도에 연결"></button></span>
                    <span class="graph-port-item"><span class="graph-port-label">진행</span><button type="button" class="graph-port graph-port-in metric-advance ${graphPortStateClass({ direction: "in", id: node.sourceId, metric: "advance", type: node.type })}" ${graphPortDataAttrs({ direction: "in", id: node.sourceId, metric: "advance", type: node.type })} data-graph-connect-end="${node.sourceId}" data-graph-connect-target="${node.type}" data-graph-connect-metric="advance" aria-label="${escapeHtml(node.label)} 진행도에 연결"></button></span>
                    <span class="graph-port-item"><span class="graph-port-label">자료</span><button type="button" class="graph-port graph-port-in metric-archive ${graphPortStateClass({ direction: "in", id: node.sourceId, metric: "archive", type: "archiveProject" })}" ${graphPortDataAttrs({ direction: "in", id: node.sourceId, metric: "archive", type: "archiveProject" })} data-graph-connect-end="${node.sourceId}" data-graph-connect-target="archiveProject" data-graph-connect-metric="archive" aria-label="${escapeHtml(node.label)} 자료 연결"></button></span>
                  </span>
                ` : ""}
                <button type="button" class="graph-node-main" ${action}>
                  <strong>${escapeHtml(node.label)}</strong>
                  <span>${escapeHtml(node.sublabel)}</span>
                  ${node.type !== "memo" && node.type !== "archive" ? `<em class="graph-progress"><i style="--value:${node.progress}%"></i></em>` : ""}
                  ${node.type === "project" ? `<small>진행도 ${node.advance}%</small>` : ""}
                  ${node.type === "project" && node.hasChildren ? `<small>${node.progress}% 합산</small>` : ""}
                  ${node.type === "formula" ? `<small>완성 ${node.progress}% · 진행 ${node.advance}%</small>` : ""}
                  ${node.type === "memo" && node.body ? `<small>${escapeHtml(node.body)}</small>` : ""}
                </button>
                ${node.type === "memo" ? `<textarea class="graph-memo-editor" data-graph-memo-body="${node.sourceId}" aria-label="${escapeHtml(node.label)} 메모">${escapeHtml(node.body)}</textarea>` : ""}
                ${node.type === "archive" ? `
                  <select class="graph-archive-select" data-archive-node-id="${node.sourceId}" style="width: 100%; margin-top: 4px; font-size: 9px; padding: 2px; border-radius: 4px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text); outline: none;">
                    <option value="">[리소스 연결 안 됨]</option>
                    ${(state.archiveResources || []).map(r => `
                      <option value="${r.id}" ${node.resourceId === r.id ? "selected" : ""}>${escapeHtml(r.name)}</option>
                    `).join("")}
                  </select>
                  ${node.resourceId ? `
                    <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(node.sublabel)}" data-archive-type="${node.archiveType}" style="width: 100%; margin-top: 4px; font-size: 9.5px; padding: 4px;">열기/실행</button>
                  ` : ""}
                ` : ""}
                ${formulaControls}
                ${portSettings}
                ${portSlots}
                ${nestedProjectList}
                ${groupedTaskList}
                ${dockingSlot}
                ${projectActions}
                ${freeNodeActions}
                ${managedPortStackOut}
                ${node.type === "project" || node.type === "formula" || node.type === "archive" ? `
                  <span class="graph-port-stack graph-port-stack-out" aria-label="${escapeHtml(node.label)} 반영 시작">
                    <span class="graph-port-item"><button type="button" class="graph-port graph-port-out metric-${node.type === "archive" ? "archive" : "completion"} ${graphPortStateClass({ direction: "out", id: node.sourceId, metric: node.type === "archive" ? "archive" : "completion", type: node.type })}" ${graphPortDataAttrs({ direction: "out", id: node.sourceId, metric: node.type === "archive" ? "archive" : "completion", type: node.type })} data-graph-connect-start="${node.sourceId}" data-graph-connect-source="${node.type}" data-graph-connect-metric="${node.type === "archive" ? "archive" : "completion"}" aria-label="${escapeHtml(node.label)} ${node.type === "archive" ? "자료 연결 시작" : "완성도에서 연결 시작"}"></button><span class="graph-port-label">${node.type === "archive" ? "자료" : "완성"}</span></span>
                    ${node.type !== "archive" ? `<span class="graph-port-item"><button type="button" class="graph-port graph-port-out metric-advance ${graphPortStateClass({ direction: "out", id: node.sourceId, metric: "advance", type: node.type })}" ${graphPortDataAttrs({ direction: "out", id: node.sourceId, metric: "advance", type: node.type })} data-graph-connect-start="${node.sourceId}" data-graph-connect-source="${node.type}" data-graph-connect-metric="advance" aria-label="${escapeHtml(node.label)} 진행도에서 연결 시작"></button><span class="graph-port-label">진행</span></span>` : ""}
                  </span>
                ` : ""}
              </article>
            `;
          }).join("")}
        </div>
      </div>
      ${graphMinimapMarkup(nodes)}
      ${graphContextMenuMarkup()}
    </section>
  `;
}
