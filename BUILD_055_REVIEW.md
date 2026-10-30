# Build 055 — Quiet Folio

Built locally on `build-055-quiet-folio`, based on confirmed Build 054 (`fcbaf67`). Not published; Quest verification pending.

Bastian approved Quiet Folio after three plain-language concepts and an independent design judge's 9/10 choice. The approval covers building; publishing remains a separate decision.

## Result

- Settings → More settings → Reading comfort contains one continuous Focus dim slider and a Seasons switch. Dimming ranges from transparent to 96% black and is remembered. It eases in over reading, previews the chosen strength while adjusting the slider, and restores the room in other menus. The native page stays opaque and crisp above a separate projection layer. A limited-layer headset can keep the native page while room dimming steps aside.
- Aim at a displayed word and pinch. A compact glass card sits beyond the nearest side of the page, near the word's height. It shows a meaning and, for a supported reference, a short background note. Pinch that word again to close it. Page turns, menus, reflow and tracking loss dismiss it; asynchronous results cannot reopen a departed page. Holding still opens the existing menu. Word selection uses the hand pointer even when head pointing is preferred for menus. Dictionary meanings are general meanings, not an AI interpretation of the sentence.
- The offline glossary covers a few common older words and references. Other lookups need a connection to Free Dictionary and, for references, Wikipedia. No new server or API key is needed. Exact references only; ambiguous and missing articles do not produce invented notes. Provider failures produce a retry message.
- Seasons start off. Enabling them adds a subtle seasonal tint to the glass frame; the paper and words keep their existing contrast. A tiny detail drifts outside the page after 90 seconds, then at most once every three minutes. Reduced motion retains the tint and omits the drifting detail. Northern/Southern hemisphere can be chosen; the local calendar selects the season.
- The existing deliberate placement keeps the page straight ahead along the seated viewing direction and fixed in the room after confirmation. There is no automatic movement when reclining or looking away. Intro and wrist-watch implementations are unchanged apart from cache keys.

## Validation

240 unit tests and all maintained literary-source checks pass, including all 39 damaged-source rejection checks. The 241 accepted literary works and their stored text are unchanged.

308 browser cases pass across the full-run prefix and complete focused reruns (300 existing cases plus 8 comfort cases). This was not one clean full-suite invocation. The detailed group counts are saved in the current chat outputs as BUILD_055_TEST_RESULTS.json. Browser checks use synthetic WebXR with real Chromium/WebGL. They cannot prove real Quest comfort, hand tracking, compositor behaviour, or Apple Vision Pro quality.

The lookup response and failure paths are covered with deterministic browser responses. Separate live requests to both public providers returned HTTP 200 and wildcard CORS headers. Live Quest access to those providers remains unverified.

## Test-harness notes

The display stack now includes a dim projection layer below the native page, so fixed layer-count assertions include it. A one-layer runtime retains the native page and disables optional dimming. The mock treats a relaxed reading hand independently from head direction and relaxes the hand after opening a reading; deliberate word aims remain explicit. Playwright fixed-date setup can replace the initial performance clock binding, so the mock now binds performance.now to the XR frame clock at frame and native-event boundaries. A rejected press was traced to future event timestamps; no application tracking windows or gesture safeguards were loosened. Failure-only press diagnostics were retained.

## Device check after an approved release

Check the full dim range on the couch, the page's comfortable height and steady position, a word in each text size, a word near an opening letter, a place/reference, and both page-turn hands. Check the intro and watch feel unchanged. Leave Seasons off for the first reading; then enable it briefly and check the tint and rare detail. Verify dimming restores on opening the menu and when leaving.
