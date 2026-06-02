#!/usr/bin/env python3
"""Create a local workflow artifact folder."""

from __future__ import annotations

import json
import re
import sys
from datetime import UTC, datetime
from pathlib import Path


def slugify(title: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", title.strip().lower()).strip("-")
    return slug[:64] or "workflow"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: new_workflow.py \"Task title\"", file=sys.stderr)
        return 2

    title = sys.argv[1].strip()
    slug = slugify(title)
    root = Path(".workflow") / slug
    packets = root / "packets"
    results = root / "results"
    packets.mkdir(parents=True, exist_ok=True)
    results.mkdir(parents=True, exist_ok=True)

    created = datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    files = {
        root / "plan.md": f"# {title}\n\n## Goal\n\n## Success Criteria\n\n## Work Packets\n\n## Verification\n",
        root / "orchestration.md": "# Orchestration\n\n## Sequence\n\n## Branching Rules\n\n## Integration Policy\n",
        root / "final-report.md": "# Final Report\n\n## Accepted\n\n## Rejected\n\n## Conflicts\n\n## Decisions\n\n## Verification\n\n## Remaining Risks\n",
    }
    for path, content in files.items():
        if not path.exists():
            path.write_text(content, encoding="utf-8")

    state_path = root / "state.json"
    if not state_path.exists():
        state_path.write_text(
            json.dumps(
                {
                    "title": title,
                    "slug": slug,
                    "created_at": created,
                    "status": "planned",
                    "packets": [],
                    "verification": [],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    print(root.as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
