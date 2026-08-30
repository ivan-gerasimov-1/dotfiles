# Homebrew
if (( $+commands[brew] )); then
  eval "$(brew shellenv)"
elif [[ $OSTYPE == darwin* && -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ $OSTYPE == darwin* && -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
elif [[ -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# OrbStack (macOS only)
if [[ $OSTYPE == darwin* && -r $HOME/.orbstack/shell/init.zsh ]]; then
  source "$HOME/.orbstack/shell/init.zsh"
fi
