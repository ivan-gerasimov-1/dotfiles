typeset -U path PATH

# XDG
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_CACHE_HOME="$HOME/.cache"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_STATE_HOME="$HOME/.local/state"

export EDITOR="nvim"

# zsh
export ZDOTDIR="$XDG_CONFIG_HOME/zsh"

# less
export LESSHISTFILE="$XDG_STATE_HOME/less/.lesshst"

# Homebrew
export HOMEBREW_CASK_OPTS="--appdir=$HOME/Applications"

# Starship
export STARSHIP_CONFIG="$XDG_CONFIG_HOME/starship/starship.toml"

# npm
export NPM_CONFIG_CACHE="$XDG_CACHE_HOME/npm"

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
path=("$PNPM_HOME/bin" $path)

# tmux
export TMUX_CONF="$XDG_CONFIG_HOME/tmux/tmux.conf"

# PI Coding Agent
export PI_CODING_AGENT_DIR="$XDG_CONFIG_HOME/pi"
export PI_CODING_AGENT_SESSION_DIR="$XDG_STATE_HOME/pi/sessions"

# Codex
export CODEX_HOME="$XDG_STATE_HOME/codex"

# GO
export GOPATH="$XDG_DATA_HOME/go"
path=("$GOPATH/bin" $path)

# PATH
export PATH

