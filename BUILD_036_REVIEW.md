# Build 036 — pointer, glass hand markers, smoother and quieter
29 October 2026. Bastian on 035: better, intro improved, still clunky; no pointing line makes aiming hard (but it must look good); hand markers look terrible; clunky = pages jump, too much text, heavy menus. Design agreed first (faint beam + soft dot; Apple-glass hand markers), then "go for it".

## What changed
- pointer.js (new): in menus only, a 4 mm hairline beam from the hand ray that fades toward the hand, and a soft dot where it meets the page. Compositor quad layers; never shown while reading or with the head pointer. Layers stay listed while a menu is open (opacity only), rays under 8 cm hidden, non-finite poses skipped.
- Hand markers: frosted dark-glass discs with one thin chevron (menu: three thin lines), no words; warm hold ring; short warm end stop when blocked.
- Smoothness: view changes fade the window in over 160 ms (from 0.5); page turns only breathe (from 0.85); no dip right after arrival.
- Less text: instruction footer lines disappear after three visits (feedback messages still show); canvas page count reads "4 / 12".
- Menus: Apple-style inset grouped list — one soft panel per group, hairline dividers, only the pointed row lifts; labels 54 px. Hit rectangles unchanged.
- v36 / BUILD 036 / gestures-036; pointer.js allowlisted.

## Validation
- npm test 155/155 + source checks; full PC browser suite 148/148 (../build-036-browser.log, ../build-036-evidence).
- Test harness: mock recognises pointer layers (pixel widths 48/160) so they are not mistaken for the page.
- Gaps: no automated pointer behaviour tests; no isolated mutation run; no Quest check. Mutable XRQuadLayer.height (beam length) is spec-allowed but unproven on Quest Browser — on the Quest checklist.

## Independent review
Critic round 1: 7/10 (P2: fade dip after arrival, every page turn dimming to half, layer churn at page edge, height setter unproven, faint markers, no pointer tests). Fixed all but the device check and tests. Round 2: 8.5/10, remaining: height setter on device, pointer tests, minor churn on tracking loss, visits counted on re-centre.
