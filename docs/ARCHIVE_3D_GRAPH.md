# Archive 3D Graph Contract

The archive graph is a Second Brain surface for agents first and humans second. It is rhizomatic: folders and drives are storage aids, not conceptual parent nodes.

## Runtime Shape

- Archive Graph defaults to `appSettings.archiveGraphDisplayMode = "graph3d"`.
- `graph2d` remains as a fallback renderer.
- `archive-graph-model.js` builds renderer-neutral nodes and links.
- `archive-graph-3d.js` owns Three.js rendering, OrbitControls, hover labels, and node selection.
- `archive-graph-d3.js` owns the legacy 2D map.

## Relationship Model

- Relationship scoring is content centered.
- Storage locations, drive names, file extensions, and management tags must not dominate relation scores.
- The selected archive resource is the active context. Nearby materials should outrank unrelated global backlinks.
- Large maps are capped by model options such as `limit` and `edgeLimit`.

## Embedded Payloads

- JSON payloads in `<script type="application/json">` must use script-safe JSON.
- Do not HTML-escape JSON quotes into `&quot;`; that breaks `JSON.parse()` for both D3 and Three.js payloads.
- Escape `<`, `>`, `&`, U+2028, and U+2029 inside JSON script payloads.

## Electron Loading

- `index.html` must provide an import map for the bare `three` package name because `OrbitControls.js` imports `three` under Electron file URLs.
- `package.json` build files must include:
  - `archive-graph-3d.js`
  - `archive-graph-model.js`
  - `node_modules/three/build/three.module.js`
  - `node_modules/three/examples/jsm/controls/OrbitControls.js`

## Verification

- Run `npm.cmd test` for the full reliability suite.
- Run `node_modules\.bin\electron.cmd scripts\verify-archive-3d-electron.cjs` to verify the real Electron runtime creates a 3D canvas, obtains WebGL, and loads graph payload nodes.
