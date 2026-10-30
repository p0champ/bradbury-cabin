# Bradbury Cabin — draft rule book and feature freeze

Approved finishing contract, 30 October 2026. Build 057 is the protected starting inventory. Required trust behavior below is a target until backed by passing evidence; do not describe it as already proven.

## Governing rules

- Bradbury Cabin is feature-complete. This project now permits reliability work and user-selected bug/polish fixes only. No new features unless Bastian explicitly starts a new version.
- Preserve the look, intro, existing watch design, pointer/input behavior, passthrough, stationary page placement and exact-text rule. A bug report does not authorize a redesign. If a proposed repair would alter a frozen behavior, explain it and get an explicit selection first.
- Bastian continues to ask Claude “give me the daily three” and “swap the poem” or another kind. Do not generate, schedule or automate that request, replace Claude, or move the choice into a new system.
- Personal data is never reset as a repair technique. Source rollback must not roll back reader data. Migrations preserve the original copy and support recovery; do not deploy an older app against a newer data format unless compatibility has been tested.
- No production publish until the complete release check passes. Partial/focused passes cannot be described as a full pass. Never relax tests, gesture thresholds or source checks merely to obtain green results.
- Every approved fix is isolated, checked and reviewed before the next. Keep a release record and a tested source rollback path.
- Report built, automatically checked, independently reviewed, published, physically checked on Quest and seven-day trial as separate states.
- After approval, put these rules and this inventory in project RULES.md, with AGENTS.md and CLAUDE.md entry points referring to it. Enforce release checks in automation as well: a text file alone cannot compel every AI or prevent a bypass.

## Feature inventory: expected behavior

| Area | What must continue to work |
|---|---|
| Browser entrance | Current calm presentation and saved-page glimpse; clear entry into Quest passthrough; browser support failures do not erase reading data or leave a dead loading screen. |
| Placement and intro | User-confirmed, stationary page straight ahead; existing lamp arrival, skip and reduced-motion behavior; no automatic head/recline following. |
| Passthrough and exits | Real room stays visible behind the page as designed; exit remains reachable from reading and menus; leaving, tracking loss and system UI safely cancel unfinished inputs. |
| Pointer | Displayed target and selected item agree on the actual native surface, including edges, both hands, head-pointer option and seated/reclined orientations. Preserve working hand timing and target priority. |
| Gestures | Existing next/back hands, saved hand preference, hold for menu, cancellation, page-boundary behavior and optional look-to-turn. A detected but rejected action must not pretend a page turned. |
| Reading page | Existing glass folio, type, drop caps, quotes, folios, restrained page turns and rim effect; all original words remain intact through wrapping, reflow and size changes. |
| Position and resume | Save last work and exact section/word anchor on every relevant change. Restore it on reopen, restart, update and full backup restore. A late sync or midnight rollover must not pull a reader away mid-story. |
| Today | Show the accepted poem, story and essay in stable source order. Begin, Continue and Read again are truthful. With no new trio, gently prompt the usual Claude request and offer yesterday's trio, the saved place and shelf; never present an unexplained empty state. |
| Claude and Drive | Exact existing manual request workflow; new accepted trios and swaps appear at next opening or within a minute while active when the required service/connection is available. Preserve the other two selections on a swap; validate the whole newest file and never silently call an old file the new result. |
| Sources and critic | Only supported critic-approved complete original editions. Ignore model-supplied literary text, invented IDs, forged verification and unverified editions. Existing quotation checks and original-text protection remain strict, including rewards. |
| Guides and personal lines | Before-reading material stays spoiler-free; after-reading material remains separated; guides attach to the exact work/edition and survive archive/restore. Existing optional welcome/thread wording remains optional. |
| Shelf | All recorded past days, exact editions, completion and saved notes remain accessible; missing information is described honestly, never invented. |
| Library | Starter works, available current/completed works and earned rewards remain readable; no duplicates masquerading as different editions; correct next-reading and saved-place actions. |
| Completion and challenge | Reading completion requires the existing explicit confirmation, persists immediately and does not mark a different daily work read. Calendar corrections and weekly written-story tracking remain available. Future dates cannot be falsely completed. |
| Wrist watch | Same small right-wrist face, time, existing reading cue, fade, posture and tracking-loss behavior. The current cue identifies the first unread daily work; the critic flags its meaning for an explicit decision. Capped still flame reflects the protected reading-day streak without adding a new dashboard. |
| Streak and rewards | A day counts only with all three read; one past miss/partial per Monday–Sunday Berlin week protects without adding a day; unfinished today stays neutral. Milestones: seven protected reading days, 30 total full trios and 100 distinct reviewed pieces. Earned gifts remain owned, are optional and do not replay after sync/reload. |
| Reward ceremony | Existing silent, short, skippable glow and card after completion/optional feedback; reduced motion; Read now/Later; simultaneous milestones share one ceremony; reserved originals open offline when available. |
| Stars and thoughts | Optional independently; stars save on selection. A written thought saves only after approval, with the exact piece; complete transcript is reviewable. Edit/removal and deletion-aware sync survive restart/restore. Draft handling must be made explicit and protected without auto-saving unapproved speech as a final thought. |
| Voice | Recording and transcription are distinct. Show actual listening, stop/cancel correctly, reject late results, handle denied/missing support calmly and keep typing available. Quest speech support remains unconfirmed until physically checked. No new speech service without an explicit decision. |
| Word tap | Deliberate word pinch shows an off-page meaning/reference card, without an accidental page turn; close and cancel correctly on navigation/tracking loss; network failure leaves reading usable. |
| Reading comfort | Focus dim range and live setting, gentleness and restoration in menus; seasons off by default, correct hemisphere/season, rare outside-text details, reduced motion. Keep page placement stationary. |
| Appearance and controls | Paper/night, typeface, sizes, sound/chime, ambient choices, volume, watch toggle, pointer choice, next-page hand, practice and re-centre retain their existing behavior and appearance. Every setting joins the complete save/restore contract. |
| Failure and offline reading | Cached accepted readings and shelf remain usable; friendly short notes replace raw error codes. Fetch timeouts, account expiry, corrupt optional content and blocked storage must not blank the screen, silently lose changes or replace good data with empty data. |
| Backup and restore | Complete personal state is backed up outside the Quest, with earlier verified snapshots and an actually tested restore. Restoring or merging cannot revive deleted thoughts, lose earned rewards or erase newer independent changes. Credentials are not placed in a public backup/repository. |
| Updates | Complete compatible app/content is cached after successful installation; update failure retains the last working version. Data migration, interrupted update, rollback and fresh-browser restore have automatic checks. |
| Advanced tools | Existing exports/imports, test-detail export, desktop comparison and credits remain usable, but maintenance/debug language must not spill into the ordinary reading experience. Export/restore must be upgraded to cover all personal state before being called a complete backup. |

## Automated protection to add after approval

Each inventory row receives stable check IDs and an evidence link. Distinguish protected existing behavior from new trust requirements and Quest-only checks. Run unit/state checks, critic/source checks, all maintained browser modules, visual comparisons and recovery/failure tests in one release gate. The gate also checks that no browser module was silently omitted.

Exercise fresh and returning readers; daily arrival and same-day swaps; late and out-of-order replies; expired authorization; long/corrupt listings; timeouts and offline return; storage-full/denied/corrupt state; crash/reopen at each save boundary; two-device edits and deletion conflicts; old-version migration; interrupted update; complete restore into an empty separate browser; midnight/DST; all frozen visual/input behavior. Use fake private accounts/fixtures for destructive tests, never Bastian's only copy.

Automated checks do not establish physical Quest comfort, a real restart/restore or seven actual days of successful Claude deliveries. Those remain separate acceptance requirements.


## Approved repair order and reporting

Protect the baseline and establish the complete release gate first. Repair saving, backup/recovery and the existing Claude handoff before optional polish. Then handle critic items 1, 2, 4, 5, 6, 7, 8, 9 and 10, one at a time, rerunning the entire gate after each. After each fix, tell Bastian in one or two plain sentences what changed and what to check on Quest. Do not publish a failed or incomplete candidate.

For critic item 3, first obtain an actual Quest speech test. If speaking does not work, propose a simple thought-entry method inside the cabin and wait for approval of that idea before building it. A desktop fixture or the presence of a browser API is not a successful Quest test. As of approval, Bastian has not tested this yet.

### Maybe later — not authorized for this finishing version

- Critic 11: generic or absent why-this-one explanations. Never invent historical reasons.
- Critic 12: hemisphere toggle and calendar symbol explanations.

No other polish items are implied by the finishing work. Preserve frozen appearance. Item 5 permits correcting the watch's reading cue, not replacing its design.

## Verification and release

Run `npm run verify` before and after each repair. This discovers every unit test and checks that every maintained browser module is included in the full browser runner, runs original-text checks and all browser checks, and binds the passing receipt to the exact project contents. Focused checks are for diagnosis only. `npm run install:guard` installs the repository's pre-push verification hook. CI repeats verification; repository hosting protection still requires checking the hosting settings, and must not be claimed configured without evidence.

Real Quest acceptance remains pending until the owner reports it. Full backup, durable connection, restore and the seven-day trial must each have their own evidence; do not substitute a code savepoint or a test fixture for personal-data recovery.
