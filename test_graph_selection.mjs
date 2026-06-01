import assert from "node:assert/strict";
import { getGraphSelectionRect, isGraphPointInRect } from "./graph-selection.js";

const rect = getGraphSelectionRect({ x: 70, y: 80 }, { x: 20, y: 30 });

assert.deepEqual(rect, {
  left: 20,
  top: 30,
  right: 70,
  bottom: 80,
  width: 50,
  height: 50
});

assert.equal(isGraphPointInRect({ x: 20, y: 30 }, rect), true);
assert.equal(isGraphPointInRect({ x: 45, y: 55 }, rect), true);
assert.equal(isGraphPointInRect({ x: 71, y: 55 }, rect), false);
assert.equal(isGraphPointInRect({ x: 45, y: 81 }, rect), false);

console.log("graph selection tests passed");
