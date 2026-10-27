# Latest Quest feedback — unresolved, 27 October 2026

Bastian tested Build 005 and reported: **“the skipping pages is a little weird now and dosent change page even if the click is registred.”** He requested that this be noted and handed to Claude to finish the work. No repair or new Quest pass followed this report. The cause is unknown; distinguish Quest's click feedback from the app's badge pulse, emitted page action and actual page-state change. Build 005's PC checks and 8/10 review did not establish reliable on-device page turning. The gesture gate remains unpassed. Phase 0 crispness remains passed.

Next: fix this mismatch first, preserve crispness and hand-only menu animation, add meaningful regressions, obtain independent review, then ask Bastian to check gestures again before continuing Phase 1. Do not interpret this handoff as approval to skip phase gates. See CLAUDE_HANDOVER.md for the continuation prompt. Older readiness statements below describe PC evidence only.

---
# Build 005 — calmer hand controls

Build 004 was too sensitive in Bastian's Quest test. This revision requires a firmer, deliberate pinch, a settled release and a short pause between actions. The menu hold is now 1.4 seconds. Skip icons sit over each hand; a circle fills on the holding hand until the menu opens. The reading page has no progress animation.

Right pinch/release still turns forward; left goes back. The menu supports hand swapping, hand pointing or optional head pointing, practice and deliberate re-centering. A menu hold never also turns a page or selects a button. Reading placement is restored after closing the menu. Full Phase 1 remains pending.

PC verification: 23 pure gesture/geometry tests and 74 isolated Chromium checks. They cover deliberate contact, brief-touch rejection, release bounce, natural gradual release, partial loosening, cooldown, continuous hold timing, tracking loss, simultaneous hands, menu targeting, practice and native graphics regressions. Two new native hand-layer workflows read actual uploaded textures, check transparent corners and ring growth, confirm that page pixels stay unchanged during progress, and cover front/lying views. A layer-budget rejection test confirms that optional feedback failure preserves reading and controls. These are simulated XR checks, not headset results.

Independent review reached **8/10 for PC readiness**, with all 23+74 checks independently passing, and is recorded in CALM_GESTURE_REVIEW.md. The original Build 004 review remains in GESTURE_REVIEW.md. Source and hosting use `phase-1-gestures`; the passed Phase 0 branch is preserved. No Sunnyvale bridge or normal Chrome session was touched.

Try [Build 005](https://p0champ.github.io/bradbury-cabin/?v=5) in a fresh Quest Browser tab:

1. Open your fingers, then make a deliberate right pinch for roughly a quarter second and release. It should turn once. Left goes back.
2. Try relaxed fingers and brief accidental touches. They should do nothing.
3. Hold a firm pinch. Watch the circle fill on that hand over about 1.4 seconds until the menu appears. Release; no button should select itself.
4. Check both hand icons while sitting and lying down. Open your hand halfway through a hold: the circle should clear and the menu should stay closed.
5. Check that page turns feel calmer and the hand badges stay comfortable. Use Save test details if anything fails.

The near-face system-pinch guard remains best effort. Actual Quest gesture comfort, compositor layer budget and frame pacing need the user's check.