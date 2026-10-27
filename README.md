# Bradbury Cabin — Phase 1 gesture trial

A passthrough reading cabin for Meta Quest 3. Bastian confirmed Build 003 is very crisp and approved moving on. Build 006 is the current Phase 1 step: a focused gesture and menu trial, repairing Build 005's "registered but did not turn" report. Full-work pagination, saved reading place, moods and ambience are still pending; Phase 1 is not complete.

## Run

`npm start` serves a PC preview on loopback port 18140. This is a static file server, not a bridge. `npm test` runs the gesture-state and geometry tests. No installation is required for the app or those tests.

Open [the gesture trial](https://p0champ.github.io/bradbury-cabin/?v=6) in Quest Browser. The public repository is [p0champ/bradbury-cabin](https://github.com/p0champ/bradbury-cabin); GitHub Pages serves the root of `phase-1-gestures`. Do not use a `file:` URL or local-network HTTP for immersive WebXR. Ordinary desktop Chrome is neither accessed nor required.

## The comparison

One 2048 × 2560 canvas is rasterized with bundled Literata. The same page pixels feed both paths:

- A: `XRWebGLBinding.createQuadLayer`, mono, 0.72 × 0.90 metres, local reference space. The Layers list contains the page quad plus visible hand badges. When the page changes or the runtime requests redraw, an XR callback obtains `getSubImage` and copies the canvas directly with `texSubImage2D`, using the subimage viewport offsets and dimensions. No quad framebuffer attachment, shader draw, texture reallocation or mipmaps. Restore upload orientation and unbind before leaving the callback. A runtime-clamped allocation uses a staging canvas at its reported size. No Layers polyfill.
- B: the ordinary perspective-textured rectangle drawn into each eye's native `XRProjectionLayer` subimage. Its color and DEPTH_COMPONENT24 textures attach to our framebuffer during that view, then detach in finally. Each eye's own viewport is scissored during clearing. An ordinary canvas source texture with filtered mipmaps is uploaded only when B needs changed pixels. Both paths have the same geometry, text size, distance and content. Foveation is disabled where supported. A/B does not deliberately degrade B. Legacy XRWebGLLayer is reserved for explicitly labelled texture-only fallback sessions without Layers.

When the Layers feature is enabled, both modes submit only a `layers` list: A contains the page quad, B contains the native projection layer; both may include two hand badge quads. Never include `baseLayer`, even null, in a layers-enabled session. The legacy property is reserved for sessions without the feature.

The 1.1 metre distance gives approximately 36° × 44.5° angular size. Requested resolution is about 56 × 58 pixels per degree, intentionally oversampled; it is not a claim of headset-native pixels per degree. The actual layer viewport dimensions are recorded. This budget must be evaluated on Quest for sharpness, memory and frame pacing. Text size is 46/54/62 source pixels. Rasterization/antialiasing uses the browser, without custom font hinting controls.

Only `immersive-ar` with alpha blending is accepted. No opaque virtual world is provided. The initial head pose positions AND orients the page; this supports lying down without gravity-locked text. Thereafter placement remains fixed until re-centre or a reference-space reset.

## Hands and controls

The reading and menu contexts are separate. In reading, right index/thumb pinch then release means Next; left means Back. Swap them in the menu if preferred. Neither looking at the page footer nor pointing at a button changes a reading pinch. Either hand held for 1400 ms opens the menu; another hold closes it.

Build 006 recogniser: a hand arms after 140 ms above 32 mm (readings between 26 and 32 mm pause arming rather than resetting it). A pinch is confirmed only when at least 80% (and at least three) of the readings in the last 80 ms are below 18 mm, so scattered noisy dips from a resting near-pinch cannot latch; timing is counted from the first firm reading. While firmly pinched, upward spikes shorter than 30 ms are ignored. Lingering between 18 and 26 mm without a firm reading for 300 ms, or separating above 26 mm, counts as loosening; a firm re-contact within 120 ms keeps the pinch but restarts the hold, and anything longer cancels. Release: above 32 mm for 80 ms, within 300 ms of first separation; dips back into the 26–32 mm zone do not restart settling. Minimum contact 160 ms; 400 ms cooldown after a turn or selection; a pinch begun during cooldown must reopen. The hold ring stays hidden for the first 350 ms, so a quick pinch never looks like a registered press, and still completes at 1.4 s.

Feedback reports the real outcome: a turn flashes the arrows and shows "Page n of m"; a Back on the first page or Next on the last shows an orange end bar and "First/Last page" text, never a turn flash; a direction with no page left is dimmed. Practice is finished by Next + Back in any order and returns to reading. Save test details exports the last 40 firm pinch outcomes (with reasons such as too-short, release-stalled, re-pinched) and the last 20 near-pinches that never got firm (with their closest distance), for diagnosing on-device behaviour.

Build 005 responds to Bastian's report that Build 004 was too sensitive. Two small transparent compositor layers carry forward/back skip icons over the hands. The owning hand's ring fills over the 1.4 second hold; release or cancellation clears it. Only those hand textures animate, leaving the reading pixels untouched. Badges follow tracked hand position and face the viewer, including lying down; the menu itself remains world-still. An unsupported extra-layer budget disables badges with a diagnostic while preserving reading and gestures.

In the menu, point until a large button highlights, pinch, then release on the same button. The pinching hand owns the highlight; an idle hand cannot highlight a different button while it is selecting. A head-directed pointer is an optional menu-only setting, also selectable in the browser before entering if the hand ray is uncomfortable. Head direction is not eye tracking. Untargeted menu pinches do nothing. Releasing the hold that opened a menu cannot activate a button. Tracking loss, hidden session, input removal or space reset cancels the gesture.

The menu is drawn through the same crisp layer at a separate position captured in front of the current view, then remains world-still. The reading page's original position is retained and restored when the menu closes. Only Re-centre changes that reading position. This is not a hand- or wrist-following menu. The reading page is hidden while the menu is shown. A practice panel appears on first entry and recognises Next/Back/Menu without changing pages. Complete all three to remember that practice was done; repeat it from the menu.

Hand-swap, menu-pointer and practice-complete preferences are best-effort browser settings. They are not reading history and do not replace the future durable progress store. Native hand select events are ignored to avoid double handling alongside joint gestures. Controller select is a limited backup for page turns/menu buttons; full controller interaction is not part of this trial.

[Meta's WebXR Hands guidance](https://developers.meta.com/vr/documentation/web/webxr-hands/) reserves near-face palm pinches for browser/system menus. The app cancels custom recognition for a palm facing the viewer, within 0.5 m and in a narrow forward viewing cone. That is a best-effort geometric guard; WebXR does not expose the native SDK's system-gesture flag. Ordinary resting hands outside that near-face cone remain usable. Browser system controls retain priority.

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
