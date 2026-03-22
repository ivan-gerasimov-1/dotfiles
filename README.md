# dotfiles

Personal development environment configuration. macOS, ZSH, Git with SSH signing,
and AI coding agents (Claude Code, Codex, Windsurf).

## Key decisions

**Repo structure** — the `.gitignore` uses an inverse allowlist pattern:
block everything (`*`), then explicitly unblock tracked directories.
This lets the repo live in `$HOME` without pulling in the entire home directory.

**Git signing** — commits are signed via 1Password SSH agent (`op-ssh-sign`).
Conditional includes swap identity/signing key per project directory.

**AI agents** — three coding assistants share a common behavioral core (`.agents/AGENTS.md`)
but each gets tool-specific config. Permissions are explicit allowlists —
destructive commands (`--force`, `reset --hard`, `clean -f`) are blocked.

**OpenSpec skills** — a structured workflow system for feature and bugfix
lifecycles. Skills live in `.agents/skills/` and are symlinked into
`.claude/skills/` for Claude Code.

## Dependencies

- oh-my-zsh: https://ohmyz.sh
- fnm: brew install fnm
- 1Password with SSH agent enabled

After cloning, review .gitconfig — it references local includes (~/.gitconfig_main)
that contain user identity and are not tracked.

## Not tracked

Anything sensitive or machine-specific stays out: SSH keys, shell history,
1Password config, IDE state, node_modules, credentials. The .gitignore allowlist
ensures nothing leaks by default.
