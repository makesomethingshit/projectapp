# 2D Map Interaction Upgrade Design

## Goal

Upgrade Archive 2D Map into the practical relationship workspace that complements Space.

Space remains the atmospheric 3D discovery view. 2D Map becomes the precise working map for reading structure, selecting materials, and adjusting archive relation confidence.

Priority order is `C -> A -> B`:

1. Improve 2D Map readability.
2. Connect node and edge interactions to inspector/relation controls.
3. Add light cross-window selection synchronization.

## Non-Goals

- Do not make 2D Map another Space-style visual scene.
- Do not add a new graph engine unless the existing DOM/D3 structure blocks the work.
- Do not add large user preference panels or persistent layout settings in the first pass.
- Do not redesign the whole archive screen.

## Current Context

- `ui-components.js` renders Archive graph modes and the 2D map markup.
- `archive-graph-d3.js` already exists for D3 force simulation behavior.
- `app-graph-events.js` handles Archive graph mode, pan, filters, node references, and selection events.
- `state.appSettings.archiveGraphDisplayMode` already switches between `graph3d` and `graph2d`.
- Relation confidence metadata already exists on `archiveResourceLinks`: `relationStatus`, `relationType`, `relationStrength`, `relationScore`, and `relationNote`.

## Design

### Phase 1: 2D Map Readability

2D Map should read like a clear work map.

Required behavior:

- Selected material is visually dominant but not oversized.
- Direct materials, one-step expanded materials, and wider materials are distinguishable in the plane.
- Node labels avoid overlapping as much as possible and should prefer selected/direct labels over low-priority labels.
- Edge opacity and width follow relation confidence: high confidence is stronger, weak or suggested relations are quieter.
- File/link/folder material types remain distinguishable through existing visual language.
- The map should stay usable in light and dark modes.

Implementation shape:

- Reuse the existing filtered graph payload and 2D map markup.
- Add a small deterministic layout/ranking layer for 2D readability if the existing positions are too dense.
- Keep label density as a display decision, not a stored resource property.
- Add or update markup/CSS tests for Korean labels, edge confidence classes, and graph mode rendering.

### Phase 2: Node And Edge Interaction

2D Map should become an editing surface for relationships.

Required behavior:

- Clicking a material node selects that archive resource and updates the inspector.
- Double-clicking or pressing an explicit open action opens the material.
- Clicking a relation edge reveals relation context: target, confidence, evidence, memo, and adjustment controls.
- Relation confidence controls reuse the existing relation update path and labels: `this task/project/link confidence`, not global material quality.
- Edge interaction must not block pan/zoom gestures.

Implementation shape:

- Prefer data attributes on existing 2D nodes/edges.
- Reuse `archiveRelationConfidenceMarkup`, `archiveRelationReasonMarkup`, and memo controls where possible.
- Keep selected edge as ephemeral UI state unless persistence becomes necessary.
- Add tests for node click target attributes, edge relation payload, and confidence control rendering.

### Phase 3: Cross-Window Selection Sync

The first sync pass should be shallow and reliable.

Required behavior:

- Selecting a material in Archive highlights the same material in 2D Map.
- Selecting a task/project context can highlight linked archive materials in the map when that context is visible.
- Opening a task launcher from a task should preserve the same relation confidence labels and memo previews.
- Sync should be visual emphasis first, not automatic navigation that surprises the user.

Implementation shape:

- Reuse `state.selectedArchiveResourceId` for archive material selection.
- For task/project context, derive highlights from `archiveResourceLinks` during render instead of storing new sync state.
- Avoid cross-window side effects that change `state.viewMode` unless the user explicitly clicks an open action.
- Add tests that a selected task/project produces linked archive highlight classes without mutating archive links.

## Data Model

No new persistent data is required for the first pass.

Existing data used:

- `archiveResources`
- `archiveResourceLinks`
- `state.selectedArchiveResourceId`
- `state.selectedProjectId`
- `state.appSettings.archiveGraphDisplayMode`
- `state.appSettings.archiveGraphDepth`
- `state.appSettings.archiveGraphKindFilter`
- `state.appSettings.archiveGraphStrengthFilter`

If selected-edge state is needed, it should start as ephemeral DOM/UI state. Persist it only if the user later wants the last selected relation to survive navigation.

## Testing Plan

- Add a focused 2D map markup/layout contract test before implementation.
- Run existing Archive graph tests:
  - `node test_archive_view_modes.mjs`
  - `node test_archive_graph_3d_markup.mjs`
  - `node test_archive_view_attach_controls.mjs`
- Run Korean layout safety checks:
  - `node test_korean_ui_layout_contract.mjs`
- Run full regression:
  - `npm.cmd test`

## Manual QA

- Switch Archive graph mode between Space and 2D Map.
- Confirm 2D Map labels do not collapse into unreadable clusters.
- Click a material node and confirm the inspector updates.
- Click a relation edge and confirm confidence/memo context is understandable.
- In dark mode, confirm edge labels, buttons, and node labels remain readable.
- Confirm Korean material names and long file paths do not overflow their containers.

## Open Risk

The main risk is scope creep: 2D Map can easily become a second graph product. The first implementation should stop after readability, node/edge interaction, and shallow selection highlighting. More advanced editing, saved layouts, custom graph modes, and bulk relation operations should wait until the basic map feels reliable.
