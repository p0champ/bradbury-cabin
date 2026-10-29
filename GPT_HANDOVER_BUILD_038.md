# Handover for a new ChatGPT/Codex chat: Bradbury Cabin, after Build 037

You are continuing Bastian's Meta Quest 3 WebXR passthrough reading app, **Bradbury Cabin**. Read all of this before acting. Continue the work; do not restart or redesign what is approved.

## Who Bastian is and how he wants to work
- He is not a programmer. Short, plain-language updates. No jargon without a one-line explanation.
- **Agree the design idea before building.** He said: "rather get the idea right before we build". Propose and get a clear yes ("go for it") before coding a new feature. Once a scope is approved, work through it autonomously without needless check-ins.
- **Use separate agents.** He explicitly likes this: "I like the idea of the separate agents, it yields better results."
  - For design questions, have two or more designer agents with distinct stances (for example a visionOS purist and a calm editorial reading designer) propose independently. A separate judge agent then merges them into ONE recommendation for Bastian to approve.
  - Every build gets an independent critic agent that wrote none of the code. It gives ranked findings (P1/P2/P3) and a score; release at 8/10 or more within up to three rounds. Record it in BUILD_0xx_REVIEW.md and HANDOVER.md.
- **The bar is Apple:** clean, calm, professional, seamless, elegant, "Apple feel all the way through". He dislikes anything that looks "Android" (for example coloured outline rings), long beams, clutter, jumpy transitions and instruction text everywhere.
- He wants real-device honesty. PC browser tests use synthetic XR and mocked Google. Never claim Quest, real Claude or real Drive testing happened unless he did it.
- Credits/usage are limited. Prefer high-impact changes and keep notes current, so work survives a sudden stop.

## Links Bastian provided (use what is useful, ignore the rest)
- https://developer.apple.com/design/human-interface-guidelines
- https://developer.apple.com/design/human-interface-guidelines.md (Markdown version, easier to read)
- https://developer.apple.com/design/resources
- https://developer.apple.com/videos/play/wwdc2017/802/
- https://github.com/rshankras/claude-code-apple-skills
- https://github.com/haider-nawaz/liquid-glass-skill

What was most useful so far from the visionOS HIG:
- hover is a subtle lift/brighten, never a solid colour inversion or coloured ring;
- rounded shapes;
- avoid large motion towards the viewer and idle oscillation;
- keep reading surfaces opaque and put glass on the chrome;
- no text depth;
- fade rather than move.

The liquid-glass repo is SwiftUI API only; take the look, not the code.

## Repository and release state
- Local active repo (Windows): `C:\Users\Bruger\Documents\Codex\2026-10-28\files-pasted-by-the-user-handover\work\bradbury-volume`
- GitHub: https://github.com/p0champ/bradbury-cabin. Pages branch: `phase-1-gestures`. Never write to main or phase-0-crispness.
- **Live: Build 037** at https://p0champ.github.io/bradbury-cabin/?v=37. Code commit a37469f, release record f24653b, branch `build-037-welcome`. Live files were verified identical to the reviewed local files (31 JS modules).
- Read HANDOVER.md (newest first), BUILD_034–037_REVIEW.md and QUEST_CHECK.md in the repo.
- Git quirks on this PC:
  - no global identity: commit with `-c user.name=Codex -c user.email=codex@openai.com`;
  - ownership: use a command-local `safe.directory` (or env `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0=<repo path>`). No global changes.
- Release routine:
  - `node ../scan-release.cjs` (staged secrets), commit, then `node ../scan-release-committed.cjs`;
  - `git push origin HEAD:<feature-branch> HEAD:phase-1-gestures` (never force);
  - verify live with `node ../verify-build-0xx.cjs` (copy the latest and bump the version);
  - bump ALL `?v=` imports, the index header `BUILD 0xx` and the diagnostic `gestures-0xx` together;
  - add any new root JS module to the `serve.mjs` allowlist.
- Tests:
  - `npm test` runs 155 unit tests plus source checks.
  - Full PC browser suite: start `PORT=<port> node serve.mjs` (restart it after adding a module). Then set the environment variables CABIN_BASE_URL, CABIN_PLAYWRIGHT_PATH=`C:/Users/Bruger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`, CABIN_CHROMIUM_PATH=`C:/Users/Bruger/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe` and CABIN_EVIDENCE_DIR, and run `node tests/browser-check.cjs`. Currently 148/148 pass.
  - The harness's `__center()` now passes through the welcome screen via `__welcomeChoose()`, which really pinches when the fixture has hand joints and a placed layer.
- Hard constraints:
  - handMapRevision stays 9;
  - don't change the gesture recogniser (gestures.js), main-menu indices or existing button hit rectangles;
  - literary texts must stay word-for-word from the reviewed catalogue (241 works) and are never model-written;
  - don't touch Sunnyvale's bridge on port 8130;
  - no account automation or paid services.

## What Builds 034–037 did (design track)
- **034:**
  - theme.js design system: system sans plus Literata, refined palettes;
  - quiet running head instead of the "A little room for reading." masthead;
  - hairlines;
  - new start page.
- **035:**
  - the page became a rounded floating window (transparent corners, premultiplied upload, blendTextureSourceAlpha);
  - the book-leaf intro was retired in favour of a fade plus greeting;
  - visionOS-style "lift" hover.
- **036:**
  - glass hand discs with one chevron;
  - 160 ms view fades (page turns only "breathe" from 0.85);
  - instruction lines hide after 3 visits;
  - Apple grouped-list menus;
  - a beam pointer, which Bastian hated (too long, ugly).
- **037:**
  - welcome-panel.js: every entry lands on a welcome screen ("Good evening, Bastian.", a line about the day, "Begin today's reading" / "Continue <title> p. N", "Menu ›"). A mid-build pinch only completes it.
  - pointer.js: no beam. A 6 mm dot becomes a 12 mm ring over a choice and closes to 8 mm while pinching.
  - One-Euro smoothing of hand rays (min cutoff 1.0, beta 0.03, resets on jumps and tracking loss).
  - The choice is held from pinch close or native press until release, and selection uses exactly the held, steadied target.

## Bastian's latest feedback (Build 037): "The dot is not as accurate as it should be."
This is the top open issue. Investigate before changing anything, and propose a fix to Bastian. Likely causes to check:
1. **The ray origin and direction come from `targetRaySpace`.** On Quest hands this is a wrist/shoulder-derived ray that wobbles with wrist rotation. visionOS-like accuracy usually needs a ray from a stable body point (approximate shoulder or head) through the pinch point (index–thumb midpoint). Compare the two on device.
2. **Smoothing lag versus jitter trade-off.** The One-Euro values were untuned on device. A higher beta means less lag; a lower min cutoff means steadier.
3. **No magnetism yet.** The judge recommended snapping the dot towards a button centre within about 12 mm at 0.4 gain, releasing at about 18 mm (hysteresis). It was cut from 037 for time.
4. **The dot's visual position versus the hit-test.** Both use the same filtered ray and plane math (`rayOnPage` in pointer.js, `hit()` in app.js), but confirm that the dot sits on the page plane while the page is placed for menus (menuPlacement / presentPose).
5. Consider a short calibration-free check: draw the raw and filtered hit points side by side in a debug view on the PC preview and on the Quest.
Use the separate-agents approach: a designer pair plus a judge for the interaction model, then a critic for the build.

## Approved but NOT built: Build 038 (from the designer/judge round, approved by Bastian)
1. **Wrist glance in Apple glass.** Bastian asked for the "Apple glass look on the wrist".
   - Replace the calendar grid on the right wrist (watch.js, 8.8 x 7.7 cm quad) with a glance card: weekday, big day number, and three dots for today's reading (filled when read).
   - Frosted glass styling.
   - Appears after about 300 ms steady, with 120 ms show/hide hysteresis.
   - Pinch opens the shelf.
   - Repaint only on state change.
   - Keep the right-wrist-only rule.
2. **Cleaner hand discs.**
   - About 3.6 cm frosted glass, 12% white fill, 1 px top inner rim, thin 2 px chevron.
   - Idle 55% opacity, 90% near the page.
   - Fade out after 5 s idle.
   - Thin hold ring starting at 12 o'clock, clockwise.
   - Existing pixel tests check colours in hand-badges; read those tests before changing colours.
3. **Remaining jumpiness:**
   - One-Euro on the hand and wrist poses that layers follow;
   - hold the last pose on tracking loss;
   - never repaint a texture while its transform animates;
   - cap per-frame transform jumps;
   - preload textures before the welcome.
Cut on purpose:
- full-room dimming veil;
- scale animations of quads (per-frame resizing is unverified on Quest);
- expanding cards;
- wrist month sheet.

## Deferred real-world checks (one combined test at the end; don't block on them)
QUEST_CHECK.md lists per-build checks for 027–037. Bastian confirmed on the Quest:
- Claude's opening line on Today (033);
- the Library shortcut (033);
- 034 look (pointing colour liked, still "not Apple" then);
- 035 intro better;
- 036 discs liked, beam hated;
- 037 dot not accurate enough.

Still open:
- 033 closing reflection after reading all three, and the swap behaviour;
- the welcome flow with today's three ("Begin");
- night mode and lying down for the newer builds.

Claude's daily picks are delivered via Google Drive (progress.json carries the full current workflow). There were no picks for 29 Oct at handover.

## Parked
- Opening Bukowski poem: no licensed, verifiable route.
- Old ChatGPT design studies (`work/cabin-opening-preview.html`, `work/cabin-motion-preview.html`) are standalone mock-ups, never built in.
- A separate checkout `work/bradbury-cabin` (branch build-025-open-before) holds old parked study-guide work. Don't mix it in.

Start by confirming you've read this, then investigate the dot accuracy and bring Bastian a short, plain proposal (made with separate designer agents and a judge) before building. Build 038 is already approved and can follow.
