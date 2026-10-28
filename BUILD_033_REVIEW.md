# Build 033 — Claude's personal lines and a Library shortcut
28 October 2026.

## Behavior
The daily picks file may carry two optional top-level lines from Claude:
- `dedication`: at most 70 Unicode code points, one line, a calm opening without spoilers. Shown below the Today dateline while the day is incomplete.
- `thread`: at most 160 code points, one line, connecting the three works. Shown on Today and on the final work's closing page only once all three works are marked read.

Both are optional. Invalid, oversized or malformed copy is dropped on its own, never truncated, and never rejects the three valid readings. `personalLine` (picks.js) checks type, code-point cap, control/newline characters and balanced double quotes; every quoted fragment, even one word, must match a selected source (existing first-capital/ellipsis/insertion conventions allowed). Empty-literal quotes and contraction/compound fragments ("can" from "can't", "red" from "rose-red") are rejected. This is a deterministic quote check, not semantic verification and not a second live agent.

New daily-lines.js: `personalFor` renders only when all three catalogue IDs, body hashes and the day's retained IDs match; `rememberPersonal` saves copy with its own revision time, IDs and hashes; `mergePersonal` merges by that revision time, independent of later reading ticks, with explicit null as a tombstone so an old device cannot resurrect removed wording; `clearReplacedTicks` clears only a known changed work's read flag. Same selections and unbound legacy/manual ticks are untouched.

Today gains a "Library ›" button beside "Your shelf ›", opening the existing full reader list (daily trio plus sampler/starter works). It is not a new browser for all 241 catalogue works. Footer targets stay unavailable during the first-show reveal and use the existing 600 ms navigation guard. Copy wraps fully with no ellipsis or split surrogate pairs. Gesture recogniser, handMapRevision 9 and main-menu indices unchanged.

The Claude skill text, picker-contract.js and regenerated picker-workflow.js carry the optional-field instructions through the existing Drive sync. serve.mjs allowlists the new module. All queries v33, header BUILD 033, diagnostic gestures-033.

## Validation
- 155 unit tests, workflow parity and all exact-source checks pass; catalogue remains 241 accepted works, all 39 damaged comparator inputs rejected. Re-run after handover: same result; `git diff --check` clean.
- Full PC browser suite: 148/148 passed (../build-033-browser.log, evidence ../build-033-evidence). Six new cases: 0/2/3 read flags upright and lying, direct Library navigation, persistence and offline reload, with front/side screenshots.
- After the full run started, the mocked picker cases were extended to assert dedication/thread persist through accepted Drive sync; a targeted CABIN_PICKER_ONLY rerun passed upright and lying.
- Isolated mutations: 11/11 faults caught with passing baseline and restored fixture (../mutation-033/run.cjs). Faults cover caps, short quotes, zero literal quotes, edition/ID binding, null revision ordering, replacement and legacy tick behavior, both spoiler gates and full wrapping. The ID-binding mutation first survived because a downstream gate hid missing direct coverage; a forged-record regression was added, then all 11 were caught.
- New tests: tests/daily-lines.test.mjs, tests/personal-browser.cjs (CABIN_PERSONAL_ONLY, included in the full suite); tests/picker-browser.cjs checks sync persistence of both fields.

## Independent review
Separate critic (build031_critic), which wrote no implementation. Round 1: 7/10, two P2 findings: unbound legacy ticks were cleared on replacement; short fragments and empty-literal quotes passed the quote check. Both fixed and independently reproduced. Final: 9/10, no unresolved findings. The critic independently passed 41 targeted tests and reviewed all six new screenshots plus representative side previews: complete copy visible, no overlap or clipping, separated readable buttons, correct opening/closing gating.

## Deferred
No real Claude, Google Drive or Quest test was performed; PC tests used synthetic XR and mocked Google responses. These remain in the one combined end check (QUEST_CHECK.md). No literary text or source verdict changed.
