#!/usr/bin/env bash
# Prints what a fragment check needs besides the rules, so an agent reads it in one call:
# the check procedure with its rule tables, the report template and, for Russian, the common glossary.
# Usage: context.sh <ru|en>
# Exit code 2 means bad usage.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)

usage() {
  echo "Usage: context.sh <ru|en>" >&2
  exit 2
}

# File body without frontmatter.
body() {
  awk 'NR == 1 && /^---$/ { fm = 1; next }
       fm { if (/^---$/) fm = 0; next }
       { print }' "$1"
  echo
}

[ $# -eq 1 ] || usage

case $1 in
  ru)
    body "$root/references/quick-check.md"
    body "$root/references/report.md"
    for glossary in "$root"/references/glossary/*.md; do
      body "$glossary"
    done ;;

  en)
    # The common glossary covers Russian text, so English skips it.
    body "$root/references/quick-check-en.md"
    body "$root/references/report.md" ;;

  *)
    usage ;;
esac
