# Packet Template

Use this shape for real subagents, local models, or simulated packet passes.

```text
Packet ID:
Objective:
Context:
Files / sources:
Ownership:
Do:
Do not:
Expected output:
Verification:
```

## Packet Rules

- Do not create packets for small one-file, docs-only, or obvious UI changes.
- Do not add packets after local implementation has already happened; verify instead.
- Keep each packet prompt shorter than the context it is supposed to save.
- Use one reviewer packet for medium work; use multiple packets only for genuinely independent tracks.
- Keep packet ownership disjoint when writes are allowed.
- Prefer read-only packets for local or weaker models.
- Give enough context to complete the packet, not the whole repo.
- Tell workers not to revert changes they did not make.
- Require evidence for claims.
- Integrate findings explicitly after packets finish.

## Useful Packets

- Codebase discovery.
- UI review.
- State logic review.
- Graph semantics review.
- Test selection.
- Documentation consistency review.
- Final verification.
