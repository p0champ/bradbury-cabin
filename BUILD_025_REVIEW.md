# Build 025 — background volume

28 October 2026. This is the volume build, not the parked study-guide fix.

## Independent review — 9/10, round 1

A separate critic that did not write the implementation found no actionable
issues. It independently passed 106/106 unit tests and 4/4 volume browser
checks, and inspected menu, front/side/lying and mobile slider screenshots.
The full regression suite was run by the author, not the critic.

Verified: remembered volume, five VR choices and start-page range control;
live gain changes without replacing the loop; mute and reload; all sound
types; rendered audio continuity; keyboard/mobile access. Gesture recognition
and More/Back alignment remain unchanged. Reading modules differ only in
cache versions: the parked guide changes did not leak into this build.

## Author evidence

- 106/106 unit tests and 125/125 full PC browser checks passed.
- The real OfflineAudioContext render exposed an initial ramp discontinuity.
  Fixed with an explicit current-level event after cancel-and-hold. Rendered
  quarter volume has 0.25 amplitude, Off is silent, and transitions are continuous.
- Five mutations in isolated copies were caught: volume clamping; startup
  gain scaling; live gain scaling; explicit ramp anchor; menu repeat guard.
- The guard fixture was strengthened until removing the guard caused an
  actual failure (0 instead of 37%) with a valid native pinch inside 600 ms.
  All four volume browser checks were rerun after that fixture refinement.
- Sitting/lying tests verify all five choices, three sounds, slider changes,
  unchanged source while adjusting volume, mute and persistence across reload.

Actual Quest loudness, comfort and listening quality require Bastian's verdict.
No real Google sign-in, account automation or bridge changes were performed.
