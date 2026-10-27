# Bradbury Cabin — Phase 1 gesture trial

A passthrough reading cabin for Meta Quest 3. Bastian confirmed Build 003 is very crisp and approved moving on. Build 010 repairs Build 009's Quest startup error and retains its flipped hand mapping, explicit click outcomes, physical palm tracking, hand-entry animation and quiet welcome sound. Full-work pagination, saved reading place, moods and ambience are still pending; Phase 1 is not complete.

## Run

`npm start` serves a PC preview on loopback port 18140. This is a static file server, not a bridge. `npm test` runs the gesture-state and geometry tests. No installation is required for the app or those tests.

Open [the gesture trial](https://p0champ.github.io/bradbury-cabin/?v=10) in Quest Browser. The public repository is [p0champ/bradbury-cabin](https://github.com/p0champ/bradbury-cabin); GitHub Pages serves the root of `phase-1-gestures`. Do not use a `file:` URL or local-network HTTP for immersive WebXR. Ordinary desktop Chrome is neither accessed nor required.

## The comparison

One 2048 × 2560 canvas is rasterized with bundled Literata. The same page pixels feed both paths:

- A: `XRWebGLBinding.createQuadLayer`, mono, 0.72 × 0.90 metres, local reference space. The Layers list contains the page quad plus visible hand badges. When the page changes or the runtime requests redraw, an XR callback obtains `getSubImage` and copies the canvas directly with `texSubImage2D`, using the subimage viewport offsets and dimensions. No quad framebuffer attachment, shader draw, texture reallocation or mipmaps. Restore upload orientation and unbind before leaving the callback. A runtime-clamped allocation uses a staging canvas at its reported size. No Layers polyfill.
- B: the ordinary perspective-textured rectangle drawn into each eye's native `XRProjectionLayer` subimage. Its color and DEPTH_COMPONENT24 textures attach to our framebuffer during that view, then detach in finally. Each eye's own viewport is scissored during clearing. An ordinary canvas source texture with filtered mipmaps is uploaded only when B needs changed pixels. Both paths have the same geometry, text size, distance and content. Foveation is disabled where supported. A/B does not deliberately degrade B. Legacy XRWebGLLayer is reserved for explicitly labelled texture-only fallback sessions without Layers.

When the Layers feature is enabled, both modes submit only a `layers` list: A contains the page quad, B contains the native projection layer; both may include two hand badge quads. Never include `baseLayer`, even null, in a layers-enabled session. The legacy property is reserved for sessions without the feature.

The 1.1 metre distance gives approximately 36° × 44.5° angular size. Requested resolution is about 56 × 58 pixels per degree, intentionally oversampled; it is not a claim of headset-native pixels per degree. The actual layer viewport dimensions are recorded. This budget must be evaluated on Quest for sharpness, memory and frame pacing. Text size is 46/54/62 source pixels. Rasterization/antialiasing uses the browser, without custom font hinting controls.

Only `immersive-ar` with alpha blending is accepted. No opaque virtual world is provided. The initial head pose positions AND orients the page; this supports lying down without gravity-locked text. Thereafter placement remains fixed until re-centre or a reference-space reset.

## Hands and controls

Every entry begins with centring. Get comfortable, face the intended reading direction, keep an open hand in view briefly, then complete one native pinch. No menu, practice or turn can happen before that. The instruction panel follows the view until confirmation. Two transparent paper-and-gold leaves then open in 3D while the page gently settles toward the captured destination over 1.2 seconds. Your room stays visible; the camera never moves. Input is discarded during arrival, animation pauses while blurred/hidden or without viewer pose, and the final page is world-still. Decorative layers fail gracefully on limited budgets. Practice is optional from the menu.

Native WebXR selectstart begins a press. Successful select commits it once; selectend alone cancels. Short clicks have no custom contact threshold or minimum duration, no per-click cooldown and no geometric reopening requirement between successful native cycles. A 1.4 second native hold opens/closes the menu and consumes its later release. The existing hand-only ring starts after 350 ms and completes at 1.4 seconds. Tip occlusion cannot veto a native click while the physical palm remains tracked. If declared palm joints are lost, inferred tips and an emulated aiming ray do not count as a physical anchor. Joint distances only help determine a fresh open hand after interruption; they never generate actions. There is no joint-only click fallback and no squeeze binding.

Safety requires a visibly active session, valid non-emulated wrist/metacarpal tracking held steady for 400 ms, hands inside a conservative viewer-local view cone, and looking within 40° of the active page/menu. Looking away, losing a hand, system posture or interruption cancels the transaction. Returning closed cannot resume: establish a released hand for 180 ms and wait for stable tracking. This applies to recovery, not every completed click. The native button release is used when available; joint gap is only a fallback without that button. The camera/frustum and palm checks are best-effort safety gates, not eye tracking or a guarantee of tracking confidence. Native events are logged so the Quest trial can verify what the browser actually emits.

Build 009 inverts the current saved mapping once; the former default becomes left NEXT / right BACK. Icons spell out their actual direction, START or END at a blocked boundary. Reload preserves the new mapping; the menu can still swap it. Menu buttons require the same target at press and release. Hand pointing is default; optional head pointing works only in the menu. Real turns flash arrows, first/last boundaries show the orange end bar and text, and unavailable directions are dimmed. The sample remains only two pages. The menu is captured in the current view and stays still, restoring the original reading placement on close. Re-centre deliberately moves that reading placement.

Preferences cache hand swap and pointer choice locally, not durable reading history. Exports preserve gestureLog and ignoredPinches and add received/validated nativeEvents and current inputState. See BUILD_009_REPORT.md, BUILD_009_REVIEW.md and QUEST_CHECK.md. No actual Quest pass is claimed by PC tests.

Primary input semantics: [W3C WebXR Device API](https://www.w3.org/TR/webxr/); [W3C Hand Input](https://www.w3.org/TR/webxr-hand-input-1/); [Meta WebXR Hands](https://developers.meta.com/vr/documentation/web/webxr-hands/). Successful select precedes selectend; cancelled actions may end without select. Meta reserves palm pinches for system controls; the app's geometric suppression is best effort. No renderer code or live Sunnyvale bridge was changed.
## Failure behaviour

If layer creation is rejected, the app labels B as ordinary texture and disables A/B switching; this cannot pass the gate. If layer drawing fails later, it ends the session and retains the error in the browser and exported test details. If passthrough is unavailable it ends the session. No silent replacement of A with B.

The texture fallback is free and stays web-based, but adds the scene's eye-buffer sampling and cannot promise the requested sharpness. Do not move to Phase 1 on that basis. First investigate browser/version/runtime limits with exported diagnostics, then consider a native composition-layer app as a last resort; that would introduce a separate build/install/distribution workflow. No estimate of native development effort has been established.

## Primary references checked 27 October 2026

- [Meta: WebXR Layers](https://developers.meta.com/vr/documentation/web/webxr-layers/): Quest Browser documentation and single-sampling rationale. Build 003 crispness was confirmed by Bastian on his Quest; Build 005 gesture comfort/reliability still needs his check.
- [W3C: WebXR Layers](https://www.w3.org/TR/webxrlayers-1/): layer construction, spaces, opaque texture lifecycle and framebuffer constraints.
- [Immersive Web quad-layer sample](https://immersive-web.github.io/webxr-samples/layers-samples/quad-layer.html).

## Later-phase decisions

Sunnyvale's existing bridge/browser/media/voice implementation has been studied in the local checkout. Reuse it in Phase 3, with a distinct cabin connector secret and durable namespaced storage. Do not start another competing bridge, change its port, claim its active slot, or restart the live service. Any shared edits require their own branch, throwaway `BRIDGE_PRIVATE_DIR` and test ports. The Sunday Drive workflow stays with Claude's own connector unless real testing demonstrates a need to change it.

Legal full text will skew selections toward older works. A broad modern and international list will require external source windows or personal-library imports regularly; no defensible percentage is available before building and auditing an actual selection pool. The limitation also applies to copyrighted translations of old works. Phase 0's sample selection does not solve that coverage problem.

## Build 003 diagnostic revision

The second Quest attempt entered XR but returned the old aggregate WebGL error. Its original failing operation/code remains unknown. This build follows the official quad sample’s direct upload path and uses native projection subimages for B. Renderer resources are created after XR compatibility completes. Named GL error checks identify context/setup, comparison source upload, quad subimage/upload, projection attachment/draw/cleanup. Export includes build `phase0-003`, render route and graphicsError `{stage,codes}`. A successful PC run is not a successful Quest run.

Each hand gets one short gold orbit/depth pulse after entering, including hands first seen later. The existing badge layers animate; reading pixels do not. An original quiet three-note Web Audio chime plays once at centring confirmation; Entry sound on/off is saved in the menu. Audio is unlocked on the actual Enter click, cleaned up on Exit and diagnostic failures do not interrupt XR. No external sound assets are loaded.

Build 010 uses XRHand.get() to look up joint spaces. XRHand is an iterable, not JavaScript Map: has/set/delete/clear are not assumed. All browser fixtures now use the limited interface, reproducing the actual Quest failure before the fix. See BUILD_010_REVIEW.md for verification. The mapping migration revision remains 9 to avoid flipping saved hands a second time. Primary interface reference: [W3C WebXR Hand Input](https://www.w3.org/TR/webxr-hand-input-1/).
