import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layoutCss = readFileSync("layout.css", "utf8");
const modalCss = readFileSync("modals.css", "utf8");
const componentCss = readFileSync("components.css", "utf8");

assert.match(layoutCss, /\.app-shell\s*\{[^}]*min-height:\s*min\(700px,\s*calc\(100vh - 24px\)\)/s);
assert.match(layoutCss, /\.archive-full-content\s*\{[^}]*min-width:\s*0;[^}]*min-height:\s*0/s);
assert.match(layoutCss, /\.archive-sidebar\s*\{[^}]*width:\s*clamp\(260px,\s*28vw,\s*310px\)/s);
assert.match(layoutCss, /\.archive-backlinks\s*\{[^}]*width:\s*clamp\(220px,\s*24vw,\s*270px\)/s);

assert.match(modalCss, /\.task-modal,\s*[\s\S]*?\.project-modal\s*\{[^}]*max-height:\s*min\(760px,\s*calc\(100vh - 48px\)\)/s);
assert.match(modalCss, /\.modal-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
assert.match(modalCss, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.modal-actions button\s*\{[^}]*flex:\s*1 1 140px/s);

assert.match(componentCss, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.detail-header\s*\{[^}]*grid-template-columns:\s*1fr/s);
assert.match(componentCss, /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.task-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 24px/s);
assert.match(componentCss, /@media \(max-width:\s*520px\)\s*\{[\s\S]*?\.brand span,\s*[\s\S]*?\.brand p\s*\{[^}]*display:\s*none/s);

console.log("ui finish css test passed");
