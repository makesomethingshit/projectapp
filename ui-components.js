import { state } from "./state.js";
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
  getBottleneckDetails
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
  const archiveIcon = (type) => type === "folder" ? "폴더" : type === "link" ? "링크" : "파일";
  const archiveTopic = (resource) => resource.tags?.[0] || "미분류";
  const viewMode = ["topic", "type", "all"].includes(state.appSettings.archiveViewMode)
    ? state.appSettings.archiveViewMode
    : "topic";
  const topicGroups = resources.reduce((groups, resource) => {
    const topic = archiveTopic(resource);
    if (!groups.has(topic)) groups.set(topic, []);
    groups.get(topic).push(resource);
    return groups;
  }, new Map());
  const sortedTopicEntries = [...topicGroups.entries()].sort(([a], [b]) => {
    if (a === "미분류") return 1;
    if (b === "미분류") return -1;
    return a.localeCompare(b, "ko");
  });
  const typeEntries = [
    ["작업 폴더", resources.filter((resource) => resource.type === "folder")],
    ["문서와 파일", resources.filter((resource) => resource.type === "file")],
    ["웹 링크", resources.filter((resource) => resource.type === "link")]
  ];
  const archiveSections = viewMode === "type"
    ? typeEntries
    : viewMode === "all"
      ? [["전체", [...resources].sort((a, b) => b.id - a.id)]]
      : sortedTopicEntries;
  const archiveViewControls = [
    ["topic", "주제별"],
    ["type", "종류별"],
    ["all", "전체"]
  ].map(([mode, label]) => `
    <button type="button" data-archive-view-mode="${mode}" class="${viewMode === mode ? "active" : ""}" aria-pressed="${viewMode === mode}" style="min-height: 28px; border: 0; border-radius: 6px; padding: 0 10px; background: ${viewMode === mode ? "var(--text)" : "transparent"}; color: ${viewMode === mode ? "var(--surface)" : "var(--muted)"}; font-size: 11px; font-weight: 900; cursor: pointer;">${label}</button>
  `).join("");

  const linkBadgesMarkup = (resourceId) => {
    const linked = archiveLinks.filter((link) => Number(link.resourceId) === Number(resourceId));
    if (!linked.length) return `<span class="meta-chip quiet-chip">연결 없음</span>`;
    return linked.map((link) => {
      const target = link.targetType === "task"
        ? state.tasks.find((task) => task.id === Number(link.targetId))
        : state.projects.find((project) => project.id === Number(link.targetId));
      const label = target?.name || "연결 대상 없음";
      return `<span class="meta-chip">${link.targetType === "task" ? "할 일" : "프로젝트"} · ${escapeHtml(label)}</span>`;
    }).join("");
  };

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

  const projectAttachmentControlsMarkup = (resourceId) => {
    const linkedProjectIds = new Set(
      archiveLinks
        .filter((link) => Number(link.resourceId) === Number(resourceId) && link.targetType === "project")
        .map((link) => Number(link.targetId))
    );
    const linkedProjects = state.projects.filter((project) => linkedProjectIds.has(project.id));
    const availableProjects = state.projects.filter((project) => !linkedProjectIds.has(project.id));
    const linkedMarkup = linkedProjects.length ? linkedProjects.map((project) => `
      <button type="button" class="meta-chip" data-detach-archive-project="${resourceId}" data-project-id="${project.id}" title="프로젝트 연결 해제" style="cursor: pointer;">
        ${escapeHtml(project.name)} ×
      </button>
    `).join("") : `<span class="meta-chip quiet-chip">프로젝트 연결 없음</span>`;

    const sortedTree = getProjectTreeSorted(state.projects);
    const availableProjectSet = new Set(availableProjects.map((p) => p.id));
    const optionsMarkup = sortedTree
      .filter((item) => availableProjectSet.has(item.project.id))
      .map((item) => {
        const indent = "\u00A0\u00A0".repeat(item.depth) + (item.depth > 0 ? "└─ " : "");
        return `<option value="${item.project.id}">${indent}${escapeHtml(item.project.name)}</option>`;
      })
      .join("");

    const selectMarkup = availableProjects.length ? `
      <select data-attach-archive-project="${resourceId}" aria-label="아카이브 프로젝트 연결" style="max-width: 180px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 10.5px;">
        <option value="">프로젝트 연결</option>
        ${optionsMarkup}
      </select>
    ` : "";
    return `
      <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-top: 6px;">
        ${linkedMarkup}
        ${selectMarkup}
      </div>
    `;
  };

  const editResourceFormMarkup = (resource) => `
    <details class="archive-edit-panel" style="margin-top: 8px;">
      <summary style="display: inline-flex; align-items: center; min-height: 26px; border: 1px solid var(--line); border-radius: 999px; padding: 0 10px; color: var(--text); background: var(--panel-raised); font-size: 10.5px; font-weight: 900; cursor: pointer;">수정</summary>
      <form data-edit-archive-form="${resource.id}" style="display: grid; gap: 8px; margin-top: 8px; padding: 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-soft);">
        <div style="display: flex; gap: 6px;">
          <input data-edit-archive-name type="text" value="${escapeHtml(resource.name)}" aria-label="아카이브 이름" style="flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
          <select data-edit-archive-type aria-label="아카이브 종류" style="width: 100px; padding: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);">
            <option value="file" ${resource.type === "file" ? "selected" : ""}>파일</option>
            <option value="folder" ${resource.type === "folder" ? "selected" : ""}>폴더</option>
            <option value="link" ${resource.type === "link" ? "selected" : ""}>링크</option>
          </select>
        </div>
        <input data-edit-archive-desc type="text" value="${escapeHtml(resource.desc || "")}" aria-label="아카이브 설명" placeholder="간단 설명" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" />
        <input data-edit-archive-tags type="text" value="${escapeHtml((resource.tags || []).join(", "))}" aria-label="아카이브 주제" placeholder="주제 예: 브랜딩, 레퍼런스" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" />
        <div style="display: flex; gap: 6px; align-items: center;">
          <div style="display: flex; gap: 4px; flex: 1; min-width: 0;">
            <input data-edit-archive-path type="text" value="${escapeHtml(resource.path)}" aria-label="아카이브 경로 또는 URL" style="flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
            <button type="button" class="edit-archive-select-file" data-resource-id="${resource.id}" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); color: var(--text); cursor: pointer; white-space: nowrap; font-size: 11px;">📁 파일</button>
            <button type="button" class="edit-archive-select-folder" data-resource-id="${resource.id}" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); color: var(--text); cursor: pointer; white-space: nowrap; font-size: 11px;">📂 폴더</button>
          </div>
          <button type="submit" style="padding: 6px 14px; border: 0; border-radius: 6px; background: var(--text); color: var(--surface); cursor: pointer; font-weight: 900; flex-shrink: 0;">저장</button>
        </div>
      </form>
    </details>
  `;

  const buildCategorySection = (title, items) => {
    const listHtml = items.length ? items.map((resource) => `
      <div class="archive-resource-row js-archive-item" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; box-shadow: var(--shadow-sm);">
        <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">
          <strong style="display: block; font-size: 12px; color: var(--text);">${archiveIcon(resource.type)} · ${escapeHtml(resource.name)}</strong>
          ${resource.desc ? `<p style="margin: 3px 0 0 0; font-size: 10px; color: var(--muted);">${escapeHtml(resource.desc)}</p>` : ""}
          <small style="display: block; font-size: 9px; color: var(--muted); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(resource.path)}</small>
          ${(resource.tags || []).length ? `<span style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">${resource.tags.map((tag) => `<span class="meta-chip">${escapeHtml(tag)}</span>`).join("")}</span>` : ""}
          <span style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">${linkBadgesMarkup(resource.id)}</span>
          ${projectAttachmentControlsMarkup(resource.id)}
          ${editResourceFormMarkup(resource)}
        </div>
        <div style="display: flex; gap: 4px; flex-shrink: 0;">
          <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(resource.path)}" data-archive-type="${resource.type}" style="padding: 4px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid var(--border); background: var(--panel-raised); cursor: pointer; color: var(--text); font-weight: 600;">열기</button>
          <button type="button" class="mock-button delete-archive-btn" data-delete-archive-id="${resource.id}" style="padding: 4px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid var(--coral); background: transparent; color: var(--coral); cursor: pointer;">×</button>
        </div>
      </div>
    `).join("") : `<p class="notice" style="font-size: 11px; color: var(--muted); padding: 8px; border: 1px dashed var(--border); border-radius: 8px; margin: 0 0 16px 0; text-align: center;">등록된 리소스가 없습니다.</p>`;

    return `
      <div class="archive-category-block" style="margin-bottom: 20px;">
        <h4 style="text-align: left; font-size: 12.5px; font-weight: 900; color: var(--text); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
          <span>${title}</span>
          <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: var(--panel-soft); color: var(--text);">${items.length}</span>
        </h4>
        ${listHtml}
      </div>
    `;
  };

  return `
    <div class="archive-drop-overlay" id="archiveDropOverlay" hidden>
      <div class="overlay-content">
        <svg style="width: 32px; height: 32px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-bottom: 8px; color: var(--accent);" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        <span>전역 아카이브에 리소스 추가</span>
      </div>
    </div>

    <header class="detail-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; width: 100%;">
      <div class="detail-title-area" style="text-align: left; flex: 1;">
        <p class="detail-kicker">전역 자료실</p>
        <h2>아카이브</h2>
        <p>프로젝트에 종속되지 않는 파일, 폴더, 링크를 모아두고 필요한 프로젝트나 할 일에 연결합니다.</p>
      </div>
      <div class="archive-view-toggle" aria-label="아카이브 보기 방식" style="display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--line); border-radius: 8px; padding: 3px; background: var(--panel-raised); flex-shrink: 0;">
        ${archiveViewControls}
      </div>
    </header>

    <section class="archive-list-section" style="margin-top: 20px;">
      ${query ? `<p class="notice" style="font-size: 11px; color: var(--muted); padding: 8px; border: 1px solid var(--line); border-radius: 8px; margin: 0 0 12px 0; text-align: left;">검색 결과 ${resources.length}개 · ${escapeHtml(state.searchQuery)}</p>` : ""}
      ${archiveSections.length
        ? archiveSections.map(([title, items]) => buildCategorySection(title, items)).join("")
        : buildCategorySection("미분류", [])}
    </section>

    <section class="archive-add-section" style="margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--border);">
      <h3 style="text-align: left; font-size: 12px; margin-bottom: 8px; color: var(--text);">+ 새 리소스 추가</h3>
      <form id="addArchiveForm" style="display: grid; gap: 8px; text-align: left;">
        <div style="display: flex; gap: 6px;">
          <input type="text" id="newArchiveName" placeholder="리소스 이름" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
          <select id="newArchiveType" style="width: 100px; padding: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);">
            <option value="file">파일</option>
            <option value="folder">폴더</option>
            <option value="link">링크</option>
          </select>
        </div>
        <div style="display: flex; gap: 6px;">
          <input type="text" id="newArchiveDesc" placeholder="간단 설명" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" />
          <div style="display: flex; gap: 4px; flex: 1.5; min-width: 0;">
            <input type="text" id="newArchivePath" placeholder="로컬 경로 또는 웹 URL" style="flex: 1; min-width: 0; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" required />
            <button type="button" id="newArchiveSelectFile" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); color: var(--text); cursor: pointer; white-space: nowrap; font-size: 11px;">📁 파일</button>
            <button type="button" id="newArchiveSelectFolder" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel-raised); color: var(--text); cursor: pointer; white-space: nowrap; font-size: 11px;">📂 폴더</button>
          </div>
          <input type="text" id="newArchiveTags" placeholder="주제 예: 브랜딩, 레퍼런스" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text);" />
          <button type="submit" style="padding: 6px 16px; border: none; border-radius: 6px; background: var(--accent); color: white; cursor: pointer; font-weight: bold;">추가</button>
        </div>
      </form>
    </section>
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
  return segmentsMarkup(segments, "완성도 합산");
}

export function advanceSegmentsMarkup(projectId) {
  const segments = getAdvanceSegments(projectId);
  return segmentsMarkup(segments, "진행도 합산");
}

function rollupRowTypeLabel(row) {
  if (row.sourceType === "formula") return "수식";
  if (row.sourceType === "project") return "외부 반영";
  if (row.type === "project") return "하위 프로젝트";
  if (row.type === "task") return "할 일";
  return "기본값";
}

function rollupRowMeta(row, metric) {
  if (row.sourceType) {
    return `요청 ${Math.round(row.requestedWeight)}% / 반영 ${Math.round(row.effectiveWeight)}%`;
  }
  if (row.type === "fallback") {
    return "기여 항목 없음. 프로젝트 기본값을 사용합니다.";
  }
  if (metric === "completion") {
    return `가중치 ${Math.round(row.weight)}%`;
  }
  return `평균 몫 ${Math.round(row.share)}%`;
}

export function rollupStructureMarkup(projectId, metric) {
  const explanation = getRollupExplanation(projectId, metric);
  const rows = [
    ...explanation.contributors,
    ...explanation.incoming.map((item) => ({ ...item, external: true }))
  ];
  const emptyLabel = metric === "advance" ? "진행도에 반영되는 항목이 없습니다" : "완성도에 반영되는 항목이 없습니다";
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
              <input type="number" min="0" max="100" step="1" value="${Math.round(row.weight)}" data-completion-weight="${row.key}" data-weight-project="${projectId}" aria-label="${escapeHtml(row.name)} 완성도 합산 비율" />
              <small>가중치 ${Math.round(row.weight)}%</small>
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
  const title = isAdvance ? "진행도 구조" : "완성도 구조";
  const description = isAdvance
    ? "진행도에 반영되는 하위 프로젝트와 할 일만 합산합니다"
    : hasChildren
      ? "하위 프로젝트 완성도가 상위 완성도를 만듭니다"
      : "할 일 완성도가 프로젝트 완성도를 만듭니다";
  const bar = isAdvance ? advanceSegmentsMarkup(project.id) : progressSegmentsMarkup(project.id);

  return `
    <section class="rollup-panel ${className} ${isExpanded ? "expanded" : ""}" data-rollup-toggle="${metric}" role="button" tabindex="0" aria-expanded="${isExpanded}">
      <div>
        <span>${title}</span>
        <strong>${description}</strong>
        <small class="rollup-hint">${isExpanded ? "클릭해서 접기" : "클릭해서 구조 보기"}</small>
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
      : "새 할 일을 추가해서 시작";
  const riskLabel = overdueCount
    ? "마감 지난 프로젝트 있음"
    : urgentCount
      ? `${urgentCount}개 마감 임박`
      : lowTasks.length
        ? `${lowTasks.length}개 완성도 낮음`
        : "눈에 띄는 위험 없음";
  const structureLabel = descendantCount
    ? `${descendantCount}개 하위 · ${incomingCount + outgoingCount}개 반영선`
    : `${allTasks.length}개 할 일 · ${incomingCount + outgoingCount}개 반영선`;
  const balanceLabel = gap >= 25
    ? `완성도/진행도 ${gap}% 차이`
    : "완성도와 진행도 균형 양호";

  return `
    <section class="workflow-radar" aria-label="작업 운영 요약">
      <article>
        <span>다음 집중</span>
        <strong>${escapeHtml(focusLabel)}</strong>
        <small>Notion식 작업 페이지처럼 바로 손댈 항목을 먼저 보여줍니다.</small>
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
        <small>진행은 됐지만 완성도가 낮은 상태를 잡아냅니다.</small>
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
        <strong>완성도 ${completionDelta >= 0 ? "+" : ""}${completionDelta}% · 진행도 ${advanceDelta >= 0 ? "+" : ""}${advanceDelta}%</strong>
        <small>${latest ? `${latest.date} 기준 전체 최상위 프로젝트 평균` : "아직 기록이 충분하지 않습니다."}</small>
      </div>
      <div>
        <span>집중 위젯</span>
        <strong>${focused.length ? focused.map((task) => task.name).join(", ") : "선택된 할 일이 없습니다"}</strong>
        <small>${focused.length ? "위젯에서 바로 완성도와 진행도를 조절할 수 있습니다." : "할 일 카드에서 집중을 눌러 올려두세요."}</small>
      </div>
      <div>
        <span>최근 손댄 것</span>
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
          <strong>완성도 ${completionDelta >= 0 ? "+" : ""}${completionDelta}% · 진행도 ${advanceDelta >= 0 ? "+" : ""}${advanceDelta}%</strong>
        </div>
        <div>
          <span>구조</span>
          <strong>${getDescendantProjectIds(project.id).length}개 하위 · ${incomingCount + outgoingCount}개 반영선 · ${allTasks.length}개 할 일</strong>
        </div>
        <div>
          <span>집중 위젯</span>
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

  const typeLabel = (type) => type === "folder" ? "폴더" : type === "link" ? "링크" : "파일";
  const listMarkup = linked.length ? linked.map(({ link, resource, task }) => `
    <div class="archive-resource-row js-archive-item" data-resource-id="${resource.id}" data-resource-path="${escapeHtml(resource.path)}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; box-shadow: var(--shadow-sm);">
      <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">
        <strong style="display: block; font-size: 12px; color: var(--text);">${typeLabel(resource.type)} · ${escapeHtml(resource.name)}</strong>
        <span class="meta-chip ${link.targetType === "task" ? "" : "quiet-chip"}" style="display: inline-flex; margin-top: 5px;">${link.targetType === "task" ? `할 일 · ${escapeHtml(task?.name || "연결된 할 일")}` : "현재 프로젝트에 연결"}</span>
        ${resource.desc ? `<p style="margin: 5px 0 0 0; font-size: 10px; color: var(--muted);">${escapeHtml(resource.desc)}</p>` : ""}
        <small style="display: block; font-size: 9px; color: var(--muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(resource.path)}</small>
      </div>
      <button type="button" class="mock-button green-command" data-open-archive-path="${escapeHtml(resource.path)}" data-archive-type="${resource.type}" style="padding: 4px 8px; font-size: 10.5px; border-radius: 4px; border: 1px solid var(--border); background: var(--panel-raised); cursor: pointer; color: var(--text); font-weight: 600; flex-shrink: 0;">열기</button>
    </div>
  `).join("") : `<p class="notice" style="font-size: 11px; color: var(--muted); padding: 10px; border: 1px dashed var(--border); border-radius: 8px; margin: 0;">연결된 아카이브가 없습니다.</p>`;

  return `
    <section class="archive-list-section" aria-label="연결된 아카이브" style="margin-top: 18px;">
      <h3 style="text-align: left; font-size: 12px; margin-bottom: 8px; color: var(--text); display: flex; align-items: center; gap: 6px;">
        <span>연결된 아카이브</span>
        <span style="font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: var(--panel-soft); color: var(--text);">${linked.length}</span>
      </h3>
      ${listMarkup}
    </section>
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
          const metricLabel = link.metric === "advance" ? "진행도" : link.metric === "both" ? "완성도/진행도" : "완성도";
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
              <em>이 프로젝트 진행도에 ${link.weight}% 반영</em>
            </button>
          `;
        }).join("")}
        ${outgoing.map((link) => {
          const target = getProject(link.targetId);
          const metricLabel = link.metric === "advance" ? "진행도" : link.metric === "both" ? "완성도/진행도" : "완성도";
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
  const levelLabel = progress < 30 ? "낮음" : progress < 60 ? "중간" : "높음";
  const advanceLabel = advance < 30 ? "낮음" : advance < 60 ? "중간" : "높음";
  const meta = [
    showProject && project ? getProjectPath(project).slice(-2).join(" / ") : "",
    task.note ? "메모 있음" : "",
    metricTypes.includes("completion") ? `완성도 ${levelLabel}` : "",
    metricTypes.includes("advance") && !metricTypes.includes("completion") ? `진행도 ${advanceLabel}` : ""
  ].filter(Boolean).join(" · ");

  const archiveLinks = (state.archiveResourceLinks || [])
    .filter(link => link.targetType === "task" && Number(link.targetId) === Number(task.id));
  const badgesMarkup = archiveLinks.map(link => {
    const archiveNode = (state.archiveResources || []).find(n => n.id === Number(link.resourceId));
    if (!archiveNode) return "";
    let icon = "📄";
    if (archiveNode.type === "folder") icon = "📁";
    if (archiveNode.type === "link") icon = "🔗";
    return `
      <button type="button" class="mini-archive-badge-btn" data-open-archive-path="${escapeHtml(archiveNode.path)}" data-archive-type="${archiveNode.type}" style="display: inline-flex; align-items: center; gap: 3px; border: 1px solid var(--border); border-radius: 4px; padding: 2px 5px; font-size: 8.5px; background: color-mix(in srgb, var(--accent) 6%, var(--surface)); color: var(--accent); cursor: pointer; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 4px; margin-right: 4px;">
        ${icon} ${escapeHtml(archiveNode.name)}
      </button>
    `;
  }).join("");

  return `
    <article class="task-card ${progress >= 100 ? "done" : ""} ${isFocused ? "focused" : ""}">
      <button class="task-card-main" data-open-note="${task.id}" aria-label="${escapeHtml(task.name)} 메모 열기">
        <strong>${escapeHtml(task.name)}</strong>
        <span>${escapeHtml(meta)}</span>
        ${badgesMarkup ? `<div class="task-archive-badges" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">${badgesMarkup}</div>` : ""}
      </button>
      <button class="task-focus-button" type="button" data-focus-task="${task.id}" aria-pressed="${isFocused}" aria-label="${escapeHtml(task.name)} 집중 위젯 ${isFocused ? "해제" : "선택"}">${isFocused ? "집중중" : "집중"}</button>
      <button class="task-delete-button" type="button" data-delete-task="${task.id}" aria-label="${escapeHtml(task.name)} 삭제">×</button>
      ${metricTypes.includes("completion") ? `
        <label class="task-completion-control">
          <span>완성도 <strong>${progress}%</strong></span>
          <input type="range" min="0" max="100" step="5" value="${progress}" data-task-progress="${task.id}" aria-label="${escapeHtml(task.name)} 완성도" />
        </label>
      ` : ""}
      ${metricTypes.includes("advance") ? `
        <label class="task-completion-control">
          <span>진행도 <strong>${advance}%</strong></span>
          <input type="range" min="0" max="100" step="5" value="${advance}" data-task-advance="${task.id}" aria-label="${escapeHtml(task.name)} 진행도" />
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
          <small>진행도</small>
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
          <small>진행도 그래프</small>
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
          <span>진행도</span>
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
    <section class="bottleneck-alert-card" aria-label="프로젝트 지연 요인 경고">
      <div class="bottleneck-alert-header">
        <span>⚠️ 현재 프로젝트를 지연시키는 요인</span>
      </div>
      <div class="bottleneck-alert-list">
        ${bottlenecks.map((b) => {
          const metricName = b.metric === "advance" ? "진행도" : "완성도";
          const targetTypeLabel = b.sourceType === "task" ? "할 일" : b.sourceType === "formula" ? "수식" : "프로젝트";
          
          let actionButtons = "";
          if (b.type === "external") {
            actionButtons = `
              <button type="button" class="bottleneck-action-btn" data-bottleneck-focus-node="project-${b.sourceId}">[노드로 이동]</button>
              <button type="button" class="bottleneck-action-btn" data-bottleneck-add-task="${b.sourceId}">[할 일 추가]</button>
              <button type="button" class="bottleneck-action-btn" data-bottleneck-pin-focused="${b.sourceId}" data-source-type="${b.sourceType}">[집중 등록]</button>
            `;
          } else {
            if (b.sourceType === "project") {
              actionButtons = `
                <button type="button" class="bottleneck-action-btn" data-bottleneck-focus-node="project-${b.sourceId}">[노드로 이동]</button>
                <button type="button" class="bottleneck-action-btn" data-bottleneck-add-task="${b.sourceId}">[할 일 추가]</button>
                <button type="button" class="bottleneck-action-btn" data-bottleneck-pin-focused="${b.sourceId}" data-source-type="project">[집중 등록]</button>
              `;
            } else {
              actionButtons = `
                <button type="button" class="bottleneck-action-btn" data-bottleneck-focus-node="task-${b.sourceId}">[노드로 이동]</button>
                <button type="button" class="bottleneck-action-btn" data-bottleneck-pin-task="${b.sourceId}">[집중 등록]</button>
              `;
            }
          }

          return `
            <div class="bottleneck-alert-item ${b.level}">
              <p>
                <strong>${escapeHtml(b.sourceName)}</strong>(${targetTypeLabel})이(가) 이 프로젝트 ${metricName}를 <strong>${b.drag.toFixed(1)}%p</strong> 감소시키는 중
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
  const bottlenecks = getBottleneckDetails(project.id);
  if (!bottlenecks.length) return "";

  const actionButton = (className, attrs, label) => `
    <button type="button" class="bottleneck-action-btn ${className}" ${attrs}>${label}</button>
  `;

  return `
    <section class="bottleneck-alert-card" aria-label="프로젝트 병목요인 경고">
      <div class="bottleneck-alert-header">
        <div>
          <span>병목요인</span>
          <strong>현재 프로젝트를 늦추는 항목</strong>
        </div>
        <em>${bottlenecks.length}개</em>
      </div>
      <div class="bottleneck-alert-list">
        ${bottlenecks.map((b) => {
          const metricName = b.metric === "advance" ? "진행도" : "완성도";
          const targetTypeLabel = b.sourceType === "task" ? "할 일" : b.sourceType === "formula" ? "수식" : "프로젝트";
          const levelLabel = b.level === "critical" ? "위험" : "주의";
          const focusTarget = `${b.sourceType === "task" ? "task" : "project"}-${b.sourceId}`;
          const canAddTask = b.sourceType === "project" || b.type === "external";
          const pinAttr = b.sourceType === "task"
            ? `data-bottleneck-pin-task="${b.sourceId}"`
            : `data-bottleneck-pin-focused="${b.sourceId}" data-source-type="${b.sourceType}"`;
          const actionButtons = `
            ${actionButton("trace", `data-bottleneck-focus-node="${focusTarget}"`, "추적")}
            ${canAddTask ? actionButton("add", `data-bottleneck-add-task="${b.sourceId}"`, "할 일 추가") : ""}
            ${actionButton("pin", pinAttr, "집중")}
          `;

          return `
            <div class="bottleneck-alert-item ${b.level}">
              <div class="bottleneck-item-copy">
                <span class="bottleneck-level">${levelLabel}</span>
                <p>
                  <strong>${escapeHtml(b.sourceName)}</strong>
                  <span>${targetTypeLabel} · ${metricName} -${b.drag.toFixed(1)}%p</span>
                </p>
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
    ${buildCategorySection("📁 작업 디렉토리 / 로컬 폴더", folders, "📁")}
    ${buildCategorySection("📄 작업 문서 / 디자인 에셋", files, "📄")}
    ${buildCategorySection("🔗 외부 참고 레퍼런스 / 웹 링크", links, "🔗")}
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
