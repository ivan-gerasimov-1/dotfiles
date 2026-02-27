# ZSH Config
export ZSH="$HOME/.oh-my-zsh"

ZSH_THEME="robbyrussell"

plugins=(git)

source $ZSH/oh-my-zsh.sh

# User config

## fnm
### Autoload .nvmrc
eval "$(fnm env --use-on-cd --resolve-engines --version-file-strategy=recursive)"

## Brew
alias brew:fresh="brew update && brew upgrade --greedy && brew cleanup --prune=all"
alias brew:cleanup="brew autoremove && brew cleanup --prune=all"
alias brew:why="brew uses --installed --recursive"

## Windsurf
export PATH="/Users/ivan/.codeium/windsurf/bin:$PATH"

## SpecKit
export PATH="$HOME/.local/bin:$PATH"

## OpenSpec
fpath=("/Users/ivan/.oh-my-zsh/custom/completions" $fpath)
autoload -Uz compinit
compinit
