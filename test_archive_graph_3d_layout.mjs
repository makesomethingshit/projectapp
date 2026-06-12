import assert from "node:assert/strict";
import { layoutArchiveGraphNodes } from "./archive-graph-3d.js";

function radius(node) {
  return Math.hypot(node.x, node.y);
}

function minPairDistance(nodes) {
  let minDistance = Infinity;
  for (let outer = 0; outer < nodes.length; outer += 1) {
    for (let inner = outer + 1; inner < nodes.length; inner += 1) {
      const a = nodes[outer];
      const b = nodes[inner];
      minDistance = Math.min(
        minDistance,
        Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
      );
    }
  }
  return minDistance;
}

const active = {
  id: "resource:active",
  label: "Active material",
  kind: "file",
  active: true,
  score: 100,
  relationScore: 100,
  materialQualityScore: 100
};

const directNodes = Array.from({ length: 16 }, (_, index) => ({
  id: `resource:direct-${index}`,
  label: `Direct ${index}`,
  kind: index % 2 === 0 ? "file" : "link",
  score: 42 + index,
  relationScore: index === 0 ? 94 : index === 1 ? 18 : 52,
  relationLane: index === 0 ? "first" : index === 1 ? "low" : "middle",
  materialQualityScore: index === 0 ? 92 : index === 1 ? 24 : 58,
  hasRelationMemo: index === 0
}));

const links = directNodes.map((node) => ({
  source: active.id,
  target: node.id,
  relationScore: node.relationScore,
  relationStrength: node.relationLane === "first" ? "strong" : node.relationLane === "low" ? "weak" : "medium",
  type: "link"
}));

const laidOut = layoutArchiveGraphNodes([active, ...directNodes], links);
const direct = laidOut.filter((node) => node.graphDistance === 1);
const highTrust = laidOut.find((node) => node.id === "resource:direct-0");
const lowTrust = laidOut.find((node) => node.id === "resource:direct-1");

assert.equal(direct.length, directNodes.length);
assert.ok(direct.every((node) => node.connectedToActive));
assert.ok(highTrust.z > lowTrust.z + 260, "high-trust direct material should sit substantially closer on the z axis");
assert.ok(highTrust.spatialPriority > lowTrust.spatialPriority + 60, "manual relation confidence should affect spatial priority");

const directRadii = direct.map(radius);
const radiusSpread = Math.max(...directRadii) - Math.min(...directRadii);
assert.ok(radiusSpread < 80, "direct materials should remain visually in the same x/y distance ring");
assert.ok(minPairDistance(direct) > 34, "direct-ring stars should not collapse into one clump");

console.log("archive 3d graph layout ok");
