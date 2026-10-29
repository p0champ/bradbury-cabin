# Build 048 — a quiet arrival

Implemented locally on build-048-arrival. Not published or tried on a Quest.

## Directions considered

| Direction | Benefit | Decision |
| --- | --- | --- |
| Opening-book animation | A literary signature | Too much ceremony on every visit; did not reintroduce the old leaf layers. |
| Quiet arrival | Show the reading experience, then give one clear placement action | Chosen. |
| Immediate return | Shortest route for regular readers | Saved reading informs the preview; automatic placement and changed entry routing remain outside this pass. |

## Built

The browser entrance pairs “Step into a good read” with the actual saved page, rendered as a small stack of paper. It reflects the real work, reading place and appearance; it contains no invented catalogue titles or external artwork. Enter remains primary. Sound and reading controls sit together in a compact row. Drive, tools, storage information and credits remain accessible.

The page preview reveals over 480 ms once its pixels are ready. The Enter control is available throughout, with no minimum viewing time. Reduced motion removes movement and transitions. No extra welcome screen or replayed ceremony was added.

The headset placement card now has a quiet brand, “Settle in,” one look instruction and a clear “Pinch to place your window” cue. Manual placement, the exact confirmed pose, cancellation, the 200 ms Home arrival (1 ms for reduced motion), Exit and input consumption are preserved. The light cue is drawn in the existing panel; it introduces no new target or gesture gate.

## Validation

- 206 unit tests and all maintained source checks pass.
- 246 full synthetic browser checks pass.
- Latest seven focused entrance checks pass, including preview pixels, live appearance updates, keyboard behavior, re-entry, saved hand instructions and reduced motion.
- The placement test measures real text widths and bounds for all three instructions, then verifies exact confirmed placement. Existing Exit and completion checks remain passing.
- Twelve viewport/theme combinations (320, 390, 760, 768, 1024 and 1440 px, paper and night): no horizontal overflow; Enter stays on the first screen.
- A saved full work appears in the preview. A call counter confirms no browser-preview image copying during XR.
- Mutation check: omitting the real page copy fails the ink-pixel regression; final code restored and passes.
- Desktop, mobile, night and upright/lying compositor stills inspected. These are synthetic previews, not headset footage or independent design approval.

## Limits

The real Quest pointer outcome is still unknown. This pass changes the intro, not selection timing, gesture recognition, reading geometry, source text or storage semantics. Publishing is still pending explicit authorization after the prior automatic review rejection; live remains 045.

Reference: [Apple — Launching](https://developer.apple.com/design/human-interface-guidelines/launching?changes=latest_min_6) supports a restrained launch and restoring prior context. This design is an interpretation, not an Apple endorsement or native visionOS implementation.
