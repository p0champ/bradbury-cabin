# Build 044 independent review

## Verdict

Round 1: **7.7/10 — reject**. Round 2 after repair: **8.3/10 — accept the bounded implementation, subject to the final full suite passing before release**. No remaining P1/P2 finding in the reviewed diff. This is an implementation review, not an Apple endorsement or a Quest physical-alignment result.

## Blocking finding resolved

**P1: Closing-card clicks ignored their visible target.** The first implementation remapped every closing-screen pinch solely by hand direction. A right-hand click aimed at Back marked the work as read; a left-hand click aimed at Mark as read returned to text. The repair gives the actual held `end-back` / `end-mark` target priority and uses NEXT/BACK only as the untargeted shortcut. I added independent browser regressions in `tests/finish-browser.cjs`: aimed Back with the right hand cancels, aimed Mark with the left hand completes, and untargeted NEXT still completes. All 15 focused repair checks passed in my run after the change.

## Review evidence

- Inspected app input ownership, press snapshots, stale-event cancellation, actual-layer geometry conversion, same-texture pointer patch rendering, completion storage/validation and Drive union merge.
- Reviewed the independent GPU pixel test: real WebGL readback at top and lower page coordinates, old-pointer restoration, a nonzero subimage origin, a resized viewport, projection fallback, no separate pointer-layer allocation and small patch uploads. Existing synthetic hand/head tests remain useful, but their shared aiming helpers alone cannot prove physical alignment.
- Ran all 15 repair browser checks independently: centered/manual placement and exact previously displayed pose; hand Exit from placement, reading, Home and Settings; cancellation on movement/system ownership/staleness; controller Exit; queued and held head input; completion from Today, Library and archive with reload persistence.
- Independently captured actual production canvas output at `http://127.0.0.1:18168/` and visually inspected placement, reading, Home and Settings. Evidence: sibling `critic-044-evidence/entry-placement.png`, `reading.png`, `home.png`, `settings.png`. These are desktop synthetic fixtures, not headset footage. The placement text is centered and readable; Exit has a substantial visible target, does not cover the reading title, and sits clear of Home/Settings controls. The fixture without loaded Today picks correctly shows the quiet library fallback.
- The completion ledger is canonical, explicit and idempotent; merging devices preserves completions independently of the winning savedAt record. Daily ticks require an exact assigned edition, preventing an unrelated poem from becoming read.
- Protected gesture recognizer, literary source corpus and existing visible hand markers remain outside this repair's changes.

## Remaining limits and nonblocking observations

The cursor now shares the controls' page texture, eliminating the former independent compositor-surface alignment path. That is a concrete reliability improvement; the reported headset vertical error has not been reproduced on a real Quest. Do not call physical alignment verified until Bastian checks it. Hardware frame timing, readability at his chosen distance, controller/runtime variations and real Drive synchronization are also not verified by these desktop checks.

The Exit button floats just above compact navigation cards and is inset on the full reading page. It is clear and avoids collisions, though that placement change between surfaces remains a small consistency/polish opportunity. The cabin still uses a web app's drawn materials and typography; this review does not certify that its entire feel has reached Apple's standard.

## Release gate

Before publishing: the final full browser suite and unit/source checks must pass; scan the exact release; retain the feature-branch-only deployment and verify all live files. Update HANDOVER.md and QUEST_CHECK.md with the real evidence and unresolved device checks. The passing score does not waive these gates.

## Final validation record (parent)

197/197 unit tests and source checks passed. Final full synthetic desktop suite: 212/212 passed. Focused pointer28/repair15/guide15/personal6 passed. Review conditions met; scans, publication and exact live-file verification follow. No Quest/real Drive test claimed.
