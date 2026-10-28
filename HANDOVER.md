# Build 033 — Claude's personal lines and Library shortcut (28 October 2026)

**Built:** optional `dedication` (<=70 code points, shown on Today while the day is incomplete) and `thread` (<=160, shown on Today and the final closing page only after all three are read). Invalid copy is dropped alone, never truncated; quoted fragments must match a selected source. New daily-lines.js binds copy to catalogue IDs/body hashes with its own revision time and null tombstones; swaps clear only the changed work's tick. Direct "Library ›" beside "Your shelf ›" on Today. Skill/contract/workflow carry the new fields via existing sync. See BUILD_033_REVIEW.md.

**Verification:** 155 unit + all source checks; 148/148 full PC browser checks plus targeted picker rerun; 11/11 isolated mutations caught. Independent critic 7 -> 9/10 after legacy-tick and short-quote fixes, no remaining findings. No real Claude/Drive or Quest test.

**Release:** pending (recorded below once live is verified). Branch build-033-personal-lines-library; queries v33, header BUILD 033, diagnostic gestures-033; 28 JS modules.

---
# Build 032 — saved study notes (28 October 2026)

**Built:** day.guides saves normalized notes with catalogueId, source bodySha256 and independent guide revision timestamp. Your shelf reopens exact day/work notes offline; archives travel with progress/Drive/export. Startup automatically archives valid current/previous cache. Existing Sync recovers newest old pick-file notes for recorded choices only, bounded12 downloads/24 listings with a rotating persisted cursor. Invalid/missing old notes never fabricate content, replace source editions or erase ticks. Swaps and merges cannot attach a different work's guide; later old-device ticks do not overwrite newer note revisions. Adding recovered notes to an open work preserves its section/word anchor. No new guide UI.

**Verification:**149 unit and all source checks pass;four new upright/lying/offline/Drive recovery browser cases pass;9/9 isolated faults caught. Independent critic7→9/10 after oversize-starvation and offline-overlay fixes, no remaining findings. Full PC browser suite142/142 passed. See BUILD_032_REVIEW.md.

**User instruction:** hands-on Claude/Drive and Quest tests only as one combined check at the end; do not ask for testing between builds or stop for that gate. Keep deferred test list. Source catalogue remains241 works/nine authors; no literary text or gesture/menu change. Branch build-032-saved-notes, preview18152, all queries/header/diagnostics32.

**Release:** code committed as e587dce, pushed to build-032-saved-notes and phase-1-gestures. Live https://p0champ.github.io/bradbury-cabin/?v=32 verified: index.html, style.css and all27 JavaScript modules match reviewed source (line endings normalised). Optional personal opening/closing lines and broader guide redesign remain separate future work.

---
# Build 031 — more authors (28 October 2026)

**Built:**56 new independently matched complete works:35 Yeats poems,13 Poe stories,1 De Quincey essay,7 Tagore essays. Total241 accepted works by9 authors (129 poems,46 stories,66 essays). All185 previous works unchanged. A fresh blinded source critic wrote its own HTML extraction independently of the plain-text producer. Strict comparator rejects two new differing Yeats poems; no hand correction. Whole unsupported/over-length/missing-note works remain excluded. Source editions1903 Yeats and1916 Tagore are explicit; historical English contributors credited. See SOURCE_CATALOGUE.md and BUILD_031_REVIEW.md.

**Verification:**141 unit + all source checks pass;39 comparator damage cases rejected;8/8 isolated source mutations caught;138 full PC browser checks pass, including four new-author first/last-page and offline resume cases. Independent build critic final9/10, no findings; inspected front/side/lying views and independently confirmed old works unchanged. No real Claude/Drive or Quest check claimed.

**Deferred by Bastian:** keep Build030 real Claude/Drive and Builds027–031 Quest tests for later; do not stop work for a user test gate. Notes retained in QUEST_CHECK.md. Source diversity expansion is complete. Parked guide UI, optional lines and historical study-note persistence remain separate future work.

**Release:** code committed as190959c, pushed to build-031-more-authors and phase-1-gestures. Live https://p0champ.github.io/bradbury-cabin/?v=31 verified: index.html, style.css and all26 JavaScript modules match reviewed source after normalising line endings. Header BUILD031, diagnostic gestures-031, all queries v31. Existing static preview18151. No Sunnyvale or account automation touched.

---
**Bastian, 28 October:** defer the real Build030 Claude/Drive/Quest test until later; do not block further work on it. Next authorised work: expand the independently checked author selection. This is a saved testing note, not a claim the test passed.

# Build 030 — automatic current picker workflow (28 October 2026)

**Built:** progress.json now begins with the complete maintained Claude daily-three workflow, source catalogue and current rejection reasons. Both initial Drive creation and updates include it. The existing Claude skill reads this file, so no manual replacement-skill paste is required to make current instructions available. A generated picker-workflow.js is checked against CLAUDE_SKILL_DAILY_THREE.md during npm test; stale instructions fail verification. No reading text or source verdict changed. No saved Claude account skill was edited and no daily critic/backend was added.

**Verification:**139 unit + all source checks pass;134 full PC browser checks; two new upright/lying Drive transport checks;6/6 isolated mutations caught with passing baseline/restoration. Independent critic9/10; minor newest-file wording corrected and regenerated, then final critic sign-off9/10 with no remaining findings. See BUILD_030_REVIEW.md. Actual Claude connector and Quest not tested.

**Release:** code committed as e3f4cc9, pushed to build-030-picker-workflow and phase-1-gestures. Live at https://p0champ.github.io/bradbury-cabin/?v=30; index.html, style.css and all26 JavaScript modules verified identical to reviewed source (line endings normalised). Header BUILD030, diagnostic gestures-030, queries v30. Preview18151. After release, sync once to deliver current workflow, ask Claude for today's three normally, then sync to check results. If actual Claude ignores delivered instructions, investigate the real response; do not claim guaranteed obedience. Next substantial improvement: broaden independently checked authors. Preserve parked study-guide/UI work.

---
# Build 029 — entrance and bookmark (28 October 2026)

**Built:** Today's first showing builds in five 300 ms beats (heading, poem, story, essay, rest), one repaint each; a pinch completes it and chooses nothing. Reading bookmark: ◆/◇ marks for today's three in the running head. See BUILD_029_REVIEW.md.

**Verification:** 137 unit + check:sources, 132 PC browser checks, all 32 mutations caught; critic 6 → 7.5/10, its last finding fixed afterwards and author-checked. No Quest check yet; try whether the heading-only first beat feels like a stall.

**Release:** committed as ac7eaf8, pushed to build-029-entrance and phase-1-gestures. Live at https://p0champ.github.io/bradbury-cabin/?v=29; index.html, style.css and all 25 JavaScript modules verified against the reviewed source. Needs Bastian's Quest check (QUEST_CHECK.md).

**Next (not started):** Claude's optional lines (phase 3, needs the skill re-paste); more catalogue authors. Branch build-029-entrance; preview port 18150.

---
# Build 028 — Your shelf (28 October 2026)

**Built:** shelf-panel.js. Earlier days newest first; a day opens its three; works reopen as the exact catalogue edition under that day's id; works outside the catalogue are listed as Not in the cabin. Synced days now save catalogue IDs (`days[d].ids`), merged and checked together with labels. Menu row 1: Today with a trio, otherwise Your shelf. See BUILD_028_REVIEW.md.

**Verification:** 136 unit + check:sources, 129 PC browser checks, 8/8 shelf mutations; critic 7.5 → 8.5/10 (last point fixed afterwards, author-checked). No Quest check yet.

**Release:** committed as 431a4d9, pushed to build-028-shelf and phase-1-gestures. Live at https://p0champ.github.io/bradbury-cabin/?v=28; index.html, style.css and all 25 JavaScript modules verified against the reviewed source. Needs Bastian's Quest check (QUEST_CHECK.md).

**Next (not started):** title card / entrance moment (phase 4, approved in principle: Today's three fade in, a small ◆◇◇ bookmark while reading), then Claude's optional lines (phase 3, needs the skill re-paste). More authors for the catalogue also still open. Branch build-028-shelf; preview port 18147.

---
# Build 027 — Today, phase 1 (28 October 2026)

**Request:** a more personal Library; Claude's daily three should feel special, not just menu rows. Three designer agents proposed and critiqued each other; a judge chose an editorial "Today" page with a closing page and real-data facts. Bastian approved phase 1 with the judge's defaults: title card first (not built yet), no Claude dedication yet, Today appears by itself once a day.

**Built:** today-panel.js (Today page and closing page), menu row 1 labelled Today, once-a-day appearance, closing page with Mark as read today / Next / Today's three. See BUILD_027_REVIEW.md. Picks format and Claude skill unchanged.

**Verification:** 125 unit + check:sources, 128 PC browser checks, 5/5 new browser mutations, critic 6/10 → 8.5/10 (its last polish points fixed afterwards, author-checked). No Quest check yet.

**Release:** committed as 690ce02, pushed to build-027-today and phase-1-gestures. Live at https://p0champ.github.io/bradbury-cabin/?v=27; index.html, style.css and all 24 JavaScript modules verified against the reviewed source. Needs Bastian's Quest check (QUEST_CHECK.md).

**Next phases (not started):** 2 "Your shelf" (needs work IDs saved per day), 3 Claude's optional dedication/thread lines (skill re-paste), 4 title-card animation. Branch build-027-today; preview port 18145.

---
# Build 026 — source fidelity, independent critic loop (28 October 2026)

**Requirement:** complete original texts, exact to a named edition; a real independent second-agent critic with source comparisons and enforced rejection. Bastian will not photograph, transcribe or import texts.

**Design:** Claude's picks file (v2) holds only catalogue IDs and study notes. The app shows literary text only from `source-catalogue.js`, which publishes only works an independent critic agent's own extraction (gutenberg.org HTML, own code, own boundaries) matched exactly against the producer's (gutenberg.org plain text). `tools/critic_compare.py` writes the verdicts; the generator gates on them, bound to the exact text. Starter shelf (`library.js`) is generated from accepted entries. 185 works accepted; Blake "Night" rejected; "Of Fame" excluded. Daily: the app rejects unknown/wrong-kind/shelf IDs, invalid dates, works given on earlier days and misquoted study notes, and keeps the previous checked trio. Its verdict (`lastCheck`) goes back to Claude in progress.json.

**Verification:** 118 unit tests + `check:sources`, 10/10 mutations, 125 PC browser checks. Build critic 6/10 → 8/10; its round-2 findings were then fixed and rechecked by the author only. See BUILD_026_REVIEW.md and SOURCE_CATALOGUE.md. No Quest or real Drive check yet.

**Release:** committed as a778400, pushed to build-026-source-fidelity and phase-1-gestures. Live at https://p0champ.github.io/bradbury-cabin/?v=26; index.html, style.css and all 23 JavaScript modules verified against the reviewed source (line endings normalised). Needs Bastian's Quest check (QUEST_CHECK.md).

**Not done:** claude.ai skill must be replaced by hand from CLAUDE_SKILL_DAILY_THREE.md; no daily independent agent (capability gap: no backend); narrow catalogue (5 authors, 33 stories); opening-poem bookmark UI and Bukowski source still parked. Old GITenberg copies archived in work/build-026-old-gitenberg-sources. Header BUILD 026; diagnostic gestures-026; all queries v26. Preview for this checkout ran on port 18144.

---
# Build 025 — background volume (28 October 2026)

Bastian explicitly parked the study guide after Build 024 failed to show Before reading for one of today's Claude picks. He wants a different guide UI later. Today's old picks may lack guide data; their titles are unknown. A separate opening/resume fix is unfinished in the other checkout's build-025-open-before branch. **It is not included or deployed here.** Do not silently resume guide work.

He approved remembered volume: five VR choices **Off / 25 / 50 / 75 / 100%**, plus a real start-page slider. Main menu → **Background volume** opens the five-choice page. Back stays at the entry's same row (index 8), More/Back remain aligned at index 6, and volume changes are guarded for 600 ms after opening the page. Slider supports intermediate percentages and keyboard input. Both controls stay in sync.

preferences.ambienceVolume stores 0–1; missing/invalid values default to 1 to preserve existing loudness. Off means volume zero and keeps the chosen sound. Choose a sound under More settings → Background sound if sound kind is Off. Volume changes ramp smoothly over 180 ms without replacing the loop; startup retains its 2 s fade. All three kinds scale their gain. This does not change welcome-chime volume. Continuous ramps explicitly anchor the held current level, with a fallback for browsers without cancelAndHoldAtTime. Diagnostics export includes volume and targetGain.

**Verification:** 106 unit + 125 full PC browser checks pass. Independent critic: **9/10**, no actionable issues, independently ran 106 unit + four volume browser checks and reviewed menu/front/side/lying/mobile images. Five mutation checks caught disabled safeguards in isolated copies; production code was not mutated. The repeat-pinch fixture was strengthened and all four volume browser checks rerun. See BUILD_025_REVIEW.md.

**Release:** built, PC-tested, independently reviewed, committed as 92adf5a and pushed to build-025-volume and phase-1-gestures. Live at https://p0champ.github.io/bradbury-cabin/?v=25; deployed index.html, style.css and all 21 JavaScript modules verified against the reviewed source (normalising line endings). Needs Quest listening check in QUEST_CHECK.md. Header BUILD 025; diagnostic gestures-025; all source import queries and index assets use v25. Gesture recognizer, handMapRevision 9, generated texts and existing study-guide behavior are unchanged.

Current checkout: this chat's work/bradbury-volume, branch build-025-volume, a clean clone of Build 024 to keep the parked work separate. Preview port 18142. No Sunnyvale service touched. Next after Quest verdict: discuss the broader UI, one question at a time; guide redesign remains parked until Bastian returns to it.

---
# Build 024 — automatic notes attached to each work (28 October 2026)

**User verdict:** Build 023 works but is too clunky. He wants the before notes when opening a text and after notes when finishing it, without choosing a guide from a menu. This supersedes the previous detour design. Volume and wider UI changes remain pending.

**Behavior:** normal page turns follow **Before reading → original full text → After reading — spoilers**. Back works across the same boundaries. The guide menu row and return-to-text action are removed. Fresh works start Before; an existing saved work resumes its saved section/place. Missing guides add no filler pages. Partial guides add only the available sections. Source reading layout remains unchanged, including poetry. Section page labels and turn feedback agree.

**Implementation:** reading-flow.js composes independent before/text/after layouts, so source block indices and word positions stay intact. Page anchors carry section before/text/after; reader.js preserves it on storage load and restricts anchor lookup to that section. Legacy anchors without section always refer to text, preserving Build 023 places. Removed notes fall back to text start. reading.last always stays the real work ID, including while reading notes. Midnight keeps the open work intact.

**Verification:** 102 unit + 121 full PC browser checks pass. The final counter adjustment also passed all eight targeted browser checks. Five safety mutations were caught in an isolated copy. Independent critic round 1: 8.5/10; P3 inconsistent counters fixed. Round 2: **9/10**, no remaining actionable findings. Critic independently ran 102 unit + eight targeted browser checks and inspected before/text/after, night/modern, front/side/lying images. See BUILD_024_REVIEW.md.

**Release:** built, PC-tested, independently reviewed, committed as d029fcd and pushed to build-024-reading-flow and phase-1-gestures. GitHub Pages verified: index.html and all 21 JavaScript modules match the reviewed source (normalising line endings). Live at https://p0champ.github.io/bradbury-cabin/?v=24. Needs Bastian's Quest verdict. All module import queries and index assets use v24; header BUILD 024, diagnostic gestures-024. Gesture recognizer, handMapRevision 9, rendering and generated library texts are unchanged. No Sunnyvale service touched. Branch build-024-reading-flow; local preview 18141.

Claude guide JSON format is unchanged. CLAUDE_SKILL_DAILY_THREE.md only changes the navigation explanation: notes now appear automatically. The Build 023 skill already supplies compatible guides.

---
# Build 023 — study guide detour (28 October 2026)

Bastian approved the study-guide plan and asked that it feel seamless. Menu → **Study guide** opens the current work's notes using the existing reader. The same row becomes **Back to the text**. Returning restores the exact page when size/style are unchanged, or the page containing its saved word anchor after reflow. Guides always open at their safe beginning. They never overwrite the real text's saved place or reading.last; reloading resumes the real work.

`study-guide.js` builds a synthetic `guide:<workId>` work. `guide-data.js` contains original notes for all seven shelf works. Optional pick.guide fields accept strings/arrays with caps; missing or malformed notes never invalidate a pick. Before reading is spoiler-free; After reading — spoilers starts a fresh page. Partial after-only notes get a safe introduction. Sampler/no-guide shows the agreed fallback. No content or trigger warnings.

`reader.js` supports bold headings, flush-left guide paragraphs and explicit section page breaks. Menu has a ninth row; More/Back remain at index 6. Guide entry uses dayInputAllowed's 600 ms repeat guard. The source work remains current underneath its guide, including across midnight. Gesture recognizer, handMapRevision 9, rendering path and generated library texts are unchanged.

**Claude skill changed:** `CLAUDE_SKILL_DAILY_THREE.md` now requests guide context/notice/themes/questions for each pick. Bastian must update the copy saved in Claude. Old files still load; guides require newly supplied notes.

**Verification:** baseline 92 unit + 113 browser checks. Build 99 unit tests pass; final browser rerun 120/120 passes. Four mutation checks caught removed safeguards and code was restored. Critic round 1: 7.5/10, orphan-heading issue fixed with 1–399-length/all-size regression. Round 2: **9/10**, no remaining actionable code issues; critic independently passed 99 unit, seven targeted browser checks and 16,218 pagination combinations. See BUILD_023_REVIEW.md.

**Release:** built, PC-tested (99 + 120), independently reviewed (9/10), committed as 5ce1c06 and pushed to build-023-study-guide and phase-1-gestures. GitHub Pages deployment verified: index.html and all 20 JavaScript modules match the reviewed local source (normalising line endings). Live at https://p0champ.github.io/bradbury-cabin/?v=23. Needs Bastian's Quest check in QUEST_CHECK.md. All module queries and index assets use v23; header BUILD 023 and diagnostic gestures-023.

Work is in this chat's `work/bradbury-cabin`, branch `build-023-study-guide`, freshly cloned from phase-1-gestures. The old Build 011 checkout in the previous chat's outputs was left untouched. Static preview uses 18141 because 18140 was already occupied; browser tests now accept CABIN_BASE_URL. No bridge was started or restarted. Next after Bastian's verdict: propose volume control, then discuss UI one question at a time.

---
# Build 022 — Drive permission check (28 October 2026, afternoon)

First real request: Claude saved `picks-2026-10-28.json` correctly (valid JSON, today's date, all three works), but the picks did not reach the Library.

Likely cause: Google's consent screen lets people untick permissions. Without drive.readonly, the cabin sees only its own files (progress.json), never Claude's picks.

The fix:
- the cabin checks the scopes Google actually granted;
- after a partial grant, it says what to tick and asks again with the full consent screen;
- a token saved by Build 021 carries no scope record, so it is dropped once.

Status:
- unit tests 92/92, including a mutation check of the scope test;
- PC browser checks 113/113;
- small fix; no separate critic round;
- **Confirmed by Bastian (14:36): today's three now show in the Library.**

---
# Build 020 — Google Drive activated (28 October 2026, 13:42)

Bastian completed the Google Cloud setup step by step:
- project "Bradbury Cabin";
- Drive API enabled;
- Google Auth Platform: External, Testing, himself as test user;
- Web OAuth client with origin https://p0champ.github.io.

The public client ID is now in config.js. **Sync with Drive** is active.

Next:
1. Bastian's first sign-in from the start page. He will see "Google hasn't verified this app"; choose Continue.
2. Propose the skill (`CLAUDE_SKILL_DAILY_THREE.md`) with `propose_skills`.
3. Do a real end-to-end request.
4. Design the **study guide** with him (his note from the night).

---
# Build 019: Claude's daily three through Google Drive (28 October 2026, early morning)

**Bastian's decisions**
- Claude only on request, from his phone or PC, with no windows or voice in the headset.
- The Google Drive route, so his PC can stay off.
- He went to bed at 06:24.
- **Note for tomorrow (Bastian): "we also need a study guide".** Design this with him. Right now the reply to "give me the daily three" includes study-guide links.

**Live (?v=19).** The **Sync with Drive** button on the start page:
1. signs in with Google (a browser-only token client; scopes drive.readonly and drive.file);
2. reads today's best `picks-YYYY-MM-DD[-n].json` from the Drive folder "Bradbury Cabin";
3. shows the picks at the top of the Library;
4. records "Title — Author" for the calendar and wrist card;
5. merges and writes `progress.json`.

Ticks save back to Drive about 1.5 s later. When Google's roughly one-hour sign-in expires, the app says so and keeps ticks on the headset until the next Sync. A work open at midnight stays open.

**Not active yet:** `config.js` `GOOGLE_CLIENT_ID` is empty, so the button reads "setup needed".

**Waiting on Bastian: Google Cloud setup, one step at a time**
1. Create the project "Bradbury Cabin" at console.cloud.google.com. (Step 1 has been given.)
2. Enable the Google Drive API.
3. Set up the OAuth consent screen (Google Auth Platform): External, publishing status Testing, add his Gmail as a test user. drive.readonly is a restricted scope, so expect the "Google hasn't verified this app" screen; he continues past it.
4. Create an OAuth client: type Web application, authorised JavaScript origin `https://p0champ.github.io`.
5. Put the client ID (public, not a secret) in config.js, bump the version, and push.

Then propose the skill in `CLAUDE_SKILL_DAILY_THREE.md` with `propose_skills`, test it end to end with a real request, and give him Quest steps.

**Drive state**
- The folder "Bradbury Cabin" exists in his Drive.
- A harmless `picks-test.json` (dated 2000) sits in it and can be deleted.

**Review:** critic round 1 scored 7/10; round 2 scored 8/10 for both the code and the skill (BUILD_019_REVIEW.md).

---
# Build 018 — background sound audible (28 October 2026)

**What Bastian reported.**
- On Build 017 he said: "Looks good however the background music i cant hear".
- About Claude, he said it must be seamless, with no window and no voice as in Sunnyvale ("it was way too clunky"). He chose to get the daily three **only on request**.
- He then asked whether his PC must be running, and would like to "write from my phone and it then would be in the app". We are waiting for his decision between two options:
  - **PC bridge:** the PC must be on.
  - **Google Drive route:** no PC needed. Claude saves the picks file with the texts to a "Bradbury Cabin" Drive folder. The cabin reads it through Google sign-in, with a one-time OAuth client ID that Bastian creates.

**The fix.** Bastian couldn't hear the sounds because they played at −40 dBFS and were bass-heavy. They are now reshaped and levelled so the audible band (above 200 Hz) sits at −24 dBFS. The chime is louder, and the audio resumes after an interruption. The critic scored 5/10, then 8/10 (BUILD_018_REVIEW.md).

**Status.** Live at ?v=18. The Quest listen is still needed.

---
# Build 017 — Style, look-to-turn, background sound (28 October 2026)

**Status.** Resumed after the pause; Bastian said "continue". The critic scored round 1 at 6/10 and round 2 at 8/10 (BUILD_017_REVIEW.md). Merged to phase-1-gestures and live at ?v=17. Needs a Quest check.

**Style.** Literary or Clean modern. It sits on the main menu and applies to the pages, menu, calendar and Library.

**Look to turn pages.** Off by default; turn it on under More settings. It uses head direction, not eye tracking.
- Hold your gaze on the bottom-right corner for 1.3 s to go forward, or the bottom-left for back.
- A small ring fills beside the corner while you look.
- It turns once per look. A hand action, the menu, pose loss or a visibility change ends the current look, and you must look away to re-arm it.
- When it is on, the footer hint is centred, away from the corners.

**Background sound.** Off, Soft rain, Fireplace or Quiet room, under More settings. The sounds are generated in code (ambience.js): an 8 s loop at 22.05 kHz with an equal-power seam, so there are no recordings and nothing to license.

**Menu layout.**
- Main has 8 rows and More has 9. Rows are 164 px tall with a 190 px step.
- Back sits at index 6, the same slot as More settings.

**Saved preferences.** Mood, gazeTurn and ambience are stored in `cabin-controls`.

**Next.** Phase 3: Claude integration through the Sunnyvale bridge. This changes Sunnyvale's bridge, so the work happens on a separate branch with a throwaway BRIDGE_PRIVATE_DIR and test ports. Restarting the real bridge needs Bastian's explicit approval. Present the plan to him first.

---
# Build 016 — real reading: Library, full works, saved place (28 October 2026)

Bastian agreed the plan: real reading first (Phase 1 remainder), then Claude (Phase 3), then polish (Phase 4). The texts come from a small bundled public-domain starter shelf now, with Wikisource fetching to come with the picker. The UI remains a placeholder.

**reader.js** paginates full works:
- Poems keep their line breaks, stanza gaps and stepped indents. Turnovers are set flush right. A stanza stays together when it fits.
- Prose has first-line indents and widow/orphan control.
- Very long words are hard-broken.
- Each page anchor is (block, word offset), so a saved place survives text-size changes.

**library.js** is generated by tools/extract_library.py from Project Gutenberg plain texts, fetched from the GITenberg GitHub mirror (#7256, #160, #1322, #575). The works are:
- Blake: The Sick Rose
- Whitman: When I Heard the Learn'd Astronomer; O Captain! My Captain!
- O. Henry: The Gift of the Magi
- Chopin: Desiree's Baby
- Bacon: Of Studies; Of Truth

The texts are verbatim, verified by the critic's independent script.

**Menus:**
- Main menu: Continue reading, Library, Challenge calendar, Page colour, Text size, More settings, Leave the cabin.
- More settings: Next page hand, Point with, Welcome chime, Wrist calendar, Move page here, Back, Practise gestures. Back sits at index 5, the same place as More settings on the main page.
- Library: "‹ Menu" is at the top right. Selecting a work, Exit, and the other page changes are guarded for 600 ms against a repeated pinch.

**Saved state:**
- localStorage `cabin-reading` holds the saved place for each work and the last work opened. The last work reopens on reload.
- Text size and paper/night are now saved in `cabin-controls`.
- The original two-page sampler stays the default text, so the gesture tests keep their meaning.

**Status:**
- PC-tested: 71 pure tests + 110 browser checks pass.
- Independent critic: round 1 scored 7/10, round 2 scored 8/10 (BUILD_016_REVIEW.md).
- Committed and pushed; live at ?v=16.
- Needs Bastian's Quest check.

**Next: Build 017.** Literary/clean-modern moods, optional gaze page-turn (off by default), and synthesised ambience. After that comes Phase 3: the Claude picker, the Sunday tutor and Drive, through the Sunnyvale bridge, with progress sync.

---
# Build 015 — wrist card shows today's titles (28 October 2026)

Feedback: Bastian on Build 014: "wrists looks great, again UI placeholder, however the text of the poem and so on isnt displayed". When asked, he clarified he meant the wrist card should show the names of today's poem, story and essay.

Change: the card has three rows, each with a tick, the kind (Poem, Story or Essay) and the title. The author is shown only on the calendar day page.
- Titles come only from stored `days[today].picks`.
- If a day has no picks, its rows say "not picked yet". Today, only 21 Oct has stated picks.
- Real daily picks arrive with the Phase 3 Claude literature picker.
- The texture is now 512×448 and the card 8.8×7.7 cm.

Status:
- PC-tested: 59 pure tests + 106 browser checks pass.
- Independent critic: 8.5/10, no blockers. Its nice-to-haves 3 and 4 (empty title, separator variants) are applied.
- Committed and pushed; live at ?v=15.

Next: Bastian said "Keep working and lets finish this software". Remaining work, in order:
- Phase 1 reading features: real full-work pagination preserving poetry, saved place, moods, ambience.
- Phase 3: Claude picker, tutor and Drive, via Sunnyvale's bridge.
- Phase 4: polish.

The UI is explicitly a placeholder that he will restyle.

---
# Build 014 — wrist calendar, right wrist only (28 October 2026)

**What Bastian asked for:**
- Feedback on Build 013: "Note that we will change the whole UI in the end to match exactly what I want and this is a placeholder. I like it but id rather want a calander floating somewhere or on my wrist". He chose the wrist.
- Then: "last time we did this wrist thing it kept changing wrists and it was an issue. Lets fix this right away and make sure it can only appear on my right wrist".

**What the card shows** (`watch.js`, a 512×352 native quad at 8.8×6 cm): the day and date, today's Poem/Story/Essay ticks, Monday–Sunday of this week, the streak, and whether the weekly story is due or handed in.

**When it appears.** It shows when the back of the RIGHT wrist faces the eyes in a watch-checking posture:
- the palm normal points away from the eyes (below −0.7);
- the user is looking at the wrist (within 25°);
- the hand runs across the body;
- the wrist is 12–65 cm away.

It waits 200 ms before showing and 350 ms before hiding.

**The right-hand lock:**
- The app reads only from the source whose handedness is "right", and `watchPose` checks again. There is no fallback to the left or the nearest hand.
- While the face is shown, the right hand counts as untracked for gestures, and its badge steps aside.

**Settings and recovery:**
- More settings → Wrist calendar turns it on or off. The More page is now swap, pointer, sound, watch, Back, practice; Back stays at index 4.
- A dropped wrist joint only hides the face.
- On a layer-budget error, the watch is the first layer to give up.
- Save test details includes `wristCalendar.decisions`, used to tune the thresholds on the headset.

**Known open issue:** gestures.js `nearFacePalm` probably uses the same inverted palm sign. It needs a headset trace before any change, because it is part of the recogniser.

**Status:**
- PC tests: 58 pure + 106 browser checks pass.
- Critic: round 1 scored 4/10, round 2 scored 8/10 (BUILD_014_REVIEW.md).
- Committed and pushed on phase-1-gestures, live at ?v=14.
- Still needs Bastian's Quest check.

---
# Build 013 — Bradbury Challenge calendar (Phase 2 start, 28 October 2026)

Bastian on Build 012: "looks good as a placeholder - we can move on". Then: "dont begin with claude lets get the calander done first". The Phase 1 reading features (full pagination, saved place, moods, ambience) are still pending; he chose the calendar first.

What it does:
- **Menu → Challenge calendar** opens a month view. Days run Monday to Sunday, there is prev/next month navigation, and the overview line shows the streak, complete, in-progress and missed counts. There is a legend.
- **Pinching a day** opens it. There, you tick Poem, Story and Essay separately, plus the weekly written story, which belongs to that week's Sunday. A day is complete only with all three ticks. Future and pre-18-Oct days cannot be ticked.
- **History holds only stated facts:**
  - 18 Oct: complete.
  - 21 Oct: missed, with its three picks.
  - Other days before the first launch with no record show "not recorded". After `trackingSince`, an empty past day counts as missed.
- **Code:**
  - `progress.js`: pure logic, with tests in tests/progress.test.mjs.
  - `calendar.js`: canvas panels and hit rectangles.
  - app.js: menu pages "calendar" and "day", plus `panelHit`.

Storage:
- The progress is stored in localStorage key `cabin-progress`.
- An unreadable record is backed up to `cabin-progress.bak-*` and never overwritten.
- Blocked storage is reported on the calendar.
- Export/Import progress is on the PC page; the Import validates every entry.
- **Durable bridge storage is still Phase 3.**

Unchanged: renderer, recogniser, badges, centring, handMapRevision 9.

Status:
- PC-tested: 48 pure + 104 browser checks.
- Critic: round 1 scored 7/10, round 2 scored 8.5/10 (BUILD_013_REVIEW.md).
- Committed and pushed on phase-1-gestures; live at ?v=13.
- Needs Bastian's Quest check.

---
# Build 012 — simpler menu (28 October 2026)

Bastian's result on Build 011: **"its way more responsive now. But clean up the Menu and make the UI look better. Too much stuff in there I dont know what is. Make it nice and easy - and keep working aswell on integrating claude and all that, but maybe we do this first"**. Treat this as a big improvement, not as a formal gesture-gate pass. Confirm with him after Build 012.

The 12-button grid is now a two-page, single-column card menu:
- **Main:** Continue reading, Move page here, Page colour (Paper/Night), Text size, More settings ›, Leave the cabin (Exit VR).
- **More settings:** Next page hand, Point with, Welcome chime, Practise gestures, ‹ Back. Back sits in the same slot as "More settings", so a repeated pinch just toggles between the pages.
- **Removed from the headset:** menu Previous/Next (the hands do that), and the A/B sharpness test (still on the PC page) along with the technical footer text.

`menuHit(x, y, page)` is page-specific, and the menu always reopens on the main page. Renderer, recogniser, badges, centring and handMapRevision 9 are unchanged.

Status:
- PC-tested: 35 pure + 101 browser checks.
- Independent critic: 8/10, no blockers. Its nice-to-haves 1–5 were applied.
- Committed and pushed on phase-1-gestures; live at ?v=12.
- Needs Bastian's Quest check.

Next, per his request: Phase 3 Claude integration via Sunnyvale's existing bridge. Read sunnyvale-study first. Phase 1 reading features (full pagination, saved place, moods, ambience) are still pending.

---
RESUMED BY CLAUDE (27 Oct 2026, late evening): Build 011 was taken from Codex's local working tree unchanged in production code. It was retested (35 pure + 99 browser checks). Two browser checks were repaired: their mock frame clock could fall behind the real event clock on slower machines. A mutation check confirmed the 1000 ms startup expiry is still enforced. Committed and pushed on phase-1-gestures. Awaiting Bastian's Quest result.

# Build 011 — make the startup confirmation independent of reading-hand readiness

Bastian's actual Build 010 verdict: **“cant get it - the centering wont accept my click”**. He confirmed he uses **bare hands**. Build 010 repaired the XRHand crash, but did not pass startup or the gesture gate.

A code-level blocker was verified: startup confirmation went through the reading recogniser, requiring a stable tracked physical hand, an initial wide opening, and an accepted selectstart before the browser's successful select could confirm. Build 011 handles startup's single explicit action separately. A completed native Quest `select` confirms with a current non-emulated viewer pose and a visible session; it no longer depends on finger joints, initial opening, or a prior accepted selectstart. A controller's successful select can also confirm. Joint distances alone, selectstart alone and cancelled selectend cannot confirm. Active-source and fresh-event checks remain. Startup allows up to 1000 ms for the next frame, so a brief slow frame does not discard the confirmation; reading keeps its 120 ms check. Events received while blurred cannot confirm after refocus. The remaining local event batch is consumed when arrival begins, so the confirmation cannot also open a menu or turn a page.

The startup screen now says pinch/release or controller trigger, and no longer tells the user to wait with a wide open hand. Native startup confirmations and rejected attention checks are recorded with event source and hasHand. Reading/page/menu recognition, handMapRevision 9, requested hand flip, crisp renderer, hand badges, 3D arrival and quiet optional chime remain unchanged. This is a targeted startup repair, not a claim that the outstanding Quest clicking problem is solved.

Built: targeted startup repair. PC-tested: 35 pure tests and 99 isolated Chromium checks pass. New regressions cover an immediate native click with missing joints and a controller without XRHand, cancellation-only endings, blurred receipt/refocus, emulated viewer rejection, a 200 ms frame delay accepted, events older than 1000 ms rejected, diagnostic outcomes and packed duplicate confirmations. Reviewed: see BUILD_011_REVIEW.md for the separate critic verdict. Committed/deployed: committed and pushed on phase-1-gestures by Claude; see the top line for the live check. Needs Quest check: successful bare-hand startup, followed by repeated available page turns. No later Phase 1 work may start before Bastian passes the gesture gate.

All modules use ?v=11, header BUILD 011, export gestures-011. **handMapRevision stays 9: do not flip again.** Trial: https://p0champ.github.io/bradbury-cabin/?v=11 . Only phase-1-gestures may be pushed. Earlier entries below are history.

---
# Build 010 — repair the actual Quest startup error

Bastian tried Build 009 and reported: **“The layer test stopped: source.hand.has is not a function Return to the browser to read the test details.”** Startup failed, so no click/animation/sound pass can be inferred from that trial.

Cause confirmed: Build 009 treated XRHand like JavaScript Map and called `.has()`. The standard XRHand interface provides `get()`, `size` and iteration, not Map's has/set/delete/clear methods. The previous fixture used a full Map and concealed this mistake. The replacement test object is frozen and exposes only get/size/iteration; a separate backing map is used only by the fixture setup. Running Build 009 unchanged against it reproduced the user's exact error before the fix.

Production now detects declared wrist/metacarpal spaces with `!!hand.get(...)`. The whole native/layer/entry/occlusion/audio suite runs against the limited interface: 35 pure and 97 browser checks pass, independently repeated by the separate critic. Its hotfix score is 8/10; see BUILD_010_REVIEW.md. This is a confirmed runtime compatibility repair. No input thresholds, rendering paths, sounds or animation behaviour were changed for the hotfix.

IMPORTANT: every module query is v10, header BUILD 010, export gestures-010. **handMapRevision remains 9**, so this version does NOT flip the user's hands again. Build 009's requested flip, NEXT/BACK/START/END labels, physical palm tracking, hand-entry animation and quiet/mutable sound remain. URL: https://p0champ.github.io/bradbury-cabin/?v=10 . Follow QUEST_CHECK.md. Phase 0 crispness is passed, gesture gate remains unpassed; actual Quest startup and clicks still need a new result. Older entries are history.

---
# Build 009 — flipped hands, explicit outcomes, palm tracking and welcome sound

Bastian's Build 008 feedback: **“the clicking is still off. Dont stop working until its 100% done. Also add a animation to the hand as we enter and add a sound that plays aswell as we enter - subtle but nice you know”**. He clarified: **“Cant remeber but it def flashed and the paged stayed. Also the clicking is on the wrong hands. Flip it”**. The gesture gate remains failed until actual Quest behaviour is confirmed. Do not equate automated success with 100% device reliability.

Build 009 flips the user's current saved hand mapping ONCE using `handMapRevision:9`; subsequent reloads preserve it and later manual swaps. A normal previous default becomes LEFT = NEXT, RIGHT = BACK. The actual hand icons now spell out NEXT/BACK, or START/END on a blocked boundary, so an acknowledgement cannot be mistaken for a real turn. Menu Previous/Next actions now also return actual turned/first-page/last-page outcomes, not a generic successful selection. The two-page sample still has real boundaries; no wraparound or fake page advance was added.

A further code-level missed-input vulnerability was identified: thumb/index tracking can be inferred or obscured during a native pinch, but the app previously required both tips to be non-emulated every frame. The safety location now comes from a tracked non-emulated wrist, then index metacarpal. Tip loss alone cannot cancel a browser-recognised pinch when that physical anchor remains tracked/in view. If palm joints are declared but untracked, guessed tips or an emulated target ray cannot bypass safety. Tips are a compatibility anchor only for sources without palm joints. Native events remain the only action authority; no parallel joint or button-edge click fallback was added. Diagnostics include anchorKind and tipsTracked separately. Lookaway, blur, loss of physical anchor, system posture and fresh-release recovery guards remain.

After the existing 3D gateway opens, each visible hand gets a gentle 1-second orbit of gold light and a 12 mm depth pulse on its existing badge layer. A second hand appearing late gets its own first appearance welcome; tracking loss never restarts it. This sequence reuses two optional layer slots, never exceeding the existing three active-layer budget. No page pixels are repainted for the hand animation.

`entry-sound.js` synthesises an original quiet three-note sine chime, played once at centring confirmation per XR entry. AudioContext is unlocked synchronously by the actual Enter button before XR awaits. The menu's Entry sound on/off preference persists. Failed/suspended audio does not break XR; error/state/play count remain in exported details, including after Exit. Nodes disconnect after playback and the context closes on session end or failed entry. No recordings, paid APIs, external assets or network audio are used.

Verification: 35 pure tests and 96 isolated Chromium workflows. These include one-time legacy mapping inversion across reload; real native actions in the flipped directions; one/both emulated tips with a valid wrist; loss of physical palm; labelled hand-entry texture/transform readbacks front/lying; late-second-hand and no-replay checks; original rapid/packed native events; actual Web Audio offline peak/RMS/tail rendering, mute and one-play diagnostics; and earlier graphics/attention/boundary regressions. An audio preview and native badge images are in task outputs/build-009-evidence. These are synthetic PC evidence, not actual Quest logs or listening tests. See BUILD_009_REVIEW.md and BUILD_009_REPORT.md for independent review/release state.

Version: BUILD 009; every module ?v=9; export gestures-009; trial URL https://p0champ.github.io/bradbury-cabin/?v=9 . Phase 0 crispness remains passed. Actual missed-click cause cannot be certified without device feedback/trace, despite fixing demonstrable vulnerabilities and the explicit wrong-hand mapping. Preserve phase gates; no additional Phase 1 work yet. Only phase-1-gestures may be pushed. No Sunnyvale code, private files or live bridge service was touched. Older entries below are history.

---
# Build 008 — repeated clicks and a 3D welcome

Bastian's Build 007 Quest verdict: **“the clicker is still off. 1 click is next page. Im spamming it and it only works sometimes. Also the centering needs a nice 3d animation that invites you into the world as it centers”**. This is a failed gesture gate, not an approval to continue Phase 1. Phase 0 crispness stays passed.

A reproducible code defect was found: every successful native click and its following selectend disarmed the hand, requiring another 180 ms wide geometric opening and a 350 ms cooldown. An independent reproduction gave only 1 action from 5 valid native click cycles. Existing browser __pinch fixtures hid this by inserting 600 ms of open-hand padding before each click. This is a demonstrated dropped-repeat cause, not proof that every on-device miss had that cause.

Build 008 makes recovery-only readiness explicit (`needsOpen`). Initial entry, interruption, cancelled press or context change still requires safe steady tracking and a fresh release. A completed native click/end cycle immediately permits the next native cycle without a cooldown or geometric reopening. Valid native clicks alone authorize actions; duplicate start does not restart the hold, and duplicate select/end does not emit extra actions. When a native hand button is available, its unpressed state establishes release for recovery; a broad joint-gap fallback is used only for sources without that button. View/attention/system/ownership guards remain.

`arrival.js` adds an original paper-and-gold invitation using two transparent compositor quads, beside the centring page. After one confirmation, these leaves open outward in real depth/yaw while the page gently settles 18 cm toward its final position, with a small yaw/fade, over 1.2 seconds. The captured destination remains fixed as the user moves their head; no viewer/camera movement or opaque environment is created. The decorative textures upload once; animation uses quad transforms/opacity, not per-frame page painting. Animation freezes during hidden/blurred visibility, missing viewer pose or emulated viewer tracking. A reference reset during arrival returns to centring. Clicks during the transition are discarded, never replayed. The gateway hides afterwards and its layers are destroyed on session end. Optional layer-budget/upload failure removes decoration and keeps the reader; a gentle primary-page settle remains available without extra layers.

PC verification: 33 pure tests plus 86 Chromium checks. New regressions exercise 10 rapid native cycles at 0/80/120/200 ms spacing without geometric reopening, duplicate starts, 10 alternating native turns with only 40 ms press/40 ms spacing, and 3 complete native cycles packed into one RAF. New front/lying animation workflows verify matrices changing in depth, frozen destination, paused blur progress, discarded transition clicks, fixed page pixels during animation, cleared decoration and cleanup. Native texture/transform readbacks are reconstructed into clearly labelled synthetic 3D previews for waiting, opening, settling-side and reading stages. These are not Quest screenshots. Independent critic approved at 8/10 PC readiness, with 33+86 checks independently passing. Its minor emulated-viewer progress finding was fixed with regressions. See BUILD_008_REVIEW.md and BUILD_008_REPORT.md for release status.

Version: BUILD 008, all modules ?v=8, export gestures-008, URL https://p0champ.github.io/bradbury-cabin/?v=8 . Gesture comfort, native event delivery and animation appearance still require Bastian's Quest check. The sample is still only 2 pages: after one Next, another Next should acknowledge Last page with the orange boundary bar, not invent a page. Alternate Next/Back for repeat testing. Keep phase gates; no further reader work before approval. No Sunnyvale files or running bridge were touched. Older entries below are historical.

---
# Build 007 — native clicks, explicit centring and attention safety

Bastian's Build 006 verdict remains: **“buttons still very unresponsive and not good. Also sometimes does stuff if i look away and sometimes out of nowhere. Fix this. First when you open the app i should center myself, cause now I open the menu”**. The gesture gate is FAILED until he tests this revision and approves it. Phase 0 crispness remains user-passed. No further Phase 1 work is authorized before that gesture check.

Investigation confirmed Build 006 discarded all hand `select` events and generated actions from simulation-tuned joint distances, without a panel-attention or hand-frustum gate. Those code facts explain vulnerabilities; the exact on-headset cause of each missed/phantom click was not measured. Build 007 replaces the action authority, rather than retuning the old recognizer.

Every XR entry starts **centering**. The instruction panel follows the current view while Bastian gets comfortable. A steadily tracked, open hand followed by one completed native pinch places the page at the current viewer pose. No menu, practice or page turn is allowed before confirmation. No automatic practice follows centring; practice remains a menu option. A long centring press never opens the menu; its release is consumed by centring.

`gestures.js` now accepts only native `selectstart` → successful `select` → `selectend` transactions. Successful select commits once; selectend without select cancels. Short clicks have no app distance/minimum-duration filter. Native start timestamps drive the 1.4 second hold; completion consumes the sequence before changing context. The existing 350 ms ring delay and full-at-1.4 s hand animation remain. No native event means no action; there is no silent distance fallback. Squeeze is not bound, avoiding overlapping pinch/grab actions.

RAF validates current safety before processing queued events and ticking holds. Event rays are copied while the event frame is active; getViewerPose is never called there. Gates require session visibility `visible`, valid non-emulated tip poses, a known left/right hand inside a viewer-local 48° horizontal /42° vertical half-cone at depth 0.12–1.5 m, and the current page/menu within 40° of head-forward. Steady tracking takes 400 ms; fresh open takes 180 ms. Open recovery uses an unpressed native button plus a broad 22 mm gap when available, otherwise a 28 mm gap. These recovery thresholds never generate clicks. These are conservative trial view bounds, not a headset eye-tracking or tracking-confidence measurement.

Looking away, out-of-view hands, invalid/guessed poses, >120 ms sample gaps, hidden/blurred visibility, source removal, reference reset and the best-effort near-face system-pinch guard cancel pending actions and ring charge. A fresh tracked/open hand is required after return. Optional `skipRendering` suppression is honoured when supplied, but is not treated as a portable standard system-gesture flag. Cancelled or stale endings cannot strand nativeDown. A menu press retains its original target across frames; moving from Night to Exit cannot activate Exit on release.

Preserved: renderer modules, compositor texture lifecycle, right/left release direction and swap, hand badges, orange boundary bar/text, dim unavailable direction, world-still menu and restored reading placement. Only module cache versions changed in renderer imports. `gestureLog`/`ignoredPinches` remain bounded; exports add received/validated `nativeEvents` (event kind, source, hand, profiles, visibility, context, tracking/in-view/steady/readiness data) and current `inputState`. Use these to verify actual Quest event flow if the trial fails. No real Quest event recording was available during implementation.

PC verification: 28 pure tests and 82 isolated Chromium checks. Synthetic native events follow successful start/select/end and cancelled start/end flows; fixtures throw if viewer pose is queried on an event frame. Coverage includes start-up gating, quick native clicks, ignored joint-only movement, hold/release timing, lookaway and closed-hand return, blurred visibility, edge-of-view/system suppression, simultaneous hands, source removal, stale-event recovery, target locking, practice, honest boundary pixels, uploaded-page readbacks, front/side/lying images, and graphics/layer regressions. PC evidence is not headset evidence. Independent review and publication status are recorded in BUILD_007_REVIEW.md and BUILD_007_REPORT.md.

Version: header BUILD 007, all module queries v7, export `gestures-007`, trial URL https://p0champ.github.io/bradbury-cabin/?v=7 . Only push `phase-1-gestures`; retain passed `phase-0-crispness`. No Sunnyvale files or bridge service were touched. Stop after deployment and wait for Bastian's Quest verdict; QUEST_CHECK.md is the current eight-step check. Older entries below are history.

---
# Bastian's Build 006 Quest feedback — gesture gate FAILED (27 October 2026, 22:22)

Verbatim: **"buttons still very unresponsive and not good. Also sometimes does stuff if i look away and sometimes out of nowhere. Fix this. First when you open the app i should center myself, cause now I open the menu -"** (the last sentence was cut off in his message).

Meaning, as far as it can be read:
- Intended pinches are still often missed; this includes the menu buttons.
- False actions happen when he looks away and at random.
- On entry he wants an explicit centring step first. At the moment he ends up opening the menu instead.

Build 006's simulation-tuned thresholds did not transfer to the headset. Do not retune them blind again. He asked for the work to be handed to another agent; see the continuation prompt given to him in chat. Treat the Build 006 entry below as PC evidence only.

---
# Build 006 — gesture repair, awaiting Bastian's Quest check (27 October 2026)

Root causes found for "the skipping pages is a little weird now and doesn't change page even if the click is registered" (Build 005). These are evidence from code and simulation, not from the headset:

1. **The sample text is only 2 pages.** Next on page 2 and Back on page 1 did nothing, yet the hand icon flashed and the footer said "Next page" / "Previous page".
2. **The hold ring started on every pinch,** so every pinch looked registered. A single noisy tracking frame above 24 mm then silently cancelled it.
3. **The 38 mm open threshold** can sit above a relaxed hand's resting gap. Arming was also lost when a noisy reading dipped during the approach.
4. **Practice completion was saved only if Menu was done last,** so practice could return each session, ticking pinches without turning pages.

Fixes:
- `app.js gestureEvent` returns the real outcome (turned / first-page / last-page / practice), and the feedback and badge follow it:
  - a real turn flashes the arrows;
  - a no-op shows an orange end bar;
  - a direction with no page left is dimmed.
- The recogniser was rewritten (see README "Hands and controls"):
  - confirmed closes;
  - 30 ms spike filter during contact;
  - 32 mm open with pause-not-reset arming;
  - bounded half-open handling;
  - cooldown pinches must reopen.
- The ring is hidden for 350 ms and still completes at 1.4 s.
- Practice finishes on Next + Back in any order and returns to reading.
- Save test details exports `gestureLog` (40 firm pinches with outcome/reason/ms/page) and `ignoredPinches` (20 near-pinches with min distance). Use these to calibrate thresholds from real Quest data.

The crisp quad path (gl.js, the layer setup) is unchanged. Only hand layers animate.

Status:
- Built and PC-tested: 39 pure + 78 Chromium checks.
- Independently reviewed: round 1 scored 6/10, round 2 scored 8/10 (BUILD_006_REVIEW.md).
- Committed locally on `phase-1-gestures`.
- **Push pending:** the session's GitHub link was missing, so the live URL ?v=6 is not deployed until the push succeeds.
- Needs Bastian's Quest check: follow QUEST_CHECK.md. The gesture gate is still unpassed, and Phase 1 must not continue until he says go.

Next if gestures pass: Phase 1 full-work pagination (this also removes the 2-page boundary problem), saved place, moods, styles and ambience. If they fail: read his exported log before changing thresholds.

---
# Latest Quest feedback — unresolved, 27 October 2026

Bastian tested Build 005 and reported: **“the skipping pages is a little weird now and dosent change page even if the click is registred.”** He requested that this be noted and handed to Claude to finish the work. No repair or new Quest pass followed this report. The cause is unknown; distinguish Quest's click feedback from the app's badge pulse, emitted page action and actual page-state change. Build 005's PC checks and 8/10 review did not establish reliable on-device page turning. The gesture gate remains unpassed. Phase 0 crispness remains passed.

Next: fix this mismatch first, preserve crispness and hand-only menu animation, add meaningful regressions, obtain independent review, then ask Bastian to check gestures again before continuing Phase 1. Do not interpret this handoff as approval to skip phase gates. See CLAUDE_HANDOVER.md for the continuation prompt. Older readiness statements below describe PC evidence only.

---
# Build 005 — calmer gestures and hand feedback

Bastian reported Build 004 gestures were much too sensitive and requested skip symbols on each hand with a slowly filling menu-hold circle. Build 005 uses 18 mm firm pinch, 160 ms minimum, 140 ms open arming, 90 ms continuous release settling, 450 ms turn/select cooldown and a 1400 ms menu hold. Partial loosening stops hold charge; natural release has 220 ms travel allowance, with action duration capped at the first separation. Stalling half-open, reclosing, release bounce, tracking loss or a sample gap cancels the gesture. No time spent half-open is counted toward a hold. Either hand can summon the menu; two simultaneous pinches are not required.

`hand-badges.js` adds two 256-square, 6 cm native quad layers, positioned by the hands and oriented toward the viewer. Skip direction honours hand swapping. The active hand's ring fills in 48 steps, with a short completion pulse; the page has no hold bar and is not repainted by hand progress. Uploads use premultiplied alpha and restore GL state. New layers wait until active in renderState before subimage access. Tracking/system guards hide badges; cleanup destroys them. Optional layer allocation/upload/list failures disable badges and retain the reader with an exported diagnostic.

Verified: 23 pure tests +74 isolated Chromium checks pass. Independent critic approved at 8/10 PC readiness; release bounce, half-open duration, gradual-release ergonomics and optional layer-budget findings were fixed before approval. Phase 0 sharpness remains user-passed. Full Phase 1 is still pending. Build 005 needs Bastian's Quest check for pinch comfort, tracking, badge placement and frame pacing. PC evidence is synthetic XR with real WebGL, not headset evidence. Current URL: https://p0champ.github.io/bradbury-cabin/?v=5 . Branch and Pages source remain `phase-1-gestures`; versioned app/gesture/GL/badge modules are v5. See CALM_GESTURE_REVIEW.md and GESTURE_REPORT.md for verification. Older entries below are historical.

---
# Build 004 — Phase 1 gesture trial

Bastian explicitly reported Build 003: **“Very crisp we can move on.”** The Phase 0 crispness gate passed by the user's judgement. He requested a gesture-system brainstorm and approved the proposed right/left release turns, held menu, separate reading/menu contexts, and practice screen. Work is on `phase-1-gestures`, based on the passed `phase-0-crispness` Build 003 commit 10ee617. Do not claim all of Phase 1 is built: full-work pagination, saved place, both moods and ambience remain pending.

Build 004 adds right release Next / left release Back, hand swapping, either pinch held 750 ms to open/close the menu, explicit targets only in the menu, hand-ray default plus optional menu-only head pointer, visual hold progress and action feedback. One hand owns a gesture. Short actions happen on release after at least 60 ms; an elapsed hold always wins, including when the threshold is crossed on a release frame. Tracking loss, visibility changes, reference resets and input removal cancel pending actions and require the hand to open again. Native hand select events do not duplicate joint processing. Near-face palm pinches are suppressed with a best-effort geometry/forward-cone check; system gesture detection is not a standard WebXR flag.

The practice panel recognises Next, Back and Menu without advancing the sample text. All three marks remember practice completion in `cabin-controls`; hand-swap and pointer preferences use the same local setting. This is UI preference caching, not the future durable progress system. Menu Exit safely stops the callback even when cleanup is immediate. A first release after opening the menu never selects a button.

The approved crisp rendering modules remain the Build 003 path. One quad temporarily shows the practice/menu panel at a separate captured pose. Closing restores the stored reading-page pose; only explicit Re-centre replaces that pose. The menu remains world-still after opening and does not follow either hand or head. B uses the same displayed pose, so A/B still agrees. `gestures.js` holds the recognizer and menu geometry; `app.js` manages contexts/presentation. Old PinchGate/reading footer hit targets were removed.

PC-tested: **14 gesture/geometry tests +71 isolated Chromium checks**, including native layer regressions, real pixel readbacks and stereo depth, hold threshold boundary, tracking-loss cancellation, menu ownership/highlight with two simultaneous sources, practice, saved hand preference, menu placement/reading restoration, explicit re-centre, Exit and re-entry. Images under the task outputs/gesture-evidence show practice, menu and source readbacks plus world-projected front/side/lying views. These are synthetic XR tests, not device hand/comfort results.

Independent critic round 1 found two P2s (hold-threshold release and wrong-hand menu highlight); both were fixed with regressions. Final independent round 2 reached **8/10 for PC gesture-trial readiness**, with all 14+71 checks independently passing; see GESTURE_REVIEW.md. The new Quest gate is gesture comfort and reliability, not another claim that crispness is untested. Follow QUEST_CHECK.md and GESTURE_REPORT.md. User-facing URL: https://p0champ.github.io/bradbury-cabin/?v=4 . App/core/gesture module URLs are versioned 4; diagnostic build is `gestures-004`. The graphics module remains v3.

Hosting source is the root of `phase-1-gestures`. Preserve `phase-0-crispness` as the passed Build 003 reference. No main push or bridge change is involved. Before every commit and push scan the staged/committed contents for secrets. Local static preview is port 18140; never start or restart a second Sunnyvale bridge. No normal Chrome access, private data access or service restart occurred in this trial.

---

# Build 003 — Direct quad upload and precise graphics diagnostics

Supersedes the rendering details of Build 002 below. Bastian’s second Quest attempt reached drawing, then stopped with the old generic `WebGL reported an error drawing the compositor layer` message. That check included errors from earlier operations, so the failing operation and original numeric GL code are **not known**. Do not claim the legacy framebuffer or shader was proven to be the cause.

A now submits only the quad and uploads the raster page directly with `texSubImage2D`, as in the official Immersive Web quad sample. It never touches the legacy eye buffer or uses an FBO/shader/mipmap path for the page. Actual subimage offsets and allocation sizes are honored; clamped allocations use a staging canvas. Cached pixels survive unchanged frames; page changes, A/B return and `needsRedraw` refresh them. Flip state and binding are restored within the callback.

B now uses a native XRProjectionLayer with `textureType: texture` and DEPTH_COMPONENT24, per-eye `getViewSubImage`, scissored clears and guaranteed color/depth detach. Legacy XRWebGLLayer remains only for sessions without Layers. Resources are created after awaiting makeXRCompatible, guarding possible graphics-device transitions. GL checks identify the operation and all observed numeric codes; diagnostic exports include `phase0-003`, `renderRoute`, and `graphicsError` with stage/codes. No errors are silently discarded.

PC verification: 4 core +55 Chromium checks pass. The fixture protects opaque textures from reallocation/mipmaps/FBO use on A, verifies unbinding/detachment, reads back pixels to verify orientation and runtime-clamped sizing, tests A refresh after style changes in B, injects and verifies three named GL errors (1281/1282/1286), and draws both eyes into separate atlas viewports with actual allocated depth textures. Simulated images and readbacks are not Quest compositor/optics evidence. Independent review reached **8/10 for PC diagnostic readiness**, with all 4+55 checks independently passing; see REVIEW.md.

Retry URL: https://p0champ.github.io/bradbury-cabin/?v=3 . Header Build 003, versioned app and graphics module URLs prevent old module reuse. If it stops again, the complete error text now identifies the failing operation and code; Save test details preserves the full record after exit. Phase 1 remains gated on a successful Bastian Quest sharpness check. Sunnyvale and its running bridge remain untouched.

---

# Build 002 — Quest startup hotfix

Bastian reported: `Could not open the passthrough test: Failed to execute updateRenderState on XRSession: Can't use baseLayer with layers feature requested`. The earlier PC mock missed the browser’s rejection of the presence of `baseLayer`, even when its value is null, in a layers-enabled session. It also missed that a quad-creation fallback still needs the Layers list when that feature was enabled.

`applyLayers` now passes **only** `layers` for layer-enabled sessions, with the existing XRWebGLLayer inside the list. The legacy `baseLayer` property is used only without the feature. Older runtimes without `enabledFeatures` probe list support first. The [W3C Layers render-state algorithm](https://www.w3.org/TR/webxrlayers-1/#xrsession-updaterenderstate) explicitly permits XRWebGLLayer entries in the list. The successful A/B path no longer sends a baseLayer property at all.

Before the fix, a stricter regression reproduced Bastian’s exact error. After the fix, 4 core tests and 30 browser checks pass, covering both enabled-feature reporting and old runtimes, quad creation failure with the feature still enabled, no-layer sessions, and in-frame A/B switching. Independent hotfix review reached **8/10 PC readiness** and independently reran all 4+30 checks; see REVIEW.md. A nonblocking limitation remains for much older browsers that silently ignore an unknown Layers dictionary property; the target Quest repair does not depend on that compatibility probe. Header Build 002, module URL `app.js?v=2`, and diagnostic `phase0-002` identify this revision. Retry URL: https://p0champ.github.io/bradbury-cabin/?v=2 . This remains Phase 0; a successful Quest entry and sharpness check are still required.

---

# Bradbury Cabin handover — 27 October 2026

## Gate and current scope

Phase 0 only. Bastian must try it in Quest 3 while lying down and explicitly approve before any Phase 1 work. Bastian tried build 001 on Quest; entry failed with the baseLayer/layers error. There is still no successful headset sharpness comparison. Read README.md, QUEST_CHECK.md and REVIEW.md before continuing.

Built: static passthrough WebXR sharpness test with real compositor quad and ordinary perspective-texture paths, public-domain poem/story excerpts, bundled licensed font, paper/night, three sizes, tracked pinch page turn, head-directed control targeting, world-still placement, re-centre and diagnostic export.

PC-tested: four core tests and 21 isolated Chromium checks with real WebGL plus a synthetic XR API. Screenshots cover desktop, mobile, paper sizes, night, frontal and rotated side views, including lying-down pose. Mock timing now respects next-frame render-state changes. These are not compositor/device screenshots, stereo quality evidence, actual passthrough, or real hand tests.

Reviewed: independent critic's first pass was 6.5/10. It found a real frame-boundary A/B bug, fixed and regression tested. Final independent re-review reached **8/10 for PC readiness** after two rounds. The critic independently reran 4 core and 21 browser checks; see REVIEW.md for remaining device/lifecycle/typography limits.

Committed: Phase 0 code and hosting documentation on `phase-0-crispness`, pushed to the public remote. GitHub Pages is configured at https://p0champ.github.io/bradbury-cabin/ using that branch’s root. Needs a Quest check: yes. No main push/merge authorized.

## Work and hosting

The local repository is on `phase-0-crispness`. A separate loopback static preview was run on port 18140. It has no pairing or network link to Sunnyvale. Do not start another bridge for this app.

Bastian initially asked to create the repository himself, then explicitly asked the assistant to do it. Created **p0champ/bradbury-cabin** using the existing authenticated GitHub connection, pushed only `phase-0-crispness`, and configured GitHub Pages for that branch’s root. No main branch was pushed. Public remote: https://github.com/p0champ/bradbury-cabin.git . The repository and first public publication are authorized by that follow-up. Before each commit/push inspect staged/committed files for secrets; no private URLs, credentials, pairing codes or phone numbers belong in this public repo. Network operations require the environment’s normal network approval; use a per-command `safe.directory` exception for this exact checkout when an elevated Git process runs as the user rather than the sandbox account. Never weaken Git’s global directory trust. `.nojekyll` keeps the deployment as literal static files, including markdown checklist/credits.

The app has no dependencies or build step. `npm start` runs the static preview; `npm test` runs core tests. For browser regression checks, install/use a test-only Playwright runtime and its Chromium, start the static preview, then `npm run test:browser`. `CABIN_PLAYWRIGHT_PATH` and `CABIN_CHROMIUM_PATH` optionally point to an existing test runtime/browser; `CABIN_EVIDENCE_DIR` selects screenshot output. Never point tests at a personal browser profile. No normal Chrome automation or account login is needed. Font files and licence ship locally; there are no runtime CDN requests.

## Important implementation details

- `app.js`: app state, Canvas 2D page painting, XR lifetime, input, hit testing and layer drawing. `core.js`: small test-corpus pagination, dimensions and pinch gate. `gl.js`: WebGL2 source texture/shaders and column-major matrices.
- 2048 × 2560 requested layer; 0.72 × 0.90 m at 1.1 m. Both A and B use the same source. Source mipmaps keep B's minification fair. Actual layer viewport dimensions are exported.
- A mode switch requested during a joint pinch applies to render state at the next XR boundary. Finish the current callback using its initial `drawMode`. Do not replace this with immediate `state.mode` checks after input.
- Projection color/depth textures are attached and detached inside the XR callback, including error cleanup. A quad is filled directly using `texSubImage2D`; it is never attached to a framebuffer. Do not reallocate or generate mipmaps on runtime-owned textures. B alone uploads an ordinary canvas texture using `texImage2D`.
- Use `local` space, never continuous viewer parenting. Capture head orientation as well as translation on initial placement/re-centre, so lying down works. A space reset explicitly re-centres. Tracking loss clears the gesture state.
- Gaze means head direction, not eye tracking. It targets controls; there is no automatic gaze page turn in this phase. Pinching away from controls advances. Start with an open hand; a held pinch never repeats. A/B doesn't move the page.
- Layer-creation failure leaves an explicitly labelled texture-only fallback, which cannot pass the gate. Drawing failure ends XR with an error. Alpha-blended passthrough is required. No Layers polyfill or opaque virtual room.
- Export after exit retains the last render mode and layer result. Test details contain local browser/runtime information, not bridge secrets. Do not present a successful mock draw as a successful Quest draw.

## Sunnyvale studied; leave its service alone

Read the existing Sunnyvale checkout's HANDOVER.md, bridge/server.mjs and relevant bridge transport code, browser-bridge.js, browser-media.js and browser-voice-link.js during initial investigation. Its running port-8130 listener was observed. Process command-line inventory was denied by the environment; socket inspection confirmed the listener. No service was restarted, no competing bridge was started, no normal Chrome was accessed, no private runtime contents were read or copied, and Sunnyvale code was not changed.

Later Phase 3: reuse its extension/browser pipeline and separate audio sequencing/ACK channel; add a cabin-specific connector route/secret and private durable namespace inside the same bridge. Test shared changes on a branch, with throwaway `BRIDGE_PRIVATE_DIR` and separate ports, before any approved real service restart. Do not assume other tasks' historical restart approvals apply to Cabin. Reconcile against the current active Sunnyvale branch before editing. Claude's own Drive connector is the preferred route to the newest story file in **Bradbury stories**, with supported formats checked at that phase.

## Preserve these requirements for later phases

- Challenge started 18 Oct 2026, day 1 completed. 21 Oct missed: Rumi's The Guest House, Chopin's The Story of an Hour, Woolf's The Death of the Moth. Other dates must not be invented. Keep the full year including missed days. Reminder preference 20:00; no reminder automation has been created.
- Three daily cards; poem/story/essay each ticked separately. Only three ticks completes a day. Prevent repeats using durable history. Broad era/country/field variety and stored tutor priorities.
- Weekly story due Sunday. External writing, newest Drive-folder file, Claude review only: idea/structure/character/prose/ending each 0–10, ranked priorities and questions. Never rewrite stories or pitch ideas. Grade-to-picker connection must be durable structured data.
- Durable private bridge storage plus headset cache and export. Cache alone is insufficient.
- Phase 1 adds general full-work pagination, poem stanzas, saved place, both moods, ambience and optional corner gaze turning off by default. Phase 2 adds calendar/history. Phase 3 adds Claude. Phase 4 adds meaningful animation/polish. Every phase needs independent critic review up to three rounds and a separate user Quest gate.
- Legal-source full texts through bridge, prefer available full text; modern copyrighted works need source windows or personal imports. No invented full-text coverage percentage. Sounds must be licensed and credited.
