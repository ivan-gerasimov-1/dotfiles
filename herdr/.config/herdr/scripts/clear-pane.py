#!/usr/bin/env python3
import json
import subprocess
from typing import Any

HERDR = "/opt/homebrew/bin/herdr"

def herdr(*args: str) -> dict[str, Any]:
    return json.loads(subprocess.check_output((HERDR, *args), text=True))["result"]


def main() -> None:
    pane_id = herdr("pane", "current")["pane"]["pane_id"]
    subprocess.check_call((HERDR, "pane", "send-keys", pane_id, "ctrl+l"))


if __name__ == "__main__":
    main()
