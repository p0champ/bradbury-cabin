# Bradbury Cabin handover — 27 October 2026

## Gate and current scope

Phase 0 only. Bastian must try it in Quest 3 while lying down and explicitly approve before any Phase 1 work. No headset result exists. Read README.md, QUEST_CHECK.md and REVIEW.md before continuing.

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
- Opaque layer texture is attached and detached inside the XR callback, including exception paths. Do not call `texImage2D` on it. The upload texture is our own ordinary WebGL texture.
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
