# Source catalogue (Build 031)

`source-catalogue.js` holds the only literary texts Claude can select: 241
complete works (129 poems, 46 stories, 66 essays). Claude's picks file names a
catalogue ID and adds its own study notes; the app never displays text that
Claude supplies.

## How a text gets in: producer, independent critic, comparator

1. **Producer.** `tools/generate_source_catalogue.py` extracts each work from
   the current gutenberg.org plain-text editions saved unchanged in
   `tools/sources/` (`pg<N>.txt`, retrieved 2026-10-28, pinned by SHA-256 in
   `tools/source-manifest.json`).
2. **Independent critic.** A separate agent, which never saw the producer's
   code, manifest or output (it was told which collections and titles to
   cover; see Limits), downloaded the gutenberg.org **HTML** editions
   itself, wrote its own extraction code (`tools/critic/extract.py`), found the
   work boundaries itself and judged each work complete or not
   (`tools/critic/critic-extraction.json`; raw downloads in
   `tools/critic/sources/`).
3. **Comparator.** `tools/critic_compare.py` is the only writer of
   `tools/critic/verdicts.json`. A work is accepted only if the critic found
   exactly one matching work, judged it complete, and every character agrees
   (words, punctuation, quote direction, capitals, accents), every verse line
   and stanza break agrees, every stepped indent is at the same level, and no
   prose paragraph is merged or split where the edition has no break. One
   difference is tolerated: the plain-text file spells the em dash `--`.
   Whitespace is layout. Whitman's transcriber hard-wraps (a +4 continuation
   indent) are rejoined into single verse lines; the critic flagged the same
   wraps independently, and its unwrapped view is what the producer must match.
4. **Gate.** The generator publishes only accepted works, bound to the exact
   text compared. Changing a text afterwards unpublishes it until it is
   compared again. `library.js` (the starter shelf) is generated from accepted
   catalogue entries only.

Check everything (no network, no model): `npm run check:sources`. It
reproduces the critic's extraction from its saved downloads, recomputes every
verdict, regenerates both catalogues for comparison, and runs the comparator
against 39 deliberately damaged inputs (on both the critic's and the
producer's side). `npm test` runs all of this after the unit tests.

## What the critic loop found

- Round 1 compared against the older GITenberg plain-text copies the draft
  used: 48 of 193 rejected. Those copies had accents stripped (café → cafe),
  italic markers left in the text, and real word errors since fixed upstream
  (for example "ball-roomed" for "hall-roomed", "failing" for "falling",
  "Towers chandler" for "Towers Chandler", a missing "is").
- Round 2 re-sourced the producer from the current gutenberg.org editions:
  185 of 186 accepted.
- An independent build review (6/10) then found comparator gaps (quote
  direction folded, paragraph splits only warned, indent depth ignored) and
  that 30 Whitman poems showed transcriber wraps as verse lines. The
  comparator was tightened and the wraps rejoined; still 185 of 186 accepted.
- **Rejected and excluded:** Blake, "Night" (Innocence). The plain-text file
  omits a closing quotation mark that the HTML file has. Not hand-corrected.
- **Excluded by both sides:** Bacon, "Of Fame", which the edition marks as unfinished.

## Collections

| Source | Works | Boundaries |
| --- | --- | --- |
| Bacon, Gutenberg 575 | 58 essays | Contents-listed headings to next heading; "Of Fame" excluded |
| O. Henry, Gutenberg 2776 | 25 stories (The Four Million) | Contents-listed heading to next story or end marker |
| Chopin, Gutenberg 160 | 8 short stories after the novel | Story heading to next story or end marker |
| Blake, Gutenberg 1934 (R. Brimley Johnson ed., 1901) | 46 poems | Upper-case headings; section headers excluded |
| Whitman, Gutenberg 1322 | 48 short poems | Book I (Inscriptions) plus 24 named poems, heading to next heading |
| Yeats, Gutenberg 32233 (fourth edition, 1903) | 35 poems | 37 complete poems proposed; two strict comparison failures excluded; separate NOTES commentary excluded |
| Poe, Gutenberg 2148 (Raven edition, volume II) | 13 stories | Complete stories within 6,000 words, excluding works needing distant endnotes |
| De Quincey, Gutenberg 10708 | 1 essay | On the Knocking at the Gate, in Macbeth; complete body including inline footnote; full multiline source heading recorded |
| Tagore, Gutenberg 6842 (1916 edition) | 7 essays | Complete named Sadhana essays; Soul Consciousness excluded for malformed source markup |

## Limits

- The critic's independence is real but partial: it worked from its own
  download and its own code and set its own boundaries, but it was told
  which collections and which 24 extra Whitman titles to extract, and both
  sides use the same Project Gutenberg ebook (HTML vs plain text), so an
  error present in both formats would pass. The producer added two lines to
  its script so the check can rerun it with explicit paths (marked there).
- The saved critic files prove what was compared, not where they came from:
  the gutenberg.org origin is recorded, not re-verified offline.
- Whitman wraps: both sides join exactly-+4 continuation lines, so that rule
  is shared; any disagreement still fails closed.
- Exactness means agreement with these named Gutenberg editions, not with
  every printed edition.
- The critic checks literary text. It does not fact-check Claude's study notes.
  The app does reject notes whose quotations are not exact.
- Nine authors from England, the United States, Ireland and India. Variety is broader, but this is still a finite catalogue; unsupported works require the same independent source process.

## Build 031 independent expansion

Producer: tools/expand_catalogue_031.py, unchanged plain-text downloads and explicit boundaries in tools/expansion-031.json. Independent critic: a fresh agent with no producer history or access, its own unchanged HTML downloads and its own DOM extraction implementation, tools/critic/extract_031.py. The original critic runner combines both independent datasets for reproducible comparison. The main source manifest must now also reproduce exactly from discovery.

58 new candidates were compared;56 accepted. Yeats Aedh Tells of the Rose in His Heart failed verse-line structure; Michael Robartes Asks Forgiveness Because of His Many Moods failed Phoenix/Phœnix typography between formats. Neither was hand-corrected or published. The earlier Blake Night rejection remains. Four independent Poe extractions missing distant associated notes are explicitly marked incomplete and cannot pass; the producer does not propose those works. Over-length stories are excluded whole, never shortened.

The paired underscore italic-marker remover preserves its enclosed whitespace, including a space immediately before the closing marker in The Black Cat; it also handles verse markup. Actual text still has to match independently extracted HTML. A genuinely unmatched marker in Tagore Soul Consciousness causes whole-work exclusion. De Quincey's source title spans lines75–79; the recorded headingStartLine allows matching the full source title rather than its last line, with the body unchanged.

Edition dates remain explicit: Yeats collection first1899, this source1903; Tagore first1913, this source1916. Sadhana's English contributors are credited in CREDITS.md and tools/EXPANSION_031_NOTES.md. Agreement with these digital editions does not establish error-free first-edition or manuscript text. Existing185 published works remain unchanged.
