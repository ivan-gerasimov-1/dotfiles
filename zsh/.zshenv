typeset -U path PATH

# XDG
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"
# Not in the XDG spec
export XDG_BIN_HOME="$HOME/.local/bin"

export EDITOR="nvim"

# zsh
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"

# less
export LESSHISTFILE="$XDG_STATE_HOME/less/.lesshst"

# Homebrew (macOS only)
if [[ $OSTYPE == darwin* ]]; then
  export HOMEBREW_CASK_OPTS="--appdir=$HOME/Applications"
  export HOMEBREW_UPGRADE_GREEDY_CASKS="orbstack 1password"
fi

# Starship
export STARSHIP_CONFIG="$XDG_CONFIG_HOME/starship/starship.toml"

# npm
export NPM_CONFIG_CACHE="$XDG_CACHE_HOME/npm"

# pnpm
if [[ $OSTYPE == darwin* ]]; then
  export PNPM_HOME="$HOME/Library/pnpm"
else
  export PNPM_HOME="$XDG_DATA_HOME/pnpm"
fi
path=("$PNPM_HOME/bin" $path)

# tmux
export TMUX_CONF="$XDG_CONFIG_HOME/tmux/tmux.conf"

# PI Coding Agent
export PI_CODING_AGENT_DIR="$XDG_CONFIG_HOME/pi"
export PI_CODING_AGENT_SESSION_DIR="$XDG_STATE_HOME/pi/sessions"

# Claude Code
export CLAUDE_CONFIG_DIR="$XDG_STATE_HOME/claude"

# Codex
export CODEX_HOME="$XDG_STATE_HOME/codex"

# Worktrunk
export WORKTRUNK_SYSTEM_CONFIG_PATH="$XDG_CONFIG_HOME/worktrunk/config.toml"
export WORKTRUNK_CONFIG_PATH="$XDG_CONFIG_HOME/worktrunk/config.local.toml"

# Local binaries
path=("$XDG_BIN_HOME" $path)

# PATH
export PATH

