# Build 047 — coherent panels and clearer feedback

Local implementation, not released. This is a refinement pass, not a claim of Apple quality or real Quest verification.

## Changes

- Home, Settings, Calendar, Notes, completion and the placement card use one solid navigation material. Reading retains its own paper/night typography.
- Light selected tabs and settings are distinct from neutral hover feedback. The current work has a quiet resting highlight; menu hover is more visible.
- Home metadata is larger; Settings headings follow the other panels' hierarchy.
- The browser entrance has a quieter secondary Sync action, smaller editorial headline, neutral backing and consistent focus/transition styling. Its entry message supports both sitting and lying down.
- Reading help follows the saved forward hand, updates immediately from Controls and remains correct after reload. Previously it always said Right, even when Left was configured.
- Includes the unreleased 046 pointer selection behavior. No additional pointer offset, smoothing, timing heuristic, gesture gate or target geometry change.

## Validation

- 206 unit tests and all maintained source checks passed.
- 245 full synthetic browser checks passed (including two new forward-hand regressions).
- After the final placement/focus/copy refinement: all 15 repair checks and all six entrance checks passed again.
- Mutation check: restoring fixed right-hand advice fails the new regression when Controls changes the forward hand; final code restored and passes.
- Actual rendered Home, Settings, hover, long Resume, Calendar, browser desktop/mobile, paper, night, modern and lying/compositor views inspected. No independent reviewer or headset test in this chat.
- No changes to verified texts, gesture recognizer, hand mapping revision, reading geometry or completion transaction.

## Remaining

- Bastian clarified: the dot looks right, but pinching selects elsewhere. Actual outcome of 046/047 needs headset evidence. Do not report this fixed from the synthetic suite.
- Placement choreography and navigation architecture remain existing behavior; a larger redesign needs a concrete proposal. Calendar density and the empty Home state still deserve a design pass.
- This WebXR implementation does not provide visionOS system glass or adaptive blur. Opaque panels intentionally protect legibility.
- Publication remains pending explicit authorization after automatic approval review rejected the earlier deployment attempt. Live remains Build 045.

Design reference: [Apple — Design for spatial user interfaces](https://developer.apple.com/videos/play/wwdc2023/10076/), especially consistent components, legible typography and distinguishable focus feedback. Its platform capabilities are not claimed for Quest.
