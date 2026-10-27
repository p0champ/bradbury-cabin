# Build 004 — Phase 1 gesture trial

Bastian explicitly reported Build 003: **“Very crisp we can move on.”** The Phase 0 crispness gate passed by the user's judgement. He requested a gesture-system brainstorm and approved the proposed right/left release turns, held menu, separate reading/menu contexts, and practice screen. Work is on `phase-1-gestures`, based on the passed `phase-0-crispness` Build 003 commit 10ee617. Do not claim all of Phase 1 is built: full-work pagination, saved place, both moods and ambience remain pending.

Build 004 adds right release Next / left release Back, hand swapping, either pinch held 750 ms to open/close the menu, explicit targets only in the menu, hand-ray default plus optional menu-only head pointer, visual hold progress and action feedback. One hand owns a gesture. Short actions happen on release after at least 60 ms; an elapsed hold always wins, including when the threshold is crossed on a release frame. Tracking loss, visibility changes, reference resets and input removal cancel pending actions and require the hand to open again. Native hand select events do not duplicate joint processing. Near-face palm pinches are suppressed with a best-effort geometry/forward-cone check; system gesture detection is not a standard WebXR flag.

The practice panel recognises Next, Back and Menu without advancing the sample text. All three marks remember practice completion in `cabin-controls`; hand-swap and pointer preferences use the same local setting. This is UI preference caching, not the future durable progress system. Menu Exit safely stops the callback even when cleanup is immediate. A first release after opening the menu never selects a button.

The approved crisp rendering modules remain the Build 003 path. One quad temporarily shows the practice/menu panel at a separate captured pose. Closing restores the stored reading-page pose; only explicit Re-centre replaces that pose. The menu remains world-still after opening and does not follow either hand or head. B uses the same displayed pose, so A/B still agrees. `gestures.js` holds the recognizer and menu geometry; `app.js` manages contexts/presentation. Old PinchGate/reading footer hit targets were removed.

PC-tested: **14 gesture/geometry tests +71 isolated Chromium checks**, including native layer regressions, real pixel readbacks and stereo depth, hold threshold boundary, tracking-loss cancellation, menu ownership/highlight with two simultaneous sources, practice, saved hand preference, menu placement/reading restoration, explicit re-centre, Exit and re-entry. Images under the task outputs/gesture-evidence show practice, menu and source readbacks plus world-projected front/side/lying views. These are synthetic XR tests, not device hand/comfort results.

Independent critic round 1 found two P2s (hold-threshold release and wrong-hand menu highlight); both were fixed with regressions. Final independent round 2 reached **8/10 for PC gesture-trial readiness**, with all 14+71 checks independently passing; see GESTURE_REVIEW.md. The new Quest gate is gesture comfort and reliability, not another claim that crispness is untested. Follow QUEST_CHECK.md and GESTURE_REPORT.md. User-facing URL: https://p0champ.github.io/bradbury-cabin/?v=4 . App/core/gesture module URLs are versioned 4; diagnostic build is `gestures-004`. The graphics module remains v3.

Hosting source is the root of `phase-1-gestures`. Preserve `phase-0-crispness` as the passed Build 003 reference. No main push or bridge change is involved. Before every commit and push scan the staged/committed contents for secrets. Local static preview is port 18140; never start or restart a second Sunnyvale bridge. No normal Chrome access, private data access or service restart occurred in this trial.

---

# Build 003 — Direct quad upload and precise graphics diagnostics

Supersedes the rendering details of Build 002 below. Bastian’s second Quest attempt reached drawing, then stopped with the old generic `WebGL reported an error drawing the compositor layer` message. That check included errors from earlier operations, so the failing operation and original numeric GL code are **not known**. Do not claim the legacy framebuffer or shader was proven to be the cause.

A now submits only the quad and uploads the raster page directly with `texSubImage2D`, as in the official Immersive Web quad sample. It never touches the legacy eye buffer or uses an FBO/shader/mipmap path for the page. Actual subimage offsets and allocation sizes are honored; clamped allocations use a staging canvas. Cached pixels survive unchanged frames; page changes, A/B return and `needsRedraw` refresh them. Flip state and binding are restored within the callback.

B now uses a native XRProjectionLayer with `textureType: texture` and DEPTH_COMPONENT24, per-eye `getViewSubImage`, scissored clears and guaranteed color/depth detach. Legacy XRWebGLLayer remains only for sessions without Layers. Resources are created after awaiting makeXRCompatible, guarding possible graphics-device transitions. GL checks identify the operation and all observed numeric codes; diagnostic exports include `phase0-003`, `renderRoute`, and `graphicsError` with stage/codes. No errors are silently discarded.

PC verification: 4 core +55 Chromium checks pass. The fixture protects opaque textures from reallocation/mipmaps/FBO use on A, verifies unbinding/detachment, reads back pixels to verify orientation and runtime-clamped sizing, tests A refresh after style changes in B, injects and verifies three named GL errors (1281/1282/1286), and draws both eyes into separate atlas viewports with actual allocated depth textures. Simulated images and readbacks are not Quest compositor/optics evidence. Independent review reached **8/10 for PC diagnostic readiness**, with all 4+55 checks independently passing; see REVIEW.md.

Retry URL: https://p0champ.github.io/bradbury-cabin/?v=3 . Header Build 003, versioned app and graphics module URLs prevent old module reuse. If it stops again, the complete error text now identifies the failing operation and code; Save test details preserves the full record after exit. Phase 1 remains gated on a successful Bastian Quest sharpness check. Sunnyvale and its running bridge remain untouched.

---

# Build 002 — Quest startup hotfix

Bastian reported: `Could not open the passthrough test: Failed to execute updateRenderState on XRSession: Can't use baseLayer with layers feature requested`. The earlier PC mock missed the browser’s rejection of the presence of `baseLayer`, even when its value is null, in a layers-enabled session. It also missed that a quad-creation fallback still needs the Layers list when that feature was enabled.

`applyLayers` now passes **only** `layers` for layer-enabled sessions, with the existing XRWebGLLayer inside the list. The legacy `baseLayer` property is used only without the feature. Older runtimes without `enabledFeatures` probe list support first. The [W3C Layers render-state algorithm](https://www.w3.org/TR/webxrlayers-1/#xrsession-updaterenderstate) explicitly permits XRWebGLLayer entries in the list. The successful A/B path no longer sends a baseLayer property at all.

Before the fix, a stricter regression reproduced Bastian’s exact error. After the fix, 4 core tests and 30 browser checks pass, covering both enabled-feature reporting and old runtimes, quad creation failure with the feature still enabled, no-layer sessions, and in-frame A/B switching. Independent hotfix review reached **8/10 PC readiness** and independently reran all 4+30 checks; see REVIEW.md. A nonblocking limitation remains for much older browsers that silently ignore an unknown Layers dictionary property; the target Quest repair does not depend on that compatibility probe. Header Build 002, module URL `app.js?v=2`, and diagnostic `phase0-002` identify this revision. Retry URL: https://p0champ.github.io/bradbury-cabin/?v=2 . This remains Phase 0; a successful Quest entry and sharpness check are still required.

---

# Bradbury Cabin handover — 27 October 2026

## Gate and current scope

Phase 0 only. Bastian must try it in Quest 3 while lying down and explicitly approve before any Phase 1 work. Bastian tried build 001 on Quest; entry failed with the baseLayer/layers error. There is still no successful headset sharpness comparison. Read README.md, QUEST_CHECK.md and REVIEW.md before continuing.

Built: static passthrough WebXR sharpness test with real compositor quad and ordinary perspective-texture paths, public-domain poem/story excerpts, bundled licensed font, paper/night, three sizes, tracked pinch page turn, head-directed control targeting, world-still placement, re-centre and diagnostic export.

PC-tested: four core tests and 21 isolated Chromium checks with real WebGL plus a synthetic XR API. Screenshots cover desktop, mobile, paper sizes, night, frontal and rotated side views, including lying-down pose. Mock timing now respects next-frame render-state changes. These are not compositor/device screenshots, stereo quality evidence, actual passthrough, or real hand tests.

Reviewed: independent critic's first pass was 6.5/10. It found a real frame-boundary A/B bug, fixed and regression tested. Final independent re-review reached **8/10 for PC readiness** after two rounds. The critic independently reran 4 core and 21 browser checks; see REVIEW.md for remaining device/lifecycle/typography limits.

Committed: Phase 0 code and hosting documentation on `phase-0-crispness`, pushed to the public remote. GitHub Pages is configured at https://p0champ.github.io/bradbury-cabin/ using that branch’s root. Needs a Quest check: yes. No main push/merge authorized.

## Work and hosting

The local repository is on `phase-0-crispness`. A separate loopback static preview was run on port 18140. It has no pairing or network link to Sunnyvale. Do not start another bridge for this app.

Bastian initially asked to create the repository himself, then explicitly asked the assistant to do it. Created **p0champ/bradbury-cabin** using the existing authenticated GitHub connection, pushed only `phase-0-crispness`, and configured GitHub Pages for that branch’s root. No main branch was pushed. Public remote: https://github.com/p0champ/bradbury-cabin.git . The repository and first public publication are authorized by that follow-up. Before each commit/push inspect staged/committed files for secrets; no private URLs, credentials, pairing codes or phone numbers belong in this public repo. Network operations require the environment’s normal network approval; use a per-command `safe.directory` exception for this exact checkout when an elevated Git process runs as the user rather than the sandbox account. Never weaken Git’s global directory trust. `.nojekyll` keeps the deployment as literal static files, including markdown checklist/credits.

The app has no dependencies or build step. `npm start` runs the static preview; `npm test` runs core tests. For browser regression checks, install/use a test-only Playwright runtime and its Chromium, start the static preview, then `npm run test:browser`. `CABIN_PLAYWRIGHT_PATH` and `CABIN_CHROMIUM_PATH` optionally point to an existing test runtime/browser; `CABIN_EVIDENCE_DIR` selects screenshot output. Never point tests at a personal browser profile. No normal Chrome automation or account login is needed. Font files and licence ship locally; there are no runtime CDN requests.

## Important implementation details

- `app.js`: app state, Canvas 2D page painting, XR lifetime, input, hit testing and layer drawing. `core.js`: small test-corpus pagination, dimensions and pinch gate. `gl.js`: WebGL2 source texture/shaders and column-major matrices.
- 2048 × 2560 requested layer; 0.72 × 0.90 m at 1.1 m. Both A and B use the same source. Source mipmaps keep B's minification fair. Actual layer viewport dimensions are exported.
- A mode switch requested during a joint pinch applies to render state at the next XR boundary. Finish the current callback using its initial `drawMode`. Do not replace this with immediate `state.mode` checks after input.
- Projection color/depth textures are attached and detached inside the XR callback, including error cleanup. A quad is filled directly using `texSubImage2D`; it is never attached to a framebuffer. Do not reallocate or generate mipmaps on runtime-owned textures. B alone uploads an ordinary canvas texture using `texImage2D`.
- Use `local` space, never continuous viewer parenting. Capture head orientation as well as translation on initial placement/re-centre, so lying down works. A space reset explicitly re-centres. Tracking loss clears the gesture state.
- Gaze means head direction, not eye tracking. It targets controls; there is no automatic gaze page turn in this phase. Pinching away from controls advances. Start with an open hand; a held pinch never repeats. A/B doesn't move the page.
- Layer-creation failure leaves an explicitly labelled texture-only fallback, which cannot pass the gate. Drawing failure ends XR with an error. Alpha-blended passthrough is required. No Layers polyfill or opaque virtual room.
- Export after exit retains the last render mode and layer result. Test details contain local browser/runtime information, not bridge secrets. Do not present a successful mock draw as a successful Quest draw.

## Sunnyvale studied; leave its service alone

Read the existing Sunnyvale checkout's HANDOVER.md, bridge/server.mjs and relevant bridge transport code, browser-bridge.js, browser-media.js and browser-voice-link.js during initial investigation. Its running port-8130 listener was observed. Process command-line inventory was denied by the environment; socket inspection confirmed the listener. No service was restarted, no competing bridge was started, no normal Chrome was accessed, no private runtime contents were read or copied, and Sunnyvale code was not changed.

Later Phase 3: reuse its extension/browser pipeline and separate audio sequencing/ACK channel; add a cabin-specific connector route/secret and private durable namespace inside the same bridge. Test shared changes on a branch, with throwaway `BRIDGE_PRIVATE_DIR` and separate ports, before any approved real service restart. Do not assume other tasks' historical restart approvals apply to Cabin. Reconcile against the current active Sunnyvale branch before editing. Claude's own Drive connector is the preferred route to the newest story file in **Bradbury stories**, with supported formats checked at that phase.

## Preserve these requirements for later phases

- Challenge started 18 Oct 2026, day 1 completed. 21 Oct missed: Rumi's The Guest House, Chopin's The Story of an Hour, Woolf's The Death of the Moth. Other dates must not be invented. Keep the full year including missed days. Reminder preference 20:00; no reminder automation has been created.
- Three daily cards; poem/story/essay each ticked separately. Only three ticks completes a day. Prevent repeats using durable history. Broad era/country/field variety and stored tutor priorities.
- Weekly story due Sunday. External writing, newest Drive-folder file, Claude review only: idea/structure/character/prose/ending each 0–10, ranked priorities and questions. Never rewrite stories or pitch ideas. Grade-to-picker connection must be durable structured data.
- Durable private bridge storage plus headset cache and export. Cache alone is insufficient.
- Phase 1 adds general full-work pagination, poem stanzas, saved place, both moods, ambience and optional corner gaze turning off by default. Phase 2 adds calendar/history. Phase 3 adds Claude. Phase 4 adds meaningful animation/polish. Every phase needs independent critic review up to three rounds and a separate user Quest gate.
- Legal-source full texts through bridge, prefer available full text; modern copyrighted works need source windows or personal imports. No invented full-text coverage percentage. Sounds must be licensed and credited.
