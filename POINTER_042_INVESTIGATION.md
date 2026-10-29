# Build 042 pointer forensic findings (read-only audit)

## Reproduced fault
Build 041 app.js freezes menu aim when index/thumb tip distance < 30 mm, independently of the browser's native selectstart event or gamepad pressed state. This can freeze a relaxed, unpressed hand indefinitely. The GestureEngine explicitly states native events are the only action authority.

Desktop Chromium + existing synthetic XR harness reproduced:
- Native button unpressed, tips 50 mm: aim Library, displayed pointer world y = 1.7504688501358032.
- Tips 29 mm (native button still unpressed, threshold in harness is 26 mm), aim Style for 1000 ms: displayed pointer remains y = 1.7504688501358032; target remains Library.
- Reopen fingers to 50 mm: pointer follows Style, world y = 1.5500781536102295.
Thus actual displayed-versus-ray separation is 200.39 mm, not an inferred smoothing issue.
Reproduction script: ../forensic-042.cjs; server port 18167.

## Recommended bounded repair
Remove the tip-distance pre-freeze. Capture/freeze only on native selectstart, using the existing listener's displayed aim snapshot. Keep this shared snapshot for dot, hover, selected choice, and all existing tracking/revision cancellations. Add regression for open native button with 29 mm tips moving between choices, plus proper native press holding the new point.

## Other findings and limits
- Visible white dots are hand mode; headPointer=true never pushes hand pointer layers.
- rayOnPage coordinate transforms and +1 mm page-normal compositor offset appear correct; the offset cannot explain 20 cm error.
- The harness constructs native rays originating at the viewer, unlike actual hand rays. Add physical hand-origin parity tests; current tests are not real headset calibration evidence.
- Native ray and head-through-pinch diagnostics already exist but need Quest data to determine consistent offset of native intent ray versus user's visual pointing expectation. Do not claim synthetic fixtures prove calibration on hardware.
- Both hands get visually identical dots. Global hover may follow last pointerSource while another dot is elsewhere. This is a separate potential ambiguity, not demonstrated physical offset.

No repository implementation files edited by this audit.
