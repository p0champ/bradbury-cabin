# Build 045 — pointer lag/trail investigation

Bastian's Build 044 headset report: the dot lags badly and leaves a visible trail. Build 043's dot was responsive, but pinching acted below it, making top controls hard to reach.

## What changed between 043 and 044

- 043: the dot was its own tiny quad layer (160 px, 14 mm). Each frame only its pose changed; its picture was redrawn only when its look changed. The 2048×2560 page quad was rewritten only when the page itself changed.
- 044: the dot is painted into the page quad. Every frame the dot moves, `Pointer.draw` acquires the page quad's image (`getSubImage`), copies back the previous dot's area from the page canvas and draws the new dot (`gl.js copyPagePatch`).

## Established cause of the trail (code + spec + reproduction)

044 assumes the image returned each frame still holds what was drawn into it last frame. The page quad is non-static (`isStatic:false`, `clearOnAccess:false`). The WebXR Layers spec only says such buffers are cleared the first time and "MAY NOT" be cleared later; it does not promise the previous frame's content. Runtimes implement non-static layers with a swapchain of several images that rotate. Restoring only last frame's dot area then leaves older dots in the other images.

Reproduction (`repro-swapchain.cjs`, unmodified 044 `pointer.js`/`gl.js`, real WebGL, three rotating images that keep their own contents): over 12 frames of a sweeping dot, ink spots in the shown image grew 2 → 4 → 8 → 12 → 16. Two of the three images never received the page at all (99.9% transparent apart from cursor patches), because the full page copy only reaches the image acquired in its frame.

The 044 tests used one texture that is never rotated, which is exactly the assumption the code makes. That is why 212/212 passed.

## Likely contributors to the lag (not separately measurable here)

- Every pointer frame re-submits the full 2048×2560 page quad instead of moving a 160 px quad.
- Per frame, a canvas region copy plus a canvas→texture upload (and a resample canvas when the runtime's viewport differs from 2048×2560).
- Any stale image in rotation shows an older dot position, which reads as lag even at full frame rate.

Desktop timings cannot represent Quest GPU/compositor cost; none are claimed.

## The 043 "selects below the dot" symptom

044's investigation found no static geometry mismatch, and 043's dot pose came from the same page-plane hit used for selection. The timeline fits pinch drift (the "Heisenberg effect"): closing thumb and index moves the hand ray, usually downward, before the headset reports the pinch. Build 041 froze the dot when fingertips came within 30 mm, which hid this; 042 removed that freeze because it locked relaxed hands; 043 then showed the below-the-dot selection. This is strong circumstantial evidence, not a headset measurement.

## Decision inputs for the design round

- Same-texture patching cannot be made reliable on a rotating non-static layer without repainting the full page whenever the dot moves.
- A separate cursor quad (043) was confirmed responsive by Bastian.
- Agreement between dot and choice must come from one press snapshot. That snapshot is taken from the aim before the pinch-closing motion, not from the late native `selectstart` frame.
