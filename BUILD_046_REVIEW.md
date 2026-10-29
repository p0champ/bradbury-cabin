# Build 046 independent review

## Verdict

Round 1 (dwell-weighted press choice): **5/10, rejected**. Quick pinches selected the button just left.

Round 2 ("select exactly what is highlighted"): **5/10**. The critic estimated about 7/10 with the reading-Exit zone fix and honest tests, and said it cannot reach 8 without real Quest evidence.

**Released below the 8/10 bar at Bastian's explicit choice ("Ship 046 anyway")**, after he declined to record diagnostics. This is not a Quest check and not an Apple-quality judgement.

## What 046 does

- A pinch selects exactly what is highlighted when the headset reports it (043 semantics). There are no timing heuristics.
- Forgiving targets on Home and Settings only, and only when exactly one button is that close: 12 mm below a button, 7 mm to the sides and above.
- Reading Exit zone reaches y 228 (was 200), so a centre aim with a 29 mm drift still exits.
- Cursor layer, Exit visual and aim filter are unchanged from 045.
- The dwell choice is still recorded in diagnostics (`pointer.lookBack.presses`) as a hypothesis for tuning.

## Known trade-off, and causes not ruled out

**Trade-off (shown by a test):** a pinch that drifts onto the row below selects that row, as in 043. The highlight shows it before release. 045's look-back guarded against this.

**Causes not ruled out** for "not very responsive / can't mark most buttons":
- gestures.js readiness gates: 400 ms of steady tracking, and after a rejected pinch a fresh open hand is needed
- the hand-in-view cone, especially lying down
- the highlight having already slid by the time the pinch registers

These need one real diagnostics recording.

## Tests

206 unit tests and 31 truth checks pass. The full browser suite result is in the release record in HANDOVER.md.
