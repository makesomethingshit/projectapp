import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".vbs"
]);

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => textExtensions.has(extname(file)));

const suspiciousMatches = [];
for (const file of trackedFiles) {
  const text = readFileSync(file, "utf8");
  const patterns = [
    /\uFFFD/g,
    /\?\uFFFD/g,
    /최상\?\?/g,
    /\?\?;/g
  ];
  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      suspiciousMatches.push(`${file}:${line}:${match[0]}`);
    }
  });
}

assert.deepEqual(suspiciousMatches, [], "tracked text files should not contain mojibake markers");

const componentsCss = readFileSync("components.css", "utf8");
assert.match(componentsCss, /content: "순위 " counter\(impact-step\);/);
assert.match(componentsCss, /content: "최상위";/);
assert.match(componentsCss, /content: "현재";/);

console.log("encoding integrity test passed");
