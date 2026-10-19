# Quick check (English)

Mode for an English fragment of up to five sentences, from an editor selection
or from chat. One agent does everything, without subagents and without the
script. The sections [«Что вычитывать»](../SKILL.md#что-вычитывать) and
[«Где правила пересекаются»](../SKILL.md#где-правила-пересекаются) of SKILL.md
apply here too.

Rule IDs are the same as in [rules/](rules/), one file per rule, indexed by
[rules/slop.md](rules/slop.md) and [rules/prose.md](rules/prose.md). Those files give Russian examples, so this
file gives the English reading of each rule and the English marker lists.
When the two disagree on an example, this file wins for English text.

## Order

1. Read the rules from the table [«Applies»](#applies) for their intent, then
   the English lists below. Skip the common glossary, since it covers Russian. Read
   the project glossary if the project wires one in (see [SKILL.md](../SKILL.md)),
   for product and code terms only.
2. Check the fragment in pass order: slop first, then words, grammar and
   readability.
3. If the fragment comes from a file, edit it in place with Edit. If it comes
   in chat, return the corrected text.
4. Under the text, list the edits with rule IDs. No slop score.

## Applies

| Rule | What is checked in the fragment |
|---|---|
| A001 | a marker from [the A001 list](#a001-markers) is visible in one phrase |
| A002 | only if the fragment has a conclusion or a why |
| B001 | every contrast pivot, no density count (see [B001 forms](#b001-forms)) |
| B004 | a Russian calque or false friend (see [the B004 list](#b004-russian-calques)) |
| P001 and project glossary | code names in backticks, product terms as the glossary spells them |
| P004 | articles, question word order, it's/its, tense and verb forms |
| P005 | sentence structure, corporate-speak (see [the P005 list](#p005-corporate-speak)) |
| P006 | meta-phrases and padding inside the fragment |
| P012 | em-dash, semicolon and colon as connectors inside a sentence |
| P013 | verb instead of a nominalisation |
| P014 | metaphors (see [the P014 list](#p014-metaphors)) |
| P010, P015 | only for a table cell or a list item |

## Not applied

| Rule | Why it doesn't fit a fragment or English |
|---|---|
| A003, A004, P007 | need neighbouring sections or the whole list |
| A005 | needs the whole document to see where a detail comes from |
| B002, B003, B005, B006 | counted by density or across the whole document |
| P009 | consistency is checked across the whole document |
| P011 | links and navigation are checked across the whole document |
| P002, P003, P008, common glossary | anglicisms and hybrids in Russian text |

## English lists

### A001 markers

Each occurrence is a finding. Match case-insensitively.

- Filler openers: "it's worth noting", "it's important to note", "notably",
  "needless to say", "it goes without saying".
- Grand framing: "in today's fast-paced world", "plays a crucial role",
  "plays a pivotal role", "is an integral part of", "a testament to".
- LLM vocabulary: "delve", "leverage", "seamless", "streamline", "harness",
  "unlock", "elevate", "navigate the landscape", "tapestry". "robust" and
  "leverage" pass only when they carry a checkable claim.
- Empty intensifiers: "significantly improves", "greatly enhances",
  "highly scalable" with no number or mechanism.

### B001 forms

- "not X, but Y", "X, not Y";
- "isn't just X, it's Y", "not only X, but also Y" used as a pivot;
- "rather than X" when X is a straw man nobody proposed.

Rewrite as a direct statement. Keep the contrast when it is the claim itself.

### B004 Russian calques

- False friends: "actual" (актуальный) → "current", "up to date";
  "realize" (реализовать) → "implement"; "functional" as a noun (функционал)
  → "functionality", "features"; "control" (контроль) → "check", "monitoring";
  "exploitation" (эксплуатация) → "operation"; "perspective" (перспектива)
  → "prospects".
- Calqued phrases: "the idea is following" → "here's the idea", or state it;
  "discuss about" → "discuss"; "make a meeting" → "hold a meeting";
  "annulate" → "void", "cancel"; "overthere" → "there".
- Calqued grammar: "worth to do" → "worth doing" goes here. The rest of
  grammar goes to P004.

### P004 grammar

- Articles: missing or wrong a/an/the ("an Donor Portal", "in a first place").
  Product names usually take no article ("in Jira", not "in the Jira").
- Question word order: "How this is implemented?" → "How is this implemented?"
- it's / its.
- Tense agreement and verb forms: "I thought there is" → "I thought there was";
  "should be move" → "should be moved".

### P005 corporate-speak

Replace with the plain form or drop:

- "in order to" → "to";
- "at this point in time" → "now";
- "with regard to", "in terms of" → "about", "for", or rewrite;
- "utilize" → "use";
- "in the scope of this document" → drop.

A sentence over 25 words with three or more clauses splits into two or three.

### P012 connectors

The em-dash is the strongest English LLM marker. Inside a prose sentence,
replace it with a full stop, a comma or a conjunction. The P012 exceptions hold:
a term definition ("Snapshot — a copy of state at write time"), labels and
metadata, run-in list headings, headings, arrow notation.

### P013 verbs

- "perform validation of X" → "validate X";
- "make a decision" → "decide";
- "provides the ability to" → "lets", "can";
- "is responsible for writing" → "writes".

### P014 metaphors

"umbrella document", "north star", "landscape", "deep dive",
"single pane of glass" → say it directly: "overview", "goal", "the options",
"detailed review", "one view". An artifact's own name stays.
