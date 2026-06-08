import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const htmlPath = process.argv[2];
if (!htmlPath) {
  console.error("Usage: node scripts/import-design-reference-links.mjs <html-file>");
  process.exit(1);
}

const seedPath = new URL("../archive-seed-sources.js", import.meta.url);
const { DEFAULT_ARCHIVE_SOURCES } = await import(`${seedPath.href}?t=${Date.now()}`);
const source = DEFAULT_ARCHIVE_SOURCES.find((entry) => entry.id === "g-precious-reference-library");
if (!source) {
  console.error("Archive source g-precious-reference-library was not found.");
  process.exit(1);
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&raquo;/g, "»")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&bull;/g, "•")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(rawHref) {
  const href = decodeHtml(rawHref).trim();
  if (!href) return "";
  try {
    const parsed = new URL(href);
    if (parsed.hostname === "www.google.com" && parsed.pathname === "/url") {
      return parsed.searchParams.get("q") || href;
    }
    return href;
  } catch {
    return href;
  }
}

function entryForLink(link) {
  return {
    name: link.label || link.url,
    type: "link",
    path: link.url,
    desc: `Design reference site imported from ${htmlPath}.`,
    tags: [
      "reference-library",
      "g-drive",
      "귀한거",
      "곽신 선생님이 주신거",
      "디자인",
      "디자인 참고 사이트",
      "web/link"
    ],
    createdAt: "2026-06-07T00:00:00"
  };
}

const html = readFileSync(htmlPath, "utf8");
const existingPaths = new Set(source.resources.map((resource) => String(resource.path || "").toLowerCase()));
const seen = new Set();
const links = [];
const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
let match;

while ((match = anchorPattern.exec(html))) {
  const href = match[1].match(/\bhref="([^"]+)"/i)?.[1] || "";
  const url = normalizeUrl(href);
  if (!/^https?:\/\//i.test(url)) continue;
  const key = url.toLowerCase();
  if (seen.has(key) || existingPaths.has(key)) continue;
  seen.add(key);
  links.push({
    label: stripTags(match[2]) || url,
    url
  });
}

if (!links.length) {
  console.log("No new design reference links found.");
  process.exit(0);
}

const seedFilePath = new URL("../archive-seed-sources.js", import.meta.url);
let seedText = readFileSync(seedFilePath, "utf8");
const insertion = links
  .map((link) => JSON.stringify(entryForLink(link), null, 2)
    .split("\n")
    .map((line) => `                      ${line}`)
    .join("\n"))
  .join(",\n");

const tailPattern = /(\r?\n\s*\]\r?\n\s*}\r?\n\];\s*)$/;
const tailMatch = seedText.match(tailPattern);
if (!tailMatch) {
  console.error("archive-seed-sources.js did not have the expected generated tail.");
  process.exit(1);
}

seedText = seedText.replace(tailPattern, `,\n${insertion}$1`);
writeFileSync(seedFilePath, seedText, "utf8");

console.log(`Imported ${links.length} design reference links.`);
console.log(links.slice(0, 8).map((link) => `- ${link.label} -> ${link.url}`).join("\n"));
if (links.length > 8) console.log(`...and ${links.length - 8} more`);
