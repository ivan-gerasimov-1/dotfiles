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
HERDR = "/opt/homebrew/bin/herdr"


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


def replace_pane(current_pane: dict[str, Any]) -> None:
    """Replace the last pane with a fresh shell, preserving cwd.

    Herdr has no native pane reset command. Creating a fresh split, focusing it,
    then closing the old pane gives clean scrollback and avoids shell/job-control
    messages left by sending `exec $SHELL` into the terminal.
    """
    pane_id = current_pane["pane_id"]
    cwd = (
        current_pane.get("foreground_cwd")
        or current_pane.get("cwd")
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


def main() -> None:
    current = herdr("pane", "current")["pane"]
    pane_id = current["pane_id"]
    tab_id = current["tab_id"]
    workspace_id = current["workspace_id"]

    tabs = herdr("tab", "list")["tabs"]
    current_tab = next((tab for tab in tabs if tab.get("tab_id") == tab_id), None)
    if current_tab is None:
        notify("Cmd+W failed", "Could not find the current tab. Nothing was closed.")
        return

    # Prefer tab.pane_count over counting pane.list manually. In key-handler
    # context pane.list can be scoped/stale in some Herdr builds, which made
    # every pane look like the only pane in its tab. Fun little footgun.
    pane_count = current_tab.get("pane_count", 1)
    if pane_count > 1:
        run_after_warning(
            target=f"pane:{pane_id}",
            busy=pane_busy(pane_id),
            command=(HERDR, "pane", "close", pane_id),
            title="Pane has a running process",
            action="close it",
        )
        return

    workspaces = herdr("workspace", "list")["workspaces"]
    current_workspace = next(
        (
            workspace
            for workspace in workspaces
            if workspace.get("workspace_id") == workspace_id
        ),
        None,
    )

    # Be defensive here. Depending on Herdr/context, either workspace.list or
    # tab.list can be narrower than expected. If both are present, use the
    # larger count so we do not mistake a normal single-pane tab for the last
    # tab and reset the pane instead of closing the tab.
    workspace_tabs = [tab for tab in tabs if tab.get("workspace_id") == workspace_id]
    listed_tab_count = len(workspace_tabs) or len(tabs)
    workspace_tab_count = current_workspace.get("tab_count", 0) if current_workspace else 0
    tab_count = max(workspace_tab_count, listed_tab_count, 1)

    if current_workspace is None and listed_tab_count <= 1:
        notify(
            "Cmd+W failed",
            "Could not confirm this is the last tab. Nothing was closed.",
        )
        return
    if tab_count > 1:
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

    replace_pane(current)
    notify("Not closing last pane", "Created a fresh pane instead.")


if __name__ == "__main__":
    main()
