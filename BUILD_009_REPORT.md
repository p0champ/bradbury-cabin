# Build 009 — flipped labelled hands, physical tracking and welcome audio

Bastian clarified that a click flashed while the page stayed, and that the hands were the wrong way around. This revision flips his saved mapping once and labels the icons NEXT/BACK or START/END. A normal previous default becomes left NEXT / right BACK. Reload does not flip again; later manual swaps remain possible. Reading and menu page actions both report real turns or real sample boundaries.

The native recognizer is no longer vetoed merely because fingertips are inferred/hidden while the physical wrist or metacarpal remains tracked. A real physical anchor, attention/view gates and native event completion are still required. Loss of declared palm tracking cannot fall back to guessed tips or an emulated aiming ray. No additional click recognizer was introduced.

After the gateway opens, each hand gets one short gold orbit/depth pulse on its existing compositor badge, even if it first appears later. A quiet original three-note chime plays once at centring confirmation. Entry sound on/off is saved in the menu. Audio unlock occurs on Enter, exceptions are diagnostic rather than fatal, and cleanup stops/releases the audio context. No new external media or sound service is used.

| Status | Evidence |
| --- | --- |
| Built | Flipped mapping and labels, honest menu boundaries, physical-anchor gate, per-hand welcome animation, quiet/mutable entry chime |
| PC-tested | npm test: 35 passing; npm run test:browser: 96 passing; native synthetic events and real WebGL/Web Audio |
| Reviewed | Independent critic 8/10 PC readiness, final round 2; BUILD_009_REVIEW.md |
| Committed | Release remains on phase-1-gestures, based on Build 008 718c041 |
| Deployed | Target https://p0champ.github.io/bradbury-cabin/?v=9; build and exact live-file verification are confirmed in the release reply |
| Needs a Quest check | Yes. The user's repeated missed-click feedback has not yet been cleared by an actual device verdict. No 100% claim |

New verification includes legacy mapping/reload and actual flipped page turns; native emulated-tip recognition with a real wrist versus physical-anchor loss; anchorKind/tipsTracked outcome logs; hand-welcome matrix/texture/readiness/no-replay tests front/lying and late second hand; actual AudioContext one-play diagnostics; OfflineAudioContext render with quiet peak/RMS and silent tail; and mute suppression. Prior rapid/packed clicks, boundaries, visibility, lookaway, layers, pixel uploads and lifecycle regressions remain.

Synthetic badge PNGs and an original rendered WAV preview are in task outputs/build-009-evidence. They are not device footage or a Quest listening test. The hand and sound animations do not repaint the reading page. Gate safeguards, crisp renderer and three-layer active budget are preserved.

Use QUEST_CHECK.md. If still failing, record the icon's exact word and get Save test details so hardware event delivery, physical tracking and real page outcomes can be distinguished. Keep working on the gesture gate, but do not claim hardware completion or advance to another phase without Bastian's result. No Sunnyvale bridge/code or normal Chrome session was touched; no main push.