#!/bin/sh
# Claude Code statusLine command
# Mirrors robbyrussell oh-my-zsh theme: ➜ <dir> git:(branch) [dirty]
# Extended with Claude Code context info

input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
model=$(echo "$input" | jq -r '.model.display_name // ""')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Current directory basename (matches %c in robbyrussell)
dir=$(basename "$cwd")

# Git branch and dirty state
branch=""
dirty=""
if git -C "$cwd" rev-parse --git-dir > /dev/null 2>&1; then
  branch=$(git -C "$cwd" symbolic-ref --short HEAD 2>/dev/null || git -C "$cwd" rev-parse --short HEAD 2>/dev/null)
  if [ -n "$(git -C "$cwd" status --porcelain 2>/dev/null)" ]; then
    dirty=" ✗"
  fi
fi

# Colors (ANSI, will appear dimmed in status line)
cyan="\033[36m"
bold_blue="\033[1;34m"
red="\033[31m"
yellow="\033[33m"
reset="\033[0m"

# Build output — robbyrussell style: ➜  <dir>  git:(<branch>)[dirty]
if [ -n "$branch" ]; then
  git_part=$(printf " ${bold_blue}git:(${red}%s${bold_blue})${yellow}%s${reset}" "$branch" "$dirty")
else
  git_part=""
fi

dir_part=$(printf "${cyan}%s${reset}" "$dir")

# Context usage suffix
ctx_part=""
if [ -n "$used" ]; then
  used_int=$(printf "%.0f" "$used")
  ctx_part="  ctx:${used_int}%"
fi

# Model suffix
model_part=""
if [ -n "$model" ]; then
  model_part="  $model"
fi

printf "➜  %b%b%s%s\n" "$dir_part" "$git_part" "$ctx_part" "$model_part"
