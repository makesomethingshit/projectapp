import { state } from "./state.js";

// ==============================================================
// FUNCTION INDEX (calculator.js)
// --------------------------------------------------------------
// L3     clampProgress
// L7     clampGraphZoom
// L11    clampGraphCanvasScale
// L15    clampGraphNodeScale
// L19    getProject
// L23    getFormulaNode
// L27    getFormulaValue
// L60    getChildProjects
// L64    getDescendantProjectIds
// L80    getProjectDepth
// L92    getProjectPath
// L104   getProjectPathObjects
// L116   getTopProjectId
// L121   getAncestorIds
// L125   revealProjectPath
// L129   getScopedProjectIds
// L133   taskContributesTo
// L139   getProjectTasks
// L146   getCompletionItemKey
// L150   getCompletionContributors
// L170   getCompletionWeight
// L175   getWeightedCompletion
// L190   setCompletionWeight
// L248   pruneCompletionWeights
// L248   getOwnProgress
// L258   getOwnAdvance
// L277   getIncomingLinks
// L284   getIncomingFormulaLinks
// L291   getFormulaInputLinks
// L298   getOutgoingLinks
// L302   getRollupProgress
// L325   getRollupAdvance
// L347   getProgressSegments
// L396   getAdvanceSegments
// L478   getExternalLinkDrag
// L493   getInternalContributorDrag
// ==============================================================

export function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function clampGraphZoom(value) {
  return Math.max(0.4, Math.min(2.8, Math.round((Number(value) || 1) * 10) / 10));
}

export function clampGraphCanvasScale(value) {
  return Math.max(0.8, Math.min(4, Math.round((Number(value) || 1.25) * 10) / 10));
}

export function clampGraphNodeScale(value) {
  return Math.max(0.5, Math.min(2.0, Math.round((Number(value) || 1.0) * 20) / 20));
}

export function getProject(projectId) {
  return state.projects.find((project) => project.id === Number(projectId));
}

export function getFormulaNode(formulaId) {
  return (state.appSettings.graphFormulaNodes || []).find((node) => node.id === Number(formulaId));
}

export function getFormulaValue(formulaId, metric = "completion", seen = new Set()) {
  const node = getFormulaNode(formulaId);
  if (!node) return 0;
  if (seen.has(Number(formulaId))) {
    return metric === "advance"
      ? clampProgress(node.advance ?? node.completion)
      : clampProgress(node.completion);
  }
  const nextSeen = new Set(seen);
  nextSeen.add(Number(formulaId));
  const inputs = getFormulaInputLinks(formulaId, metric);
  if (inputs.length && node.formulaType !== "fixed") {
    const values = inputs.map((link) => ({
      weight: link.weight,
      value: link.sourceType === "formula"
        ? getFormulaValue(link.sourceId, metric, nextSeen)
        : metric === "advance"
          ? getRollupAdvance(link.sourceId)
          : getRollupProgress(link.sourceId)
    }));
    if (node.formulaType === "min") return Math.min(...values.map((item) => item.value));
    if (node.formulaType === "max") return Math.max(...values.map((item) => item.value));
    if (node.formulaType === "average") {
      return Math.round(values.reduce((sum, item) => sum + item.value, 0) / values.length);
    }
    const totalWeight = values.reduce((sum, item) => sum + item.weight, 0) || 1;
    return Math.round(values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
  }
  return metric === "advance"
    ? clampProgress(node.advance ?? node.completion)
    : clampProgress(node.completion);
}

export function getChildProjects(projectId) {
  const targetId = Number(projectId);
  return state.projects.filter((project) => project.parentId !== null && project.parentId !== undefined && Number(project.parentId) === targetId);
}

export function getDescendantProjectIds(projectId) {
  const result = [];
  const queue = [Number(projectId)];
  const visited = new Set();
  while (queue.length) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    getChildProjects(currentId).forEach((child) => {
      result.push(child.id);
      queue.push(child.id);
    });
  }
  return result;
}

export function getProjectDepth(project) {
  let depth = 0;
  let current = project;
  const seen = new Set();
  while (current?.parentId && !seen.has(Number(current.parentId)) && depth < 8) {
    seen.add(Number(current.parentId));
    current = getProject(Number(current.parentId));
    if (current) depth += 1;
  }
  return depth;
}

export function getProjectPath(project) {
  const path = [project.name];
  let current = project;
  const seen = new Set();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = getProject(current.parentId);
    if (current) path.unshift(current.name);
  }
  return path;
}

export function getProjectPathObjects(project) {
  const path = [project];
  let current = project;
  const seen = new Set();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = getProject(current.parentId);
    if (current) path.unshift(current);
  }
  return path;
}

export function getTopProjectId(projectId) {
  const path = getProjectPathObjects(getProject(projectId) || {});
  return path[0]?.id || Number(projectId);
}

export function getAncestorIds(projectId) {
  return getProjectPathObjects(getProject(projectId) || {}).slice(0, -1).map((project) => project.id);
}

export function revealProjectPath(projectId) {
  getAncestorIds(projectId).forEach((id) => state.expandedProjectIds.add(id));
}

export function getScopedProjectIds(projectId) {
  return [projectId, ...getDescendantProjectIds(projectId)];
}

export function taskContributesTo(task, metric) {
  if (metric === "completion") return task.contributionMode !== "advance";
  if (metric === "advance") return task.contributionMode !== "completion";
  return true;
}

export function getProjectTasks(projectId, includeDescendants = false) {
  const ids = includeDescendants ? getScopedProjectIds(projectId) : [projectId];
  return state.tasks
    .filter((task) => ids.includes(task.projectId))
    .sort((a, b) => clampProgress(a.progress) - clampProgress(b.progress));
}

export function getCompletionItemKey(type, id) {
  return `${type}:${id}`;
}

export function getCompletionContributors(projectId) {
  const children = getChildProjects(projectId).filter((child) => child.contributionMode !== "advance");
  const completionTasks = getProjectTasks(projectId)
    .filter((task) => taskContributesTo(task, "completion"));

  const childContributors = children.map((child) => ({
    type: "project",
    id: child.id,
    name: child.name,
    value: () => getRollupProgress(child.id)
  }));

  const taskContributors = completionTasks.map((task) => ({
    type: "task",
    id: task.id,
    name: task.name,
    value: () => clampProgress(task.progress)
  }));

  return [...childContributors, ...taskContributors];
}

export function getCompletionWeight(projectId, key, fallback) {
  const savedWeight = Number(state.completionWeights?.[projectId]?.[key]);
  return Number.isFinite(savedWeight) && savedWeight >= 0 ? savedWeight : fallback;
}

export function getWeightedCompletion(projectId, contributors, seen = new Set()) {
  if (!contributors.length) return null;
  const fallback = Math.round(100 / contributors.length);
  const weighted = contributors.map((item) => {
    const key = getCompletionItemKey(item.type, item.id);
    return { ...item, key, weight: getCompletionWeight(projectId, key, fallback) };
  });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
  const total = weighted.reduce((sum, item) => {
    const value = item.type === "project" ? getRollupProgress(item.id, new Set(seen)) : item.value();
    return sum + value * item.weight;
  }, 0);
  return Math.round(total / totalWeight);
}

export function setCompletionWeight(projectId, key, weight) {
  const contributors = getCompletionContributors(projectId);
  const keys = contributors.map((item) => getCompletionItemKey(item.type, item.id));
  if (!keys.includes(key)) return;
  if (keys.length === 1) {
    state.completionWeights = {
      ...state.completionWeights,
      [projectId]: { [key]: 100 }
    };
    return;
  }

  const targetWeight = Math.max(0, Math.min(100, Math.round(Number(weight) || 0)));
  const otherKeys = keys.filter((itemKey) => itemKey !== key);
  const remaining = 100 - targetWeight;
  const fallback = Math.round(100 / contributors.length);
  const currentOthers = otherKeys.map((itemKey) => ({
    key: itemKey,
    weight: getCompletionWeight(projectId, itemKey, fallback)
  }));
  const currentTotal = currentOthers.reduce((sum, item) => sum + item.weight, 0);

  let otherWeights;
  if (remaining === 0) {
    otherWeights = currentOthers.map((item) => ({ key: item.key, weight: 0 }));
  } else if (currentTotal > 0) {
    const raw = currentOthers.map((item) => {
      const value = (item.weight / currentTotal) * remaining;
      return { key: item.key, base: Math.floor(value), rest: value % 1 };
    });
    let leftover = remaining - raw.reduce((sum, item) => sum + item.base, 0);
    otherWeights = raw
      .sort((a, b) => b.rest - a.rest)
      .map((item) => {
        const extra = leftover > 0 ? 1 : 0;
        leftover -= extra;
        return { key: item.key, weight: item.base + extra };
      });
  } else {
    const base = Math.floor(remaining / otherKeys.length);
    let leftover = remaining - base * otherKeys.length;
    otherWeights = otherKeys.map((itemKey) => {
      const extra = leftover > 0 ? 1 : 0;
      leftover -= extra;
      return { key: itemKey, weight: base + extra };
    });
  }

  const nextWeights = { [key]: targetWeight };
  otherWeights.forEach((item) => {
    nextWeights[item.key] = item.weight;
  });
  state.completionWeights = {
    ...state.completionWeights,
    [projectId]: nextWeights
  };
}

export function pruneCompletionWeights(projectId) {
  const parentId = Number(projectId);
  const savedWeights = state.completionWeights?.[parentId];
  if (!savedWeights || typeof savedWeights !== "object") return;

  const validKeys = new Set(
    getCompletionContributors(parentId).map((item) => getCompletionItemKey(item.type, item.id))
  );
  const nextWeights = Object.fromEntries(
    Object.entries(savedWeights).filter(([key]) => validKeys.has(key))
  );

  state.completionWeights = { ...state.completionWeights };
  if (Object.keys(nextWeights).length) {
    state.completionWeights[parentId] = nextWeights;
  } else {
    delete state.completionWeights[parentId];
  }
}

export function getOwnProgress(projectId, seen = new Set()) {
  const project = getProject(projectId);
  if (!project) return 0;
  if (seen.has(projectId)) return clampProgress(project.progress);
  seen.add(projectId);
  const weightedCompletion = getWeightedCompletion(projectId, getCompletionContributors(projectId), seen);
  if (weightedCompletion !== null) return weightedCompletion;
  return clampProgress(project.progress);
}

export function getOwnAdvance(projectId, seen = new Set()) {
  const project = getProject(projectId);
  if (!project) return 0;
  if (seen.has(projectId)) return clampProgress(project.advance ?? project.progress);
  seen.add(projectId);

  const children = getChildProjects(projectId).filter((child) => child.contributionMode !== "completion");
  const directTasks = getProjectTasks(projectId);
  const advanceTasks = directTasks.filter((task) => taskContributesTo(task, "advance"));

  const totalContributors = children.length + advanceTasks.length;
  if (totalContributors > 0) {
    const childrenTotal = children.reduce((sum, child) => sum + getRollupAdvance(child.id, new Set(seen)), 0);
    const tasksTotal = advanceTasks.reduce((sum, task) => sum + clampProgress(task.advance), 0);
    return Math.round((childrenTotal + tasksTotal) / totalContributors);
  }

  return clampProgress(project.advance ?? project.progress);
}

export function getIncomingLinks(projectId, metric = "completion") {
  return state.projectLinks.filter((link) => {
    const contributesToMetric = link.metric === "both" || link.metric === metric;
    return link.targetId === Number(projectId) && getProject(link.sourceId) && contributesToMetric;
  });
}

export function getIncomingFormulaLinks(projectId, metric = "completion") {
  return (state.appSettings.graphFormulaLinks || []).filter((link) => {
    const contributesToMetric = link.metric === "both" || link.metric === metric;
    return link.targetId === Number(projectId) && getFormulaNode(link.sourceId) && contributesToMetric;
  });
}

export function getFormulaInputLinks(formulaId, metric = "completion") {
  return (state.appSettings.graphFormulaInputLinks || []).filter((link) => {
    const contributesToMetric = link.metric === "both" || link.metric === metric;
    return link.targetId === Number(formulaId) && contributesToMetric;
  });
}

export function getOutgoingLinks(projectId) {
  return state.projectLinks.filter((link) => link.sourceId === Number(projectId) && getProject(link.targetId));
}

export function getRollupProgress(projectId, seen = new Set()) {
  if (seen.has(projectId)) return getOwnProgress(projectId);
  const ownProgress = getOwnProgress(projectId, new Set(seen));
  const nextSeen = new Set(seen);
  nextSeen.add(projectId);
  const incoming = getIncomingLinks(projectId, "completion").filter((link) => !nextSeen.has(link.sourceId));
  const formulaIncoming = getIncomingFormulaLinks(projectId, "completion").map((link) => ({ ...link, sourceType: "formula" }));
  const allIncoming = [...incoming, ...formulaIncoming];
  if (!allIncoming.length) return ownProgress;

  const totalRequested = allIncoming.reduce((sum, link) => sum + link.weight, 0);
  const incomingTotal = Math.min(90, totalRequested);
  const scale = totalRequested > incomingTotal ? incomingTotal / totalRequested : 1;
  const ownWeight = 100 - incomingTotal;
  const incomingScore = allIncoming.reduce((sum, link) => {
    const value = link.sourceType === "formula"
      ? getFormulaValue(link.sourceId, "completion")
      : getRollupProgress(link.sourceId, new Set(nextSeen));
    return sum + value * link.weight * scale;
  }, 0);
  return Math.round((ownProgress * ownWeight + incomingScore) / 100);
}

export function getRollupAdvance(projectId, seen = new Set()) {
  if (seen.has(projectId)) return getOwnAdvance(projectId);
  const ownAdvance = getOwnAdvance(projectId, new Set(seen));
  const nextSeen = new Set(seen);
  nextSeen.add(projectId);
  const incoming = getIncomingLinks(projectId, "advance").filter((link) => !nextSeen.has(link.sourceId));
  const formulaIncoming = getIncomingFormulaLinks(projectId, "advance").map((link) => ({ ...link, sourceType: "formula" }));
  const allIncoming = [...incoming, ...formulaIncoming];
  if (!allIncoming.length) return ownAdvance;
  const totalRequested = allIncoming.reduce((sum, link) => sum + link.weight, 0);
  const incomingTotal = Math.min(90, totalRequested);
  const scale = totalRequested > incomingTotal ? incomingTotal / totalRequested : 1;
  const ownWeight = 100 - incomingTotal;
  const incomingScore = allIncoming.reduce((sum, link) => {
    const value = link.sourceType === "formula"
      ? getFormulaValue(link.sourceId, "advance")
      : getRollupAdvance(link.sourceId, new Set(nextSeen));
    return sum + value * link.weight * scale;
  }, 0);
  return Math.round((ownAdvance * ownWeight + incomingScore) / 100);
}

export function getProjectDisplayProgress(projectId) {
  return getRollupProgress(projectId);
}

export function getProjectDisplayAdvance(projectId) {
  return getRollupAdvance(projectId);
}

export function getProgressSegments(projectId, includeExternal = true) {
  const incoming = includeExternal ? [
    ...getIncomingLinks(projectId, "completion"),
    ...getIncomingFormulaLinks(projectId, "completion").map((link) => ({ ...link, sourceType: "formula" }))
  ] : [];
  const incomingTotal = Math.min(90, incoming.reduce((sum, link) => sum + link.weight, 0));
  const baseWidth = includeExternal ? 100 - incomingTotal : 100;
  const requestedTotal = incoming.reduce((sum, link) => sum + link.weight, 0);
  const scale = incoming.length && requestedTotal > incomingTotal
    ? incomingTotal / requestedTotal
    : 1;
  const externalSegments = incoming.map((link) => {
    const source = link.sourceType === "formula" ? getFormulaNode(link.sourceId) : getProject(link.sourceId);
    return {
      id: `${link.sourceType === "formula" ? "formula" : "external"}-${link.sourceId}`,
      name: link.sourceType === "formula" ? `${source?.title || "수식"} 수식 반영` : `${source?.name || "연결"} 외부 반영`,
      progress: link.sourceType === "formula" ? getFormulaValue(link.sourceId, "completion") : getRollupProgress(link.sourceId, new Set([projectId])),
      width: link.weight * scale,
      external: true
    };
  });

  const contributors = getCompletionContributors(projectId);
  if (contributors.length) {
    const fallback = Math.round(100 / contributors.length);
    const weighted = contributors.map((item) => {
      const key = getCompletionItemKey(item.type, item.id);
      return { ...item, key, weight: getCompletionWeight(projectId, key, fallback) };
    });
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
    return [
      ...weighted.map((item) => ({
        id: item.id,
        key: item.key,
        type: item.type,
        name: item.name,
        progress: item.type === "project" ? getRollupProgress(item.id) : item.value(),
        width: baseWidth * (item.weight / totalWeight),
        weightInput: item.weight
      })),
      ...externalSegments
    ];
  }
  return [
    { id: projectId, name: getProject(projectId)?.name || "", progress: getOwnProgress(projectId), width: baseWidth },
    ...externalSegments
  ].filter((segment) => segment.width > 0);
}

export function getAdvanceSegments(projectId) {
  const children = getChildProjects(projectId).filter((child) => child.contributionMode !== "completion");
  const incoming = [
    ...getIncomingLinks(projectId, "advance"),
    ...getIncomingFormulaLinks(projectId, "advance").map((link) => ({ ...link, sourceType: "formula" }))
  ];
  const incomingTotal = Math.min(90, incoming.reduce((sum, link) => sum + link.weight, 0));
  const baseWidth = incoming.length ? 100 - incomingTotal : 100;
  const requestedTotal = incoming.reduce((sum, link) => sum + link.weight, 0);
  const scale = incoming.length && requestedTotal > incomingTotal
    ? incomingTotal / requestedTotal
    : 1;
  const externalSegments = incoming.map((link) => {
    const source = link.sourceType === "formula" ? getFormulaNode(link.sourceId) : getProject(link.sourceId);
    return {
      id: `${link.sourceType === "formula" ? "formula" : "external"}-${link.sourceId}`,
      name: link.sourceType === "formula" ? `${source?.title || "수식"} 수식 반영` : `${source?.name || "연결"} 외부 반영`,
      progress: link.sourceType === "formula" ? getFormulaValue(link.sourceId, "advance") : getRollupAdvance(link.sourceId, new Set([projectId])),
      width: link.weight * scale,
      external: true
    };
  });
  if (children.length) {
    const width = baseWidth / children.length;
    return [
      ...children.map((child) => ({ id: child.id, name: child.name, progress: getRollupAdvance(child.id), width })),
      ...externalSegments
    ];
  }
  const directTasks = getProjectTasks(projectId);
  const advanceTasks = directTasks.filter((task) => taskContributesTo(task, "advance"));
  if (advanceTasks.length) {
    const width = baseWidth / advanceTasks.length;
    return [
      ...advanceTasks.map((task) => ({ id: task.id, name: task.name, progress: clampProgress(task.advance), width })),
      ...externalSegments
    ];
  }
  return [
    { id: projectId, name: getProject(projectId)?.name || "", progress: getOwnAdvance(projectId), width: baseWidth },
    ...externalSegments
  ].filter((segment) => segment.width > 0);
}

export function getExternalLinkDrag(link) {
  const isAdvance = link.metric === "advance";
  const W = Number(link.weight) || 0;
  const V_target_own = isAdvance ? getOwnAdvance(link.targetId) : getOwnProgress(link.targetId);
  const V_source_rollup = link.sourceType === "formula"
    ? getFormulaValue(link.sourceId, link.metric)
    : (isAdvance ? getRollupAdvance(link.sourceId) : getRollupProgress(link.sourceId));
  const drag = W * (V_target_own - V_source_rollup) / 100;
  let level = null;
  if (drag >= 5) {
    level = "critical";
  } else if (drag >= 2) {
    level = "warning";
  }
  return { drag, level };
}

export function getInternalContributorDrag(projectId, key) {
  const contributors = getCompletionContributors(projectId);
  if (!contributors.length) return { drag: 0, level: null };

  const fallback = Math.round(100 / contributors.length);
  const weighted = contributors.map((item) => {
    const k = getCompletionItemKey(item.type, item.id);
    return { ...item, key: k, weight: getCompletionWeight(projectId, k, fallback) };
  });

  const target = weighted.find((item) => item.key === key);
  if (!target) return { drag: 0, level: null };

  const W_i = target.weight;
  const Total_W = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;

  const V_parent_rollup = getRollupProgress(projectId);
  const V_child = target.type === "project" ? getRollupProgress(target.id) : target.value();

  const drag = (W_i / Total_W) * (V_parent_rollup - V_child);
  let level = null;
  if (drag >= 5) {
    level = "critical";
  } else if (drag >= 2) {
    level = "warning";
  }
  return { drag, level };
}

export function getBottleneckDetails(projectId) {
  const result = [];
  const project = getProject(projectId);
  if (!project) return result;

  const allIncomingLinks = [
    ...getIncomingLinks(projectId, "completion"),
    ...getIncomingLinks(projectId, "advance"),
    ...getIncomingFormulaLinks(projectId, "completion").map((link) => ({ ...link, sourceType: "formula" })),
    ...getIncomingFormulaLinks(projectId, "advance").map((link) => ({ ...link, sourceType: "formula" }))
  ];

  const seenLinks = new Set();
  allIncomingLinks.forEach((link) => {
    const linkWithSourceType = link.sourceType === "formula" ? { ...link, sourceType: "formula" } : link;
    if (linkWithSourceType.sourceType !== "formula" && getAncestorIds(projectId).includes(Number(linkWithSourceType.sourceId))) {
      return;
    }
    const linkKey = `${linkWithSourceType.sourceType || "project"}:${linkWithSourceType.sourceId}:${linkWithSourceType.targetId}:${linkWithSourceType.metric}`;
    if (seenLinks.has(linkKey)) return;
    seenLinks.add(linkKey);

    const { drag, level } = getExternalLinkDrag(linkWithSourceType);
    if (level === "critical" || level === "warning") {
      let sourceName = "";
      if (linkWithSourceType.sourceType === "formula") {
        sourceName = getFormulaNode(linkWithSourceType.sourceId)?.title || "수식";
      } else {
        sourceName = getProject(linkWithSourceType.sourceId)?.name || "외부 프로젝트";
      }
      result.push({
        type: "external",
        sourceId: linkWithSourceType.sourceId,
        sourceType: linkWithSourceType.sourceType || "project",
        sourceName,
        drag,
        level,
        metric: linkWithSourceType.metric,
        linkKey
      });
    }
  });

  const contributors = getCompletionContributors(projectId);
  const fallback = contributors.length ? Math.round(100 / contributors.length) : 0;
  contributors.forEach((item) => {
    const key = getCompletionItemKey(item.type, item.id);
    const { drag, level } = getInternalContributorDrag(projectId, key);
    if (level === "critical" || level === "warning") {
      result.push({
        type: "internal",
        sourceId: item.id,
        sourceType: item.type,
        sourceName: item.name,
        drag,
        level,
        metric: "completion",
        key
      });
    }
  });

  return result;
}

