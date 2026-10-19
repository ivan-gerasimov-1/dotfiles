#!/usr/bin/env bash
# Prints presets and rules in one go, so an agent reads them in one call.
# Usage: rules.sh <ru|en> [<selector>...]   preset notes, then the selected rules for the language
#        rules.sh <ru|en> --notes [<selector>...]   only the preset notes
#        rules.sh <ru|en> --passes [<selector>...]   the passes that hold selected rules, one per line
#        rules.sh <ru|en> --ids [<selector>...]   only the rule IDs
#        rules.sh --check   check that presets and rule files agree
# A selector is a preset name (references/presets/<name>.md) or a rule ID such as GR003.
# No selectors means the recommended preset.
#
# Preset frontmatter: `rules: [..]` lists rules, `extends: [..]` adds other presets,
# `passes` splits the preset's rules into passes. Every rule sits in exactly one pass
# of one preset. A rule lists its languages in `languages: [ru, en]` and names its
# category, one of references/categories.md.
# Exit code 2 means bad usage or an unknown selector.
set -euo pipefail
export LC_ALL=C

root=$(cd "$(dirname "$0")/.." && pwd)
rules_dir=$root/references/rules
presets_dir=$root/references/presets
categories_file=$root/references/categories.md

usage() {
  cat >&2 <<'EOF'
Usage: rules.sh <ru|en> [<selector>...]
       rules.sh <ru|en> --notes [<selector>...]
       rules.sh <ru|en> --passes [<selector>...]
       rules.sh <ru|en> --ids [<selector>...]
       rules.sh --check

A selector is a preset name (recommended, prose, slop, fragment, full) or a rule ID such as GR003.
EOF
  exit 2
}

# File body without frontmatter, HTML comments and blank lines at either end.
body() {
  awk 'NR == 1 && /^---$/ { fm = 1; next }
       fm { if (/^---$/) fm = 0; next }
       /^<!--/ { comment = 1 }
       comment { if (/-->$/) comment = 0; next }
       /^$/ { if (started) blanks++; next }
       { while (blanks > 0) { print ""; blanks-- } started = 1; print }' "$1"
}

# Items of a top-level `key: [a, b]` line in a file's frontmatter, one per line.
fm_list() {
  awk -v key="$2" 'NR == 1 && /^---$/ { fm = 1; next }
       fm && /^---$/ { exit }
       fm && index($0, key ": [") == 1 {
         sub(/^[^[]*\[/, ""); sub(/\].*$/, ""); gsub(/ /, "")
         n = split($0, items, ",")
         for (i = 1; i <= n; i++) if (items[i] != "") print items[i]
       }' "$1"
}

# Value of a top-level `key: value` line in a file's frontmatter.
fm_value() {
  awk -v key="$2" 'NR == 1 && /^---$/ { fm = 1; next }
       fm && /^---$/ { exit }
       fm && index($0, key ": ") == 1 { print substr($0, length(key) + 3); exit }' "$1"
}

# Passes of a preset, one per line: number, tab, title, tab, space-separated rule IDs.
preset_passes() {
  awk 'NR == 1 && /^---$/ { fm = 1; next }
       fm && /^---$/ { exit }
       fm && /^passes:/ { inside = 1; next }
       fm && /^[^ ]/ { inside = 0 }
       inside && /^  - title:/ {
         n++; t = $0; sub(/^  - title: *"?/, "", t); sub(/"$/, "", t); title[n] = t
       }
       inside && /^    rules: *\[/ {
         r = $0; sub(/^[^[]*\[/, "", r); sub(/\].*$/, "", r); gsub(/, */, " ", r); ids[n] = r
       }
       END { for (i = 1; i <= n; i++) printf "%d\t%s\t%s\n", i, title[i], ids[i] }' "$1"
}

preset_file() {
  echo "$presets_dir/$1.md"
}

is_rule() {
  [[ $1 =~ ^[A-Z]{2}[0-9]{3}$ ]] && [ -f "$rules_dir/$1.md" ]
}

is_preset() {
  [[ $1 =~ ^[a-z][a-z0-9-]*$ ]] && [ -f "$(preset_file "$1")" ]
}

# The preset and the presets it extends, extended ones first. Extends go one level deep.
preset_chain() {
  local parent
  for parent in $(fm_list "$(preset_file "$1")" extends); do
    echo "$parent"
  done
  echo "$1"
}

# Rule IDs of a preset: extended presets first, then each preset's own passes, then
# its `rules`. Passes go first so the preset's own passes run before borrowed ones.
preset_rules() {
  local name file
  for name in $(preset_chain "$1"); do
    file=$(preset_file "$name")
    preset_passes "$file" | cut -f3 | tr ' ' '\n' | grep . || true
    fm_list "$file" rules
  done
}

# Selected rule IDs in selector order, duplicates kept.
expand() {
  local selector
  for selector in "$@"; do
    if is_rule "$selector"; then
      echo "$selector"
    else
      preset_rules "$selector"
    fi
  done
}

all_rules() {
  find "$rules_dir" -name '[A-Z][A-Z][0-9][0-9][0-9].md' -exec basename {} .md \; | sort
}

# Rule IDs whose `languages` list the language.
language_rules() {
  local id
  for id in $(all_rules); do
    if fm_list "$rules_dir/$id.md" languages | grep -qx "$1"; then
      echo "$id"
    fi
  done
}

# Bodies of the selected presets and the presets they extend, each once.
print_notes() {
  local selector name
  for selector in "$@"; do
    if is_preset "$selector"; then
      preset_chain "$selector"
    fi
  done | awk '!seen[$0]++' | while read -r name; do
    body "$(preset_file "$name")"
    echo
  done
}

print_rules() {
  local id
  for id in "$@"; do
    body "$rules_dir/$id.md"
    echo
  done
}

# Every rule placed in a pass, as "<rule ID> <preset>", one per line.
pass_owners() {
  local file
  for file in "$presets_dir"/*.md; do
    preset_passes "$file" | cut -f3 | tr ' ' '\n' | grep . | sed "s/\$/ $(basename "$file" .md)/" || true
  done
}

# Passes that hold kept rules, as "<preset> <number> <title>: <IDs>". Presets go in
# the order their rules first appear in the selectors, so `full` runs slop first.
print_passes() {
  local kept=$1 owner number title ids
  shift
  expand "$@" | awk 'NR == FNR { owner[$1] = $2; next } $1 in owner { print owner[$1] }' \
    <(pass_owners) - | awk '!seen[$0]++' | while read -r owner; do
    preset_passes "$(preset_file "$owner")" | while IFS=$'\t' read -r number title ids; do
      ids=$(comm -12 <(tr ' ' '\n' <<< "$ids" | sort) <(echo "$kept") | tr '\n' ' ')
      [ -z "$ids" ] || echo "$owner $number $title: ${ids% }"
    done
  done
}

check() {
  local status=0 file name parent id langs lang category others count missing

  for file in "$presets_dir"/*.md; do
    name=$(basename "$file" .md)
    [ "$(fm_value "$file" id)" = "$name" ] || { echo "$name: id does not match the file name"; status=1; }
    for parent in $(fm_list "$file" extends); do
      if ! is_preset "$parent"; then
        echo "$name: extends unknown preset $parent"; status=1
      elif [ -n "$(fm_list "$(preset_file "$parent")" extends)" ]; then
        echo "$name: extends $parent, which extends another preset"; status=1
      fi
    done
    [ -n "$(preset_rules "$name")" ] || { echo "$name: no rules"; status=1; }
    for id in $(preset_rules "$name"); do
      [ -f "$rules_dir/$id.md" ] || { echo "$name: no rule file for $id"; status=1; }
    done
  done

  for id in $(all_rules); do
    file=$rules_dir/$id.md
    langs=$(fm_list "$file" languages)
    [ -n "$langs" ] || { echo "$id: no languages"; status=1; }
    for lang in $langs; do
      case $lang in
        ru | en) ;;
        *) echo "$id: unknown language $lang"; status=1 ;;
      esac
    done

    [ "$(fm_value "$file" id)" = "$id" ] || { echo "$id: id does not match the file name"; status=1; }

    # Rules stay independent: how they relate lives in checking.md and the presets.
    others=$(body "$file" | grep -oE '[A-Z]{2}[0-9]{3}' | grep -vx "$id" | sort -u || true)
    [ -z "$others" ] || { echo "$id: mentions other rules $(echo $others)"; status=1; }

    category=$(fm_value "$file" category)
    fm_list "$categories_file" categories | grep -qx "$category" ||
      { echo "$id: category ${category:-is missing} is not in categories.md"; status=1; }
    [ "${id:0:2}" = "$(tr '[:lower:]' '[:upper:]' <<< "${category:0:2}")" ] ||
      { echo "$id: prefix does not match category $category"; status=1; }

    count=$(pass_owners | awk -v id="$id" '$1 == id' | wc -l | tr -d ' ')
    [ "$count" = 1 ] || { echo "$id: in $count passes, must be in one"; status=1; }
  done

  missing=$(comm -23 <(all_rules) <(preset_rules full | sort -u))
  [ -z "$missing" ] || { echo "full: missing $(echo $missing)"; status=1; }

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

mode=rules
case ${1:-} in
  --notes) mode=notes; shift ;;
  --passes) mode=passes; shift ;;
  --ids) mode=ids; shift ;;
  -*) usage ;;
esac

[ $# -ge 1 ] || set -- recommended

for selector in "$@"; do
  is_rule "$selector" || is_preset "$selector" || { echo "Unknown selector: $selector" >&2; exit 2; }
done

kept=$(comm -12 <(expand "$@" | sort -u) <(language_rules "$lang"))

# Only IDs asked for by name are worth a note. A preset always has rules the language filter drops.
asked=$(printf '%s\n' "$@" | grep -E '^[A-Z]{2}[0-9]{3}$' | sort -u || true)
skipped=$(comm -23 <(echo "$asked") <(echo "$kept") | grep . || true)

case $mode in
  rules)
    print_notes "$@"
    print_rules $kept ;;
  notes)
    print_notes "$@" ;;
  passes)
    print_passes "$kept" "$@" ;;
  ids)
    [ -z "$kept" ] || echo "$kept" ;;
esac

[ -z "$skipped" ] || echo "Not checked for $lang: $(echo $skipped)"
