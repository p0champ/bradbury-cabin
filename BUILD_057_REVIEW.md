# Build 057 — Hearthlight rewards

Built locally on `build-057-hearthlight`, based on local Build 056 (`e117164`). Not pushed, published or checked on Quest. Live remains the Quest-confirmed Build 054. Builds 055–057 are stacked locally.

## Behavior

The existing Glance face keeps its 4.4 × 3.85 cm dimensions, time, current reading, right-wrist posture and fade. Only its ember becomes a still flame. Growth is capped in restrained steps at 1, 7, 30 and 100 completed days in the protected streak. The face still paints only when its visible data changes.

A complete day requires all three recorded reading completions: poem, story and essay. The first missed or partial past day in each Monday–Sunday week protects the chain but adds no day. A second miss in that week breaks it. Unfinished today is neutral. Protection resets on Monday using Europe/Berlin dates; Sunday and Monday can both be protected. Unknown pre-tracking gaps receive no invented credit and cannot bridge a chain.

The first milestones are seven completed reading days within a protected streak, 30 complete trios overall, and 100 distinct reviewed catalogue editions. Reward readings can contribute to the 100 pieces. Rereads and duplicate daily/ledger records count once. Historical complete trios can establish an earned milestone, while unknown piece identities cannot contribute to the distinct-piece count.

Nine reviewed editions are reserved in three small local reward pools. Primary picks are Poe's The Tell-Tale Heart, Yeats's The Song of Wandering Aengus, and De Quincey's On the Knocking at the Gate, in Macbeth. Each milestone has two fallback editions if an earlier pick is already assigned or read. The app uses their unchanged catalogue bodies immediately, offline, without a new model response. This is vetted local selection, not Claude preselection. Claude's synced daily workflow excludes these reserved IDs; incoming new daily files are checked too. Already assigned older daily readings remain valid.

After completion, optional feedback can be saved or skipped. Done, or holding the pinch to close the feedback card, opens any newly earned reward. A cached warm rim glow lasts about two seconds, then a card offers Read now or Later. It is silent and skippable; reduced motion uses a short fade. Several milestones share one ceremony with a sequence of cards. Later completes the interaction and preserves the gift on the Rewards shelf. Rewards do not add a daily requirement. A pool with no unread candidate reports the earned milestone and the need for more reviewed picks; it never invents a work.

Awards, book ownership and seen receipts merge independently through Drive. Rewards survive streak breaks, later history corrections and older devices syncing. Receipts prevent a replay after reload or sync. Concurrent offline devices may choose different eligible fallbacks; merging retains both books already granted, with one canonical milestone and receipt. These are entitlements, not a security or anti-tampering system. Storage failure is reported; durability cannot be promised when browser storage refuses writes.

The celebration uses the existing native-page GPU composition with a glow painted once, rather than repainting its canvas every frame. Text pages, passthrough, intro, page placement and the rest of the watch remain unchanged.

## Validation

- 263 unit checks and maintained source checks pass. All 241 critic-accepted originals remain unchanged; all 39 deliberately corrupted source inputs are rejected.
- 35 unique focused browser cases pass across complete groups: rewards/watch 5; reading continuity/feedback/picker/archive 19; comfort/GPU composition 11. Rewards were repeated with native glow capture, hold-to-skip feedback, reduced motion, explicit animation Skip, combined milestones and failed storage. No full browser-suite run is claimed for 057.
- Desktop Chromium uses real WebGL, synthetic WebXR and fixture reading history. The reward, shelf, native glow and watch-growth previews were inspected. They do not establish headset comfort or performance, or represent Bastian's actual earned milestones.
- Independent review found no actionable blocker in the inspected implementation. It confirmed the source boundary, weekly protection, distinct-piece count, merging and preserved watch geometry. Hardware appearance/performance remain unverified.

Preview: http://127.0.0.1:18197 (local PC only). Logs and evidence are in the parent work directory: unit-057.log, rewards-057.log, regression-057.log, rewards-final-057.log, rewards-skip-057.log, build-057-focused/. The helper check-057.cjs runs named maintained browser modules; the normal suite also includes rewards-browser.cjs, with CABIN_REWARDS_ONLY for a focused run.

Publishing still requires a separate request. Build 056's Quest recording/dictation check remains open; no transcription service was added by this build.
