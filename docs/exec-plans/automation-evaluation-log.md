# Automation Evaluation Log

This file records accepted daily-evaluation candidates so the automation can continue from explicit user approvals instead of reopening new ideas every time.

## 2026-06-09

- Source: manual run of daily app evaluation.
- User decision: accepted all proposed candidates, then asked Codex to proceed sequentially and leave final manual test guidance.
- Implementation order:
  1. Korean UI layout contract and clipping guard.
  2. Relation confidence evidence display.
  3. Task launcher curation overload reduction.
  4. Space graph depth meaning clarification.
  5. Acceptance-log scaffold.
- Verification target:
  - Run narrow tests for each touched surface.
  - Run `node test_encoding_integrity.mjs` after Korean/UI-string changes.
  - Run `npm.cmd test` before handoff.

## 2026-06-10

- Source: daily automation heartbeat.
- User decision: accepted the proposed candidates with "ㄱㄱ".
- Small implementation scope:
  1. Show a one-line relation reason beside linked resources.
  2. Add a compact Space depth legend without changing graph data.
  3. Extend Korean layout contracts for the new reason and legend text.
  4. Keep this evaluation log as the automation's acceptance memory.
- External comparison checklist for future evaluations:
  - Obsidian-like graph work: local/global graph distinction, depth clarity, and non-destructive link exploration.
  - Notion-like relation work: visible relation properties should explain what is linked and why without opening a separate inspector.
  - AppFlowy-like workspace work: project, document, and wiki surfaces should stay integrated but not overload the main task flow.
  - Logseq-like knowledge work: backlinks and block-level context are useful only when they preserve the user's own writing structure.
  - Local app constraint: prefer small, inspectable UI layers over cloud-style collaboration or heavy database abstractions.
- Verification target:
  - Run focused markup/layout tests for task launcher and Space graph.
  - Run `node test_encoding_integrity.mjs` after Korean UI-string changes.
  - Run `npm.cmd test` before handoff.

## Candidate Record Format

- `candidate_id`: number from the evaluation message.
- `decision`: `accepted`, `rejected`, or `deferred`.
- `scope`: smallest behavior or document change allowed by the decision.
- `verification`: commands or manual UI checks required before reporting completion.
- `notes`: assumptions, risks, or follow-up context.
