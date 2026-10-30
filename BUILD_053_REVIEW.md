# Build 053 — "Glance face" wrist watch

Bastian found the wrist watch cheap and too big. He wanted it like an Apple Watch: small, clean glass, calm, matching the new intro. It should show only the time, today's reading and his streak, and appear only when he turns his wrist to look. Three ideas went to an independent judge: Glance face (9/10), Three rings (6/10) and Two-step glance (5/10). Bastian approved Glance face with the judge's refinements. It was built overnight and is **not published**.

## What changed

- **Size.** 4.4 × 3.85 cm, down from 8.8 × 7.7 cm. The 512 × 448 canvas is unchanged, so the type is twice as dense.
- **Look.** Near-black glass with a soft top sheen, a faint warm edge glow and a hairline warm rim.
- **Content: exactly three lines.**
  - The time, large, 24-hour (e.g. 21:47).
  - Today's reading: the first of today's three not yet read, as "Poem · *Title*". The kind is in the interface face and the title in Literata. A long title is cut short with "…" rather than shrunk. Titles come from the real Today picks or stored picks and are never invented. When all three are read, the line says "All three read".
  - The streak in warm gold with an ember dot, e.g. "12-day streak", or "Begin a streak today" when there is none. Once all three are read, the gold and the ember glow brighten.
- **Fade.** 0.25 s, up from 0.12 s.
- **Trigger unchanged.** It shows only on a deliberate right-wrist turn toward the eyes, and only for the right hand.
- **Repaints** only when the minute, progress or today's titles change.

## Verification (desktop; not a Quest)

- 223 unit tests and all source checks pass. New tests:
  - The face paints exactly the time, the reading and the streak, nothing else.
  - The minute changes the face.
  - The first unread reading is chosen, and no title is ever invented.
  - Streak wording and the 24-hour clock.
  - Apple Watch size and the 0.25 s fade.
- Two existing glance timing tests were lengthened for the longer fade; their checks are unchanged.
- New in-app check (`tests/glance-watch-browser.cjs`):
  - The real wrist layer is at most 4.6 × 4.0 cm.
  - It fades in over 200–300 ms.
  - It paints exactly 21:47, "Poem · " with today's real poem title, and the streak.
- The existing wrist "feel" checks still pass: the glance survives small movement, interrupted wrist pinches cancel, and a fresh wrist pinch opens Shelf.
- Rendered faces were inspected for the first reading, story, all read and no streak.
- **Full browser suite: 296/296** in one clean run. Two older wrist-glance timing waits and the wrist-pixel expectation were updated for the 0.25 s fade and the dark glass face.

## Not verified

No Quest result. Readability at arm's length, the warmth of the gold over a real room and the size on the real wrist need Bastian's check.
