# Bradbury Cabin — Phase 0

A passthrough WebXR reading sharpness experiment for Meta Quest 3. Stop at this phase until Bastian checks the headset and explicitly approves Phase 1.

## Run

`npm start` serves a PC preview on loopback port 18140. This is a static file server, not a bridge. `npm test` runs the small geometry/input suite. No installation is required for the app or those tests.

Open [the Phase 0 test](https://p0champ.github.io/bradbury-cabin/) in Quest Browser. The public repository is [p0champ/bradbury-cabin](https://github.com/p0champ/bradbury-cabin); GitHub Pages serves the root of `phase-0-crispness`. Do not use a `file:` URL or local-network HTTP for immersive WebXR. Ordinary desktop Chrome is neither accessed nor required.

## The comparison

One 2048 × 2560 canvas is rasterized with bundled Literata and uploaded to one source texture. The same pixels feed both paths:

- A: `XRWebGLBinding.createQuadLayer`, mono, 0.72 × 0.90 metres, local reference space. Each XR frame obtains `getSubImage`, attaches its opaque texture to a framebuffer, draws into its viewport, then detaches it within that callback. No Layers polyfill.
- B: the ordinary perspective-textured rectangle drawn into each eye's `XRWebGLLayer` framebuffer. Both paths have the same geometry, text size, distance and content. Foveation is disabled where supported. A/B does not deliberately degrade B.

The 1.1 metre distance gives approximately 36° × 44.5° angular size. Requested resolution is about 56 × 58 pixels per degree, intentionally oversampled; it is not a claim of headset-native pixels per degree. The actual layer viewport dimensions are recorded. This budget must be evaluated on Quest for sharpness, memory and frame pacing. Text size is 46/54/62 source pixels. Rasterization/antialiasing uses the browser, without custom font hinting controls.

Only `immersive-ar` with alpha blending is accepted. No opaque virtual world is provided. The initial head pose positions AND orients the page; this supports lying down without gravity-locked text. Thereafter placement remains fixed until re-centre or a reference-space reset.

## Hands and controls

Open the pinch at least once after tracking starts. Either hand can pinch anywhere tracked to advance one page. Looking at a bottom control then pinching activates it instead. Head direction is a control pointer, not eye tracking; page-corner gaze turning is not implemented in Phase 0. Controller select also works as a backup. Hold a pinch and it will not repeat. Tracking loss disarms the gesture. Hand joint and select events are deduplicated. At the last page the reader stops; use Back to repeat.

Re-centre is on both the page and desktop toolbar. If the page is behind you, exit the immersive session with the Quest system menu, look in the desired direction, and re-enter.

## Failure behaviour

If layer creation is rejected, the app labels B as ordinary texture and disables A/B switching; this cannot pass the gate. If layer drawing fails later, it ends the session and retains the error in the browser and exported test details. If passthrough is unavailable it ends the session. No silent replacement of A with B.

The texture fallback is free and stays web-based, but adds the scene's eye-buffer sampling and cannot promise the requested sharpness. Do not move to Phase 1 on that basis. First investigate browser/version/runtime limits with exported diagnostics, then consider a native composition-layer app as a last resort; that would introduce a separate build/install/distribution workflow. No estimate of native development effort has been established.

## Primary references checked 27 October 2026

- [Meta: WebXR Layers](https://developers.meta.com/vr/documentation/web/webxr-layers/): Quest Browser documentation and single-sampling rationale. Support on this particular headset/browser version remains unverified.
- [W3C: WebXR Layers](https://www.w3.org/TR/webxrlayers-1/): layer construction, spaces, opaque texture lifecycle and framebuffer constraints.
- [Immersive Web quad-layer sample](https://immersive-web.github.io/webxr-samples/layers-samples/quad-layer.html).

## Later-phase decisions

Sunnyvale's existing bridge/browser/media/voice implementation has been studied in the local checkout. Reuse it in Phase 3, with a distinct cabin connector secret and durable namespaced storage. Do not start another competing bridge, change its port, claim its active slot, or restart the live service. Any shared edits require their own branch, throwaway `BRIDGE_PRIVATE_DIR` and test ports. The Sunday Drive workflow stays with Claude's own connector unless real testing demonstrates a need to change it.

Legal full text will skew selections toward older works. A broad modern and international list will require external source windows or personal-library imports regularly; no defensible percentage is available before building and auditing an actual selection pool. The limitation also applies to copyrighted translations of old works. Phase 0's sample selection does not solve that coverage problem.
