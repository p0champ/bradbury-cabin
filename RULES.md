# Bradbury Cabin — finished app: bug fixes only

Build 058 closes the approved finishing work. Build 057 remains the protected starting inventory; the chosen finishing changes are recorded in the Git history. The exact complete-check receipt and release record establish what passed. Account checks, physical Quest checks and seven real reading days require their own evidence; never infer them from a desktop pass.

## Governing rules

- Bradbury Cabin is feature-complete. Future work permits bug fixes only. Do not add features, polish, redesigns or speculative improvements unless Bastian explicitly starts a new version. A repair must address an identified failure and preserve the frozen behavior below.
- Preserve the look, intro, existing watch design, pointer/input behavior, passthrough, stationary page placement and exact-text rule. A bug report does not authorize a redesign. If a proposed repair would alter a frozen behavior, explain it and get an explicit selection first.
- Bastian continues to ask Claude “give me the daily three” and “swap the poem” or another kind. Do not generate, schedule or automate that request, replace Claude, or move the choice into a new system.
- Personal data is never reset as a repair technique. Source rollback must not roll back reader data. Migrations preserve the original copy and support recovery; do not deploy an older app against a newer data format unless compatibility has been tested.
- No production publish until the complete release check passes. Partial/focused passes cannot be described as a full pass. Never relax tests, gesture thresholds or source checks merely to obtain green results.
- Every approved fix is isolated, checked and reviewed before the next. Keep a release record and a tested source rollback path.
- Report built, automatically checked, independently reviewed, published, physically checked on Quest and seven-day trial as separate states.
- Keep these rules and this inventory in RULES.md, with AGENTS.md and CLAUDE.md referring to it. Keep the release gate and hosting protection enforced: instructions alone cannot prevent a bypass.

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
| Wrist watch | Same small right-wrist face, time, existing reading cue, fade, posture and tracking-loss behavior. The cue names the open poem, story or essay; otherwise it identifies the first unread daily work. Capped still flame reflects the protected reading-day streak without adding a new dashboard. |
| Streak and rewards | A day counts only with all three read; one past miss/partial per Monday–Sunday Berlin week protects without adding a day; unfinished today stays neutral. Milestones: seven protected reading days, 30 total full trios and 100 distinct reviewed pieces. Earned gifts remain owned, are optional and do not replay after sync/reload. |
| Reward ceremony | Existing silent, short, skippable glow and card after completion/optional feedback; reduced motion; Read now/Later; simultaneous milestones share one ceremony; reserved originals open offline when available. |
| Stars and thoughts | Optional independently; stars save on selection. A written thought saves only after approval, with the exact piece; complete transcript is reviewable. Edit/removal and deletion-aware sync survive restart/restore. Restore unfinished drafts with a clear unsaved note, without treating unapproved speech as a saved thought. |
| Voice | Recording and transcription are distinct. Show actual listening, stop/cancel correctly, reject late results, handle denied/missing support calmly and keep typing available. Quest speech support remains unconfirmed until physically checked. No new speech service without an explicit decision. |
| Word tap | Deliberate word pinch shows an off-page meaning/reference card, without an accidental page turn; close and cancel correctly on navigation/tracking loss; network failure leaves reading usable. |
| Reading comfort | Focus dim range and live setting, gentleness and restoration in menus; seasons off by default, correct hemisphere/season, rare outside-text details, reduced motion. Keep page placement stationary. |
| Appearance and controls | Paper/night, typeface, sizes, sound/chime, ambient choices, volume, watch toggle, pointer choice, next-page hand, practice and re-centre retain their existing behavior and appearance. Every setting joins the complete save/restore contract. |
| Failure and offline reading | Cached accepted readings and shelf remain usable; friendly short notes replace raw error codes. Fetch timeouts, account expiry, corrupt optional content and blocked storage must not blank the screen, silently lose changes or replace good data with empty data. |
| Backup and restore | Complete personal state is backed up outside the Quest, with earlier verified snapshots and an actually tested restore. Restoring or merging cannot revive deleted thoughts, lose earned rewards or erase newer independent changes. Credentials are not placed in a public backup/repository. |
| Updates | Complete compatible app/content is cached after successful installation; update failure retains the last working version. Data migration, interrupted update, rollback and fresh-browser restore have automatic checks. |
| Advanced tools | Existing exports/imports, test-detail export, desktop comparison and credits remain usable, but maintenance/debug language must not spill into the ordinary reading experience. Export/restore must be upgraded to cover all personal state before being called a complete backup. |

## Release protection

BUILD_058_ACCEPTANCE.md maps each inventory row to a stable check ID, maintained checks and evidence. Run unit/state checks, critic/source checks, every maintained browser module, visual comparisons and recovery/failure tests in one release gate. The gate refuses an omitted browser module, focused run, dirty tree or changed source. A passing receipt belongs only to its exact commit and project bytes.

Exercise fresh and returning readers; daily arrival and same-day swaps; late and out-of-order replies; expired authorization; long/corrupt listings; timeouts and offline return; storage-full/denied/corrupt state; crash/reopen at each save boundary; two-device edits and deletion conflicts; old-version migration; interrupted update; complete restore into an empty separate browser; midnight/DST; all frozen visual/input behavior. Use fake private accounts/fixtures for destructive tests, never Bastian's only copy.

Automated checks do not establish physical Quest comfort, a real restart/restore or seven actual days of successful Claude deliveries. Those remain separate acceptance requirements.


## Completed finishing scope and future reporting

The approved finishing sequence covered saving and recovery, the existing Claude handoff, critic items 1, 2, 4, 5, 6, 7, 8, 9 and 10, complete offline updates, explicit unapproved drafts, the owner connection, outage fallback and safe same-browser tab ownership. This history does not authorize more polish. For future bugs, reproduce the failure, fix one thing, review it and rerun the complete gate before the next fix. Never reset personal data. Report only when a fix is finished, help is needed or something fails, using two plain sentences.

For critic item 3, first obtain an actual Quest speech test. If speaking does not work, propose a simple thought-entry method inside the cabin and wait for approval of that idea before building it. A desktop fixture or the presence of a browser API is not a successful Quest test. Bastian could not test this during finishing. Keep Quest speech explicitly unconfirmed until he reports the actual result.

### Outside the finished app — requires a new version

- Critic 11: generic or absent why-this-one explanations. Never invent historical reasons.
- Critic 12: hemisphere toggle and calendar symbol explanations.

No further polish is authorized. Preserve the frozen appearance and input behavior. The completed watch repair corrected its reading cue and did not replace its design.

## Verification and release

Run `npm run verify` before and after each repair. This discovers every unit test and checks that every maintained browser module is included in the full browser runner, runs original-text checks and all browser checks, and binds the passing receipt to the exact project contents. Focused checks are for diagnosis only. `npm run install:guard` installs the repository's pre-push verification hook. CI repeats verification; repository hosting protection still requires checking the hosting settings, and must not be claimed configured without evidence.

Real Quest acceptance remains pending until the owner reports it. Full backup, durable connection, restore and the seven-day trial must each have their own evidence; do not substitute a code savepoint or a test fixture for personal-data recovery.

## Backup and outage invariants

- Complete personal state includes history, exact editions, completion and corrections, weekly entries, rewards, saved/deleted thoughts, explicitly unapproved drafts, reading places and settings. Credentials and private connection identity stay outside public exports and source.
- A private backup is acknowledged only after complete durable readback. Do not clear a newer queued save on an older reply. Preserve the explicit device edit sequence and duplicate identity, including its frozen first-device ownership mode.
- The service is the only writer of the normal Google progress file. Tap-to-Sync fallback uses checked immutable Google safety files, then the same sequenced reconciliation protocol when the service returns. Do not introduce a second independent main-file writer. Preserve the checked cursor and complete pagination. See connection/RECOVERY.md.
- Google failure must not prevent a valid private save. Cloudflare failure must leave installed reading and local changes usable, with manual Google fallback for the already verified owner. If both providers fail, keep the durable local queue and retry calmly; never claim an unchecked outside backup.
- Only one reading document may own the journal in a supported browser profile. OAuth return/helper pages are separate handoffs. Leaving invalidates late personal writes; Back must not revive a stale writer.
- Source deployment is distinct from the first real Quest sync. Existing Quest places and settings are confirmed outside the headset only after its first successful complete backup. Never substitute a Google file that lacks those fields or a fixture for that evidence.
- GitHub requires the complete verify check on an up-to-date pull request before production changes, including owner changes. Pages deployment also depends on verification. Bastian performs the production merge/publish; never bypass the guard or push production on his behalf.
