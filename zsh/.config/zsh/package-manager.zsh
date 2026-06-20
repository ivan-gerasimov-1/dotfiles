# Package manager helpers

function pm_find_in_tree() {
  local dir="$PWD"

  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/pnpm-lock.yaml" ]]; then
      echo "pnpm"
      return 0
    fi

    if [[ -f "$dir/package-lock.json" ]]; then
      echo "npm"
      return 0
    fi

    if [[ -f "$dir/bun.lock" || -f "$dir/bun.lockb" ]]; then
      echo "bun"
      return 0
    fi

    dir="${dir:h}"
  done

  return 1
}

function pm_refresh() {
  local packageManager

  packageManager="$(pm_find_in_tree)" || packageManager="pnpm"

  PACKAGE_MANAGER="$packageManager"
}

autoload -Uz add-zsh-hook
add-zsh-hook chpwd pm_refresh
pm_refresh

function pm() {
  command "$PACKAGE_MANAGER" "$@"
}

function pmi() {
  case "$PACKAGE_MANAGER" in
    pnpm) command pnpm install --frozen-lockfile "$@" ;;
    npm) command npm ci "$@" ;;
    bun) command bun install "$@" ;;
    *) echo "Unknown package manager: $PACKAGE_MANAGER"; return 1 ;;
  esac
}

function pma() {
  case "$PACKAGE_MANAGER" in
    pnpm) command pnpm add --save-exact "$@" ;;
    npm) command npm install --save-exact "$@" ;;
    bun) command bun add --exact "$@" ;;
    *) echo "Unknown package manager: $PACKAGE_MANAGER"; return 1 ;;
  esac
}

function pmad() {
  case "$PACKAGE_MANAGER" in
    pnpm) command pnpm add --save-exact -D "$@" ;;
    npm) command npm install --save-exact -D "$@" ;;
    bun) command bun add --exact -d "$@" ;;
    *) echo "Unknown package manager: $PACKAGE_MANAGER"; return 1 ;;
  esac
}

function pmr() {
  command "$PACKAGE_MANAGER" run "$@"
}
