# Build 004 — gesture trial report

The new control system is built for the first part of Phase 1. Bastian confirmed that Build 003 was very crisp and approved moving on. The full Phase 1 reader is still in progress.

While reading, a right pinch followed by release turns forward; the left goes back. Holding either pinch for ¾ second opens a separate menu without also turning a page. The menu pauses reading gestures, shows large highlighted buttons, supports hand swapping and an optional head pointer, and lets you re-centre deliberately. Close it with Return to reading or another hold. The original reading position is restored. A first-use practice panel confirms Next / Back / Menu without advancing your text.

| Status | Result |
| --- | --- |
| Built | Gesture trial, practice and menu; full Phase 1 remains pending |
| PC-tested | 14 gesture/geometry tests +71 browser checks passed |
| Reviewed | Independent critic **6.5 → 8/10**, two rounds; [review](GESTURE_REVIEW.md) |
| Committed | `phase-1-gestures`; the passed Phase 0 branch is retained |
| Deployed | GitHub Pages from the gesture-trial branch |
| Needs a Quest check | Release timing, menu targeting, resting-hand reliability and comfort |

The checks include delayed page turns, hold/release separation at the exact threshold, tracking-loss cancellation, simultaneous hands, highlight ownership, practice, saved preferences, menu placement and restoration, re-centre, safe Exit and re-entry. The graphics tests still cover direct layer pixel uploads, clamped allocations, stereo depth buffers and named graphics failures. The independent critic's first pass found a threshold-release bug and a wrong-hand highlight; both were corrected with regression tests.

Screenshots include native page-buffer readbacks and world-projected front, side and lying-down views of the menu. They are simulations, not Quest screenshots. The 750 ms hold and distance thresholds are starting values; the headset trial determines whether they need adjustment. The near-face system-pinch guard is best effort because WebXR has no native system-gesture flag. Integrated visibility/reset coverage remains a minor review item.

No Sunnyvale code, service, private files or normal Chrome session was touched. No new bridge, account or paid service was used. Full reading history, Claude, sounds, general document pagination and saved reading place are not part of this gesture trial. Preferences are cached locally; durable history is a later feature.

## Try this in the headset

1. Close the old tab and open [Build 004](https://p0champ.github.io/bradbury-cabin/?v=4) in Quest Browser while lying down.
2. Open your fingers once, then practise right pinch/release for Next and left for Back. Practice should tick them without changing pages.
3. Hold either pinch for ¾ second. Watch the progress bar, then release after the menu opens. No button should activate from that release.
4. Point at Return to reading, wait for its highlight, then pinch and release. Right now turns forward and left back, with your hands resting anywhere tracked.
5. Look around and repeat page turns. The action should stay tied to the hand, rather than what your head points at.
6. Open the menu while looking elsewhere. Close it and check that the reading page returns to its original position. Then try explicit Re-centre.
7. Try swapping the hands and switching the menu pointer between hand and head. Keep both hands visible and check that the pinching hand controls the highlighted button.
8. Exit and tell me whether the controls feel reliable and comfortable, whether the hold feels too short or long, and any wrong actions or poorly tracked resting positions. Save test details if an error occurs.

The next step is Bastian's gesture check before expanding the rest of the Phase 1 reader around these controls.
