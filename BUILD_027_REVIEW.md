# Build 027 — Today, phase 1

28 October 2026. The first phase of the design that won a three-way design
contest (editorial "Today" page, with a closing page and facts from real data).

## What changed

- **Today page** (`today-panel.js`): date, part of day and challenge day
  ("Wednesday evening · Day 11"); three large entries (kind, title, author ·
  year · place, "✓ Read" / "In progress"); gold hairlines that turn ink once
  all three are read; "All three read · N days running" (streak only from 2).
- **Appears by itself** once per date when the cabin settles, if a checked
  trio is cached. If picks arrive later, it opens only while he has not yet
  moved from the place he arrived at; otherwise the menu row says "New".
- **Menu row 1** reads "Today" with "N of 3 read" while a trio exists, and
  opens Today; otherwise it is the Library as before. No menu index moved.
- **Closing page** after the last page of one of today's works: "Mark as read
  today" (tick box; guarded against repeated pinches both ways), "Next: …"
  (only while another of today's works is unread) and "Today's three".
  Nothing is ticked automatically. Shelf works have no closing page.
- Midnight with Today or a closing page open falls back to the Library.

Not in phase 1: "Your shelf", Claude's dedication/thread lines, the opening
title-card animation.

## Review

Independent build critic (wrote no code): **6/10** in round 1. Blocker: Today
left open over midnight ended the VR session. Also a late-sync race, untick on
a double pinch, cut-off long titles. Round 2: **8.5/10**, blocker fixed and
verified with its own probe. Its three remaining polish points (late picks
over a chosen work, a pinch across midnight, closing-header spacing) were
then fixed and rechecked by the author only.

## Evidence (author)

- 125 unit tests, then `check:sources` (185/186 accepted, 31/31 damaged
  inputs rejected).
- 128/128 PC browser checks, including day and night Today flows, midnight,
  menu labels, guards and shelf works.
- 5/5 browser mutations caught (`../mutation-027/`), 10/10 earlier ones still
  caught (`../mutation-026/`).
- Screenshots: `../build-027-evidence/today*.png`.
- No Quest hardware check yet; legibility lying down is still to confirm.
