# zsh
## Completion

autoload -Uz compinit
compinit -C -d "$XDG_CACHE_HOME/zsh/.zcompdump"

## History
HISTFILE="$XDG_STATE_HOME/zsh/.zsh_history"
HISTSIZE=10000
SAVEHIST=10000

setopt SHARE_HISTORY
setopt HIST_IGNORE_ALL_DUPS
setopt HIST_IGNORE_SPACE
setopt HIST_REDUCE_BLANKS
setopt HIST_VERIFY

# 3rd party tools config

# fzf
source <(fzf --zsh)

# zoxide
eval "$(zoxide init zsh)"

# Starship
eval "$(starship init zsh)"

# Worktrunk
eval "$(wt config shell init zsh)"

# fnm
eval "$(fnm env --use-on-cd --version-file-strategy=recursive --log-level=error)"

# User config
source "$XDG_CONFIG_HOME/zsh/package-manager.zsh"

## Aliases

### Brew
alias brew:update="brew update && brew outdated"
alias brew:cleanup="brew autoremove && brew cleanup --prune=all"
alias brew:why="brew uses --installed --recursive"

### PI
alias pi='pi --tools read,bash,edit,write,grep,find,ls,question --offline'
alias pir='pi --tools read,grep,find,ls --offline'

### Lazygit
alias lg="lazygit"

### nvim
alias vi="nvim"

### eza
alias ls="eza -a --color=never --oneline --show-symlinks"
alias tree="eza -a --tree --group-directories-first --level 2 --color=never --show-symlinks"
