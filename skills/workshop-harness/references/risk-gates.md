# Risk Gates

Ask before actions that are destructive, broad, external, or expensive.

## Requires Approval

- Delete, overwrite, mass-rename, or force-push.
- Run broad codemods or migrations.
- Deploy, publish, email, post, or change external systems.
- Touch credentials, secrets, production data, billing, or user accounts.
- Spawn many agents or long-running expensive jobs.
- Make irreversible Git or repository operations.

## Subagent Budget Gate

Before spawning or simulating subagents, decide whether delegation saves context.

Skip delegation when:

- The task is already implemented and only needs verification.
- The task can be handled by one local read/edit/test loop.
- The packet prompt would need most of the same context as the parent task.
- The worker would edit the same files as the parent on the critical path.

Use delegation when:

- Work can be split into independent write sets or read-only reviews.
- The worker can answer a narrow question from a short file/source list.
- Verification can run in parallel with non-overlapping local work.

## Project-Specific Risks

- State inconsistency between stored `progress`/`advance` and displayed rollups.
- Confusing `parentId` hierarchy with `projectLinks` external influence.
- Encoding regressions in Korean UI strings or CSS `content`.
- Graph changes that create cycles or misleading node positions.
- Import/export changes that lose or fail to normalize references.

When risk is unclear, continue with read-only inspection, a local draft, or a plan until the user approves.
