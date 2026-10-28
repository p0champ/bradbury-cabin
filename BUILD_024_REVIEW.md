# Build 024 — notes belong to the text

28 October 2026. Supersedes Build 023's separate guide detour.

User verdict on Build 023: it works but is too clunky. He wants Before reading
on opening the text and After reading on finishing it, with no guide menu task.

## Independent critic

A separate agent that did not write this implementation reviewed code and
tests plus before/text/after, modern/night and native front/side/lying images.

Round 1: **8.5/10**. Ranked P3: permanent section page counts conflicted with
combined page-turn feedback. Fixed by using one shared section-aware label
for the page footer, browser place label and native turn feedback.

Round 2: **9/10**, no remaining actionable issues. Independently passed
102/102 unit tests and 8/8 targeted browser checks after the counter fix.
The critic did not independently rerun the full browser suite. Updated
synthetic front/side/lying images are fully framed; they are not Quest photos.

## Author verification

- 102/102 unit tests and 121/121 full PC browser checks passed.
- Final counter adjustment: all eight targeted browser checks passed again.
- Five mutations in an isolated copy were caught: wrong default for legacy
  text anchors; lost section in storage; lost section on page anchors;
  incorrect section order; extra empty title page before After reading.
- Original source text page content/layout remains unchanged at all sizes.
- Fresh works begin Before; saved works resume their saved section/words.
- Missing/partial notes add only available sections, with no empty fallback pages.
- Cached Claude picks follow the same flow offline, including across midnight.
- Gesture recognizer and handMapRevision 9 remain unchanged; the guide menu
  row is removed and More/Back alignment is preserved.

No actual Quest check or real Google sign-in was automated. Release status
is recorded at the top of HANDOVER.md and in the chat.
