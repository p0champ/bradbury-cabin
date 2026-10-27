# Independent Phase 0 review

**Final score: 8 / 10 for PC engineering readiness.** This is a convincing Phase 0 experiment to take to a Quest 3 once HTTPS hosting is available. It is not a headset sharpness score, and it does not approve Phase 1. No headset was used.

## Evidence inspected

I independently reviewed app.js, core.js, gl.js, the core tests and browser harness. I reran the final four core tests and 21 isolated Chromium checks: all passed. I visually inspected desktop, mobile, large paper, night, simulated lying, and the updated angled side views. The side views now combine translation and rotation. These are synthetic monoscopic ordinary-texture renders, not screenshots of the Quest compositor or headset optics.

## Findings repaired and rechecked

- **In-frame B to A switch:** I independently reproduced a session-ending failure by making render-state updates take effect at the next frame and checking active-layer membership. The implementation now snapshots the drawing mode before joint processing; its current frame finishes against the current layer set. My independent regression no longer fails, and the final harness also exercises gaze plus joint-pinch A to B to A with delayed render-state changes. This matches the pending-state/active-layer distinction in the [W3C WebXR Layers specification](https://www.w3.org/TR/webxrlayers-1/).
- **Viewer tracking recovery:** Missing viewer pose now disarms hands and clears hover. The new regression checks that a previously open hand cannot turn a page merely by returning already pinched.
- **Opaque texture lifetime:** The compositor framebuffer attachment is detached in a finally block, including an incomplete-framebuffer failure.
- **Export accuracy:** Exiting preserves the last comparison mode, and the action count is called pageTurns rather than claiming all turns were pinches. New sessions clear old layer-resolution/status data.
- **Large-type pagination:** The former almost empty middle page is gone. The updated mobile capture shows the excerpt continuation on page 2 of 2.

## Remaining ranked work

1. **Headset gate — required before Phase 1:** Publish this static build on HTTPS, then have Bastian compare A and B in Quest Browser while lying down. Confirm page orientation, real passthrough, low/resting hand reliability, re-centre and exit, sustained smoothness, comfort, and Disney+ comparable sharpness. Desktop evidence cannot establish any of these hardware outcomes.
2. **P2 — Further lifecycle/control coverage:** The fixture still uses an ordinary WebGL texture instead of a runtime-owned opaque texture, one synthetic eye and immediate session termination. Additional useful cases are pinch activation of every control, in-headset exit followed by re-entry, reference-space resets, visibility changes and recovery after an attached-framebuffer failure. The existing tests cover the highest-risk switching regression, but should not be described as exhaustive WebXR validation.
3. **P3 — Minor typography polish:** The story heading follows the final poem line tightly, and the large-type continuation begins with the remaining line before a repeated heading. Neither hides text nor blocks this sharpness experiment; general pagination belongs to the next phase.

## What is convincing

Warm paper and night palettes have a coherent literary character; text stays within margins and the poem's line structure survives. Placement uses the initial head orientation, including lying down. A and B share source pixels and physical dimensions; source mipmaps give B ordinary filtered minification rather than an intentionally poor comparison. Unsupported layers, opaque sessions, permission denial and drawing failures are disclosed. The code and checklist explicitly preserve Bastian's decision as the quality gate.

**Decision:** Ready for HTTPS deployment and Bastian's Phase 0 headset evaluation. No claim of Quest quality or approval to proceed beyond Phase 0.
