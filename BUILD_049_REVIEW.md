# Build 049 — reading continuity

The approved reading-desk design is implemented in the real app. Today gives the current unfinished work a clear place without reordering the three daily works. Begin, Continue and Read again reflect real saved anchors and canonical completion, including a bookmark on page zero. Resolved section/page context stays visible when an author is long.

A work from another day gets one named Resume strip with its resolved place. The Library reveals the completed edition, retains its Read status and offers an optional next unread daily piece through its existing action. It restores that piece’s saved section. Canonically completed works are never offered as the next unread piece merely because a daily tick is missing.

Completion still requires a fresh NEXT beyond the final page and another separate NEXT to confirm. BACK returns to the text. Save failures remain visible as “Read here · could not save on this headset”; the app retries saving on a later explicit confirmation. No storage format or source anchors changed.

Long closing summaries have reserved instruction/action space. Notes name their Back destination; Library pagination says Previous/Next, while Shelf dates retain Earlier/Later. The Library has one Back target in its footer, clear of the completion acknowledgement, and keeps its Library name visible beside that acknowledgement.

## Verification

- 216 unit tests and all maintained source checks pass.
- 256 synthetic browser cases pass across the full-run prefix (194 cases) and final affected-module run (62 cases). The original full invocation stopped at an obsolete fixed-coordinate fixture. Complete pointer/feel/frontdoor/coherent/reading-continuity modules passed after updating that fixture; this was not a clean single-process full invocation. Ten new continuity groups are included.
- Actual canvas renders inspected for saved-current Today, foreign Resume, confirmation, completed Library and failed-save Library. Visual inspection found a duplicate Back label crossing the completion notice; fixed, with whole-panel glyph-overlap and target-uniqueness checks added.
- Independent production diff and rendered-screen reviews approved the bounded desktop implementation with no blocking defect. Foreign-Resume place detail and a persistent Library location label address the final suggestions.
- Synthetic coverage includes page-zero bookmarks in all three positions, source order, longest accepted source title in every row/current position, completion from Today/Library/archive, save failure, and optional next-place restoration.

Pointer and gesture behavior are parked. The only pointer-file change is the diagnostic build label. Source text, section/block/word anchors and hand mapping are preserved. Desktop results do not establish Quest comfort or selection alignment. Calendar and Settings redesign remain outside this bounded change.

## Release

Local build 049; publication not yet verified. Published build 048 remains the last verified release until this section is updated.
