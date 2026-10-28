# Build 026 — source fidelity with an independent critic loop

28 October 2026.

## Two critics, two jobs

1. **Source critic (text).** A separate agent, with no access to the
   producer's code, manifest or output, downloaded the gutenberg.org HTML
   editions, wrote its own extractor and set its own boundaries. The
   comparator (`tools/critic_compare.py`) accepts a work only if both sides
   agree character for character, line for line, stanza for stanza, indent
   level for indent level and paragraph for paragraph. The app can display
   only accepted works. See SOURCE_CATALOGUE.md.
2. **Build critic (code).** A second separate agent that wrote no code
   reviewed the diff, tests and screenshots, attacking the comparator and
   parser in scratch copies.

## Source critic rounds

| Round | Producer source | Result |
| --- | --- | --- |
| 1 | Draft's old GITenberg plain text | 48 of 193 rejected: accents stripped, italic markers shown, real word errors |
| 2 | Current gutenberg.org plain text | 185 of 186 accepted |
| 3 (after build review) | Same, stricter comparator, Whitman wraps rejoined | 185 of 186 accepted |

Rejected and excluded: Blake, "Night" (closing quotation mark missing from
the plain-text file). Excluded by both: Bacon, "Of Fame" (unfinished).

## Build critic rounds

- **Round 1: 6/10.** Found that 30 Whitman poems showed transcriber wraps as
  verse lines, plus comparator gaps: quote direction folded, paragraph splits
  only warned, indent depth ignored, no producer-side damage tests. Also:
  quote-check false positives, verdict lost on reload, duplicate Blake titles.
- **Round 2: 8/10.** All of the above confirmed fixed by its own mutations.
  Remaining findings were then fixed: own-title quote false rejection for
  renamed Blake titles, shelf works now refused as picks (not just
  discouraged), docs contradiction, prose block type checked, clearer
  "no picks file for today yet" verdict. These last fixes were not
  re-reviewed by the critic; the author reran every check below.

## Evidence (author)

- `npm test`: 118 unit tests, then `check:sources`: catalogue and shelf
  reproduce, critic extraction reproduces from its saved downloads, 185/186
  verdicts recompute identically, 31/31 damaged inputs rejected.
- 10/10 safety mutations caught in isolated copies against a passing
  baseline (`../mutation-026/`). An earlier run that reported 7/7 is void:
  its baseline was failing.
- 125/125 PC browser checks. Five front/lying image pairs are byte-identical
  because they capture only the page texture, which does not change with
  posture; they show page content, not placement.
- No Quest hardware check yet. No real Google Drive run.

## Known limits

- Critic independence is partial: it was told which collections and titles
  to cover; both sides use the same Gutenberg ebook in two formats; both
  join Whitman's +4 wraps by the same rule.
- The study-note quote check covers double-quoted passages of three or more
  words only; it does not fact-check notes.
- No independent agent runs at daily pick time. Daily safety is enforced by
  the app: only accepted catalogue texts can display.
- 33 stories, 5 authors: variety is narrow until more editions pass the loop.
- The claude.ai skill must be updated by hand from CLAUDE_SKILL_DAILY_THREE.md;
  progress.json carries the essential instructions meanwhile.
