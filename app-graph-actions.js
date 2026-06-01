import {
  state,
  saveState,
  normalizeProjectLinks,
  normalizeGraphFormulaLinks,
  normalizeGraphFormulaInputLinks
} from "./state.js";

import {
  getProject,
  getDescendantProjectIds,
  setCompletionWeight,
  getCompletionItemKey,
  pruneCompletionWeights
} from "./calculator.js";

import {
  render,
  renderProjectList,
  renderGraphKeepingViewport
} from "./app.js";

export function applyGraphConnection({ sourceId, targetId, connectionType, metric, weight }) {
  const source = getProject(sourceId);
  const target = getProject(targetId);
  if (!source || !target || source.id === target.id) {
    state.graphNotice = "서로 다른 프로젝트 노드끼리 연결할 수 있습니다.";
    return;
  }

  if (connectionType === "hierarchy") {
    const blocked = new Set([target.id, ...getDescendantProjectIds(target.id)]);
    if (blocked.has(source.id)) {
      state.graphNotice = "순환 구조가 생기는 위계 연결은 만들 수 없습니다.";
      return;
    }
    const previousParentId = target.parentId;
    target.parentId = source.id;
    target.contributionMode = metric;
    if (metric !== "advance") {
      setCompletionWeight(source.id, getCompletionItemKey("project", target.id), weight);
    }
    if (previousParentId) pruneCompletionWeights(previousParentId);
    pruneCompletionWeights(source.id);
    state.projectLinks = normalizeProjectLinks(state.projectLinks, state.projects);
    state.graphNotice = `${target.name}을 ${source.name}의 하위 프로젝트로 연결했습니다.`;
    saveState();
    return;
  }

  const exists = state.projectLinks.some((link) => link.sourceId === source.id && link.targetId === target.id && link.metric === metric);
  if (exists) {
    state.graphNotice = "이미 연결된 프로젝트입니다.";
    return;
  }
  state.projectLinks.push({ sourceId: source.id, targetId: target.id, metric, weight });
  state.projectLinks = normalizeProjectLinks(state.projectLinks, state.projects);
  state.graphNotice = `${source.name} → ${target.name} ${weight}% 반영 연결을 만들었습니다.`;
  saveState();
}

export function applyGraphFormulaConnection({ sourceId, targetId, metric, weight }) {
  const source = (state.appSettings.graphFormulaNodes || []).find((node) => node.id === Number(sourceId));
  const target = getProject(targetId);
  if (!source || !target) {
    state.graphNotice = "수식노드는 프로젝트에만 반영할 수 있습니다.";
    return;
  }

  state.appSettings.graphFormulaLinks = state.appSettings.graphFormulaLinks || [];
  const exists = state.appSettings.graphFormulaLinks.some((link) => {
    return link.sourceId === source.id && link.targetId === target.id && link.metric === metric;
  });
  if (exists) {
    state.graphNotice = "이미 연결된 수식 반영입니다.";
    return;
  }
  state.appSettings.graphFormulaLinks.push({ sourceId: source.id, targetId: target.id, metric, weight });
  state.appSettings.graphFormulaLinks = normalizeGraphFormulaLinks(
    state.appSettings.graphFormulaLinks,
    state.projects,
    state.appSettings.graphFormulaNodes
  );
  state.graphNotice = `${source.title} 수식이 ${target.name}에 ${weight}% 반영됩니다.`;
  saveState();
}

export function applyGraphFormulaInputConnection({ sourceType, sourceId, targetId, metric, weight }) {
  const source = sourceType === "formula"
    ? (state.appSettings.graphFormulaNodes || []).find((node) => node.id === Number(sourceId))
    : getProject(sourceId);
  const target = (state.appSettings.graphFormulaNodes || []).find((node) => node.id === Number(targetId));
  if (!source || !target || (sourceType === "formula" && Number(sourceId) === Number(targetId))) {
    state.graphNotice = "수식 입력 연결을 만들 수 없습니다.";
    return;
  }

  state.appSettings.graphFormulaInputLinks = state.appSettings.graphFormulaInputLinks || [];
  const exists = state.appSettings.graphFormulaInputLinks.some((link) => {
    return link.sourceType === sourceType
      && link.sourceId === Number(sourceId)
      && link.targetId === target.id
      && link.metric === metric;
  });
  if (exists) {
    state.graphNotice = "이미 꽂혀 있는 수식 입력입니다.";
    return;
  }
  state.appSettings.graphFormulaInputLinks.push({
    sourceType,
    sourceId: Number(sourceId),
    targetId: target.id,
    metric,
    weight
  });
  state.appSettings.graphFormulaInputLinks = normalizeGraphFormulaInputLinks(
    state.appSettings.graphFormulaInputLinks,
    state.projects,
    state.appSettings.graphFormulaNodes
  );
  const sourceName = source.name || source.title || "입력";
  state.graphNotice = `${sourceName} 값을 ${target.title} 수식에 꽂았습니다.`;
  saveState();
}

export function removeGraphEdge(edgeId, canvas = null) {
  const parts = String(edgeId).split(":");
  const [type, sourceTypeOrId, sourceIdOrTargetId, targetIdOrMetric, metricText = "completion"] = parts;
  const sourceIdText = type === "formulaIn" ? sourceIdOrTargetId : sourceTypeOrId;
  const targetIdText = type === "formulaIn" ? targetIdOrMetric : sourceIdOrTargetId;
  const metric = type === "formulaIn" ? metricText : (targetIdOrMetric || "completion");
  const sourceId = Number(sourceIdText);
  const targetId = Number(targetIdText);
  if (type === "hierarchy") {
    const child = getProject(targetId);
    if (child && child.parentId === sourceId) {
      child.parentId = null;
      pruneCompletionWeights(sourceId);
      state.projectLinks = normalizeProjectLinks(state.projectLinks, state.projects);
      state.graphNotice = `${child.name}의 상위 프로젝트 연결을 끊었습니다.`;
    }
  }
  if (type === "external") {
    state.projectLinks = state.projectLinks.filter((link) => !(link.sourceId === sourceId && link.targetId === targetId && link.metric === metric));
    state.graphNotice = "반영 연결을 끊었습니다.";
  }
  if (type === "formula") {
    state.appSettings.graphFormulaLinks = (state.appSettings.graphFormulaLinks || [])
      .filter((link) => !(link.sourceId === sourceId && link.targetId === targetId && link.metric === metric));
    state.graphNotice = "수식 반영 연결을 끊었습니다.";
  }
  if (type === "formulaIn") {
    const sourceType = sourceTypeOrId === "formula" ? "formula" : "project";
    state.appSettings.graphFormulaInputLinks = (state.appSettings.graphFormulaInputLinks || [])
      .filter((link) => !(link.sourceType === sourceType && link.sourceId === sourceId && link.targetId === targetId && link.metric === metric));
    state.graphNotice = "수식 입력 연결을 뺐습니다.";
  }
  if (type === "archiveLink") {
    const archiveNodeId = Number(sourceTypeOrId);
    const targetType = sourceIdOrTargetId;
    const targetId = Number(targetIdOrMetric);
    state.appSettings.graphArchiveLinks = (state.appSettings.graphArchiveLinks || [])
      .filter((link) => !(link.sourceId === archiveNodeId && link.targetType === targetType && link.targetId === targetId));
    state.graphNotice = "아카이브 연결을 끊었습니다.";
  }
  saveState();
  renderProjectList();
  if (canvas) {
    renderGraphKeepingViewport(canvas);
  } else {
    render();
  }
}
