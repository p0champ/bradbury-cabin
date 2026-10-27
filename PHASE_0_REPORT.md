# Bradbury Cabin — Phase 0 report

The crispness test is built and ready to put on HTTPS for your Quest check. It has **not** been tested in a headset. Nothing from Phase 1 has been started.

You get a warm reading page with Blake's **The Sick Rose** and an opening excerpt from O. Henry's **The Gift of the Magi**. Switch between a real compositor quad layer and the same page drawn as an ordinary texture. Try paper/night, three sizes, pinch page turns and re-centre. The page is placed in your initial viewing direction, including while lying down, then stays still in the room. The app shows layer failures openly and can save a small diagnostic file.

| Status | Result |
| --- | --- |
| Built | Phase 0 only |
| PC-tested | 4 core tests + 21 isolated Chromium checks passed |
| Reviewed | Separate critic: **6.5 → 8/10**, two rounds; final score is for PC readiness |
| Committed | Local `phase-0-crispness` branch; no remote push |
| Deployed | No — public repository and HTTPS hosting are pending |
| Needs a Quest check | Yes — actual sharpness, layer support, passthrough, hand tracking, comfort and comparison with Disney+ |

The PC checks used real WebGL with simulated headset APIs. They checked layout at every size, paper/night, mobile layout, A/B drawing, correct timing when pinching the A/B control, lying-down placement, stationary placement, re-centre, one turn per held pinch, disarming after tracking loss, diagnostic downloads, layer failures, passthrough rejection and permission retry. Screenshots include front and rotated side views for upright and lying poses. **These are simulations, not Quest screenshots.**

The critic found a real A/B timing error that the first mock did not catch. It was fixed, the simulation was strengthened, and the critic independently checked the fix and reran the tests. Other fixes disarm pinches after tracking loss, detach layer textures even on errors, preserve the selected mode in diagnostics after exit, and avoid a nearly empty middle page at the largest size. Full review: [REVIEW.md](REVIEW.md).

Remaining limits: the Quest gate itself; additional coverage of every control and session lifecycle event; minor typography around continuation headings. None is a substitute for your reading-quality judgement. If layers fail, the ordinary texture fallback adds an extra sampling step and cannot promise Disney+ quality. It does **not** pass the gate. We would investigate the reported browser/runtime error before considering a native app.

Sunnyvale's port-8130 listener was observed and left running. Its code, Chrome session, credentials and bridge were untouched. No competing bridge, account login, paid service or new account was used. The test bundles its openly licensed Literata font; there are no runtime CDN dependencies. [Credits and licences](CREDITS.md).

## What to try in the headset, once the HTTPS link exists

1. Open the published Cabin page in **Quest Browser**, turn on hand tracking, and lie down as you normally read.
2. Look where you want the page, select **Enter the crispness test**, and allow the requested permissions. Your room should remain visible around the page.
3. Confirm the footer says **A · COMPOSITOR LAYER**. If it starts in B or reports an error, stop and save the test details in the browser.
4. Read the poem and story excerpt. Look at **Text size** and pinch to try all three sizes; use **Paper / Night** the same way.
5. Look at **A / B** and pinch several times while comparing the same lines. Separately compare with Disney+. Judge the letter edges and reading comfort.
6. Look at the text, open your fingers, then pinch with your hand resting low wherever the headset can still track it. One pinch should turn once; holding it should not keep turning. Look at **Back** and pinch to return.
7. Move your head: the page should stay still in the room. Use **Re-centre** to place it in front of your current view. If it is behind you, exit through the Quest menu and re-enter while looking in the right direction.
8. Use **Exit**, then **Save test details** in the browser. Tell me whether A is sharper/same/worse than B, whether it is close enough to Disney+, which size/style you prefer, and any drift, double turns, errors or discomfort. Phase 1 waits for your explicit go-ahead.

## The one step needed from you now

Create the empty public repository yourself, as requested: open [GitHub's new repository page](https://github.com/new), select owner **p0champ**, enter **bradbury-cabin**, select **Public**, leave README, licence and gitignore additions off, then click **Create repository**. Tell me when it exists.

After that I can push this reviewed branch and take you through the Pages setup. I will not push to `main`. There is no working Quest test URL yet.
