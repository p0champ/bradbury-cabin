# Independent Build 004 gesture review

**Final score: 8 / 10 for PC readiness of the Phase 1 gesture trial.** Round 2: no blocking defect remains from this review. Bastian's approval of Build 003 text crispness is recorded as user evidence; Build 004's gesture ergonomics have not been verified on Quest by this reviewer. This is not a review of a completed Phase 1 reader.

## Evidence

I inspected gestures.js, its pure tests, app integration, graphics lifecycle and browser fixtures. I independently ran the final **14 pure/geometry tests and 71 isolated Chromium checks: all passed**. I viewed the practice screen, highlighted menu, world-space menu from front and lying/side angles, including menu-world-lying-side.png and practice-lying.png. These are simulated graphics captures, not hardware evidence.

## Review history and repaired findings

The first version scored provisionally 6.5 / 10 despite passing its original 13 pure and 69 browser checks:

1. **P2 — A hold could become a page turn or menu selection when release crossed 750 ms.** I independently reproduced closed at 20 ms, still closed at 760 ms, release at 780 ms returning a page event. The release branch now gives the elapsed hold priority. I reran this exact case in reading and menu contexts: both return only Menu. The new regression passes.
2. **P2 — Two hands could show a different highlighted button from the selecting hand's target.** Hover previously used the first pointing hand, even when another hand owned the pinch. The final code resolves hover from the owner/last interacting pointer. New front and lying browser cases put the idle left ray on Exit and the right pinch on Resume; Resume highlights and activates, with no exit. Both passed independently.

## What is convincing

Reading gestures depend on handedness and release, without requiring gaze or the hand ray to intersect the reading page. Holds consume their release, and open-to-arm, minimum contact duration, hysteresis, hand ownership, tracking-loss cancellation and context resets reduce accidental actions. Menu pinches cannot gain a target halfway through or activate a different release target. Large highlighted controls and a separate practice view are visually clear in the fixtures.

The menu is summoned into the current view, remains fixed, and restores the reading pose when closed; only explicit Re-centre moves that pose. Practice does not turn reading pages, and its completion/preferences survive re-entry locally. Exit avoids continuing a destroyed XR callback. The established direct quad graphics path remains intact, and its regression/error checks pass.

## Remaining ranked work

1. **Required Quest trial:** Bastian should test resting-hand Next/Back, threshold holds, both hands visible, menu pointing, repeated open/close and re-centre while lying down. Check effort, unintended actions and responsiveness; synthetic timing/joints cannot settle these.
2. **P3 — System-pinch guard remains approximate:** The near-face palm/viewing-cone check uses geometry rather than a native system-gesture flag. Confirm on Quest that it avoids system-menu conflicts without cancelling normal low resting pinches. Its limited claim is appropriate; no stronger guarantee is supported.
3. **P3 — Follow-up coverage:** Reference-space resets and visibility changes have cancellation handlers but less integrated workflow coverage than the main gesture paths. Extend those if real testing reveals recovery problems.

**Decision:** Ready to deploy the bounded gesture trial for Bastian's headset check. No full-reader completion or Build 004 headset-quality claim is made. No application code, normal Chrome session, bridge or service was changed by this reviewer.
