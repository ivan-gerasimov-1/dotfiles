# English reading of the rules

Rule IDs are the same as in [rules/](rules/), one file per rule. Those files
give Russian examples, so this file gives the English reading of each rule that
has `en` in its `languages`, and the English marker lists. When the two
disagree on an example, this file wins for English text.

Skip the common glossary, since it covers Russian. Read the project glossary
if the project wires one in (see [SKILL.md](../SKILL.md)), for product and code
terms only.

| Rule | What is checked in English |
|---|---|
| PA001 | a marker from [the PA001 list](#pa001-markers) |
| SU001 | a conclusion or a why without a checkable claim |
| CA001 | contrast pivots (see [CA001 forms](#ca001-forms)) |
| WO001 | a Russian calque or false friend (see [the WO001 list](#wo001-russian-calques)) |
| TE001 and project glossary | code names in backticks, product terms as the glossary spells them |
| GR001 | articles, question word order, it's/its, tense and verb forms |
| ST001 | sentence structure, corporate-speak (see [the ST001 list](#st001-corporate-speak)) |
| PA003 | meta-phrases and padding |
| ST002, ST004 | a table cell or a list item |
| GR003 | em-dash, semicolon and colon as connectors inside a sentence |
| WO003 | verb instead of a nominalisation |
| WO004 | metaphors (see [the WO004 list](#wo004-metaphors)) |

## English lists

### PA001 markers

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

### CA001 forms

- "not X, but Y", "X, not Y";
- "isn't just X, it's Y", "not only X, but also Y" used as a pivot;
- "rather than X" when X is a straw man nobody proposed.

Rewrite as a direct statement. Keep the contrast when it is the claim itself.

### WO001 Russian calques

- False friends: "actual" (актуальный) → "current", "up to date";
  "realize" (реализовать) → "implement"; "functional" as a noun (функционал)
  → "functionality", "features"; "control" (контроль) → "check", "monitoring";
  "exploitation" (эксплуатация) → "operation"; "perspective" (перспектива)
  → "prospects".
- Calqued phrases: "the idea is following" → "here's the idea", or state it;
  "discuss about" → "discuss"; "make a meeting" → "hold a meeting";
  "annulate" → "void", "cancel"; "overthere" → "there".
- Calqued grammar: "worth to do" → "worth doing" goes here. The rest of
  grammar goes to GR001.

### GR001 grammar

- Articles: missing or wrong a/an/the ("an Donor Portal", "in a first place").
  Product names usually take no article ("in Jira", not "in the Jira").
- Question word order: "How this is implemented?" → "How is this implemented?"
- it's / its.
- Tense agreement and verb forms: "I thought there is" → "I thought there was";
  "should be move" → "should be moved".

### ST001 corporate-speak

Replace with the plain form or drop:

- "in order to" → "to";
- "at this point in time" → "now";
- "with regard to", "in terms of" → "about", "for", or rewrite;
- "utilize" → "use";
- "in the scope of this document" → drop.

A sentence over 25 words with three or more clauses splits into two or three.

### GR003 connectors

The em-dash is the strongest English LLM marker. Inside a prose sentence,
replace it with a full stop, a comma or a conjunction. The GR003 exceptions hold:
a term definition ("Snapshot — a copy of state at write time"), labels and
metadata, run-in list headings, headings, arrow notation.

### WO003 verbs

- "perform validation of X" → "validate X";
- "make a decision" → "decide";
- "provides the ability to" → "lets", "can";
- "is responsible for writing" → "writes".

### WO004 metaphors

"umbrella document", "north star", "landscape", "deep dive",
"single pane of glass" → say it directly: "overview", "goal", "the options",
"detailed review", "one view". An artifact's own name stays.
