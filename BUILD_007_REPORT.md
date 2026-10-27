# Build 007 — centring and native-input trial

Build 006 was unresponsive and produced phantom actions in Bastian's headset check. Investigation found the app deliberately ignored native hand selects and had no lookaway or hand-in-view safety gate. Build 007 uses native completed clicks for page/menu actions, with joint tracking only for safety and fresh-open recovery.

Every entry starts by asking the user to get comfortable, face the intended reading direction and pinch/release once to centre the page. All other actions are blocked until that confirmation. A 1.4 second native hold still fills the hand ring and opens the menu. Looking away, losing a hand or entering system UI cancels the press and requires a freshly opened hand. Menu presses cannot drift onto a different button. Reading direction, swap, honest boundary feedback and compositor rendering are preserved.

| Status | Evidence |
| --- | --- |
| Built | Native-select state machine, startup centring, visibility/tracking/view/attention gates and expanded diagnostics |
| PC-tested | npm test: 28 passing; npm run test:browser: 82 passing; isolated test Chromium with synthetic XR and real WebGL |
| Reviewed | Independent critic 6.5 → 8/10 over two rounds; BUILD_007_REVIEW.md |
| Committed | Release is kept on phase-1-gestures; implementation is based on Build 006 ca2fc15 |
| Deployed | Target GitHub Pages URL is https://p0champ.github.io/bradbury-cabin/?v=7; completion and exact live-file checks are reported in the release reply |
| Needs a Quest check | Yes. Gesture gate remains unpassed; Phase 0 sharpness remains user-passed |

Tests cover successful start/select/end, cancelled start/end, duplicate/stray native events, joint-only movement, short clicks, native hold timing and release consumption, centring first, lookaway/blur/tracking/source/system interruptions, closed-hand return, stale release recovery, simultaneous hands, immutable menu targets, page boundaries and actual uploaded pixels. Images include front/lying centring, native menus and side views, plus hand-only ring readbacks. They are not screenshots of Quest optics or real hand recognition.

The native API flow is verified against the W3C WebXR Device API and exercised in mocks. It still needs verification against the user's real Quest event stream; diagnostics retain received and validated event stages, source profiles, visibility, context, in-view/tracking/steady/readiness data and action outcomes. No silent distance fallback exists.

Follow the eight steps in QUEST_CHECK.md. Stop after the headset trial request; do not continue Phase 1 until Bastian approves gestures. No Sunnyvale files or bridge service were touched. Only phase-1-gestures is pushed; main and the passed phase-0-crispness reference are preserved.