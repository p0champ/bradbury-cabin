# Build 035 — the window, the greeting, Today first
29 October 2026. Bastian on Build 034: the pointing colour is nice but "more Android than Apple"; the intro barely changed; the whole experience still doesn't feel like Apple. Approved ("go for it"): rounded floating window, a new intro, open on Today.

## What changed
- Rounded floating window: the page's corners are masked transparent (radius 88 px of 2048) at the end of every paint; the quad layer blends source alpha and the page uploads premultiplied, the same proven route the old leaves used. Texture fallback keeps square opaque corners.
- New intro: the two book-cover leaves are retired. The window fades in (smoothstep opacity) with a 3 cm settle and shows a greeting painted once: "Good morning/afternoon/evening." and "Today's three are ready." or "Continuing <title>" (fixed at confirmation so a sync mid-fade cannot change it). The page position line and running-head title are hidden during it.
- Today first: every entry opens on Today when today's three exist (the stepped build plays only on the first entry of the day). Footer on Today: "Hold a pinch to continue reading." Without today's three, entry continues reading as before.
- Hover: a visionOS-style lift (card brightens, soft shadow beneath), replacing the green ring. Night hover card brighter (#3a443f) because shadows don't show on dark.
- All queries v35, header BUILD 035, diagnostic gestures-035. No hit geometry, gesture, menu index, text, picks or sync change.

## Validation
- npm test 155/155 plus all exact-source checks.
- Full PC browser suite 148/148 (../build-035-browser.log, ../build-035-evidence).
- Tests updated for intended behaviour: night pixel sampled inside the window; upload-matches-canvas compares opaque pixels (corner edges are premultiplied); leaves test now asserts no decoration layer exists; re-entry expects Today, then holding a pinch reads. New check: corner alpha 0, inside alpha 255, page layer blendTextureSourceAlpha true.
- Not done: isolated mutation run for the new window-shape check (credits); no Quest check.

## Independent review
Separate critic, no code written by it. 8/10, no P1. P2: nothing tested the rounded window → added the window-shape check. P3s fixed: leaf assertion could never fail (now asserts no arrival layer), greeting could change mid-fade (now fixed at confirmation), weak night hover (brighter). Left: the unused Arrival object is still constructed (harmless, dead code to remove later); 00–05 says "Good evening."

## Release
Code commit 3919de5 pushed to build-035-window and phase-1-gestures. Live https://p0champ.github.io/bradbury-cabin/?v=35 verified: index.html, style.css and all 29 JavaScript modules match reviewed local files (line endings normalised). Secret scans passed. Not yet seen on a Quest.
