# Build 050 — tracked menu pointer and reachable session report

The headset report is now more specific: middle selections work, but the pointer disappears and becomes inaccurate as it moves away from the middle. User confirmed they can test a headset build. Real-device trace has not yet been supplied.

## Reproduced software failure

The app used its reading-hand visibility cone (48 degrees horizontal,42 vertical) to decide whether a menu cursor could exist. A tracked wrist outside that cone lost its cursor and selection even when its valid native ray still intersected an actual menu button. Reproduced with wrists left/right at x±.54,z-.45 and above/below at y±.43,z-.45, upright and lying. The regression assertion fails on the preceding behavior; it passes with the bounded correction.

A hand menu may now accept that actual on-window ray when its physical hand remains tracked, in front, within the existing forward-depth range, attentive and not system-owned or reading the wrist watch. No guessed pinch threshold or look-back choice is added. Reading and head-pointer visibility gates remain unchanged; gestures.js is unchanged. The wider menu check is the forward half-space, not a measurement of sensor field of view. A ray leaving the visible window outside the old cone still cancels a held press.

## Session report access

The save action was inside closed “Preview and advanced tools,” invisible in the immersive cabin. A shortcut is now revealed and brought into view after exit, and is already visible when diagnostics are requested. It downloads bradbury-test-details-build-050.json. The original advanced-tools action still works.

The report retains actual native-window dimensions, transform and upload viewport after exit. Opt-in traces also record wrist-cone eligibility, actual menu-ray visibility, tracking and system/watch flags, displayed target/pixel, native-event pixel and dispatched choice. Detailed frame traces remain opt-in; no automatic transmission. Normal exit names the save action; failure exits preserve their original error message.

## Verification

- 216 unit tests and maintained source checks pass.
- 23 focused new menu-visibility cases pass: both hands, all four directions, upright/lying; reading gate retained; system-owned, lost wrist/ray, behind-viewer and too-near inputs blocked.
- Two new browser download checks pass with tools collapsed at 390px, including actual JSON content and retained geometry after exit.
- The final complete synthetic browser run passes all 281 cases, including existing reading, source, selection, pointer, Exit, visibility, offline and continuity regressions plus the 25 new visibility/export cases. The run initially exposed a normal-exit message overwriting failure notices; the corrected run preserves failure messages and passes.
- Independent review found no blocking correctness/scope issue and confirmed reading/head mode, depth, attention, system and watch safeguards remain. This is a reproduced software defect, not proof that it fully explains the real headset symptom.

## Release and device outcome

Released code 2524000 on phase-1-gestures by fast-forward, with build-050-menu-tracking saved remotely. Verified BUILD 050 and normalized SHA-256 matches for all 38 live root code files at https://p0champ.github.io/bradbury-cabin/?v=50. No force push; main and phase-0-crispness untouched. Headset outcome remains pending. Next device check: move from centre to top-left/top-right and lower menu actions with the same hand; dot/highlight must remain aligned and each pinch must open that action. After exit, the visible Save test details shortcut should work. If the problem remains, use that report to distinguish visibility gating, aim mapping and click dispatch before another change.
