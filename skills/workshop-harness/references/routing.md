# Routing Reference

Use the narrowest role that fits the task. Existing project docs remain authoritative.

## Roles

| Role | Read first | Project docs |
| --- | --- | --- |
| Docs | `docs/agents/docs-agent.md` | `docs/PRODUCT.md`, `docs/generated/project-map.md`, as needed |
| UI | `docs/agents/ui-agent.md` | `docs/FRONTEND.md`, `docs/DESIGN.md` |
| State Logic | `docs/agents/state-logic-agent.md` | `docs/DATA_MODEL.md`, `docs/PROJECT_LOGIC.md` |
| Graph | `docs/agents/graph-agent.md` | `docs/FRONTEND.md`, `docs/PROJECT_LOGIC.md`, as needed `docs/DATA_MODEL.md` |
| QA | `docs/agents/qa-agent.md` | `docs/QUALITY_CHECK.md` |

## Triggers

- Product intent, scope, open questions, compatibility docs: Docs.
- Layout, components, visual style, copy, modal markup: UI.
- Projects, tasks, progress, advance, status, import/export, normalization: State Logic.
- Graph nodes, edges, ports, formulas, graph archive nodes, drag/selection: Graph.
- Test choice, release checks, final evidence, skipped-check explanation: QA.

## Escalation Between Roles

Start narrow. Add a second role only when the edit crosses a boundary:

- UI that adds or stores new data: add State Logic.
- State Logic that changes displayed behavior: add UI.
- Graph link semantics: add State Logic.
- Any implementation or document contract change: add QA before completion.

Do not read every project document by habit.
