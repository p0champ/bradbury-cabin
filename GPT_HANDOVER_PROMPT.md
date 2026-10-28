# Handover: Bradbury Cabin (from Claude, 28 Oct 2026, after Build 022)

You are taking over **Bradbury Cabin**, my Meta Quest 3 WebXR passthrough reading app for the Bradbury Challenge: one poem, one story and one essay a day, plus one written story a week.

- Repo: `p0champ/bradbury-cabin`
- Branch: `phase-1-gestures`. Latest commit: `a08c947` (Build 022, confirmed working by me).
- Live: https://p0champ.github.io/bradbury-cabin/?v=22. GitHub Pages serves this branch.

Before you change anything:
1. Pull the branch.
2. Read `HANDOVER.md` (newest entry on top), `CLAUDE_HANDOVER.md` and `QUEST_CHECK.md`.
3. Run `npm test` and `node tests/browser-check.cjs` (with `node serve.mjs` running). The baseline is **92/92 unit tests and 113/113 PC browser checks**.

## How I work
- Short, direct, **one thing at a time**. Don't front-load questions or mix several issues together.
- Honest feedback over encouragement.
- Get my real agreement on design choices before building big things.
- Never claim a test result or approval that didn't happen. Keep these states distinct: built / PC-tested / reviewed / committed / deployed / needs a Quest check.
- End each build with a short explanation and 5–10 clear headset test steps. Then wait for my verdict.
- **Review loop:** a separate critic that didn't write the code reviews each build. It scores 0–10 and gives a ranked issue list. Fix until 8+, for up to 3 rounds. Record it in a `BUILD_0xx_REVIEW.md` and at the top of `HANDOVER.md`.
- Mutation-test new safety checks: break the code and confirm the test fails.

## Hard rules
- Never commit secrets: pairing codes, private bridge/connector URLs, phone numbers, or the Google **client secret**. The OAuth **client ID** in `config.js` is public and fine. Scan staged files before every commit.
- Don't break **Sunnyvale** (my other app). Never restart the real bridge on port 8130, and don't start a competing bridge.
- Work on feature branches. Never push to `main` without my approval. Don't overwrite the `phase-0-crispness` reference.
- No account automation, sign-ins, new accounts or paid services.
- Keep `handMapRevision` at **9**. Don't touch the gesture recogniser unless asked: it is finally reliable.
- The UI is a **placeholder**. I'll redesign it with you soon.
- Bump the cache-busting `?v=NN` on **every** import in all modules plus `index.html`, together with the BUILD number in the header.

## What exists (short)
- **Rendering:** WebXR Layers quad with a 2048×2560 canvas page (crisp text), hand badges with filling menu-hold circles, and a right-wrist-only calendar card (`watch.js`).
- **Gestures (`gestures.js`):**
  - right pinch = next page, left pinch = back, hold = menu;
  - in menus, point and pinch;
  - menu pages are in `MENU_PAGES`;
  - Library and calendar panels have their own hit maps;
  - the 600 ms repeat-pinch guard is `dayInputAllowed`.
- **Reader (`reader.js`):** paginates works made of `stanza`/`para` blocks. Saved places are word anchors (`cabin-reading`).
- **Library:** today's three, then the sampler, then seven public-domain works (`library.js`, generated; don't hand-edit the texts).
- **Calendar:** challenge calendar with ticks (`progress.js`, `calendar.js`).
- **Settings:** moods (Literary/Modern), look-to-turn, background sound (`ambience.js`: rain/fire/room, levelled to −24 dBFS, gain ramps to `LEVEL[kind]` = 1).
- **Google Drive link (`drive.js`, `picks.js`):**
  - Claude, from my phone, saves `Bradbury Cabin/picks-YYYY-MM-DD[-n].json`.
  - **Sync with Drive** on the start page loads the three into the Library and syncs `progress.json` both ways.
  - Build 022 added a check that Google granted `drive.readonly`. **This works end to end now.**
- **The Claude-side instructions** are in `CLAUDE_SKILL_DAILY_THREE.md`. That file is saved as a skill in my Claude account. If you change the picks format, update this file too, and tell me so I can update the skill in Claude.

## Next tasks, in this order

### 1. Study guide, in the cabin, per work (agreed)
This was planned, but nothing is built yet. Confirm the plan with me in one short message, then build:
- **Menu entry:** "Study guide" in the main menu. It opens the guide for the work being read; in the guide, the same entry reads "Back to the text".
  - The main menu has room for a 9th row (rows are at y = 580 + i·190, height 164, on a 2560 px page).
  - Keep the "Back" button on the More page aligned with "More settings" on the main page, so a repeated pinch is harmless.
  - Guard the menu entry with `dayInputAllowed`.
- **Content:** two parts.
  - **Before reading** (no spoilers): context (author, era, why it matters) and things to notice.
  - **After reading** (spoilers allowed, clearly headed as such): themes and questions to think about.
  - **No content or trigger warnings.** I find them spoilers.
- **Implementation idea:**
  - Show the guide as a synthetic work (`id: "guide:<workId>"`) so the reader's paging, text size and moods all just work.
  - Add a `heading` block type to `layoutWork` and to the page drawing in `app.js` (around the `pages[state.page]` loop).
  - Guide items shouldn't get the paragraph first-line indent.
  - Don't let a guide become `reading.last`: on reload it must resume the real work.
- **Sources:**
  - **Claude's picks:** an optional `guide` field per pick, e.g. `{ "context": "...", "notice": ["..."], "themes": "...", "questions": ["..."] }`. Parse it leniently in `picks.js`: strings or arrays of strings, with length caps, and a missing guide must never break the pick. Update `CLAUDE_SKILL_DAILY_THREE.md` to write it.
  - **The seven built-in works:** write the guides by hand (accurate; keep the Before part spoiler-free).
  - **Sampler / no guide:** show "No study guide for this text."
- Add tests: parsing, layout, menu toggle, `reading.last`. Then run the browser check and the critic loop.

### 2. Volume slider for the background sound
- Today the sound is either on or off, at full level (`LEVEL` = 1 in `ambience.js`).
- Add a remembered volume (`preferences.ambienceVolume`) that scales the gain, with smooth ramps rather than clicks.
- **In VR**, the menu is point-and-pinch, so a slider can be a row with − and + targets or 5 steps (Off · 25 · 50 · 75 · 100 %). Propose one to me before building.
- Also add a real `<input type="range">` on the start page.
- Changes must apply live while the sound is playing.

### 3. Discuss the UI with me
I want to restyle the whole UI. **Talk first, build later.** Ask me what I want, one question at a time.

## Later / pending
- Quest checks still open for Builds 016–021: reading, moods, gaze, sound levels, wrist, calendar.
- Sunday tutor: grade my newest story from the Drive folder "Bradbury stories" (0–10 across idea, structure, character, prose and ending), with ranked feedback and questions. Never rewrite my story or pitch ideas.
- `picks-test.json` in the Drive folder can be deleted.
