import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runTestsSource = readFileSync("scripts/run-tests.mjs", "utf8");
const diagnosticSource = readFileSync("test_build_data.js", "utf8");

assert.match(
  runTestsSource,
  /--disable-warning=MODULE_TYPELESS_PACKAGE_JSON/,
  "test runner should suppress repeated Node module-type warnings"
);

const consoleLogCount = (diagnosticSource.match(/console\.log\(/g) || []).length;
assert.ok(consoleLogCount <= 1, "diagnostic script should not print verbose graph debug output during npm test");

console.log("test harness output contract passed");
