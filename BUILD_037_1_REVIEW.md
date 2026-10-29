# Build 037.1 — pointer consistency and response

29 October 2026. Bastian approved the two-designers/separate-judge pointer proposal with "go". This correction precedes the already approved Build 038 wrist/hand scope, keeping its number intact.

## Result

One page-plane point now controls the dot, hover and press. Both point and target (including a miss) are held through the pinch and native release. Target snapshots invalidate on replaced screens/content, attention/tracking/ray loss, removed hands, stale native events and queue overflow. Reading gestures remain independent of the availability of a menu aiming ray. The dot is lifted 1 mm along the page normal. No magnetic snapping or beam; Quest native ray remains default.

PageAimFilter smooths page millimetres rather than mixing ray position/direction units. Optional `?pointerDiagnostics=1` records up to 600 native/raw, filtered and head-through-pinch paired positions in the existing diagnostic export. No automatic switch to experimental ray.

## Evidence

- 155 unit tests and all source/workflow checks passed; unchanged 241-work catalogue and recognizer.
- 20 focused browser checks passed: both hands upright/lying, point/choice freeze, screen cancellation, physical tracking and aim-ray loss, reading without an aim ray, stale/overflow events, empty-space presses, filter traces at 60/72/90 Hz.
- Controlled 5 cm step reaches 90% in 28–33 ms vs baseline 367–383 ms. At the end of a one-second 20 cm/s ramp residual is 1.23–1.35 mm vs about 30 mm. Still-input trace (0.5 mm amplitude, 12 Hz sine) RMS 0.033–0.034 mm vs 0.029–0.030 mm. Synthetic trace evidence only: a small measured noise increase, not a claim of actual headset accuracy/latency.
- Broader regression run passed 163/163 (148 existing + initial 15 pointer checks). Final 20/20 focused checks ran after critic fixes; the broader run began before those final fixes. Evidence ../build-037-1-pointer-evidence/pointer-results.json; logs ../build-037-1-unit.log, ../build-037-1-browser.log and ../build-037-1-pointer.log.

## Independent critic

Separate agent wrote none of the code. Round 1 found a P2: a missing aim ray incorrectly cancelled reading gestures; fixed and directly regression-tested. It also found dropped stale/overflow native events could leave a frozen pointer; both paths fixed and directly tested. Defensive source removal cleanup added. Added ramp/stop/edge comparisons requested by critic. Inherited P3 near-distance cutoffs unified at 80 mm. Round 2 final review: no material findings, 8.5/10, release recommended after inspecting final code and final verification results. No Quest score or real device test claimed.

## Release

Code commit b577211 pushed to build-037-pointer-fix and phase-1-gestures after staged/committed secret scans passed (27 files). Live https://p0champ.github.io/bradbury-cabin/?v=37.1 verified: index, style and all 31 JavaScript modules match reviewed local files (line endings normalised). v37.1 / BUILD 037.1 / gestures-037.1. No main or phase-0 branch changes. No Quest testing.
