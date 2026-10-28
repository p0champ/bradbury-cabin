# Build 029 — the entrance and the reading bookmark

28 October 2026. Phase 4 of the Today design.

## What changed

- **Entrance:** Today's first showing of the day builds in five even beats,
  300 ms apart (about 1.2 s): heading and date; the poem; the story; the
  essay; then the rules, closing line and Your shelf. Each beat is one page
  repaint (no per-frame fade: full-page texture uploads are costly on Quest).
  Opening Today later from the menu is instant.
- **A pinch during the build-up completes it at once** (at the press, since
  the untouched gesture engine reports menu selects only with a target). That
  pinch chooses nothing: its release is held by the usual 600 ms guard, which
  now also covers Today's own buttons. Nothing not yet drawn is a target.
- **Bookmark:** while reading one of today's three, three marks sit left of
  the title in the running head: ◆ read today, ◇ not yet; the current one is
  larger and in ink. Display only. Absent on starter works, past days and the
  sampler.

## Review

Independent build critic (wrote no code): **6/10** in round 1 — the pinch
that completed the build could open a work never seen, and the undrawn Your
shelf button was a target; also state leaks, rhythm, bookmark contrast.
Round 2: **7.5/10** — all fixed except one path (the completing pinch could
still reach the hidden Your shelf button). That was then fixed (guard on
Today's buttons) with a test pinching exactly there; checked by the author
only. Critic's design view: discrete beats are acceptable; check on the
headset whether the first heading-only beat feels like a stall.

## Evidence (author)

- 137 unit tests, then `check:sources` (185/186 accepted, 31/31 damaged inputs
  rejected).
- 132/132 PC browser checks, including the beat order, repaint count,
  stillness afterwards, mid-build pinches aimed at the hidden essay and the
  hidden Your shelf button, and bookmark states.
- Mutations: 9/9 entrance and bookmark (`../mutation-029/`), 8/8 shelf,
  5/5 Today, 10/10 earlier.
- No Quest hardware check yet.
