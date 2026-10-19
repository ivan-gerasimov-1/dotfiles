#!/usr/bin/env bash
# Prints the rules behind presets and rule IDs in one go, so an agent reads them in one call.
# Usage: rules.sh <selector>...   print the selected rules, in ID order, without frontmatter
#        rules.sh --fragment <ru|en> [<selector>...]   only rules a fragment check applies
#        rules.sh --ids <selector>...   print only the rule IDs
#        rules.sh --check   check that presets, fragment lists and rule files agree
# A selector is a preset name (references/presets/<name>.md) or a rule ID such as P012.
# No selectors after --fragment means the recommended preset.
# Exit code 2 means bad usage or an unknown selector.
set -euo pipefail
export LC_ALL=C

root=$(cd "$(dirname "$0")/.." && pwd)
rules_dir=$root/references/rules
presets_dir=$root/references/presets

usage() {
  cat >&2 <<'EOF'
Usage: rules.sh <selector>...
       rules.sh --fragment <ru|en> [<selector>...]
       rules.sh --ids <selector>...
       rules.sh --check

A selector is a preset name (recommended, prose, slop, full) or a rule ID such as P012.
EOF
  exit 2
}

# Rule IDs listed under `rules:` in a file's frontmatter, one per line.
listed_rules() {
  awk 'NR == 1 && /^---$/ { fm = 1; next }
       fm && /^---$/ { exit }
       fm && /^  - [A-Z][0-9][0-9][0-9]$/ { print $2 }' "$1"
}

fragment_list() {
  case $1 in
    ru) echo "$root/references/quick-check.md" ;;
    en) echo "$root/references/quick-check-en.md" ;;
    *) usage ;;
  esac
}

# Expands selectors into sorted, unique rule IDs. Fails on an unknown selector.
resolve() {
  local selector
  for selector in "$@"; do
    if [[ $selector =~ ^[A-Z][0-9]{3}$ ]] && [ -f "$rules_dir/$selector.md" ]; then
      echo "$selector"
    elif [ -f "$presets_dir/$selector.md" ]; then
      listed_rules "$presets_dir/$selector.md"
    else
      echo "Unknown selector: $selector" >&2
      exit 2
    fi
  done | sort -u
}

all_rules() {
  find "$rules_dir" -name '[A-Z][0-9][0-9][0-9].md' -exec basename {} .md \; | sort
}

# Rule file body: frontmatter dropped, the "# ID. Title" heading kept.
print_rules() {
  local id
  for id in "$@"; do
    awk 'NR == 1 && /^---$/ { fm = 1; next }
         fm { if (/^---$/) fm = 0; next }
         { print }' "$rules_dir/$id.md"
    echo
  done
}

check_list() {
  local name=$1 file=$2 status=0 id
  [ -n "$(listed_rules "$file")" ] || { echo "$name: no rules"; return 1; }
  for id in $(listed_rules "$file"); do
    [ -f "$rules_dir/$id.md" ] || { echo "$name: no rule file for $id"; status=1; }
  done
  return $status
}

check() {
  local status=0 preset lang missing

  for preset in "$presets_dir"/*.md; do
    check_list "$(basename "$preset" .md)" "$preset" || status=1
  done
  for lang in ru en; do
    check_list "fragment $lang" "$(fragment_list $lang)" || status=1
  done

  missing=$(comm -23 <(all_rules) <(listed_rules "$presets_dir/full.md" | sort -u))
  [ -z "$missing" ] || { echo "full: missing $(echo $missing)"; status=1; }

  return $status
}

[ $# -ge 1 ] || usage

case $1 in
  --check)
    [ $# -eq 1 ] || usage
    check ;;

  --ids)
    shift
    [ $# -ge 1 ] || usage
    resolve "$@" ;;

  --fragment)
    [ $# -ge 2 ] || usage
    list=$(fragment_list "$2")
    shift 2
    [ $# -ge 1 ] || set -- recommended

    selected=$(resolve "$@")
    applicable=$(listed_rules "$list" | sort -u)
    print_rules $(comm -12 <(echo "$selected") <(echo "$applicable"))

    # Only IDs asked for by name are worth a note. A preset always has rules a fragment skips.
    asked=$(printf '%s\n' "$@" | grep -E '^[A-Z][0-9]{3}$' | sort -u || true)
    skipped=$(comm -23 <(echo "$asked") <(echo "$applicable") | grep . || true)
    [ -z "$skipped" ] || echo "Not checked on a fragment: $(echo $skipped)" ;;

  -*)
    usage ;;

  *)
    print_rules $(resolve "$@") ;;
esac
