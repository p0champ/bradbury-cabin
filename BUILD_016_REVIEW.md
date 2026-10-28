# Build 016 independent review: real reading, Library, saved place

A separate critic agent reviewed this build. It wrote none of the code.

## Round 1: 7/10, three blockers

Text fidelity was verified independently. All seven works match their Project Gutenberg sources verbatim; the only changes are "--" to "—" and joining wrapped lines. The extractor also reproduces library.js byte for byte.

Blockers:
1. The Library's "‹ Menu" overlapped main-menu Exit, so a repeated pinch could end the session.
2. The saved-place anchor (block, line) drifted after a text-size change. In 624 page starts, 10 landed on the wrong page, some up to two pages ahead.
3. Startup crashed on a stored sampler anchor.

Fixes:
- "‹ Menu" moved to the top right, and Exit is now guarded for 600 ms after any menu-page change.
- Anchors are now (block, word offset), and the test covers every page at every size pair.
- Anchors are validated, and bad stored places are dropped.

Polish applied:
- Very long words are hard-broken.
- Generic first/last-page text.
- The title "Desiree's Baby" now matches the source spelling.
- A larger meta line.
- The masthead shows the current work's title.
- Text size and paper/night now persist across visits.

## Round 2: 8/10, no blockers

The critic counted 1 of 624 misses on its own probe, which is effectively zero. Its follow-ups were then applied:
- Poem turnovers are set flush right.
- The Library says "Coming later" for Claude's picks.
- A test checks that every work has a row.

## Not done

- Library paging beyond 8 rows.
- Word anchors that ignore hard-broken fragments. No current text is affected.
- Larger muted helper text.

## Final

**71 pure + 110 browser checks pass.** All of this is synthetic PC evidence, not a headset test.
