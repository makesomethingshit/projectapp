#!/usr/bin/env python3
"""Summarize packet result files for integration."""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: collect_results.py .workflow/<slug>", file=sys.stderr)
        return 2

    root = Path(sys.argv[1])
    results = root / "results"
    if not results.is_dir():
        print(f"ERROR: missing results directory: {results}", file=sys.stderr)
        return 1

    files = sorted(path for path in results.iterdir() if path.is_file())
    print("# Integration Checklist")
    print()
    if not files:
        print("- No packet result files found.")
        return 0

    for path in files:
        print(f"- [ ] Review `{path.as_posix()}`")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
