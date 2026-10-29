# Build 037 — a proper welcome, a precise dot
29 October 2026. Bastian on 036: beam pointer far too long and inaccurate; intro too quick; it opens a random text; wants a proper welcome screen. Two designer agents (visionOS purist, calm editorial) proposed, a separate judge merged; Bastian approved ("its good"; wrist to use Apple glass look in 038).

## What changed
- welcome-panel.js (new): every entry lands on a welcome screen. The arrival fade shows "Good evening, Bastian."; then in three 600 ms steps a hairline, a line about the day ("Three pieces are waiting." / "Today's three are read." / "Today's three haven't arrived yet."), and the choices: "Begin today's reading" (Today) and "Continue <title> p. N", or only Continue without picks; small "Menu ›". A pinch mid-build completes it and its release cannot choose.
- Pointer: beam removed. A 6 mm dot on the page; over a choice it becomes a 12 mm ring that closes to 8 mm while pinching. Hand rays are steadied with a One-Euro filter (min cutoff 1.0 Hz, beta 0.03, resets on jumps and tracking loss) and the choice under the dot is held from pinch close (or Quest's native press) until release. Selection uses exactly that held, steadied target, so what you see is what you pick.
- Picks arriving while the welcome is open repaint it with a fresh input guard.
- v37 / BUILD 037 / gestures-037; welcome-panel.js allowlisted. No hit rectangles of existing buttons, gesture recogniser, handMapRevision 9 or menu indices changed.

## Validation
- npm test 155/155 + source checks; full PC browser suite 148/148 (../build-037-browser.log, ../build-037-evidence incl. welcome-screen.png).
- Test harness: entering now passes through the welcome; __welcomeChoose aims and really pinches the first choice wherever the fixture has hand joints and the aim lands (and fails if the pinch doesn't leave the welcome); aim-less fixtures (texture fallback, controller-only) use the preview's Close menu button for Continue. Manual-entry tests assert the welcome first.
- Gaps: welcome wording not asserted by a test; no isolated mutation run; no Quest check.

## Independent review
Round 1: 6/10 — P1: selection still used the raw native ray, not the steadied/held target the dot showed. P2: slow build-completing pinch could choose; picks arriving mid-welcome; stale evidence; test gaps. All fixed. Round 2: 8/10 — a swallowed release could leak to the next pinch (fixed: cleared on selectend) and the hold could drop before Quest's own release (fixed: also hold while the native press is down). Full suite rerun 148/148 after both.

## Release
Code commit a37469f pushed to build-037-welcome and phase-1-gestures. Live https://p0champ.github.io/bradbury-cabin/?v=37 verified: index.html, style.css and all 31 JavaScript modules match reviewed local files (line endings normalised). Secret scans passed. Not yet seen on a Quest.
