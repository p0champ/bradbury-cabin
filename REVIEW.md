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

## Build 002 startup hotfix — independent re-review, 27 October 2026

**Score: 8 / 10 for PC readiness of the hotfix. Round 1: no blocking hotfix defect found.** This updates the prior review after Bastian reported the real Quest startup error, "Can't use baseLayer with layers feature requested". The earlier desktop fixture was too permissive to catch it; its passing result did not establish Quest startup compatibility.

The correction directly addresses the reported conflict. With a quad or negotiated Layers support, applyLayers submits only the layers member, including the XRWebGLLayer in the list. If Layers was not negotiated it submits only legacy baseLayer. Keeping XRWebGLLayer in the Layers list is supported by the [W3C WebXR Layers draft, section 11.2](https://www.w3.org/TR/webxrlayers-1/#xr-session-updaterenderstate), whose validation explicitly handles XRWebGLLayer entries; replacing the renderer is unnecessary for this reported error.

I independently reran the four core tests and all 30 browser checks successfully. The stricter fixture now rejects the presence of baseLayer, including null, in a Layers session. Coverage includes negotiated Layers, rejected quad creation, no negotiated Layers, missing enabledFeatures in both relevant routes, and the previously fixed in-frame A/B switch. I inspected the current app and fixture, the BUILD 002 desktop capture, lying and angled-side texture captures, and phase0-002 exported diagnostics. Build tagging and the versioned app module identify this revision; no visual regression is apparent in these synthetic views.

Remaining ranked findings:

1. **Required hardware recheck:** Bastian must retry Build 002 on Quest. This review supports deployment of the startup repair, but cannot claim that Quest now enters successfully or that compositor text passes the reading-quality gate. Confirm the visible BUILD 002 marker, then use exported diagnostics if startup still fails. Phase 1 remains gated on Bastian's actual headset result.
2. **P3, older-browser hardening:** The missing-enabledFeatures branch assumes unsupported layers dictionaries throw. A genuinely old implementation may silently ignore the unknown layers member, so a successful call alone does not prove a rendering route was selected. The fixture models rejection, not silent ignoring. This is not a blocker for the current Quest-reported conflict; narrow the compatibility claim or add a renderState.layers capability check and a silent-ignore regression before promising support for older browsers.
3. **Existing coverage limits remain:** Synthetic ordinary textures and one eye do not validate runtime-owned compositor textures, real passthrough, stereo, tracking quality, comfort or headset optical sharpness.

The plain npm browser-test command initially lacked the optional Playwright dependency in this checkout. Re-running with the available bundled Playwright and Chromium paths through the harness's supported environment settings passed all 30 checks. No application code, bridge or service was changed during this review.

## Build 003 graphics isolation — independent re-review, 27 October 2026

**Score: 8 / 10 for PC diagnostic readiness. Round 1: no blocking implementation defect found.** Build 002 reportedly entered XR on Quest but then stopped with a generic GL error. Its aggregate error check did not identify the failing operation; the cause of that hardware error remains unproven.

I independently inspected the revised renderer, frame loop, lifecycle and fixture, and reran all **4 core tests and 55 browser checks successfully**. I viewed the direct quad-buffer captures, reduced-resolution capture, lying/side views and two-eye projection preview. These remain synthetic graphics evidence, not headset captures.

The A path now uses only the quad in the active layer list and updates its runtime-owned texture through texSubImage2D. It does not enter the comparison source-upload/shader/framebuffer path. This follows the direct-upload pattern in the [Immersive Web quad sample](https://raw.githubusercontent.com/immersive-web/webxr-samples/main/layers-samples/quad-layer.html). Uploads flip vertically and restore pixel-store state, unbind within the callback, honor runtime viewport dimensions, and refresh after content changes in B. Sampled pixel comparisons cover upright orientation and a 1024 by 1280 allocation. These are useful checks against a flipped or stale page.

B now uses a native projection layer with per-eye subimages, viewport/scissor clears, real depth attachments and finally-block detachment. The final fixture exercises two eye viewports in one atlas and confirms content in both halves and no lingering attachments after the callback. Frame-start comparison mode still prevents the previously found pending-state switch failure. GPU resources are created after makeXRCompatible completes.

Named GL stages and exported numeric codes replace the former aggregate message. I inspected representative INVALID_VALUE/source, INVALID_OPERATION/quad and INVALID_FRAMEBUFFER_OPERATION/projection exports. The final code also checks projection cleanup separately. This makes another hardware failure more actionable; it does not prove that any particular previous operation caused the Quest error.

Remaining ranked work:

1. **Required:** Deploy Build 003 and repeat Bastian's Quest test. Confirm startup, page orientation, A/B switching, pinches and sustained reading. If it stops, retain the named stage/code and exported graphicsError. No Quest success or Disney+ sharpness claim is justified by these tests.
2. **P3:** If future runtime investigation requires more precise isolation, split projection acquisition/attachment and clear/draw into separate named stages. Current stages substantially narrow the failure and are adequate for this iteration.

**Decision:** Ready to deploy as a targeted graphics-path simplification and diagnostic build. Phase 1 remains gated on Bastian's actual headset approval. No app code or bridge/service was changed by this reviewer.
