#!/usr/bin/env bash
# Prints presets and rules in one go, so an agent reads them in one call.
# Usage: rules.sh <ru|en> [<selector>...]   preset notes, then the selected rules for the language
#        rules.sh <ru|en> --notes [<selector>...]   only the preset notes
#        rules.sh <ru|en> --groups [<selector>...]   the plain rules and groups to run, one per line
#        rules.sh <ru|en> --ids [<selector>...]   only the rule IDs, in run order
#        rules.sh <ru|en> --checks [<selector>...]   the mechanical checks of the selected rules
#        rules.sh --check   check that presets and rule files agree
# A selector is a preset name (references/presets/<name>.md) or a rule ID such as GR003.
# No selectors means the recommended preset.
#
# Preset frontmatter holds either `rules: [..]`, plain rules, or `groups`, rules split
# into titled groups, and may add `extends: [..]`, other presets one level deep. Rules
# run in this order: plain rules, then groups. In each part the preset's own come
# first, then those of the presets it extends, in order. The selectors work as a
# preset that extends the named presets and has the named rule IDs as plain rules.
# A group runs whole and once. A plain rule runs once and drops out when a group to
# run holds it. A rule lists its languages in `languages: [ru, en]`, names its
# category, one of references/categories.md, and may name its scripts/checks.sh
# checks in `checks: [..]`. The description is Russian and holds for every language.
# Examples and lists for one language go in its section at the end, `## ru` or `## en`.
# A section is optional, but its language must be in `languages`.
# Exit code 2 means bad usage or an unknown selector.
set -euo pipefail
export LC_ALL=C

root=$(cd "$(dirname "$0")/.." && pwd)
rules_dir=$root/references/rules
presets_dir=$root/references/presets
categories_file=$root/references/categories.md
checks_script=$root/scripts/checks.sh

usage() {
  cat >&2 <<'EOF'
Usage: rules.sh <ru|en> [<selector>...]
       rules.sh <ru|en> --notes [<selector>...]
       rules.sh <ru|en> --groups [<selector>...]
       rules.sh <ru|en> --ids [<selector>...]
       rules.sh <ru|en> --checks [<selector>...]
       rules.sh --check

A selector is a preset name (recommended, light, prose, slop, full) or a rule ID such as GR003.
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

# Groups of a preset, one per line: number, tab, title, tab, space-separated rule IDs.
preset_groups() {
  awk 'NR == 1 && /^---$/ { fm = 1; next }
       fm && /^---$/ { exit }
       fm && /^groups:/ { inside = 1; next }
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

# Plain rules of a preset: its own `rules`, then those of the presets it extends.
plain_rules() {
  local file parent
  file=$(preset_file "$1")
  fm_list "$file" rules
  for parent in $(fm_list "$file" extends); do
    fm_list "$(preset_file "$parent")" rules
  done
}

# Groups of a preset, as "<preset>\t<number>\t<title>\t<IDs>": its own, then those of
# the presets it extends.
all_groups() {
  local name
  for name in "$1" $(fm_list "$(preset_file "$1")" extends); do
    preset_groups "$(preset_file "$name")" | awk -v name="$name" '{ print name "\t" $0 }'
  done
}

# Every rule ID of a preset, duplicates kept.
preset_rules() {
  plain_rules "$1"
  all_groups "$1" | cut -f4 | tr ' ' '\n' | grep . || true
}

# Rule IDs from the input that have a reading for the language, in input order.
in_language() {
  grep -Fx -f <(echo "$lang_rules") || true
}

# Groups to run for the selectors, in the all_groups format. Each group runs once,
# cut to the rules of the language. A group left empty drops out.
plan_groups() {
  local selector preset number title ids
  for selector in "$@"; do
    if is_preset "$selector"; then
      all_groups "$selector"
    fi
  done | awk -F '\t' '!seen[$1 FS $2]++' | while IFS=$'\t' read -r preset number title ids; do
    ids=$(tr ' ' '\n' <<< "$ids" | in_language | paste -sd ' ' -)
    [ -z "$ids" ] || printf '%s\t%s\t%s\t%s\n' "$preset" "$number" "$title" "$ids"
  done
}

# Plain rules to run: rule IDs named in the selectors, then the presets' plain rules.
# Each runs once, only in the language and only when no group to run holds it.
plan_rules() {
  local selector
  {
    for selector in "$@"; do
      if is_rule "$selector"; then
        echo "$selector"
      fi
    done
    for selector in "$@"; do
      if is_preset "$selector"; then
        plain_rules "$selector"
      fi
    done
  } | GROUPED=$(cut -f4 <<< "$groups") awk '
    BEGIN { n = split(ENVIRON["GROUPED"], ids, /[ \n]+/); for (i = 1; i <= n; i++) grouped[ids[i]] }
    !($0 in grouped) && !seen[$0]++' | in_language
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

# Bodies of the selected presets and the presets they extend, each once. A preset with
# groups gets the list of its groups from the frontmatter, under its "## Группы"
# heading or at the end, so the text never repeats the frontmatter by hand.
print_notes() {
  local selector name file groups
  for selector in "$@"; do
    if is_preset "$selector"; then
      preset_chain "$selector"
    fi
  done | awk '!seen[$0]++' | while read -r name; do
    file=$(preset_file "$name")
    groups=$(preset_groups "$file" | awk -F '\t' '{ gsub(/ /, ", ", $3); print $1 ". " $2 ": " $3 }')
    body "$file" | GROUP_LIST=$groups awk '
      BEGIN { groups = ENVIRON["GROUP_LIST"] }
      /^## Группы$/ && groups != "" { print; print ""; print groups; printed = 1; next }
      { print }
      END { if (!printed && groups != "") { print ""; print "## Группы"; print ""; print groups } }'
    echo
  done
}

# Rule text for the language: the description, plus the `## <lang>` section.
# Sections of other languages are left out.
rule_text() {
  body "$1" | awk -v lang="$2" '
    /^## [a-z][a-z]$/ { skip = (substr($0, 4) != lang); if (skip) next }
    /^## / && !/^## [a-z][a-z]$/ { skip = 0 }
    !skip { print }' | awk 'NF { while (blanks > 0) { print ""; blanks-- } print; next } { blanks++ }'
}

print_rules() {
  local id
  for id in "$@"; do
    rule_text "$rules_dir/$id.md" "$lang"
    echo
  done
}

# Plain rules and groups to run, one per line, as "<preset> <number> <title>: <IDs>".
# Plain rules come first, on one line with "-" for the preset and the number.
print_groups() {
  [ -z "$plain" ] || echo "- - Отдельные правила: $(echo $plain)"
  [ -z "$groups" ] || awk -F '\t' '{ print $1 " " $2 " " $3 ": " $4 }' <<< "$groups"
}

# Mechanical checks of the kept rules that work for the language, one per line as
# "<check>: <rule IDs>", in the order the rules run.
print_checks() {
  local id check
  for id in $kept; do
    for check in $(fm_list "$rules_dir/$id.md" checks); do
      echo "$check $id"
    done
  done | KNOWN=$("$checks_script" --list "$lang") awk '
    BEGIN { n = split(ENVIRON["KNOWN"], names, "\n"); for (i = 1; i <= n; i++) known[names[i]] }
    $1 in known { if (!($1 in ids)) order[++count] = $1; ids[$1] = ids[$1] " " $2 }
    END { for (i = 1; i <= count; i++) print order[i] ":" ids[order[i]] }'
}

check() {
  local status=0 file name parent id ids langs lang sections category others repeated missing
  local known check used unused
  known=$( { "$checks_script" --list ru; "$checks_script" --list en; } | sort -u)

  for file in "$presets_dir"/*.md; do
    name=$(basename "$file" .md)
    [ "$(fm_value "$file" id)" = "$name" ] || { echo "$name: id does not match the file name"; status=1; }
    if [ -n "$(fm_list "$file" rules)" ] && [ -n "$(preset_groups "$file")" ]; then
      echo "$name: has both rules and groups"; status=1
    fi
    for parent in $(fm_list "$file" extends); do
      if ! is_preset "$parent"; then
        echo "$name: extends unknown preset $parent"; status=1
      elif [ -n "$(fm_list "$(preset_file "$parent")" extends)" ]; then
        echo "$name: extends $parent, which extends another preset"; status=1
      fi
    done
    ids=$(preset_rules "$name")
    [ -n "$ids" ] || { echo "$name: no rules"; status=1; }
    for id in $ids; do
      [ -f "$rules_dir/$id.md" ] || { echo "$name: no rule file for $id"; status=1; }
    done
    repeated=$( { fm_list "$file" rules; preset_groups "$file" | cut -f3 | tr ' ' '\n'; } | grep . | sort | uniq -d || true)
    [ -z "$repeated" ] || { echo "$name: lists $(echo $repeated) more than once"; status=1; }
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
    sections=$(grep -E '^## [a-z]{2}$' "$file" | cut -c4- || true)
    for lang in $(sort -u <<< "$sections"); do
      grep -qx "$lang" <<< "$langs" || { echo "$id: has a ## $lang section but does not list $lang"; status=1; }
    done
    repeated=$(sort <<< "$sections" | uniq -d)
    [ -z "$repeated" ] || { echo "$id: more than one ## section for $(echo $repeated)"; status=1; }

    [ "$(fm_value "$file" id)" = "$id" ] || { echo "$id: id does not match the file name"; status=1; }

    # Rules stay independent: each one states its own boundaries by content.
    others=$(body "$file" | grep -oE '[A-Z]{2}[0-9]{3}' | grep -vx "$id" | sort -u || true)
    [ -z "$others" ] || { echo "$id: mentions other rules $(echo $others)"; status=1; }

    category=$(fm_value "$file" category)
    fm_list "$categories_file" categories | grep -qx "$category" ||
      { echo "$id: category ${category:-is missing} is not in categories.md"; status=1; }
    [ "${id:0:2}" = "$(tr '[:lower:]' '[:upper:]' <<< "${category:0:2}")" ] ||
      { echo "$id: prefix does not match category $category"; status=1; }

    for check in $(fm_list "$file" checks); do
      grep -qxF "$check" <<< "$known" || { echo "$id: unknown check $check"; status=1; }
    done
  done

  used=$(for id in $(all_rules); do fm_list "$rules_dir/$id.md" checks; done | sort -u)
  unused=$(comm -23 <(echo "$known") <(echo "$used"))
  [ -z "$unused" ] || { echo "checks.sh: no rule names $(echo $unused)"; status=1; }

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
  --groups) mode=groups; shift ;;
  --ids) mode=ids; shift ;;
  --checks) mode=checks; shift ;;
  -*) usage ;;
esac

[ $# -ge 1 ] || set -- recommended

for selector in "$@"; do
  is_rule "$selector" || is_preset "$selector" || { echo "Unknown selector: $selector" >&2; exit 2; }
done

lang_rules=$(language_rules "$lang")
groups=$(plan_groups "$@")
plain=$(plan_rules "$@")
# Rules in run order: plain rules, then the rules of each group, each once.
kept=$( { echo "$plain"; cut -f4 <<< "$groups" | tr ' ' '\n'; } | grep . | awk '!seen[$0]++' || true)

# Only IDs asked for by name are worth a note. A preset always has rules the language filter drops.
asked=$(printf '%s\n' "$@" | grep -E '^[A-Z]{2}[0-9]{3}$' | sort -u || true)
skipped=$(comm -23 <(echo "$asked") <(sort <<< "$kept") | grep . || true)

case $mode in
  rules)
    print_notes "$@"
    print_rules $kept ;;
  notes)
    print_notes "$@" ;;
  groups)
    print_groups ;;
  ids)
    [ -z "$kept" ] || echo "$kept" ;;
  checks)
    print_checks ;;
esac

[ -z "$skipped" ] || echo "Not checked for $lang: $(echo $skipped)"
