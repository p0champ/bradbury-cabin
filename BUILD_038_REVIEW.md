# Build 038 — quiet glass wrist and hand following

29 October 2026. Implements the previously approved 038 scope after releasing and live-verifying pointer correction 037.1. No broader Apple redesign is included.

## Changes

- Right wrist glance replaces the dense calendar: weekday, large date and three reading dots. Simulated translucent glass and a restrained rim, same 8.8 x 7.7 cm dimensions. 300 ms steady posture, 120 ms show/hide fades and 120 ms loss/posture hysteresis. Pinch opens Your shelf and preserves reading place.
- A wrist press cancels on joint/posture loss, browser ownership, removed source, changed screen/revision, visibility/reset, stale events and overflow. Duplicate starts cannot restart its timer. The existing near-face heuristic has the opposite anatomical normal to the independently tested wrist pose, so the shortcut requires positively verified back-of-wrist posture plus explicit browser-ownership rejection. Reading recognizer unchanged.
- Hand discs: 3.6 cm, 12% white fill, thin chevron and top rim, thin clockwise hold ring. Idle layer opacity .55, menu/near-page .9; after five idle seconds fade over 200 ms. Real motion or action wakes them; readiness alone does not. Successful and blocked actions stay distinct.
- Shared PoseFollower applies adaptive position/quaternion smoothing, shortest rotation path, 12 mm / .10 rad per-frame caps. Brief tracking loss holds the last transform, then fades; reader stays anchored. Texture painting/uploads wait for materially stable transforms. Pending action feedback waits rather than disappearing while the hand moves.
- Hand and wrist textures are prepared and uploaded hidden before welcome. Layer-budget fallback drops optional layers safely and preserves reading. New follow-pose.js is allowlisted; all version queries/header/export diagnostics use 38.

## Verification

167 unit tests plus all workflow/source checks pass; 241-work reviewed catalogue unchanged. Independent critic ran 23 wrist/follower tests itself. Seven focused browser checks pass: prewelcome uploads, wrist tracking/system/screen/queued-screen cancellations, a fresh right-wrist pinch opens shelf, idle fade/wake.

Full browser run 175/175 passes, including all 148 existing checks, 20 pointer checks and seven feel checks. Existing pixel checks updated for deliberately thinner symbols and ring (straight-alpha samples exclude translucent white glass); retain blocked-vs-successful distinction, transparent corners and increasing owning-hand hold progress. Feedback checks wait 220 ms for pose settling before the deferred texture update. Old decorative entry-orbit checks now require quiet textures and no bob within 0.1 mm numerical tolerance. Wrist checks retain right-only anatomy, now check translucent face and shelf shortcut rather than old calendar content. Desktop component preview visually inspected; no Quest testing, true blur or native system material claim.

## Independent critic

Separate agent authored none of the code. Round 1 P2s: wrist press failed to invalidate across transient tracking/posture loss, browser ownership and queued screen changes; duplicate start could reset timer. Fixed and tested. Corrected legacy opposite-normal heuristic conflict without editing gestures.js. Round 2: 8.5/10, no remaining material findings; release recommended once full browser rerun passes. Per-frame caps and actual headset comfort remain for combined Quest check.

## Release

Pending full checks, scans, commit/push, live comparison. Branch build-038-wrist-glass. v38 / BUILD 038 / gestures-038.
