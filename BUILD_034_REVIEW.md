# Build 034 — calm, Apple-standard design pass
28 October 2026. Requested by Bastian: "Apple style, professional, seamless, clean, aesthetic, elegant", including the opening animation, feel and usability. Apple's Human Interface Guidelines (visionOS, materials, typography, motion, eyes, colour, spatial layout) were read by a research helper and applied where they fit a WebXR canvas app.

## What changed (visual and motion only)
- New theme.js: one interface font (system UI sans, Roboto on Quest) replacing Arial everywhere; Literata stays for literature. Refined paper and night palettes, one deep accent, shared hover tint and ring.
- Running head: the large repeated "A little room for reading." and "B / C" masthead are gone. A small spaced BRADBURY CABIN on the left, the work's title on the right (hidden in menus), a soft hairline below. Bookmark diamonds slightly smaller.
- Hover (HIG: subtle highlight, keep the label constant): the solid dark-green fill with inverted text is replaced by a soft tint plus a 6 px accent ring. Text never changes colour on hover. Applies to menu, Today, closing page, shelf and library. Calendar keeps its own existing style.
- Today/closing: gold 3 px bars become 2 px hairlines; kind labels are spaced small capitals; read status quieter; the "mark as read" box is a circle that fills with a check.
- Cards: larger, consistent corner radius (36, menu 40). Hit rectangles and button geometry unchanged; gesture recogniser, handMapRevision 9 and menu indices unchanged.
- Arrival (HIG: avoid large motion toward the viewer, no oscillation): the page approaches 6 cm instead of 18 cm with a softer quartic settle; the cover leaves fade with a smoothstep instead of a linear ramp, in the new colours; the idle "breathing" bob is removed. Duration unchanged (1.2 s).
- Start page: test-lab wording removed ("gesture trial", "words are clear"). New welcome: "A quiet room for three readings." with a short three-gesture guide (pinch and release, hold a pinch, point then pinch), Literata headline, system font, rounded soft buttons, one gentle rise-in on load (disabled for reduced-motion). Developer tools stay available under "Preview and tools" with quieter styling; all element IDs unchanged.
- All queries v34, header BUILD 034, diagnostic gestures-034.

## Validation
- npm test: 155/155 unit tests, workflow parity and all exact-source checks; catalogue unchanged at 241 works. Test canvas stand-ins gained moveTo/lineTo/stroke (finite-geometry checked).
- One intentional browser expectation changed: night paper first pixel is now [19,23,21] (new night tone #131715) instead of [26,33,30].
- Full PC browser suite: 148/148 passed after the critic fixes (../build-034-browser.log, evidence ../build-034-evidence, upright and lying, paper/night, literary/modern). All modules pass node --check.

## Independent review
A separate critic agent that wrote none of the code reviewed the diff, screenshots and constraints.
- Round 1: 7.5/10, no P1. P2: hover tint ignored the modern style; hover too faint for headset pinch-selection. P3: invalid lineJoin leak, old 3 px shelf bars, dead arrival code, centring diamonds, start-page wording (swap hands, sync), night page background, indentation.
- Fixes: per-palette hover tints (paper #ddd4bf), ring 8 px, shared hairline rule on the shelf, lineJoin reset, diamonds hidden while centring, copy fixes, night root background. Full suite rerun 148/148.
- Round 2: 8.5/10, no P1 or P2 in code. Remaining P3s: shelf imports rule from today-panel (tidier in theme.js); muted label contrast on the hover tint about 3.2:1; leaf wash not night-tinted; reading footer repeats the title and margins differ slightly (160/180/194). Last indentation point fixed. The critic's remaining caution: check hover visibility on the Quest in bright and dim rooms.
- No literary text, source verdict, picks parsing, sync or progress logic changed.

## Not done / deferred
- Not tried on the Quest yet; PC browser uses synthetic XR. Check hover ring visibility in bright and dim rooms, and that the shorter arrival feels calm.
- Today reveal still steps in four repaints (no per-frame fade) to keep repaint cost low in XR.
