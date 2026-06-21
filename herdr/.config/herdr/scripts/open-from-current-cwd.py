#!/usr/bin/env python3
import json
import subprocess
import sys
from typing import Any


def herdr(*args: str) -> dict[str, Any]:
    return json.loads(subprocess.check_output(("herdr", *args), text=True))["result"]


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"tab", "split-right", "split-down"}:
        print("usage: open-from-current-cwd.py tab|split-right|split-down", file=sys.stderr)
        return 2

    current = herdr("pane", "current")["pane"]
    cwd = current.get("foreground_cwd") or current.get("cwd")
    if not cwd:
        cwd = subprocess.check_output(("/bin/pwd",), text=True).strip()

    action = sys.argv[1]
    if action == "tab":
        subprocess.check_call((
            "herdr",
            "tab",
            "create",
            "--workspace",
            current["workspace_id"],
            "--cwd",
            cwd,
            "--focus",
        ))
    else:
        direction = "right" if action == "split-right" else "down"
        subprocess.check_call((
            "herdr",
            "pane",
            "split",
            "--current",
            "--direction",
            direction,
            "--cwd",
            cwd,
            "--focus",
        ))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
