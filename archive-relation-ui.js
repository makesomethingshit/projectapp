const ARCHIVE_RELATION_CONFIDENCE_OPTIONS = [
  { strength: "strong", label: "\ub192\uc74c", score: 90 },
  { strength: "medium", label: "\uc911\uac04", score: 60 },
  { strength: "weak", label: "\ub0ae\uc74c", score: 30 }
];

const ARCHIVE_RELATION_CONFIDENCE_SCORE_BY_STRENGTH = {
  strong: 90,
  medium: 60,
  weak: 30
};

const ARCHIVE_RELATION_EVIDENCE_LABELS = {
  auto: "\uc790\ub3d9 \uc5f0\uacb0",
  curation: "\uc790\ub3d9 \ud050\ub808\uc774\uc158",
  manual: "\uc218\ub3d9 \uc870\uc815",
  memo: "\uba54\ubaa8 \ubc18\uc601",
  legacy: "\uae30\uc874 \uc5f0\uacb0",
  core: "\ud575\uc2ec",
  evidence: "\uadfc\uac70",
  similar: "\uc720\uc0ac",
  reference: "\ucc38\uace0"
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));
}

function archiveRelationStrengthFromScore(score) {
  if (score >= 78) return "strong";
  if (score >= 62) return "medium";
  return "weak";
}

export function archiveRelationConfidenceState(link, fallback = {}) {
  const fallbackScore = Number.isFinite(Number(fallback.score)) ? Number(fallback.score) : null;
  if (Number.isFinite(Number(link?.relationScore))) {
    const score = Math.max(0, Math.min(100, Math.round(Number(link.relationScore))));
    const strength = ["strong", "medium", "weak"].includes(link?.relationStrength)
      ? link.relationStrength
      : archiveRelationStrengthFromScore(score);
    return {
      score,
      strength
    };
  }
  if (fallbackScore !== null) {
    const score = Math.max(0, Math.min(100, Math.round(fallbackScore)));
    return {
      score,
      strength: fallback.strength || archiveRelationStrengthFromScore(score)
    };
  }
  const strength = ["strong", "medium", "weak"].includes(link?.relationStrength)
    ? link.relationStrength
    : "medium";
  return {
    score: ARCHIVE_RELATION_CONFIDENCE_SCORE_BY_STRENGTH[strength],
    strength
  };
}

export function archiveRelationScopeLabel(link) {
  if (link?.targetType === "task") return "\uc774 \uc791\uc5c5\uc5d0\uc11c\uc758 \uc2e0\ub8b0\ub3c4";
  if (link?.targetType === "project") return "\uc774 \ud504\ub85c\uc81d\ud2b8\uc5d0\uc11c\uc758 \uc2e0\ub8b0\ub3c4";
  return "\uc774 \uc5f0\uacb0\uc5d0\uc11c\uc758 \uc2e0\ub8b0\ub3c4";
}

function archiveRelationEvidenceItems(link, fallback = {}) {
  if (!link) return [];
  const items = [];
  const hasStoredScore = Number.isFinite(Number(link.relationScore));
  const hasFallbackScore = Number.isFinite(Number(fallback.score));
  if (hasStoredScore && link.relationStatus === "confirmed") {
    items.push(ARCHIVE_RELATION_EVIDENCE_LABELS.auto);
  } else if (hasStoredScore) {
    items.push(ARCHIVE_RELATION_EVIDENCE_LABELS.manual);
  } else if (hasFallbackScore) {
    items.push(ARCHIVE_RELATION_EVIDENCE_LABELS.curation);
  } else {
    items.push(ARCHIVE_RELATION_EVIDENCE_LABELS.legacy);
  }
  if (typeof link.relationNote === "string" && link.relationNote.trim()) {
    items.push(ARCHIVE_RELATION_EVIDENCE_LABELS.memo);
  }
  if (["core", "evidence", "similar", "reference"].includes(link.relationType)) {
    items.push(ARCHIVE_RELATION_EVIDENCE_LABELS[link.relationType]);
  }
  return [...new Set(items)].slice(0, 4);
}

function archiveRelationEvidenceMarkup(link, fallback = {}) {
  const items = archiveRelationEvidenceItems(link, fallback);
  if (!items.length) return "";
  return `
    <div class="archive-relation-evidence" aria-label="\uc790\ub8cc \uc5f0\uacb0 \uadfc\uac70">
      ${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

export function archiveRelationReasonMarkup(link, fallback = {}) {
  if (!link) return "";
  const confidence = archiveRelationConfidenceState(link, fallback);
  const scopeLabel = archiveRelationScopeLabel(link);
  const evidence = fallback.reason
    || link.relationReason
    || archiveRelationEvidenceItems(link, fallback).join(" / ")
    || ARCHIVE_RELATION_EVIDENCE_LABELS.legacy;
  return `<p class="archive-relation-reason">\uadfc\uac70 \u00b7 ${escapeHtml(evidence)} \u00b7 ${scopeLabel} ${confidence.score}</p>`;
}

export function archiveRelationConfidenceBadgeMarkup(link, fallback = {}) {
  if (!link) return "";
  const confidence = archiveRelationConfidenceState(link, fallback);
  const option = ARCHIVE_RELATION_CONFIDENCE_OPTIONS.find((item) => item.strength === confidence.strength);
  const label = option?.label || "\uc911\uac04";
  const scopeLabel = archiveRelationScopeLabel(link);
  return `
    <span class="archive-relation-badge ${confidence.strength}" aria-label="${scopeLabel} ${confidence.score}">
      ${label} ${confidence.score}
    </span>
  `;
}

function archiveRelationConfidenceMarkup(link, fallback = {}) {
  if (!link) return "";
  const confidence = archiveRelationConfidenceState(link, fallback);
  const scopeLabel = archiveRelationScopeLabel(link);
  return `
    <div class="archive-relation-confidence" aria-label="${scopeLabel}">
      <span>${scopeLabel} ${confidence.score}</span>
      <div class="archive-relation-confidence-options">
        ${ARCHIVE_RELATION_CONFIDENCE_OPTIONS.map((option) => `
          <button
            type="button"
            class="${option.strength === confidence.strength ? "active" : ""}"
            data-archive-relation-strength="${option.strength}"
            data-resource-id="${Number(link.resourceId)}"
            data-target-type="${link.targetType === "task" ? "task" : "project"}"
            data-target-id="${Number(link.targetId)}"
            title="${scopeLabel} ${option.label} (${option.score})"
            aria-pressed="${option.strength === confidence.strength ? "true" : "false"}"
          >${option.label}</button>
        `).join("")}
      </div>
      ${archiveRelationEvidenceMarkup(link, fallback)}
    </div>
  `;
}

export function archiveRelationAdjustMarkup(link, fallback = {}) {
  if (!link) return "";
  return `
    <details class="archive-relation-adjust">
      <summary>\uc870\uc815</summary>
      <div class="archive-relation-control-panel">
        ${archiveRelationConfidenceMarkup(link, fallback)}
        ${archiveRelationNoteMarkup(link)}
      </div>
    </details>
  `;
}

function archiveRelationNoteMarkup(link) {
  if (!link) return "";
  return `
    <label class="archive-relation-note">
      <span>\uba54\ubaa8</span>
      <textarea
        rows="2"
        maxlength="500"
        data-archive-relation-note="true"
        data-resource-id="${Number(link.resourceId)}"
        data-target-type="${link.targetType === "task" ? "task" : "project"}"
        data-target-id="${Number(link.targetId)}"
        placeholder="\uba54\ubaa8"
        aria-label="\uc790\ub8cc \uc5f0\uacb0 \uba54\ubaa8"
      >${escapeHtml(link.relationNote || "")}</textarea>
    </label>
  `;
}

export function archiveRelationNotePreviewMarkup(link) {
  const note = typeof link?.relationNote === "string" ? link.relationNote.trim() : "";
  if (!note) return "";
  return `<p class="archive-relation-note-preview">\uba54\ubaa8 \u00b7 ${escapeHtml(note)}</p>`;
}

function archiveRelationEdgeKey(link) {
  const targetType = link?.targetType === "task" ? "task" : "project";
  return `resource:${Number(link?.resourceId || 0)}:${targetType}:${Number(link?.targetId || 0)}`;
}

export function archiveRelationGraphEdgeData(link) {
  const confidence = archiveRelationConfidenceState(link);
  return {
    relationEdgeKey: archiveRelationEdgeKey(link),
    resourceId: Number(link.resourceId),
    targetType: link.targetType === "task" ? "task" : "project",
    targetId: Number(link.targetId),
    relationStrength: confidence.strength,
    relationScore: confidence.score,
    relationStatus: link.relationStatus || ""
  };
}

export function archiveGraphEdgeClass(edge) {
  const strength = ["strong", "medium", "weak"].includes(edge?.relationStrength)
    ? edge.relationStrength
    : "";
  const review = edge?.relationStatus === "suggested" ? "review" : "";
  const relation = edge?.relationEdgeKey ? "relation-review" : "";
  return [edge?.type || "link", strength, review, relation].filter(Boolean).join(" ");
}

export function archiveGraphEdgeAttrs(edge) {
  if (!edge?.relationEdgeKey) return "";
  return [
    `data-resource-id="${Number(edge.resourceId)}"`,
    `data-target-type="${escapeHtml(edge.targetType === "task" ? "task" : "project")}"`,
    `data-target-id="${Number(edge.targetId)}"`,
    `data-archive-review-edge="${escapeHtml(edge.relationEdgeKey)}"`
  ].join(" ");
}

function archiveRelationReviewPriority(link) {
  const confidence = archiveRelationConfidenceState(link);
  if (link?.relationStatus === "suggested" || confidence.strength === "weak" || confidence.score < 50) return 0;
  if (typeof link?.relationNote === "string" && link.relationNote.trim()) return 1;
  if (confidence.strength === "strong") return 2;
  return 3;
}

export function archiveRelationReviewDeskMarkup(backlinks) {
  if (!backlinks.length) {
    return `
      <section class="archive-graph-inspector-card archive-relation-review-desk">
        <h3>\uac80\ud1a0\ud560 \uc5f0\uacb0</h3>
        <p>\uc120\ud0dd \uc790\ub8cc\uc5d0 \uc5f0\uacb0\ub41c \ud560 \uc77c\uc774\ub098 \ud504\ub85c\uc81d\ud2b8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.</p>
      </section>
    `;
  }
  const rows = [...backlinks]
    .sort((a, b) => archiveRelationReviewPriority(a.link) - archiveRelationReviewPriority(b.link)
      || archiveRelationConfidenceState(b.link).score - archiveRelationConfidenceState(a.link).score
      || String(a.target.name || "").localeCompare(String(b.target.name || ""), "ko"))
    .slice(0, 8)
    .map(({ link, target }) => {
      const confidence = archiveRelationConfidenceState(link);
      const edgeKey = archiveRelationEdgeKey(link);
      const targetTypeLabel = link.targetType === "task" ? "\ud560\uc77c" : "\ud504\ub85c\uc81d\ud2b8";
      return `
        <article
          class="archive-relation-review-row ${confidence.strength} ${link.relationStatus === "suggested" ? "review" : ""}"
          data-archive-review-edge="${escapeHtml(edgeKey)}"
          data-resource-id="${Number(link.resourceId)}"
          data-target-type="${link.targetType === "task" ? "task" : "project"}"
          data-target-id="${Number(link.targetId)}"
        >
          <div class="archive-relation-review-top">
            <strong>${escapeHtml(target.name || "\uc774\ub984 \uc5c6\uc74c")}</strong>
            ${archiveRelationConfidenceBadgeMarkup(link)}
          </div>
          <p class="archive-relation-review-meta">${targetTypeLabel} \u00b7 ${archiveRelationScopeLabel(link)}</p>
          ${archiveRelationReasonMarkup(link)}
          ${archiveRelationNotePreviewMarkup(link)}
          ${archiveRelationAdjustMarkup(link)}
        </article>
      `;
    }).join("");
  return `
    <section class="archive-graph-inspector-card archive-relation-review-desk">
      <h3>\uac80\ud1a0\ud560 \uc5f0\uacb0</h3>
      <p>\ud655\uc778 \ud544\uc694/\ub0ae\uc74c, \uba54\ubaa8 \uc788\uc74c, \uac15\ud55c \uc5f0\uacb0 \uc21c\uc73c\ub85c \uc815\ub9ac\ud588\uc2b5\ub2c8\ub2e4.</p>
      <div class="archive-relation-review-list">
        ${rows}
      </div>
    </section>
  `;
}

export function selectedArchiveBacklinks(resourceId, projects = [], tasks = [], archiveResourceLinks = []) {
  const projectsById = new Map((projects || []).map((project) => [Number(project.id), project]));
  const tasksById = new Map((tasks || []).map((task) => [Number(task.id), task]));
  return (archiveResourceLinks || [])
    .filter((link) => Number(link.resourceId) === Number(resourceId))
    .map((link) => {
      const target = link.targetType === "task"
        ? tasksById.get(Number(link.targetId))
        : projectsById.get(Number(link.targetId));
      if (!target) return null;
      return { link, target };
    })
    .filter(Boolean)
    .sort((a, b) => archiveRelationConfidenceState(b.link).score - archiveRelationConfidenceState(a.link).score);
}
