#!/usr/bin/env python3
"""Validate workflow artifact completeness."""

from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_FILES = ["plan.md", "state.json", "orchestration.md", "final-report.md"]
REQUIRED_DIRS = ["packets", "results"]


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: verify_workflow.py .workflow/<slug>", file=sys.stderr)
        return 2

    root = Path(sys.argv[1])
    errors: list[str] = []

    if not root.exists():
        errors.append(f"missing workflow directory: {root}")
    else:
        for name in REQUIRED_FILES:
            path = root / name
            if not path.is_file():
                errors.append(f"missing file: {path}")
        for name in REQUIRED_DIRS:
            path = root / name
            if not path.is_dir():
                errors.append(f"missing directory: {path}")

        state_path = root / "state.json"
        if state_path.exists():
            try:
                state = json.loads(state_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                errors.append(f"invalid state.json: {exc}")
            else:
                for key in ["title", "slug", "status", "packets", "verification"]:
                    if key not in state:
                        errors.append(f"state.json missing key: {key}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1

    print(f"OK: {root.as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
