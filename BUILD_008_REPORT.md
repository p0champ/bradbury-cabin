# Build 008 — repeat clicks and a paper-and-gold welcome

Bastian reported Build 007 still missed clicks when repeated and requested an inviting 3D centring animation. The implementation now trusts each completed native click cycle without an artificial pause or wide finger opening between clicks. Recovery after an unsafe or cancelled press still requires a released, steadily tracked hand. One completed click requests one Next/Back; the two-page sample still reports its boundaries honestly.

After centring confirmation, two transparent paper-and-gold leaves open in real depth/yaw while the page eases to its captured destination over 1.2 seconds. The animation never moves the camera or creates an opaque environment. Page pixels are not repainted every animation frame. The final reading placement stays fixed even when the user turns their head during arrival. Transition clicks are discarded, not replayed. Animation pauses while blurred/hidden, with missing viewer pose or with emulated viewer tracking. Layer-budget failure keeps reading available.

| Status | Evidence |
| --- | --- |
| Built | Recovery-only click readiness, repeat-click fix, original procedural 3D welcome and interruption safeguards |
| PC-tested | npm test: 33 passing; npm run test:browser: 86 passing; synthetic XR/native events with real WebGL |
| Reviewed | Independent critic: 8/10 PC readiness; BUILD_008_REVIEW.md |
| Committed | Release stays on phase-1-gestures, based on Build 007 901bae1 |
| Deployed | Target URL https://p0champ.github.io/bradbury-cabin/?v=8; build completion and exact live-file checks are confirmed in the release reply |
| Needs a Quest check | Yes. Build 007 failed on device; gesture gate remains unpassed. Sharpness remains user-passed |

New input regressions deliberately avoid padded clicks: 10 cycles at 0/80/120/200 ms spacing, 10 alternating browser turns at 40 ms press/40 ms spacing with a 20 mm joint gap, and three complete cycles packed into one RAF. Existing lookaway, system gesture, tracking, context and duplicate-event tests remain. Animation tests verify changing native matrices, final destination, paused progress, fixed page upload version, ignored transition input, hidden decorations and destruction on Exit. Images show actual mock native textures projected using their native transforms; they are explicitly labelled synthetic, not Quest footage.

The small native-hand button release is used to establish recovery when available; geometric distance remains only a no-button fallback. The 1.4 second hold, delayed hand ring, hand directions/swap, crisp quad path, honest orange boundary bar/text, and stationary menu are preserved. No Sunnyvale code/service, normal Chrome profile or private bridge was touched. Only phase-1-gestures is pushed; no main or Phase 0 reference change.

Follow QUEST_CHECK.md. Stop after this trial and wait for Bastian's headset verdict before further Phase 1 work.