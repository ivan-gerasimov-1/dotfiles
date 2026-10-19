#!/usr/bin/env bash
# Prints what a check needs besides presets and rules, so an agent reads it in one call:
# the flow, how to check, the report template, the edit rules with --fix and then,
# for the single flow on Russian text, the common glossary,
# for the parallel flow, the subagent prompt.
# Usage: context.sh <ru|en> <single|parallel> [--fix]
# Exit code 2 means bad usage.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
refs=$root/references

usage() {
  echo "Usage: context.sh <ru|en> <single|parallel> [--fix]" >&2
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
  echo
}

[ $# -eq 2 ] || [ $# -eq 3 ] || usage

lang=$1
flow=$2
fix=${3:-}

case $lang in ru | en) ;; *) usage ;; esac
case $flow in single | parallel) ;; *) usage ;; esac
case $fix in "" | --fix) ;; *) usage ;; esac

body "$refs/flows/$flow.md"
body "$refs/checking.md"
body "$refs/report.md"
[ -z "$fix" ] || body "$refs/fix.md"

if [ "$flow" = parallel ]; then
  # Subagents read the glossary and the English reading themselves.
  body "$refs/subagent-prompt.md"
elif [ "$lang" = ru ]; then
  # The common glossary covers Russian text, so English skips it.
  for glossary in "$refs"/glossary/*.md; do
    body "$glossary"
  done
fi
