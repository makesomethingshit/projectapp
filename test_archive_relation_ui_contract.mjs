import assert from "node:assert/strict";

import {
  archiveGraphEdgeAttrs,
  archiveGraphEdgeClass,
  archiveRelationAdjustMarkup,
  archiveRelationConfidenceBadgeMarkup,
  archiveRelationConfidenceState,
  archiveRelationGraphEdgeData,
  archiveRelationNotePreviewMarkup,
  archiveRelationReviewDeskMarkup,
  archiveRelationScopeLabel,
  selectedArchiveBacklinks
} from "./archive-relation-ui.js";

const weakTaskLink = {
  resourceId: 100,
  targetType: "task",
  targetId: 10,
  relationStatus: "suggested",
  relationType: "reference",
  relationStrength: "weak",
  relationScore: 32,
  relationReason: "topic overlap needs human review",
  relationNote: ""
};

const memoTaskLink = {
  resourceId: 100,
  targetType: "task",
  targetId: 11,
  relationStatus: "confirmed",
  relationType: "similar",
  relationStrength: "medium",
  relationScore: 66,
  relationReason: "shared layout terms",
  relationNote: "Check after the first draft."
};

const strongProjectLink = {
  resourceId: 100,
  targetType: "project",
  targetId: 1,
  relationStatus: "confirmed",
  relationType: "evidence",
  relationStrength: "strong",
  relationScore: 91,
  relationReason: "manual project reference",
  relationNote: ""
};

assert.equal(archiveRelationScopeLabel(weakTaskLink), "이 작업에서의 신뢰도");
assert.equal(archiveRelationScopeLabel(strongProjectLink), "이 프로젝트에서의 신뢰도");

assert.deepEqual(archiveRelationConfidenceState(weakTaskLink), {
  strength: "weak",
  score: 32
});

const adjustMarkup = archiveRelationAdjustMarkup(weakTaskLink);
assert.match(adjustMarkup, /data-archive-relation-strength="weak"/);
assert.match(adjustMarkup, /data-resource-id="100"/);
assert.match(adjustMarkup, /data-target-type="task"/);
assert.match(adjustMarkup, /data-target-id="10"/);
assert.match(adjustMarkup, /data-archive-relation-note="true"/);
assert.match(adjustMarkup, /이 작업에서의 신뢰도/);

assert.match(archiveRelationConfidenceBadgeMarkup(strongProjectLink), /이 프로젝트에서의 신뢰도 91/);
assert.match(archiveRelationNotePreviewMarkup(memoTaskLink), /메모 · Check after the first draft\./);

const backlinks = [
  { link: strongProjectLink, target: { id: 1, name: "Weekly Book Page" } },
  { link: memoTaskLink, target: { id: 11, name: "Collect references" } },
  { link: weakTaskLink, target: { id: 10, name: "Draw one page" } }
];
const reviewDeskMarkup = archiveRelationReviewDeskMarkup(backlinks);
const weakIndex = reviewDeskMarkup.indexOf('data-archive-review-edge="resource:100:task:10"');
const memoIndex = reviewDeskMarkup.indexOf('data-archive-review-edge="resource:100:task:11"');
const strongIndex = reviewDeskMarkup.indexOf('data-archive-review-edge="resource:100:project:1"');
assert.ok(weakIndex >= 0 && weakIndex < memoIndex, "weak/review relation should be first");
assert.ok(memoIndex >= 0 && memoIndex < strongIndex, "memo relation should precede strong relation");

const edgeData = archiveRelationGraphEdgeData(strongProjectLink);
assert.equal(edgeData.relationEdgeKey, "resource:100:project:1");
assert.equal(edgeData.relationStrength, "strong");
assert.equal(edgeData.relationScore, 91);
assert.match(archiveGraphEdgeClass({ type: "link", ...edgeData }), /relation-review/);

const edgeAttrs = archiveGraphEdgeAttrs(edgeData);
assert.match(edgeAttrs, /data-resource-id="100"/);
assert.match(edgeAttrs, /data-target-type="project"/);
assert.match(edgeAttrs, /data-target-id="1"/);
assert.match(edgeAttrs, /data-archive-review-edge="resource:100:project:1"/);

const backlinksFromState = selectedArchiveBacklinks(
  100,
  [{ id: 1, name: "Weekly Book Page" }],
  [{ id: 10, name: "Draw one page" }, { id: 11, name: "Collect references" }],
  [weakTaskLink, memoTaskLink, strongProjectLink]
);
assert.equal(backlinksFromState.length, 3);
assert.equal(backlinksFromState[0].target.name, "Weekly Book Page");
