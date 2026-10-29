# Build 040 — visible hands and dependable wrist glance

Bastian’s headset feedback on039: hand markers barely visible, wrist does not work; UI better but still does not feel Apple. This repair supersedes the earlier five-second disappearance. No claim that the whole Apple experience is achieved.

## Independent design round

Separate optical-legibility and restrained-material designers; separate judge merged their views. Agreed: persistent96% layer opacity,94% dark backing,6px symbol,5px progress,quiet2px full rim and soft top highlight. Neutral charcoal functional screens with restrained inner edges on interactive cards; same geometry/type sizes/reading paper. Strong backing replaces ineffective simulated glass; no true adaptive material or background blur is claimed.

## Investigation and repair

Old hand backing was12% white ×55% layer=6.6% effective coverage; complete disappearance after5.2seconds. Tracked markers now stay visible, including unavailable direction, while system/tracking-loss safety remains.

Wrist acquisition restarted whenever the pose follower moved over0.5mm/frame or0.006rad/frame. All three valid synthetic6–10mm motion traces failed to show the card for3seconds before repair. Acquisition now counts300ms valid anatomical intent with at most80ms total interruption allowance. Right-only lock, posture limits and safe pinch revalidation remain. Long callback gaps reset acquisition. Explicit browser ownership/emulated viewer hide immediately. Failed attempts now export bounded rejection measurements.

Hand and wrist texture changes no longer wait indefinitely for complete stillness; repaint stays keyed to actual visual state. Hand turn acknowledgment expires normally after220ms rather than extending during motion. Existing browser test was corrected to sample within its lifetime, then verify expiry.

## Validation and independent critique

178 unit tests plus maintained-source checks pass:241 reviewed literary works unchanged. 184/184 full synthetic browser checks pass;10/10 final focused feel checks pass including continuous motion, interrupted wrist presses, immediate ownership/emulated hide, shelf pinch, persistent idle visibility and normal/unavailable symbol contrast over white,dark,paper backgrounds. These are desktop synthetic tests, not Quest/real Drive/Claude tests.

Independent critic final8.4/10, approved for release with no blocking defects after full suite/immediate-hide checks. Minor P3: successwhite flash now has modest contrast beside brighter resting ink; preserve resting visibility and defer new shape/scale behavior. Navigation is cleaner but remains a large opaque web window, not native visionOS.

## Release

Code2b0694a pushed to build-040-visible-hands and phase-1-gestures after staged/committed scans. Live https://p0champ.github.io/bradbury-cabin/?v=40 verified: index, style and all32root JavaScript modules match reviewed source (normalized line endings). No Quest repair validation claimed.
