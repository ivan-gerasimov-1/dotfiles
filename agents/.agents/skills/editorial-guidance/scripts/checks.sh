#!/usr/bin/env bash
# Mechanical checks for the editorial-guidance rules.
# Usage: checks.sh <check> file.md
#        checks.sh --list <ru|en>   the checks that work for text in the language
# Empty output means no findings. Exit code is 0 either way; 2 means bad usage.
# Rules name their checks in the `checks` field of their frontmatter.
set -euo pipefail
# Byte-wise sort/uniq: in a UTF-8 locale macOS uniq treats different Cyrillic words as equal.
# Perl decodes UTF-8 itself (-CSD -Mutf8), so the C locale does not affect it.
export LC_ALL=C

usage() {
  cat >&2 <<'EOF'
Usage: checks.sh <check> file.md
       checks.sh --list <ru|en>

Checks, (ru) marks the ones that read only Russian text:
  hybrids          Latin glued to Cyrillic (ru)
  latin            Latin words in prose with counts and lines (ru)
  variants         Concepts written in more than one variant (ru)
  connectors       Dash and semicolon inside prose and prose table cells
  ellipsis         Ellipsis outside tables
  long-sentences   Sentences over 25 words
  file-lines       file:line references in prose and inline code
  links            Relative links to files or directories that do not exist
  contrast         «X, а не Y» and «не X, а Y», across line breaks (ru)

Helpers:
  words            Prose word count for per-1000-words thresholds
  prose            The prose the line-based checks read
EOF
  exit 2
}

all_checks="hybrids latin variants connectors ellipsis long-sentences file-lines links contrast"
ru_only="hybrids latin variants contrast"

if [ "${1:-}" = --list ]; then
  [ $# -eq 2 ] || usage
  case $2 in
    ru) tr ' ' '\n' <<< "$all_checks" ;;
    en) tr ' ' '\n' <<< "$all_checks" | grep -vxF -f <(tr ' ' '\n' <<< "$ru_only") ;;
    *) usage ;;
  esac
  exit
fi

[ $# -eq 2 ] || usage
check=$1
file=$2
[ -f "$file" ] || { echo "No such file: $file" >&2; exit 2; }

# Prose lines as "N: text": no frontmatter, no fenced code blocks (indented fences too).
prose_raw() {
  awk 'FNR == 1 && /^---[[:space:]]*$/ { fm = 1; next }
       fm { if (/^---[[:space:]]*$/) fm = 0; next }
       /^[[:space:]]*```/ { c = !c; next }
       !c { print FNR ": " $0 }' "$file"
}
# The same without inline code.
prose() { prose_raw | sed 's/`[^`]*`//g'; }

case $check in
  prose)
    prose ;;

  hybrids)
    prose | perl -CSD -Mutf8 -ne '($l) = /^(\d+):/; print "$l: $1\n" while /\b([A-Za-z][A-Za-z0-9]*-?[а-яё]+|[а-яё]+-?[A-Za-z][A-Za-z0-9]*)/g' ;;

  latin)
    # "count word (lines)", most frequent first.
    prose | perl -CSD -Mutf8 -ne '
      ($l, $t) = /^(\d+): (.*)/s or next;
      while ($t =~ /\b([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)/g) { push @{ $w{$1} }, $l if length $1 > 2 }
      END {
        for (sort { @{ $w{$b} } <=> @{ $w{$a} } || $a cmp $b } keys %w) {
          my %seen; my @lines = grep { !$seen{$_}++ } @{ $w{$_} };
          printf "%4d %s (%s)\n", scalar @{ $w{$_} }, $_, join(", ", @lines);
        }
      }' ;;

  variants)
    # Prints a concept only when it appears in two or more forms.
    prose | perl -CSD -Mutf8 -ne '
      ($l, $t) = /^(\d+): (.*)/s or next; $t = lc $t;
      while ($t =~ /(?<![\w-])(бэкенд\w*|бэк(?:а|у|ом|е)?\b|backend|фронтенд\w*|фронт(?:а|у|ом|е)?\b|frontend|downstream-[а-яё]+)/g) {
        my $f = $1; my ($g, $n);
        if    ($f =~ /^бэкенд/)   { ($g, $n) = ("бэкенд", "бэкенд") }
        elsif ($f =~ /^бэк/)      { ($g, $n) = ("бэкенд", "бэк") }
        elsif ($f eq "backend")   { ($g, $n) = ("бэкенд", "backend") }
        elsif ($f =~ /^фронтенд/) { ($g, $n) = ("фронтенд", "фронтенд") }
        elsif ($f =~ /^фронт/)    { ($g, $n) = ("фронтенд", "фронт") }
        elsif ($f eq "frontend")  { ($g, $n) = ("фронтенд", "frontend") }
        else { ($g, $n) = ("downstream", "downstream-" . substr($f, 11, 5) . "…") }  # stem drops case endings
        $h{$g}{$n}{$l} = 1;
      }
      END {
        for my $g (sort keys %h) {
          next if keys %{ $h{$g} } < 2;
          print "$g: ", join("; ", map { "$_ (" . join(", ", sort { $a <=> $b } keys %{ $h{$g}{$_} }) . ")" } sort keys %{ $h{$g} }), "\n";
        }
      }' ;;

  connectors)
    # Every dash and semicolon in prose, with a few words of context.
    # Skipped by design (GR003): headings, «A vs B — …» items, a bold list-item label and the dash
    # after it, a semicolon ending a list item, table separators, table cells under 6 words.
    prose | perl -CSD -Mutf8 -ne '
      ($l, $t) = /^(\d+): (.*)/s or next; chomp $t;
      next if $t =~ /^\s*#/ || $t =~ /\svs\s/ || $t =~ /^\s*\|?[\s:|-]+\|?\s*$/;
      my @spans;
      if ($t =~ /^\s*\|/) {
        while ($t =~ /([^|]+)/g) { my ($c, $s) = ($1, $-[1]); my $n = () = $c =~ /\S+/g; push @spans, [$s, length $c] if $n >= 6 }
      } else {
        my $s = $t =~ /^\s*(?:[-*]|\d+\.)\s+\*\*[^*]+\*\*(?:[.:]?\s*—)?/ ? $+[0] : 0;
        my $e = length $t;
        $e-- if $t =~ /^\s*(?:[-*]|\d+\.)\s/ && $t =~ /;\s*$/;  # list punctuation at the end of an item
        push @spans, [$s, $e - $s];
      }
      for (@spans) {
        my $seg = substr($t, $_->[0], $_->[1]);
        while ($seg =~ /—|;/g) {
          my $p = $-[0];
          my ($left)  = substr($seg, 0, $p) =~ /((?:\S+\s*){0,3})$/;
          my ($right) = substr($seg, $p + 1) =~ /^(\s*(?:\S+\s*){0,3})/;
          (my $ctx = "$left" . substr($seg, $p, 1) . "$right") =~ s/\s+/ /g;
          print "$l: …$ctx…\n";
        }
      }' ;;

  ellipsis)
    prose | grep -vE '^[0-9]+: *\|' | grep -E '\.\.\.|…' || true ;;

  long-sentences)
    # Paragraphs and list items are split into sentences; tables and headings are skipped.
    # Inline code counts as one word. Prints the line where the sentence starts.
    prose_raw | perl -CSD -Mutf8 -ne '
      our @buf;
      sub flush {
        return unless @buf;
        my ($txt, @map) = ("");
        for (@buf) { push @map, [length $txt, $_->[0]]; $txt .= $_->[1] . " " }
        @buf = ();
        my $pos = 0;
        for my $s (split /(?<=[.!?…])\s+/, $txt) {
          $pos = index($txt, $s, $pos);
          my $n = () = $s =~ /\S+/g;
          if ($n > 25) {
            my $ln = $map[0][1]; for (@map) { $ln = $_->[1] if $_->[0] <= $pos }
            (my $o = $s) =~ s/\s+/ /g; $o =~ s/ $//;
            print "$ln: $n words: $o\n";
          }
          $pos += length $s;
        }
      }
      ($l, $t) = /^(\d+): (.*)/s or next; chomp $t;
      $t =~ s/`[^`]*`/X/g;
      if ($t =~ /^\s*$/ || $t =~ /^\s*(?:#|\|)/) { flush(); next }
      if ($t =~ s/^\s*(?:[-*]|\d+\.)\s+//) { flush() }
      push @buf, [$l, $t];
      END { flush() }' ;;

  file-lines)
    # Reads inline code too: references usually sit in backticks.
    prose_raw | grep -E '[A-Za-z0-9_]\.[a-z]{2,4}:[0-9]+' || true ;;

  links)
    # Anchors are not checked: only the file or directory part of the target.
    prose | DIR=$(dirname "$file") perl -CSD -Mutf8 -ne '
      ($l, $t) = /^(\d+): (.*)/s or next;
      while ($t =~ /\]\(([^)\s]+)\)/g) {
        my $u = $1; next if $u =~ /^(?:[a-z][a-z0-9+.-]*:|#)/i;
        (my $path = $u) =~ s/#.*//;
        print "$l: $u\n" unless -e ($path =~ m{^/} ? $path : "$ENV{DIR}/$path");
      }' ;;

  contrast)
    # Reads the whole file so a construction broken by a line break is still found.
    # Frontmatter and code blocks are blanked but keep their newlines, so line numbers stay right.
    perl -CSD -Mutf8 -0777 -ne '
      s{\A(---[ \t]*\n.*?\n---[ \t]*\n)}{ $1 =~ s/[^\n]//gr }se;
      s{^([ \t]*```.*?^[ \t]*```[^\n]*)}{ $1 =~ s/[^\n]//gr }gmse;
      s/`[^`\n]*`//g;
      # Context words stay on the same line; only the construction itself may span lines.
      # The trailing context is a lookahead, so it never swallows the next match.
      while (/((?:\S+[ \t]+){0,3})(\S*,\s*а\s+не\b|\b[Нн]е\s+[^,.]{1,40},\s*а\b(?!\s+(?:также|значит)\b))(?=((?:[ \t]*\S+){0,3}))/g) {
        ($m, $l) = ("$1$2$3", 1 + (substr($_, 0, $-[2]) =~ tr/\n//));
        $m =~ s/\s+/ /g; print "$l: …$m…\n";
      }' "$file" ;;

  words)
    # Prose words only: markup tokens, table separators, frontmatter and code blocks are not counted.
    prose_raw | perl -CSD -Mutf8 -ne '
      s/^\d+: //; next if /^\s*\|?[\s:|-]+\|?\s*$/;
      s/`[^`]*`/X/g; s/\*\*|__|[#>|]//g; s/^\s*(?:[-*]|\d+\.)\s+//;
      $n += grep { /[\p{L}\p{N}]/ } split;
      END { print $n + 0, "\n" }' ;;

  *)
    usage ;;
esac
