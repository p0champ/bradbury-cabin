RESUMED BY CLAUDE (27 Oct 2026, late evening): Build 011 was taken from Codex's local working tree unchanged in production code. It was retested (35 pure + 99 browser checks). Two browser checks were repaired: their mock frame clock could fall behind the real event clock on slower machines. A mutation check confirmed the 1000 ms startup expiry is still enforced. Committed and pushed on phase-1-gestures. Awaiting Bastian's Quest result.

# Build 011 — make the startup confirmation independent of reading-hand readiness

Bastian's actual Build 010 verdict: **“cant get it - the centering wont accept my click”**. He confirmed he uses **bare hands**. Build 010 repaired the XRHand crash, but did not pass startup or the gesture gate.

A code-level blocker was verified: startup confirmation went through the reading recogniser, requiring a stable tracked physical hand, an initial wide opening, and an accepted selectstart before the browser's successful select could confirm. Build 011 handles startup's single explicit action separately. A completed native Quest `select` confirms with a current non-emulated viewer pose and a visible session; it no longer depends on finger joints, initial opening, or a prior accepted selectstart. A controller's successful select can also confirm. Joint distances alone, selectstart alone and cancelled selectend cannot confirm. Active-source and fresh-event checks remain. Startup allows up to 1000 ms for the next frame, so a brief slow frame does not discard the confirmation; reading keeps its 120 ms check. Events received while blurred cannot confirm after refocus. The remaining local event batch is consumed when arrival begins, so the confirmation cannot also open a menu or turn a page.

The startup screen now says pinch/release or controller trigger, and no longer tells the user to wait with a wide open hand. Native startup confirmations and rejected attention checks are recorded with event source and hasHand. Reading/page/menu recognition, handMapRevision 9, requested hand flip, crisp renderer, hand badges, 3D arrival and quiet optional chime remain unchanged. This is a targeted startup repair, not a claim that the outstanding Quest clicking problem is solved.

Built: targeted startup repair. PC-tested: 35 pure tests and 99 isolated Chromium checks pass. New regressions cover an immediate native click with missing joints and a controller without XRHand, cancellation-only endings, blurred receipt/refocus, emulated viewer rejection, a 200 ms frame delay accepted, events older than 1000 ms rejected, diagnostic outcomes and packed duplicate confirmations. Reviewed: see BUILD_011_REVIEW.md for the separate critic verdict. Committed/deployed: committed and pushed on phase-1-gestures by Claude; see the top line for the live check. Needs Quest check: successful bare-hand startup, followed by repeated available page turns. No later Phase 1 work may start before Bastian passes the gesture gate.

All modules use ?v=11, header BUILD 011, export gestures-011. **handMapRevision stays 9: do not flip again.** Trial: https://p0champ.github.io/bradbury-cabin/?v=11 . Only phase-1-gestures may be pushed. Earlier entries below are history.

---
# Build 010 — repair the actual Quest startup error

Bastian tried Build 009 and reported: **“The layer test stopped: source.hand.has is not a function Return to the browser to read the test details.”** Startup failed, so no click/animation/sound pass can be inferred from that trial.

Cause confirmed: Build 009 treated XRHand like JavaScript Map and called `.has()`. The standard XRHand interface provides `get()`, `size` and iteration, not Map's has/set/delete/clear methods. The previous fixture used a full Map and concealed this mistake. The replacement test object is frozen and exposes only get/size/iteration; a separate backing map is used only by the fixture setup. Running Build 009 unchanged against it reproduced the user's exact error before the fix.

Production now detects declared wrist/metacarpal spaces with `!!hand.get(...)`. The whole native/layer/entry/occlusion/audio suite runs against the limited interface: 35 pure and 97 browser checks pass, independently repeated by the separate critic. Its hotfix score is 8/10; see BUILD_010_REVIEW.md. This is a confirmed runtime compatibility repair. No input thresholds, rendering paths, sounds or animation behaviour were changed for the hotfix.

IMPORTANT: every module query is v10, header BUILD 010, export gestures-010. **handMapRevision remains 9**, so this version does NOT flip the user's hands again. Build 009's requested flip, NEXT/BACK/START/END labels, physical palm tracking, hand-entry animation and quiet/mutable sound remain. URL: https://p0champ.github.io/bradbury-cabin/?v=10 . Follow QUEST_CHECK.md. Phase 0 crispness is passed, gesture gate remains unpassed; actual Quest startup and clicks still need a new result. Older entries are history.

---
# Build 009 — flipped hands, explicit outcomes, palm tracking and welcome sound

Bastian's Build 008 feedback: **“the clicking is still off. Dont stop working until its 100% done. Also add a animation to the hand as we enter and add a sound that plays aswell as we enter - subtle but nice you know”**. He clarified: **“Cant remeber but it def flashed and the paged stayed. Also the clicking is on the wrong hands. Flip it”**. The gesture gate remains failed until actual Quest behaviour is confirmed. Do not equate automated success with 100% device reliability.

Build 009 flips the user's current saved hand mapping ONCE using `handMapRevision:9`; subsequent reloads preserve it and later manual swaps. A normal previous default becomes LEFT = NEXT, RIGHT = BACK. The actual hand icons now spell out NEXT/BACK, or START/END on a blocked boundary, so an acknowledgement cannot be mistaken for a real turn. Menu Previous/Next actions now also return actual turned/first-page/last-page outcomes, not a generic successful selection. The two-page sample still has real boundaries; no wraparound or fake page advance was added.

A further code-level missed-input vulnerability was identified: thumb/index tracking can be inferred or obscured during a native pinch, but the app previously required both tips to be non-emulated every frame. The safety location now comes from a tracked non-emulated wrist, then index metacarpal. Tip loss alone cannot cancel a browser-recognised pinch when that physical anchor remains tracked/in view. If palm joints are declared but untracked, guessed tips or an emulated target ray cannot bypass safety. Tips are a compatibility anchor only for sources without palm joints. Native events remain the only action authority; no parallel joint or button-edge click fallback was added. Diagnostics include anchorKind and tipsTracked separately. Lookaway, blur, loss of physical anchor, system posture and fresh-release recovery guards remain.

After the existing 3D gateway opens, each visible hand gets a gentle 1-second orbit of gold light and a 12 mm depth pulse on its existing badge layer. A second hand appearing late gets its own first appearance welcome; tracking loss never restarts it. This sequence reuses two optional layer slots, never exceeding the existing three active-layer budget. No page pixels are repainted for the hand animation.

`entry-sound.js` synthesises an original quiet three-note sine chime, played once at centring confirmation per XR entry. AudioContext is unlocked synchronously by the actual Enter button before XR awaits. The menu's Entry sound on/off preference persists. Failed/suspended audio does not break XR; error/state/play count remain in exported details, including after Exit. Nodes disconnect after playback and the context closes on session end or failed entry. No recordings, paid APIs, external assets or network audio are used.

Verification: 35 pure tests and 96 isolated Chromium workflows. These include one-time legacy mapping inversion across reload; real native actions in the flipped directions; one/both emulated tips with a valid wrist; loss of physical palm; labelled hand-entry texture/transform readbacks front/lying; late-second-hand and no-replay checks; original rapid/packed native events; actual Web Audio offline peak/RMS/tail rendering, mute and one-play diagnostics; and earlier graphics/attention/boundary regressions. An audio preview and native badge images are in task outputs/build-009-evidence. These are synthetic PC evidence, not actual Quest logs or listening tests. See BUILD_009_REVIEW.md and BUILD_009_REPORT.md for independent review/release state.

Version: BUILD 009; every module ?v=9; export gestures-009; trial URL https://p0champ.github.io/bradbury-cabin/?v=9 . Phase 0 crispness remains passed. Actual missed-click cause cannot be certified without device feedback/trace, despite fixing demonstrable vulnerabilities and the explicit wrong-hand mapping. Preserve phase gates; no additional Phase 1 work yet. Only phase-1-gestures may be pushed. No Sunnyvale code, private files or live bridge service was touched. Older entries below are history.

---
# Build 008 — repeated clicks and a 3D welcome

Bastian's Build 007 Quest verdict: **“the clicker is still off. 1 click is next page. Im spamming it and it only works sometimes. Also the centering needs a nice 3d animation that invites you into the world as it centers”**. This is a failed gesture gate, not an approval to continue Phase 1. Phase 0 crispness stays passed.

A reproducible code defect was found: every successful native click and its following selectend disarmed the hand, requiring another 180 ms wide geometric opening and a 350 ms cooldown. An independent reproduction gave only 1 action from 5 valid native click cycles. Existing browser __pinch fixtures hid this by inserting 600 ms of open-hand padding before each click. This is a demonstrated dropped-repeat cause, not proof that every on-device miss had that cause.

Build 008 makes recovery-only readiness explicit (`needsOpen`). Initial entry, interruption, cancelled press or context change still requires safe steady tracking and a fresh release. A completed native click/end cycle immediately permits the next native cycle without a cooldown or geometric reopening. Valid native clicks alone authorize actions; duplicate start does not restart the hold, and duplicate select/end does not emit extra actions. When a native hand button is available, its unpressed state establishes release for recovery; a broad joint-gap fallback is used only for sources without that button. View/attention/system/ownership guards remain.

`arrival.js` adds an original paper-and-gold invitation using two transparent compositor quads, beside the centring page. After one confirmation, these leaves open outward in real depth/yaw while the page gently settles 18 cm toward its final position, with a small yaw/fade, over 1.2 seconds. The captured destination remains fixed as the user moves their head; no viewer/camera movement or opaque environment is created. The decorative textures upload once; animation uses quad transforms/opacity, not per-frame page painting. Animation freezes during hidden/blurred visibility, missing viewer pose or emulated viewer tracking. A reference reset during arrival returns to centring. Clicks during the transition are discarded, never replayed. The gateway hides afterwards and its layers are destroyed on session end. Optional layer-budget/upload failure removes decoration and keeps the reader; a gentle primary-page settle remains available without extra layers.

PC verification: 33 pure tests plus 86 Chromium checks. New regressions exercise 10 rapid native cycles at 0/80/120/200 ms spacing without geometric reopening, duplicate starts, 10 alternating native turns with only 40 ms press/40 ms spacing, and 3 complete native cycles packed into one RAF. New front/lying animation workflows verify matrices changing in depth, frozen destination, paused blur progress, discarded transition clicks, fixed page pixels during animation, cleared decoration and cleanup. Native texture/transform readbacks are reconstructed into clearly labelled synthetic 3D previews for waiting, opening, settling-side and reading stages. These are not Quest screenshots. Independent critic approved at 8/10 PC readiness, with 33+86 checks independently passing. Its minor emulated-viewer progress finding was fixed with regressions. See BUILD_008_REVIEW.md and BUILD_008_REPORT.md for release status.

Version: BUILD 008, all modules ?v=8, export gestures-008, URL https://p0champ.github.io/bradbury-cabin/?v=8 . Gesture comfort, native event delivery and animation appearance still require Bastian's Quest check. The sample is still only 2 pages: after one Next, another Next should acknowledge Last page with the orange boundary bar, not invent a page. Alternate Next/Back for repeat testing. Keep phase gates; no further reader work before approval. No Sunnyvale files or running bridge were touched. Older entries below are historical.

---
# Build 007 — native clicks, explicit centring and attention safety

Bastian's Build 006 verdict remains: **“buttons still very unresponsive and not good. Also sometimes does stuff if i look away and sometimes out of nowhere. Fix this. First when you open the app i should center myself, cause now I open the menu”**. The gesture gate is FAILED until he tests this revision and approves it. Phase 0 crispness remains user-passed. No further Phase 1 work is authorized before that gesture check.

Investigation confirmed Build 006 discarded all hand `select` events and generated actions from simulation-tuned joint distances, without a panel-attention or hand-frustum gate. Those code facts explain vulnerabilities; the exact on-headset cause of each missed/phantom click was not measured. Build 007 replaces the action authority, rather than retuning the old recognizer.

Every XR entry starts **centering**. The instruction panel follows the current view while Bastian gets comfortable. A steadily tracked, open hand followed by one completed native pinch places the page at the current viewer pose. No menu, practice or page turn is allowed before confirmation. No automatic practice follows centring; practice remains a menu option. A long centring press never opens the menu; its release is consumed by centring.

`gestures.js` now accepts only native `selectstart` → successful `select` → `selectend` transactions. Successful select commits once; selectend without select cancels. Short clicks have no app distance/minimum-duration filter. Native start timestamps drive the 1.4 second hold; completion consumes the sequence before changing context. The existing 350 ms ring delay and full-at-1.4 s hand animation remain. No native event means no action; there is no silent distance fallback. Squeeze is not bound, avoiding overlapping pinch/grab actions.

RAF validates current safety before processing queued events and ticking holds. Event rays are copied while the event frame is active; getViewerPose is never called there. Gates require session visibility `visible`, valid non-emulated tip poses, a known left/right hand inside a viewer-local 48° horizontal /42° vertical half-cone at depth 0.12–1.5 m, and the current page/menu within 40° of head-forward. Steady tracking takes 400 ms; fresh open takes 180 ms. Open recovery uses an unpressed native button plus a broad 22 mm gap when available, otherwise a 28 mm gap. These recovery thresholds never generate clicks. These are conservative trial view bounds, not a headset eye-tracking or tracking-confidence measurement.

Looking away, out-of-view hands, invalid/guessed poses, >120 ms sample gaps, hidden/blurred visibility, source removal, reference reset and the best-effort near-face system-pinch guard cancel pending actions and ring charge. A fresh tracked/open hand is required after return. Optional `skipRendering` suppression is honoured when supplied, but is not treated as a portable standard system-gesture flag. Cancelled or stale endings cannot strand nativeDown. A menu press retains its original target across frames; moving from Night to Exit cannot activate Exit on release.

Preserved: renderer modules, compositor texture lifecycle, right/left release direction and swap, hand badges, orange boundary bar/text, dim unavailable direction, world-still menu and restored reading placement. Only module cache versions changed in renderer imports. `gestureLog`/`ignoredPinches` remain bounded; exports add received/validated `nativeEvents` (event kind, source, hand, profiles, visibility, context, tracking/in-view/steady/readiness data) and current `inputState`. Use these to verify actual Quest event flow if the trial fails. No real Quest event recording was available during implementation.

PC verification: 28 pure tests and 82 isolated Chromium checks. Synthetic native events follow successful start/select/end and cancelled start/end flows; fixtures throw if viewer pose is queried on an event frame. Coverage includes start-up gating, quick native clicks, ignored joint-only movement, hold/release timing, lookaway and closed-hand return, blurred visibility, edge-of-view/system suppression, simultaneous hands, source removal, stale-event recovery, target locking, practice, honest boundary pixels, uploaded-page readbacks, front/side/lying images, and graphics/layer regressions. PC evidence is not headset evidence. Independent review and publication status are recorded in BUILD_007_REVIEW.md and BUILD_007_REPORT.md.

Version: header BUILD 007, all module queries v7, export `gestures-007`, trial URL https://p0champ.github.io/bradbury-cabin/?v=7 . Only push `phase-1-gestures`; retain passed `phase-0-crispness`. No Sunnyvale files or bridge service were touched. Stop after deployment and wait for Bastian's Quest verdict; QUEST_CHECK.md is the current eight-step check. Older entries below are history.

---
# Bastian's Build 006 Quest feedback — gesture gate FAILED (27 October 2026, 22:22)

Verbatim: **"buttons still very unresponsive and not good. Also sometimes does stuff if i look away and sometimes out of nowhere. Fix this. First when you open the app i should center myself, cause now I open the menu -"** (the last sentence was cut off in his message).

Meaning, as far as it can be read:
- Intended pinches are still often missed; this includes the menu buttons.
- False actions happen when he looks away and at random.
- On entry he wants an explicit centring step first. At the moment he ends up opening the menu instead.

Build 006's simulation-tuned thresholds did not transfer to the headset. Do not retune them blind again. He asked for the work to be handed to another agent; see the continuation prompt given to him in chat. Treat the Build 006 entry below as PC evidence only.

---
# Build 006 — gesture repair, awaiting Bastian's Quest check (27 October 2026)

Root causes found for "the skipping pages is a little weird now and doesn't change page even if the click is registered" (Build 005). These are evidence from code and simulation, not from the headset:

1. **The sample text is only 2 pages.** Next on page 2 and Back on page 1 did nothing, yet the hand icon flashed and the footer said "Next page" / "Previous page".
2. **The hold ring started on every pinch,** so every pinch looked registered. A single noisy tracking frame above 24 mm then silently cancelled it.
3. **The 38 mm open threshold** can sit above a relaxed hand's resting gap. Arming was also lost when a noisy reading dipped during the approach.
4. **Practice completion was saved only if Menu was done last,** so practice could return each session, ticking pinches without turning pages.

Fixes:
- `app.js gestureEvent` returns the real outcome (turned / first-page / last-page / practice), and the feedback and badge follow it:
  - a real turn flashes the arrows;
  - a no-op shows an orange end bar;
  - a direction with no page left is dimmed.
- The recogniser was rewritten (see README "Hands and controls"):
  - confirmed closes;
  - 30 ms spike filter during contact;
  - 32 mm open with pause-not-reset arming;
  - bounded half-open handling;
  - cooldown pinches must reopen.
- The ring is hidden for 350 ms and still completes at 1.4 s.
- Practice finishes on Next + Back in any order and returns to reading.
- Save test details exports `gestureLog` (40 firm pinches with outcome/reason/ms/page) and `ignoredPinches` (20 near-pinches with min distance). Use these to calibrate thresholds from real Quest data.

The crisp quad path (gl.js, the layer setup) is unchanged. Only hand layers animate.

Status:
- Built and PC-tested: 39 pure + 78 Chromium checks.
- Independently reviewed: round 1 scored 6/10, round 2 scored 8/10 (BUILD_006_REVIEW.md).
- Committed locally on `phase-1-gestures`.
- **Push pending:** the session's GitHub link was missing, so the live URL ?v=6 is not deployed until the push succeeds.
- Needs Bastian's Quest check: follow QUEST_CHECK.md. The gesture gate is still unpassed, and Phase 1 must not continue until he says go.

Next if gestures pass: Phase 1 full-work pagination (this also removes the 2-page boundary problem), saved place, moods, styles and ambience. If they fail: read his exported log before changing thresholds.

---
# Latest Quest feedback — unresolved, 27 October 2026

Bastian tested Build 005 and reported: **“the skipping pages is a little weird now and dosent change page even if the click is registred.”** He requested that this be noted and handed to Claude to finish the work. No repair or new Quest pass followed this report. The cause is unknown; distinguish Quest's click feedback from the app's badge pulse, emitted page action and actual page-state change. Build 005's PC checks and 8/10 review did not establish reliable on-device page turning. The gesture gate remains unpassed. Phase 0 crispness remains passed.

Next: fix this mismatch first, preserve crispness and hand-only menu animation, add meaningful regressions, obtain independent review, then ask Bastian to check gestures again before continuing Phase 1. Do not interpret this handoff as approval to skip phase gates. See CLAUDE_HANDOVER.md for the continuation prompt. Older readiness statements below describe PC evidence only.

---
# Build 005 — calmer gestures and hand feedback

Bastian reported Build 004 gestures were much too sensitive and requested skip symbols on each hand with a slowly filling menu-hold circle. Build 005 uses 18 mm firm pinch, 160 ms minimum, 140 ms open arming, 90 ms continuous release settling, 450 ms turn/select cooldown and a 1400 ms menu hold. Partial loosening stops hold charge; natural release has 220 ms travel allowance, with action duration capped at the first separation. Stalling half-open, reclosing, release bounce, tracking loss or a sample gap cancels the gesture. No time spent half-open is counted toward a hold. Either hand can summon the menu; two simultaneous pinches are not required.

`hand-badges.js` adds two 256-square, 6 cm native quad layers, positioned by the hands and oriented toward the viewer. Skip direction honours hand swapping. The active hand's ring fills in 48 steps, with a short completion pulse; the page has no hold bar and is not repainted by hand progress. Uploads use premultiplied alpha and restore GL state. New layers wait until active in renderState before subimage access. Tracking/system guards hide badges; cleanup destroys them. Optional layer allocation/upload/list failures disable badges and retain the reader with an exported diagnostic.

Verified: 23 pure tests +74 isolated Chromium checks pass. Independent critic approved at 8/10 PC readiness; release bounce, half-open duration, gradual-release ergonomics and optional layer-budget findings were fixed before approval. Phase 0 sharpness remains user-passed. Full Phase 1 is still pending. Build 005 needs Bastian's Quest check for pinch comfort, tracking, badge placement and frame pacing. PC evidence is synthetic XR with real WebGL, not headset evidence. Current URL: https://p0champ.github.io/bradbury-cabin/?v=5 . Branch and Pages source remain `phase-1-gestures`; versioned app/gesture/GL/badge modules are v5. See CALM_GESTURE_REVIEW.md and GESTURE_REPORT.md for verification. Older entries below are historical.

---
# Build 004 — Phase 1 gesture trial

Bastian explicitly reported Build 003: **“Very crisp we can move on.”** The Phase 0 crispness gate passed by the user's judgement. He requested a gesture-system brainstorm and approved the proposed right/left release turns, held menu, separate reading/menu contexts, and practice screen. Work is on `phase-1-gestures`, based on the passed `phase-0-crispness` Build 003 commit 10ee617. Do not claim all of Phase 1 is built: full-work pagination, saved place, both moods and ambience remain pending.

Build 004 adds right release Next / left release Back, hand swapping, either pinch held 750 ms to open/close the menu, explicit targets only in the menu, hand-ray default plus optional menu-only head pointer, visual hold progress and action feedback. One hand owns a gesture. Short actions happen on release after at least 60 ms; an elapsed hold always wins, including when the threshold is crossed on a release frame. Tracking loss, visibility changes, reference resets and input removal cancel pending actions and require the hand to open again. Native hand select events do not duplicate joint processing. Near-face palm pinches are suppressed with a best-effort geometry/forward-cone check; system gesture detection is not a standard WebXR flag.

The practice panel recognises Next, Back and Menu without advancing the sample text. All three marks remember practice completion in `cabin-controls`; hand-swap and pointer preferences use the same local setting. This is UI preference caching, not the future durable progress system. Menu Exit safely stops the callback even when cleanup is immediate. A first release after opening the menu never selects a button.

The approved crisp rendering modules remain the Build 003 path. One quad temporarily shows the practice/menu panel at a separate captured pose. Closing restores the stored reading-page pose; only explicit Re-centre replaces that pose. The menu remains world-still after opening and does not follow either hand or head. B uses the same displayed pose, so A/B still agrees. `gestures.js` holds the recognizer and menu geometry; `app.js` manages contexts/presentation. Old PinchGate/reading footer hit targets were removed.

PC-tested: **14 gesture/geometry tests +71 isolated Chromium checks**, including native layer regressions, real pixel readbacks and stereo depth, hold threshold boundary, tracking-loss cancellation, menu ownership/highlight with two simultaneous sources, practice, saved hand preference, menu placement/reading restoration, explicit re-centre, Exit and re-entry. Images under the task outputs/gesture-evidence show practice, menu and source readbacks plus world-projected front/side/lying views. These are synthetic XR tests, not device hand/comfort results.

Independent critic round 1 found two P2s (hold-threshold release and wrong-hand menu highlight); both were fixed with regressions. Final independent round 2 reached **8/10 for PC gesture-trial readiness**, with all 14+71 checks independently passing; see GESTURE_REVIEW.md. The new Quest gate is gesture comfort and reliability, not another claim that crispness is untested. Follow QUEST_CHECK.md and GESTURE_REPORT.md. User-facing URL: https://p0champ.github.io/bradbury-cabin/?v=4 . App/core/gesture module URLs are versioned 4; diagnostic build is `gestures-004`. The graphics module remains v3.

Hosting source is the root of `phase-1-gestures`. Preserve `phase-0-crispness` as the passed Build 003 reference. No main push or bridge change is involved. Before every commit and push scan the staged/committed contents for secrets. Local static preview is port 18140; never start or restart a second Sunnyvale bridge. No normal Chrome access, private data access or service restart occurred in this trial.

---

# Build 003 — Direct quad upload and precise graphics diagnostics

Supersedes the rendering details of Build 002 below. Bastian’s second Quest attempt reached drawing, then stopped with the old generic `WebGL reported an error drawing the compositor layer` message. That check included errors from earlier operations, so the failing operation and original numeric GL code are **not known**. Do not claim the legacy framebuffer or shader was proven to be the cause.

A now submits only the quad and uploads the raster page directly with `texSubImage2D`, as in the official Immersive Web quad sample. It never touches the legacy eye buffer or uses an FBO/shader/mipmap path for the page. Actual subimage offsets and allocation sizes are honored; clamped allocations use a staging canvas. Cached pixels survive unchanged frames; page changes, A/B return and `needsRedraw` refresh them. Flip state and binding are restored within the callback.

B now uses a native XRProjectionLayer with `textureType: texture` and DEPTH_COMPONENT24, per-eye `getViewSubImage`, scissored clears and guaranteed color/depth detach. Legacy XRWebGLLayer remains only for sessions without Layers. Resources are created after awaiting makeXRCompatible, guarding possible graphics-device transitions. GL checks identify the operation and all observed numeric codes; diagnostic exports include `phase0-003`, `renderRoute`, and `graphicsError` with stage/codes. No errors are silently discarded.

PC verification: 4 core +55 Chromium checks pass. The fixture protects opaque textures from reallocation/mipmaps/FBO use on A, verifies unbinding/detachment, reads back pixels to verify orientation and runtime-clamped sizing, tests A refresh after style changes in B, injects and verifies three named GL errors (1281/1282/1286), and draws both eyes into separate atlas viewports with actual allocated depth textures. Simulated images and readbacks are not Quest compositor/optics evidence. Independent review reached **8/10 for PC diagnostic readiness**, with all 4+55 checks independently passing; see REVIEW.md.

Retry URL: https://p0champ.github.io/bradbury-cabin/?v=3 . Header Build 003, versioned app and graphics module URLs prevent old module reuse. If it stops again, the complete error text now identifies the failing operation and code; Save test details preserves the full record after exit. Phase 1 remains gated on a successful Bastian Quest sharpness check. Sunnyvale and its running bridge remain untouched.

---

# Build 002 — Quest startup hotfix

Bastian reported: `Could not open the passthrough test: Failed to execute updateRenderState on XRSession: Can't use baseLayer with layers feature requested`. The earlier PC mock missed the browser’s rejection of the presence of `baseLayer`, even when its value is null, in a layers-enabled session. It also missed that a quad-creation fallback still needs the Layers list when that feature was enabled.

`applyLayers` now passes **only** `layers` for layer-enabled sessions, with the existing XRWebGLLayer inside the list. The legacy `baseLayer` property is used only without the feature. Older runtimes without `enabledFeatures` probe list support first. The [W3C Layers render-state algorithm](https://www.w3.org/TR/webxrlayers-1/#xrsession-updaterenderstate) explicitly permits XRWebGLLayer entries in the list. The successful A/B path no longer sends a baseLayer property at all.

Before the fix, a stricter regression reproduced Bastian’s exact error. After the fix, 4 core tests and 30 browser checks pass, covering both enabled-feature reporting and old runtimes, quad creation failure with the feature still enabled, no-layer sessions, and in-frame A/B switching. Independent hotfix review reached **8/10 PC readiness** and independently reran all 4+30 checks; see REVIEW.md. A nonblocking limitation remains for much older browsers that silently ignore an unknown Layers dictionary property; the target Quest repair does not depend on that compatibility probe. Header Build 002, module URL `app.js?v=2`, and diagnostic `phase0-002` identify this revision. Retry URL: https://p0champ.github.io/bradbury-cabin/?v=2 . This remains Phase 0; a successful Quest entry and sharpness check are still required.

---

# Bradbury Cabin handover — 27 October 2026

## Gate and current scope

Phase 0 only. Bastian must try it in Quest 3 while lying down and explicitly approve before any Phase 1 work. Bastian tried build 001 on Quest; entry failed with the baseLayer/layers error. There is still no successful headset sharpness comparison. Read README.md, QUEST_CHECK.md and REVIEW.md before continuing.

Built: static passthrough WebXR sharpness test with real compositor quad and ordinary perspective-texture paths, public-domain poem/story excerpts, bundled licensed font, paper/night, three sizes, tracked pinch page turn, head-directed control targeting, world-still placement, re-centre and diagnostic export.

PC-tested: four core tests and 21 isolated Chromium checks with real WebGL plus a synthetic XR API. Screenshots cover desktop, mobile, paper sizes, night, frontal and rotated side views, including lying-down pose. Mock timing now respects next-frame render-state changes. These are not compositor/device screenshots, stereo quality evidence, actual passthrough, or real hand tests.

Reviewed: independent critic's first pass was 6.5/10. It found a real frame-boundary A/B bug, fixed and regression tested. Final independent re-review reached **8/10 for PC readiness** after two rounds. The critic independently reran 4 core and 21 browser checks; see REVIEW.md for remaining device/lifecycle/typography limits.

Committed: Phase 0 code and hosting documentation on `phase-0-crispness`, pushed to the public remote. GitHub Pages is configured at https://p0champ.github.io/bradbury-cabin/ using that branch’s root. Needs a Quest check: yes. No main push/merge authorized.

## Work and hosting

The local repository is on `phase-0-crispness`. A separate loopback static preview was run on port 18140. It has no pairing or network link to Sunnyvale. Do not start another bridge for this app.

Bastian initially asked to create the repository himself, then explicitly asked the assistant to do it. Created **p0champ/bradbury-cabin** using the existing authenticated GitHub connection, pushed only `phase-0-crispness`, and configured GitHub Pages for that branch’s root. No main branch was pushed. Public remote: https://github.com/p0champ/bradbury-cabin.git . The repository and first public publication are authorized by that follow-up. Before each commit/push inspect staged/committed files for secrets; no private URLs, credentials, pairing codes or phone numbers belong in this public repo. Network operations require the environment’s normal network approval; use a per-command `safe.directory` exception for this exact checkout when an elevated Git process runs as the user rather than the sandbox account. Never weaken Git’s global directory trust. `.nojekyll` keeps the deployment as literal static files, including markdown checklist/credits.

The app has no dependencies or build step. `npm start` runs the static preview; `npm test` runs core tests. For browser regression checks, install/use a test-only Playwright runtime and its Chromium, start the static preview, then `npm run test:browser`. `CABIN_PLAYWRIGHT_PATH` and `CABIN_CHROMIUM_PATH` optionally point to an existing test runtime/browser; `CABIN_EVIDENCE_DIR` selects screenshot output. Never point tests at a personal browser profile. No normal Chrome automation or account login is needed. Font files and licence ship locally; there are no runtime CDN requests.

## Important implementation details

- `app.js`: app state, Canvas 2D page painting, XR lifetime, input, hit testing and layer drawing. `core.js`: small test-corpus pagination, dimensions and pinch gate. `gl.js`: WebGL2 source texture/shaders and column-major matrices.
- 2048 × 2560 requested layer; 0.72 × 0.90 m at 1.1 m. Both A and B use the same source. Source mipmaps keep B's minification fair. Actual layer viewport dimensions are exported.
- A mode switch requested during a joint pinch applies to render state at the next XR boundary. Finish the current callback using its initial `drawMode`. Do not replace this with immediate `state.mode` checks after input.
- Projection color/depth textures are attached and detached inside the XR callback, including error cleanup. A quad is filled directly using `texSubImage2D`; it is never attached to a framebuffer. Do not reallocate or generate mipmaps on runtime-owned textures. B alone uploads an ordinary canvas texture using `texImage2D`.
- Use `local` space, never continuous viewer parenting. Capture head orientation as well as translation on initial placement/re-centre, so lying down works. A space reset explicitly re-centres. Tracking loss clears the gesture state.
- Gaze means head direction, not eye tracking. It targets controls; there is no automatic gaze page turn in this phase. Pinching away from controls advances. Start with an open hand; a held pinch never repeats. A/B doesn't move the page.
- Layer-creation failure leaves an explicitly labelled texture-only fallback, which cannot pass the gate. Drawing failure ends XR with an error. Alpha-blended passthrough is required. No Layers polyfill or opaque virtual room.
- Export after exit retains the last render mode and layer result. Test details contain local browser/runtime information, not bridge secrets. Do not present a successful mock draw as a successful Quest draw.

## Sunnyvale studied; leave its service alone

Read the existing Sunnyvale checkout's HANDOVER.md, bridge/server.mjs and relevant bridge transport code, browser-bridge.js, browser-media.js and browser-voice-link.js during initial investigation. Its running port-8130 listener was observed. Process command-line inventory was denied by the environment; socket inspection confirmed the listener. No service was restarted, no competing bridge was started, no normal Chrome was accessed, no private runtime contents were read or copied, and Sunnyvale code was not changed.

Later Phase 3: reuse its extension/browser pipeline and separate audio sequencing/ACK channel; add a cabin-specific connector route/secret and private durable namespace inside the same bridge. Test shared changes on a branch, with throwaway `BRIDGE_PRIVATE_DIR` and separate ports, before any approved real service restart. Do not assume other tasks' historical restart approvals apply to Cabin. Reconcile against the current active Sunnyvale branch before editing. Claude's own Drive connector is the preferred route to the newest story file in **Bradbury stories**, with supported formats checked at that phase.

## Preserve these requirements for later phases

- Challenge started 18 Oct 2026, day 1 completed. 21 Oct missed: Rumi's The Guest House, Chopin's The Story of an Hour, Woolf's The Death of the Moth. Other dates must not be invented. Keep the full year including missed days. Reminder preference 20:00; no reminder automation has been created.
- Three daily cards; poem/story/essay each ticked separately. Only three ticks completes a day. Prevent repeats using durable history. Broad era/country/field variety and stored tutor priorities.
- Weekly story due Sunday. External writing, newest Drive-folder file, Claude review only: idea/structure/character/prose/ending each 0–10, ranked priorities and questions. Never rewrite stories or pitch ideas. Grade-to-picker connection must be durable structured data.
- Durable private bridge storage plus headset cache and export. Cache alone is insufficient.
- Phase 1 adds general full-work pagination, poem stanzas, saved place, both moods, ambience and optional corner gaze turning off by default. Phase 2 adds calendar/history. Phase 3 adds Claude. Phase 4 adds meaningful animation/polish. Every phase needs independent critic review up to three rounds and a separate user Quest gate.
- Legal-source full texts through bridge, prefer available full text; modern copyrighted works need source windows or personal imports. No invented full-text coverage percentage. Sounds must be licensed and credited.
