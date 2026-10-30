# Build 051 — menu cursor shares the button image

Build 050 did not fix the headset symptom. Bastian reports a square around the poem within which the cursor is visible; the upper actions can only be clicked while pointing inside that square. No headset export was available. He asked for the repair overnight without another test request.

## Change

Hand menus now draw the cursor into the same native page image as the buttons. Both use the validated page-pixel coordinates, including the captured press position. A separate cursor layer can no longer acquire a different scale, clipping region or depth from the menu. This removes that class of mismatch without claiming a measured hardware root cause.

This differs from Build 044's CPU patching: the page canvas stays pristine; a revision-keyed GPU texture caches its content. Each acquired native viewport receives the complete clean page followed by current immutable cursor sprites. Moving or hiding a cursor therefore erases old ink on rotating display images. Cursor-only movement performs no full-page CPU upload or mipmap generation. Native output is detached after drawing; no runtime texture is sampled, resized or reallocated. Reading retains its direct-copy path and separate Exit cursor. Native gesture eligibility, safety, held-target selection and literary content remain unchanged.

Navigation, input loss and return to reading clear old marks. Losing viewer pose explicitly copies the clean page even though the normal drawing branch cannot run. Build/cache references and exported filename advance to 051.

## Verification

- 216 unit tests and maintained source checks pass (244 source slices, 241 critic-accepted works).
- **290 of 290 full browser checks pass in one clean single-process run** (281 from Build 050, 6 new surface-pointer groups, 3 new isolated WebGL composition checks).
- Actual native framebuffer pixels agree with Home and Settings control corners/centres upright, lying, with a nonzero viewport origin and at half resolution.
- Three rotating display images show one current cursor without trails; input loss, viewer-pose loss and menu closure remove it. A movement run performed 48 GPU draws with no additional canvas or native CPU uploads.
- An accepted held press is established with native pixel evidence before drift; the cursor remains at the captured Settings button and release opens Settings while lying down.
- Three isolated real WebGL checks verify padded viewport isolation, top/bottom orientation, premultiplied alpha, pristine erasure, revision refresh, upload caching, hostile graphics-state restoration and incomplete-framebuffer cleanup/detachment.
- The source-canvas check permits only up to 32 channels changing by one unit for translucent-edge readback rounding; the observed difference was nine channels across four edge pixels. Cursor ink would exceed both bounds.
- Independent code review found no blocker.

## Test-harness corrections found in the full run

The first full runs failed on two test-harness problems. Each was traced to its cause before changing anything; no app code changed and no assertion threshold was relaxed.

1. **Pointer-truth ink detector on a half-size image.** The detector sampled every 4 native pixels; on the runtime-resized 1024 × 1280 image that is every 8 page pixels, so only two samples landed on the cursor and its estimated centre was 2.9 mm off. A precise all-pixel centroid showed the cursor exactly on the aimed point (1550, 1400). The detector now samples every 4 *page* pixels at any image size (full-size sampling is unchanged). The 2 mm still-cursor limit is unchanged; a deliberate 2.8 mm cursor shift fails the check.
2. **Mock clock overtaken by wall time.** The app stamps native events `max(frame time, performance.now())`. On a headset both are one clock. The test mock drives frames with its own clock, and Build 051's full per-frame GPU composition is slow in software rendering, so wall time overtook that clock and pinches arrived "stale" (surface-pointer menu close, coherent Day → Notes, and under load press-drift). The same coherent check passes on committed Build 050 code, which confirmed the difference was frame cost, not selection logic. Once a mocked XR session starts, the harness page's `performance.now()` now reads the mock frame clock, as on a headset. Tests that need staleness already advance the mock clock explicitly and still pass.

## Performance note

Full native redraw and graphics-state queries each hand-menu frame cost bandwidth. That made software-rendered desktop frames slower than real time; Quest frame timing under this load is unmeasured. Reading remains direct/static.

## Device limit

These checks use real WebGL and a synthetic XR compositor in desktop Chromium, not Quest hardware. Real headset alignment, menu-frame performance and comfort remain unverified until Bastian can try it. No additional headset action was requested overnight.
