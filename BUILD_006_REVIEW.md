# Build 006 independent review

Final score: **8/10 for PC readiness, no blockers** (round 2). A separate critic agent that wrote none of the code reviewed the diff from fcee944, ran all tests itself, ran its own 72 Hz noisy-trace simulators against Build 005 and Build 006, mutation-tested the new regressions, and viewed front/lying hand-badge, practice and quad images.

Round 1 scored **6/10** with four blockers, all of them fixed with regressions before round 2:

- B1: noisy resting near-pinches (21 mm ±4) latched into turns 197/200 times. Fixed by requiring ≥80% (and ≥3) readings below 18 mm over 80 ms. Result: 0/200.
- B2: noisy releases to a 33–35 mm rest stalled. Fixed by limiting the spike filter to firm contact and not restarting settling on mid-zone dips. Result: 200/200.
- B3: a pinch made during cooldown could start late and turn. Fixed: it is logged `ignored:cooldown` and the hand must reopen.
- B4: lingering half-pinched after a firm pinch could open the menu or turn. Fixed: re-contact requires <18 mm, and 300 ms without a firm reading counts as loose. Result: 0 actions.

Round 1 should-fixes were also done: an end-to-end badge texture check (the "never blocked" mutant now fails), outcome linked to the exact log entry, a separate near-pinch buffer, and practice marks reset on re-entry.

Two round-2 nice-to-haves were applied afterwards:
- an `unconfirmed` reason for sub-18 mm dips that do not confirm;
- re-arming needs a fresh open settle after more than 300 ms half-open.

Not done:
- Light presses at 17–18 mm are physically indistinguishable from 19 mm brushes. Calibrate from Bastian's exported logs; do not retune blind.
- No saved PNG of the blocked badge yet. It is asserted by pixel readback instead.

Final counts after those changes: **39 pure tests + 78 isolated Chromium checks pass.** All of this is synthetic PC evidence, not headset evidence.
