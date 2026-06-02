---
name: workshop-harness
description: Project-specific workflow orchestration for this Electron project manager repository. Use when work needs scoped document routing, role packets, subagent or simulated subagent delegation, workflow artifacts, risk gates, or verification planning for UI, state logic, graph, QA, or documentation changes in this repo.
---

# Workshop Harness

## Overview

Use this skill as the execution harness for the project. Keep `AGENTS.md` thin, use this skill to choose a role and workflow shape, then load only the project docs needed for that role.

The existing `docs/*.md` files remain the source of truth. This skill decides which ones to read and when to create workflow artifacts.

## Quick Start

1. Restate the user goal and success criteria.
2. Read `references/routing.md` and choose the narrowest role.
3. Read only the role-relevant project docs named by the routing reference.
4. If the task is broad, risky, or benefits from delegation, create a workflow folder with `scripts/new_workflow.py`.
5. Split work into packets using `references/packet-template.md`.
6. Apply risk gates from `references/risk-gates.md`.
7. Verify using `references/verification.md` and the project `docs/QUALITY_CHECK.md`.
8. Synthesize packet results; never paste raw worker output as the final answer.

## When To Create A Workflow

Create `.workflow/<slug>/` when at least two are true:

- The task has independent UI, state, graph, QA, docs, research, or review tracks.
- A written success contract would reduce drift.
- Verification should be separate from implementation.
- The task has destructive, external, broad, or state-corrupting risk.
- The workflow can become a reusable recipe.
- The user asks for subagents, dynamic workflow, swarm, packets, or Hermes/Qwen side work.

For small one-shot edits, route directly and report that a full workflow folder was unnecessary.

## Workflow Artifacts

Use the bundled scripts from the repository root:

```bash
python skills/workshop-harness/scripts/new_workflow.py "Task title"
python skills/workshop-harness/scripts/verify_workflow.py .workflow/<slug>
python skills/workshop-harness/scripts/collect_results.py .workflow/<slug>
```

The workflow folder contains:

```text
.workflow/<slug>/
  plan.md
  state.json
  orchestration.md
  packets/
  results/
  final-report.md
```

`.workflow/` is local scratch space unless the user explicitly asks to preserve or commit a specific artifact.

## Subagents And Local Models

Subagents are an exception, not the default. Use them only when the coordination cost is lower than the context they save.

Budget rule:

- Small edit, one file, docs-only, or obvious UI tweak: do it locally.
- Medium task: use at most one short read-only reviewer packet.
- Large task: create packets before implementation starts.
- Already implemented locally: do not add subagents afterward; run tests and review the diff.
- Never fork full context just to save tokens.

Use real subagents only when the current environment exposes a runner and the user has allowed delegation. Otherwise simulate subagents with packet notes:

- Run one packet at a time.
- Read only packet-relevant files.
- Save findings under `results/`.
- Integrate after all useful packet passes finish.

For local models such as Hermes/Qwen, assign bounded read-only or draft-only packets unless the user explicitly grants write authority.

## References

- Read `references/routing.md` before choosing project docs.
- Read `references/risk-gates.md` before risky or ambiguous actions.
- Read `references/packet-template.md` before delegating or simulating work packets.
- Read `references/verification.md` before claiming completion.
