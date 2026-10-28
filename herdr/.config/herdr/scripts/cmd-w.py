#!/usr/bin/env python3
"""Smart Cmd+W handler for Herdr.

Behavior:
- Multiple panes in current tab: close current pane; warn first if it runs an app.
- Single-pane tab, multiple tabs in workspace: close current tab; warn first if it runs an app.
- Last pane/tab in workspace: never close it; replace with a fresh pane. Warn first if it runs an app.
"""

import json
import os
import subprocess
import tempfile
import time
from typing import Any

CONFIRM_SECONDS = 2
STATE_FILE = os.path.join(tempfile.gettempdir(), f"herdr-cmd-w-{os.getuid()}.json")
HERDR = os.environ.get("HERDR_BIN_PATH") or "/opt/homebrew/bin/herdr"


def herdr(*args: str) -> dict[str, Any]:
    return json.loads(subprocess.check_output((HERDR, *args), text=True))["result"]


def notify(title: str, body: str) -> None:
    subprocess.run(
        (
            HERDR,
            "notification",
            "show",
            title,
            "--body",
            body,
            "--position",
            "bottom-right",
            "--sound",
            "none",
        ),
        check=False,
    )


def process_info(pane_id: str) -> dict[str, Any]:
    return herdr("pane", "process-info", "--pane", pane_id)["process_info"]


def pane_has_app(info: dict[str, Any]) -> bool:
    """True when foreground process is not the pane shell itself."""
    shell_pid = info.get("shell_pid")
    return any(
        proc.get("pid") != shell_pid
        for proc in info.get("foreground_processes") or []
    )


def pane_busy(pane_id: str) -> bool:
    # Conservative on API errors: warn instead of closing/replacing blindly.
    try:
        return pane_has_app(process_info(pane_id))
    except Exception:
        return True


def warned_recently(target: str) -> bool:
    try:
        with open(STATE_FILE) as file:
            state = json.load(file)
    except Exception:
        return False

    return (
        state.get("target") == target
        and time.time() - state.get("time", 0) <= CONFIRM_SECONDS
    )


def warn_once(target: str, title: str, body: str) -> None:
    with open(STATE_FILE, "w") as file:
        json.dump({"target": target, "time": time.time()}, file)
    notify(title, body)


def run_after_warning(
    *,
    target: str,
    busy: bool,
    command: tuple[str, ...],
    title: str,
    action: str,
) -> None:
    if not busy or warned_recently(target):
        subprocess.check_call(command)
        return

    warn_once(target, title, f"Press Cmd+W again within {CONFIRM_SECONDS}s to {action}.")


def replace_pane(pane_id: str) -> None:
    """Replace the last pane with a fresh shell, preserving cwd.

    Herdr has no native pane reset command. Creating a fresh split, focusing it,
    then closing the old pane gives clean scrollback and avoids shell/job-control
    messages left by sending `exec $SHELL` into the terminal.
    """
    pane = herdr("pane", "get", pane_id)["pane"]
    cwd = (
        pane.get("foreground_cwd")
        or pane.get("cwd")
        or os.path.expanduser("~")
    )

    subprocess.check_call(
        (
            HERDR,
            "pane",
            "split",
            pane_id,
            "--direction",
            "right",
            "--cwd",
            cwd,
            "--focus",
        )
    )
    subprocess.check_call((HERDR, "pane", "close", pane_id))


def active_ids() -> tuple[str, str, str]:
    """Pane, tab and workspace ids of the focused pane.

    Herdr passes them to custom commands as HERDR_ACTIVE_*; fall back to
    `pane current` when the script runs outside a key binding.
    """
    pane_id = os.environ.get("HERDR_ACTIVE_PANE_ID")
    tab_id = os.environ.get("HERDR_ACTIVE_TAB_ID")
    workspace_id = os.environ.get("HERDR_ACTIVE_WORKSPACE_ID")
    if pane_id and tab_id and workspace_id:
        return pane_id, tab_id, workspace_id

    current = herdr("pane", "current")["pane"]
    return current["pane_id"], current["tab_id"], current["workspace_id"]


def main() -> None:
    pane_id, tab_id, workspace_id = active_ids()

    if herdr("tab", "get", tab_id)["tab"]["pane_count"] > 1:
        run_after_warning(
            target=f"pane:{pane_id}",
            busy=pane_busy(pane_id),
            command=(HERDR, "pane", "close", pane_id),
            title="Pane has a running process",
            action="close it",
        )
        return

    if herdr("workspace", "get", workspace_id)["workspace"]["tab_count"] > 1:
        run_after_warning(
            target=f"tab:{tab_id}",
            busy=pane_busy(pane_id),
            command=(HERDR, "tab", "close", tab_id),
            title="Tab has a running process",
            action="close it",
        )
        return

    # Last pane in the last tab: never close it. Replace with a fresh pane.
    info = process_info(pane_id)
    target = f"last-pane:{pane_id}"
    if pane_has_app(info) and not warned_recently(target):
        warn_once(
            target,
            "Last pane has a running process",
            f"Press Cmd+W again within {CONFIRM_SECONDS}s to reload it. We will not close the last pane.",
        )
        return

    replace_pane(pane_id)
    notify("Not closing last pane", "Created a fresh pane instead.")


if __name__ == "__main__":
    main()
