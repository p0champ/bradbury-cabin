# Build 017 independent review — Style, look-to-turn, background sound

A separate critic agent reviewed this build. It wrote none of the code.

## Round 1: 6/10

The critic found three blockers.

1. A gaze turn and a hand turn could both fire on one look, turning the page twice.
2. The sampler text overflowed the right margin in the Clean modern style.
3. The gaze guards were untested. A mutant that removed the menu and attention guards survived all 111 browser checks.

It also listed should-fix items:
- the gaze turns were not logged with a direction;
- the gaze dwell went stale after losing pose or visibility;
- a disabled gaze re-armed by itself;
- after a failed Enter, the ambience was left stale;
- ambience stopped in the wrong order when a session ended;
- baking the ambience loop caused a hitch inside the XR frame;
- the footer text sat in the back zone;
- titles were measured in a different font from the one they were drawn in;
- italics showed in the modern style;
- the ambience loop's crossfade made it audibly "breathe".

## Fixes

- **Double turn.** `GazeDwell.consume()` now runs on every real hand event, on menu toggles, on pose loss and on visibility changes. A new look needs a look away first.
  - My first version consumed on every frame. My own browser test caught that before review.
- **Overflow and fonts.** The sampler and titles are now measured in the mood's font and style.
- **New guard tests.** Browser checks now cover:
  - the menu open, and the menu just closed;
  - a blurred session;
  - a pinch made during a look.
- **Should-fix items.** All of them were applied.
- **Quiet room.** It now has a little mid-range air, so small speakers can play it.

## Round 2: 8/10, no blockers

The critic retried three mutants; all three are now caught:
- removing the menu and attention guard;
- removing the attention guard alone;
- removing the consume-on-hand-action call.

## Left for the Quest check

- A possible one-frame hitch when choosing a new sound. The bake now runs outside the XR frame, at 22.05 kHz.
- Whether Quiet room can be heard.
- Possible menu mis-hits now that rows are 26 px apart.
- The wrist card still uses Literata in both moods. It is a placeholder.

## Final counts

**77 pure + 111 browser checks pass.** This is synthetic PC evidence, not a headset test.
