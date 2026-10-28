# Build 018 independent review: audible background sound

**Bastian's Quest report on Build 017:** "the background music i cant hear".

## Round 1: 5/10

Raising the gain alone fixed rain only. Fireplace and Quiet room had almost all of their energy below 200 Hz. Small headset speakers barely play that range, so above 200 Hz those two sounds were still at −42 and −47 dBFS. The loudness test also measured the wrong number: it checked the full band rather than what the speakers can play.

## Fixes

- **Reshaped sounds.** Fireplace is now a mid-range flickering hiss with gentle crackles. Quiet room is mostly soft mid "air" over a low tone.
- **New level rule.** Every loop is set so that its audible band (2nd-order 200 Hz high-pass) sits at about −24 dBFS, with the peak capped at 0.9.
- **Audio resume.** The audio resumes after system UI interrupts it, and when the user changes the sound.
- **Welcome chime.** Raised so that the background sound doesn't mask it.
- **Tests.** The tests now check:
  - the audible band;
  - the peak cap;
  - that the sound actually plays;
  - that the AudioContext is running.

## Round 2: 8/10, no blockers

After round 2:
- The fire crackle rate was lowered, so the fire doesn't read as static.
- The default bake rate now matches the app's.

## Final

**78 pure + 111 browser checks pass.** The 200 Hz cut-off is only a stand-in for the Quest speakers. Only Bastian listening on the headset can confirm the sound.
