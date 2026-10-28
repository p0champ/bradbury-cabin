# Build 032 — study notes stay with each day's reading
28 October 2026.

## Behavior
Accepted daily selections now save their normalized notes in the day's progress record. Each guide is bound to catalogueId and the exact source bodySha256, with its own revision timestamp. Your shelf reconstructs the same day's work ID with its before/after notes; source blocks and saved source anchors remain unchanged. No new guide menu or parked guide-UI redesign.

Notes travel in existing local progress, Drive synchronization and progress export. Previously cached current/prior-day trios are archived automatically on load. Current cached selections lacking guide fields can restore notes from the matching archive offline.

Existing Sync recovers notes from the newest historical picks file for recorded earlier days. Only existing recorded selections may receive notes; no missing day/kind choices are invented. Source parsing, completeness and quote checks apply before recovery. Missing or unsupported files do not remove readings or ticks; the user imports/transcribes nothing. Recovery is bounded to12 downloads and24 metadata queries per sync, with a persisted rotating date cursor. Seen file revisions prevent repeated bad/empty/oversized downloads from starving older recovery. If notes were never supplied in the old file, none are fabricated.

Merging chooses the newer guide revision independently of a later tick on an old device, and drops notes that do not match the retained selection/edition. Malformed optional notes do not invalidate core progress. Existing valid notes are retained when a same-work resync omits notes. Late notes arriving while a work is open preserve its current section/word anchor rather than jumping into a new introduction.

## Validation
-149 unit tests and all exact-source/workflow checks passed; catalogue remains241 accepted works, unchanged.
-Eight new archive tests cover persistence, independent cloning, wrong-work/edition/misquote rejection, swaps, preserving notes on no-notes resync, separate guide revision time, malformed optional notes, newest historical file recovery, recorded-only choices, oversized history starvation and bounded/rotating recovery.
-Four new PC browser cases passed:cached prior-day notes survive next day/cache removal/reload upright and lying; current no-guide cache restores archive offline; historical Drive recovery persists notes and preserves the current source anchor and ticks.
-Full PC browser suite:142/142 passed. Evidence ../build-032-evidence and ../build-032-full-evidence.
-9/9 isolated faults caught, production untouched, with passing unit/browser baselines (../mutation-032/run.cjs). Faults remove catalogue binding, edition binding, quote checks, existing-note preservation, revision ordering, past-work notes, oversize checkpoint, metadata cap and offline startup overlay.

## Independent review
The separate critic authored no implementation. Round1:7/10, twoP2 findings:oversized downloaded histories could repeatedly consume the recovery budget, and current cached files without notes did not overlay existing archives offline. Both fixed, including12 bad files followed by older good recovery across syncs, metadata request cap/cursor, and offline browser regression.
Final:9/10 approved, no unresolved findings. Critic independently ran archive/Drive/shelf tests and reviewed upright/lying notes and source-anchor recovery screenshots.

## Deferred and preserved
Real Claude/Drive and Quest checks remain saved for one combined user test at the end, as Bastian requested; no per-build user gate. No literary text, source verdict, gesture recognizer, handMapRevision9 or menu indices changed. All import/index queries v32; header BUILD032; diagnostic gestures-032. Saved notes cannot recover material Claude never wrote. Release status recorded after live verification.


## Release
Code commit e587dce pushed to build-032-saved-notes and phase-1-gestures. Live Build032 verified: index.html, style.css and all27 JavaScript modules match reviewed local files after normalising line endings. Staged and committed secret scans passed25 changed files. Actual Claude/Google Drive and Quest checks remain saved for the end, not claimed as passed.
