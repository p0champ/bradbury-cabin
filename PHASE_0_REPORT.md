# Build 003 update

Bastian’s second Quest attempt stopped during drawing. The previous generic message did not identify which graphics operation failed, so its exact cause is still unknown. Build 003 copies the page directly into its compositor layer, uses a native projection layer for the ordinary comparison, and creates graphics resources after headset compatibility is ready. If another error occurs, the message and saved test details identify the operation and numeric code.

4 core tests and 55 browser checks pass, including direct pixel readback, reduced texture sizes, both eye views/depth textures, A/B switching and injected graphics failures. Independent review scored **8/10 for PC diagnostic readiness** and independently reran all checks; see REVIEW.md. No successful Quest sharpness result is claimed. Use [Build 003](https://p0champ.github.io/bradbury-cabin/?v=3) and retry entry first.

---

# Build 002 update

The first Quest attempt exposed a startup error that the original PC mock did not enforce. A stricter test reproduced it. The fix removes the legacy `baseLayer` property from layer-enabled render-state updates, including the texture fallback. Header **BUILD 002** and the versioned script identify the update. Use [the fresh test link](https://p0champ.github.io/bradbury-cabin/?v=2) and retry the checklist below. The independent hotfix review scored **8/10 for PC readiness**, with all 4 core and 30 browser checks independently passing. No successful Quest sharpness result has been recorded.

---

# Bradbury Cabin — Phase 0 report

The crispness test is built and published at [Bradbury Cabin](https://p0champ.github.io/bradbury-cabin/) for your Quest check. Bastian’s first headset launch failed before reading began; the Build 002 startup fix is ready for a retry. Sharpness remains unverified. Nothing from Phase 1 has been started.

You get a warm reading page with Blake's **The Sick Rose** and an opening excerpt from O. Henry's **The Gift of the Magi**. Switch between a real compositor quad layer and the same page drawn as an ordinary texture. Try paper/night, three sizes, pinch page turns and re-centre. The page is placed in your initial viewing direction, including while lying down, then stays still in the room. The app shows layer failures openly and can save a small diagnostic file.

| Status | Result |
| --- | --- |
| Built | Phase 0 only |
| PC-tested | 4 core tests + 55 isolated Chromium checks passed |
| Reviewed | Separate critic: **6.5 → 8/10**, two rounds; final score is for PC readiness |
| Committed | `phase-0-crispness` branch, pushed to the public repository |
| Deployed | GitHub Pages, from the Phase 0 branch; no main push |
| Needs a Quest check | Yes — actual sharpness, layer support, passthrough, hand tracking, comfort and comparison with Disney+ |

The PC checks used real WebGL with simulated headset APIs. They checked layout at every size, paper/night, mobile layout, A/B drawing, correct timing when pinching the A/B control, lying-down placement, stationary placement, re-centre, one turn per held pinch, disarming after tracking loss, diagnostic downloads, layer failures, passthrough rejection and permission retry. Screenshots include front and rotated side views for upright and lying poses. **These are simulations, not Quest screenshots.**

The critic found a real A/B timing error that the first mock did not catch. It was fixed, the simulation was strengthened, and the critic independently checked the fix and reran the tests. Other fixes disarm pinches after tracking loss, detach layer textures even on errors, preserve the selected mode in diagnostics after exit, and avoid a nearly empty middle page at the largest size. Full review: [REVIEW.md](REVIEW.md).

Remaining limits: the Quest gate itself; additional coverage of every control and session lifecycle event; minor typography around continuation headings. None is a substitute for your reading-quality judgement. If layers fail, the ordinary texture fallback adds an extra sampling step and cannot promise Disney+ quality. It does **not** pass the gate. We would investigate the reported browser/runtime error before considering a native app.

Sunnyvale's port-8130 listener was observed and left running. Its code, Chrome session, credentials and bridge were untouched. No competing bridge, account login, paid service or new account was used. The test bundles its openly licensed Literata font; there are no runtime CDN dependencies. [Credits and licences](CREDITS.md).

## What to try in the headset

1. Open the published Cabin page in **Quest Browser**, turn on hand tracking, and lie down as you normally read.
2. Look where you want the page, select **Enter the crispness test**, and allow the requested permissions. Your room should remain visible around the page.
3. Confirm the footer says **A · COMPOSITOR LAYER**. If it starts in B or reports an error, stop and save the test details in the browser.
4. Read the poem and story excerpt. Look at **Text size** and pinch to try all three sizes; use **Paper / Night** the same way.
5. Look at **A / B** and pinch several times while comparing the same lines. Separately compare with Disney+. Judge the letter edges and reading comfort.
6. Look at the text, open your fingers, then pinch with your hand resting low wherever the headset can still track it. One pinch should turn once; holding it should not keep turning. Look at **Back** and pinch to return.
7. Move your head: the page should stay still in the room. Use **Re-centre** to place it in front of your current view. If it is behind you, exit through the Quest menu and re-enter while looking in the right direction.
8. Use **Exit**, then **Save test details** in the browser. Tell me whether A is sharper/same/worse than B, whether it is close enough to Disney+, which size/style you prefer, and any drift, double turns, errors or discomfort. Phase 1 waits for your explicit go-ahead.

## The one step needed from you now

Open [Bradbury Cabin](https://p0champ.github.io/bradbury-cabin/) in Quest Browser and follow the checklist above. The [public repository](https://github.com/p0champ/bradbury-cabin) is created and only the reviewed Phase 0 branch has been pushed. Bastian explicitly authorized the assistant to handle repository creation and hosting in the follow-up. No account login or Sunnyvale service change was needed.
