# Build 045 independent review

## Verdict

Round 1: **7/10, rejected**. Round 2: **8/10, accepted for release**. Both are reviews of the implementation, not a Quest check or a judgement of Apple quality.

## Round 1 findings and repairs

- **P1: Exit drift still failed on reading and placement.** Outside menus, the aim history only kept points inside the Exit zone. A press whose aim had drifted below the zone could not be traced back. Repair: every point on the page is filtered and remembered; only points inside the zone are shown. New tests drift from the upper and lower half of the circle on all four surfaces. The lower-half test fails on the round-1 code.
- **P2: the press dot was not held for Exit outside menus.** It now holds in the press look at the chosen point. Test added.
- **P2: Exit release read the raw ray.** It now reads the same filtered point as everything else, with 20 mm slack.
- **P2: the Exit tests trusted the app's own geometry.** They now assert the spec's values, computed in the test.
- **P2: fixture gaps.** The mock page layer now has its real size and pose. Rays can start at the hand. The sweep also runs on a runtime-resized page image.
- **P2: the floating "Leave cabin" label was hard to read over a bright room.** It now appears on hover on a small static pill of the same material as the disc.
- **P3:**
  - Dot layers are kept listed briefly and then retired (1.5 s), so short gaps don't re-submit the layer list.
  - The fallback mode no longer draws the dot twice; its sprites are uploaded once and have mipmaps.
  - Press diagnostics now record positions.

## Round 2 remaining (P3)

Fixed after the review:
- A dot layer that rejoins the list is rewritten in full.
- The hover label stays while an Exit press is held.
- The label pill has a hairline edge.

Open:
- The look-back slightly extends Exit downward while reading. A pinch whose aim rested inside the zone just before can still leave even if it ends at y 200–300. This is by design and is a headset check.
- Dot image contents are not read back in tests.
- Accepted as specified: the placement zone size, the look-back trade-off on dense cells, and no dot if creating the dot layer fails.

## Naive variants (each must fail at least one new test)

- **Build 044 itself:** sweep test fails (53 page acquisitions, stale shown page, trail). Drift test fails (Notes opened).
- **Press snapshot at selectstart:** drift test fails.
- **Always look back 180 ms:** large-move test fails, plus 6 unit tests.
- **Bare-circle Exit zone:** drifting Exit press fails.
- **Page repainted every frame while pointing:** fails, but indirectly. The extra per-frame cost in the fixture makes native events stale before the direct budget assertion runs.

## Not established

Real Quest responsiveness, trail-free rendering on the actual compositor, physical drift size and timing, top-row reach, and accidental Exit while reading. The look-back bounds (180 ms, 8 mm, 35 mm) are provisional; pointer diagnostics record press choices for tuning.
