#!/usr/bin/env bash
# Prints the rules behind presets and rule IDs in one go, so an agent reads them in one call.
# Usage: rules.sh <ru|en> <selector>...   print the selected rules for the language, in ID order, without frontmatter
#        rules.sh <ru|en> --fragment [<selector>...]   only rules a fragment check applies
#        rules.sh <ru|en> --ids <selector>...   print only the rule IDs
#        rules.sh --check   check that presets, the fragment list and rule files agree
# A selector is a preset name (references/presets/<name>.md) or a rule ID such as P012.
# A rule applies to a language when its frontmatter `languages` lists it.
# No selectors after --fragment means the recommended preset.
# Exit code 2 means bad usage or an unknown selector.
set -euo pipefail
export LC_ALL=C

root=$(cd "$(dirname "$0")/.." && pwd)
rules_dir=$root/references/rules
presets_dir=$root/references/presets
fragment_file=$root/references/quick-check.md

usage() {
  cat >&2 <<'EOF'
Usage: rules.sh <ru|en> <selector>...
       rules.sh <ru|en> --fragment [<selector>...]
       rules.sh <ru|en> --ids <selector>...
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

# Languages from a rule's `languages: [ru, en]` line, one per line.
rule_languages() {
  awk 'NR == 1 && /^---$/ { fm = 1; next }
       fm && /^---$/ { exit }
       fm && /^languages: *\[.*\]$/ {
         sub(/^languages: *\[/, ""); sub(/\]$/, ""); gsub(/ /, "")
         n = split($0, langs, ",")
         for (i = 1; i <= n; i++) print langs[i]
       }' "$1"
}

all_rules() {
  find "$rules_dir" -name '[A-Z][0-9][0-9][0-9].md' -exec basename {} .md \; | sort
}

# Rule IDs whose `languages` list the language.
language_rules() {
  local lang=$1 id
  for id in $(all_rules); do
    if rule_languages "$rules_dir/$id.md" | grep -qx "$lang"; then
      echo "$id"
    fi
  done
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
  local status=0 preset id langs lang missing

  for preset in "$presets_dir"/*.md; do
    check_list "$(basename "$preset" .md)" "$preset" || status=1
  done
  check_list "fragment" "$fragment_file" || status=1

  missing=$(comm -23 <(all_rules) <(listed_rules "$presets_dir/full.md" | sort -u))
  [ -z "$missing" ] || { echo "full: missing $(echo $missing)"; status=1; }

  for id in $(all_rules); do
    langs=$(rule_languages "$rules_dir/$id.md")
    [ -n "$langs" ] || { echo "$id: no languages"; status=1; }
    for lang in $langs; do
      case $lang in
        ru | en) ;;
        *) echo "$id: unknown language $lang"; status=1 ;;
      esac
    done
  done

  return $status
}

[ $# -ge 1 ] || usage

if [ "$1" = --check ]; then
  [ $# -eq 1 ] || usage
  check
  exit
fi

lang=$1
case $lang in
  ru | en) ;;
  *) usage ;;
esac
shift
[ $# -ge 1 ] || usage

mode=document
case $1 in
  --fragment) mode=fragment; shift ;;
  --ids) mode=ids; shift ;;
  -*) usage ;;
esac

if [ $# -eq 0 ]; then
  [ $mode = fragment ] || usage
  set -- recommended
fi

selected=$(resolve "$@")
kept=$(comm -12 <(echo "$selected") <(language_rules "$lang"))

# Only IDs asked for by name are worth a note. A preset always has rules a filter drops.
asked=$(printf '%s\n' "$@" | grep -E '^[A-Z][0-9]{3}$' | sort -u || true)
skipped_lang=$(comm -23 <(echo "$asked") <(echo "$kept") | grep . || true)

skipped_fragment=
if [ $mode = fragment ]; then
  in_lang=$kept
  kept=$(comm -12 <(echo "$in_lang") <(listed_rules "$fragment_file" | sort -u))
  skipped_fragment=$(comm -12 <(echo "$asked") <(echo "$in_lang") | comm -23 - <(echo "$kept") | grep . || true)
fi

if [ $mode = ids ]; then
  [ -z "$kept" ] || echo "$kept"
else
  print_rules $kept
fi

[ -z "$skipped_lang" ] || echo "Not checked for $lang: $(echo $skipped_lang)"
[ -z "$skipped_fragment" ] || echo "Not checked on a fragment: $(echo $skipped_fragment)"
