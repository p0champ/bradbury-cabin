# Build 014 independent review — wrist calendar (right wrist only)

A separate critic agent reviewed this build. It wrote none of the code.

## Round 1: 4/10

The critic found three blockers.

1. **The back-of-hand test was inverted.** For a real right hand, cross(index−wrist, pinky−wrist) points out of the PALM. The code and its tests shared the wrong assumption, so they agreed with each other but not with a real hand.
2. **A single dropped wrist joint threw an error** and disabled the feature for the whole session.
3. **Loose limits let page-turn postures through.** Once item 1 was fixed, these postures could have shown the face.

The critic also noted that a mutation letting any hand feed the calendar was not caught.

Fixes:
- The pose test was re-derived from anatomy.
- Both test suites now build hands as thumb side = fingers × palm-normal, and the unit test includes an anatomy check.
- A dropped joint now only hides the face.
- The pose now has tighter limits: palm away, gaze within 25°, and the hand must run across the body.
- New tests cover: page-turn postures, the left hand placed in the exact watch geometry, two hands at once, removing the right source, and the right hand acting again after a glance.

## Round 2: 8/10, no blockers

The mutation is now caught.

Applied afterwards:
- The real handedness is passed into `watchPose`, so there are two independent locks.
- The palm limit was loosened to −0.7, so a flat palm-down check at chest height can pass.
- "Save test details" now records the last 20 show/hide decisions: palm, gaze, across-body, distance and reason.

## Left for headset data

- A rare false positive: an inward-yawed, over-rotated pinch while looking straight at the hand.
- The card size (8.8 cm placeholder).
- `nearFacePalm` in gestures.js probably has the same sign inversion. It needs a Quest trace before anyone changes it, because it is part of the recogniser.

## Final status

Final counts: **58 pure + 106 browser checks pass.** This is synthetic PC evidence, not a headset test.
