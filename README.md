# dotfiles

Personal development environment configuration. macOS, ZSH, Git with SSH signing,
and AI coding agents (Claude Code, Codex, Windsurf).

## What's here

~
├── .zshrc # ZSH + oh-my-zsh, fnm, brew aliases
├── .gitconfig # Git with 1Password SSH signing, conditional includes
├── .gitignore # Inverse allowlist for this repo ├── .gitignore_global # System-wide ignores (.DS_Store, .swp)
│ ├── .claude/
│ ├── CLAUDE.md # Global agent behavior & principles
│ ├── settings.json # Permissions, allowed domains, model config
│ ├── statusline-command.sh
│ └── skills/ # → symlink to .agents/skills │
├── .agents/ │ ├── AGENTS.md # Shared agent behavior guide
│ └── skills/ # OpenSpec workflow skills (17 skills) │ ├── feature-lifecycle/
│ ├── feature-plan/ │ ├── feature-implement/
│ ├── feature-close/ │ ├── bugfix-lifecycle/
│ ├── openspec-/ # explore, apply, verify, ff, archive, sync │ ├── frontend-design/
│ └── teammate-code-reviewer/ │
├── .codex/ │ ├── config.toml # GPT-5.4, xhigh reasoning, multi-agent
│ ├── AGENTS.md │ └── rules/default.rules # Command permissions
│ └── .codeium/windsurf/
├── memories/global_rules.md └── windsurf/workflows/review.md

## Key decisions

**Repo structure** — the `.gitignore` uses an inverse allowlist pattern: block

everything (`*`), then explicitly unblock tracked directories. This lets the repo live in `$HOME` without pulling in the entire home directory.
**Git signing** — commits are signed via 1Password SSH agent (`op-ssh-sign`). Conditional includes swap identity/signing key per project directory.

**AI agents** — three coding assistants share a common behavioral core

(`.agents/AGENTS.md`) but each gets tool-specific config. Permissions are explicit
allowlists — destructive commands (`--force`, `reset --hard`, `clean -f`) are
blocked.

**OpenSpec skills** — a structured workflow system for feature and bugfix
lifecycles. Skills live in `.agents/skills/` and are symlinked into
`.claude/skills/` for Claude Code.

## Setup

```sh
# Clone into home directory
git clone git@github.com:ivan-gerasimov-1/dotfiles.git ~/dotfiles-tmp
cp -r ~/dotfiles-tmp/.git ~/
rm -rf ~/dotfiles-tmp
git checkout .
```

## Dependencies

- oh-my-zsh: https://ohmyz.sh
- fnm: brew install fnm
- 1Password with SSH agent enabled

After cloning, review .gitconfig — it references local includes
(~/.gitconfig_main) that contain user identity and are not tracked.

## Not tracked

Anything sensitive or machine-specific stays out: SSH keys, shell history,
1Password config, IDE state, node_modules, credentials. The .gitignore allowlist
ensures nothing leaks by default.
```
