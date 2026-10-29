# Pointer investigation — 29 October 2026, awaiting Bastian's go

No application code changed and no release made. Build 037 remains the inspected baseline. Bastian's overriding goal: the entire cabin must feel coherent, calm and precise, like Apple; cosmetic detail alone has not achieved this.

## Confirmed findings

- app.js freezes the target ID during pinch, but pointer.js receives the current moving ray intersection. The dot and the committed choice therefore disagree during movement. Reproduced against the unmodified app using its existing synthetic WebXR browser fixture: aim at `library` (the menu ID for Today/Your shelf), close pinch, aim at `mood`, wait 350 ms, release. The dot moved 198.45 mm while the hover/held target remained `library`; release opened the shelf. Reproduced with left/right hands, upright/lying: four cases. These are deliberately simulated movements, not measured involuntary drift.
- Actual production pagePoint/hit functions and rayOnPage agree to numerical precision: 72 comparisons across nine points on four displaced/rotated planes (including lying orientation); max difference 6.83e-13 canvas pixels. All use presentPose. No static plane conversion mismatch found. This does not test perceived binocular alignment. The rendered dot is separately offset 3 mm toward the ray origin; shared page-plane geometry with a small surface-normal offset is preferable.
- Current OneEuro(1,.03) filtering was measured with actual smoothRay on synthetic noise-free traces: page 1.1 m away, fixed ray origin, target moves 5 cm in a step. Time to reach 90%: 383/375/367 ms at 60/72/90 Hz. A 20 cm/s, one-second ramp leaves 30.31/30.06/29.69 mm error; after stopping takes 450/444/433 ms to fall below 2 mm. A 1 cm/s ramp leaves about 1.58 mm. These are filter responses, not Quest or end-to-end latency measurements. No real-hand jitter traces are available.
- Aim comes from targetRaySpace, not finger joints. Meta documents an emulated ray matching Horizon Home and generally pointing forward; it does not document the specific wrist/shoulder algorithm assumed in the old handover.

## Native versus pinch-point comparison

Source review plus explicit geometric comparison, not a headset A/B test. A head-through-pinch model removes dependence on the supplied ray orientation but introduces joint and head-position sensitivity. With a pinch 45 cm in front of the head and page at 1.1 m, 1 mm lateral pinch noise becomes 2.44 mm at the page; 1 mm head motion with stationary pinch becomes 1.44 mm opposite motion. A native ray perturbed by 1 degree moves about 19.2 mm at 1.1 m. Those perturbations are arbitrary different units, so they do not establish a winner.

For pinch (0,-.20,-.45), head anchor (0,0,0) gives page hit (0,-.489); guessed shoulder (-.18,-.20,0) gives (.260,-.200). Changing the body anchor materially changes the aiming model. Do not replace the native ray on that assumption. Vision Pro's gaze-based indirect input does not prove a shoulder ray is accurate on Quest.

Sources: https://developers.meta.com/vr/documentation/web/webxr-hands/ ; https://www.w3.org/TR/webxr/ ; https://developer.apple.com/videos/play/wwdc2023/10073/ ; https://developer.apple.com/design/human-interface-guidelines/gestures ; https://gery.casiez.net/1euro/

## Independent design round and judge decision

Two separate read-only designer agents: strict visionOS precision and calm editorial reading. Both independently found the held-target/moving-dot bug. Precision designer prioritised agreement, response measurements and evidence before changing rays; reading designer prioritised predictable direct control and avoiding magnetic surprises. A third, separate judge merged their findings:

1. One shared page point determines dot, hover and press. Hold point AND target together during a pinch. Cancel safely on tracking/hand loss, screen replacement or leaving interaction; never carry stale selection to a new screen.
2. Reduce measured smoothing drag. Compare identical stationary, movement, stopping and edge-crossing traces at 60/72/90 Hz, using page millimetres. Select a faster adaptive candidate while checking still-hand stability; do not claim synthetic noise is a measured user's tremor.
3. Keep Quest's supplied ray as the initial default. Add an optional diagnostic comparison of native/raw/filtered and head-through-pinch positions using the same timestamps; compare shoulder assumptions only as explicitly experimental. A real Quest comparison remains deferred to the combined check.
4. Keep small dot/press ring. Defer magnetism, beams and extra visual clutter.

Preserve gestures.js, handMapRevision 9, existing button hit rectangles and menu indices. Implementation requires Bastian's explicit go. Then relevant tests, independent critic >=8/10 within three rounds, release and live file verification. A critic score does not certify Quest feel.

## Reproducible investigation evidence

Scripts and raw JSON are in this chat's scratch directory:
`C:/Users/Bruger/Documents/Codex/2026-10-29/files-mentioned-by-the-user-gpt/work/`

- pointer-investigation.cjs / pointer-integration-results.json: unmodified app, existing browser fixture, four press-drift reproductions and production plane math comparison.
- pointer-filter-probe.mjs / pointer-filter-results.json: actual filter responses and explicit candidate-ray geometry.

No full regression suite was run for this investigation; no implementation changed. No Quest, real Drive or Claude test claimed.

## Ordered work after approval

Pointer fix, tests, independent critic, release, live check FIRST. Then separately deliver the already approved Build 038 wrist glance / idle hand discs / following smoothness scope with the same release checks. Assign unambiguous release numbering before implementation, keeping the approved feature scope distinct from the pointer correction. Then run Bastian's full Apple research and start-to-finish experience audit, three distinct designers with cross-critiques and a separate judge; bring one ranked realistic plan and wait for approval before implementing that broader design. Do not skip ahead to build it.
