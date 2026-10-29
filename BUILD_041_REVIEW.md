# Build 041 — hierarchy and a steady reading surface

Bastian explicitly asked to keep working beyond the040 wrist/marker repair and corrected the premature stop. His standing approval to use the Apple agents’ agreed direction applies to this continuation within the original hard constraints.

## Design process

Three independent designers: strict visionOS hierarchy/material roles; Apple Books editorial/reading calm; motion/response. Each inspected the actual040 source and screenshots, checked official Apple guidance and cross-critiqued the other proposals. A separate judge merged ONE scope: stable opaque surfaces; four menu groups; stronger welcomeprimary; navigationchrome restraint; learnedaiminghelp. Separate hierarchy author built menu-panel/welcome; parent integrated response/header/hints. No new approval gate for the existing authorized direction.

References: Apple HIG Layout, Materials, Motion and spatial layout; WWDC hover guidance. Concrete application: priority through type/grouping, stable stationary frames/material, brief initialarrival, content first, no transparency used at the expense of readability. This is a cross-platform adaptation, not native system materials.

## Changes

Main menu now groups Continue | Today/calendar | appearance | utilities within every original button rectangle/order. Continue54px600, browsing500, routine settings400; values42px400. Primary has a stronger opaque backing. Welcome’s firstaction gets an independent stronger surface/600weight; secondary400. Main targets and availableactions unchanged.

Removed whole-quad opacity dips after ordinary navigation/pagechanges: previous50%/85% dips exposed the room through the entire material. Content now updates immediately on stable backing. The200ms initial stationaryarrival/reducedmotion and allsession/input safety remain.

Navigation/practice/centering no longer repeat the cabinbrand and top decorative rule; reading title/author/folio/body retained. Learnedusers no longer see repeatedaiminghelp; newusers retain it and actual warnings remain. Removed redundant ExitVR copy beside Leave.

Cuts: no new successring, pressedrowlogic, sounds, contentcrossfade, geometry exceptions, pointer/wrist tuning or glass tricks. Build040 visiblemarkers remain unchanged. Tallportrait menu is still a limitation.

## Verification

178unit tests plus maintainedsource checks pass,241reviewed works unchanged. Focused5coherent browser checks pass normal/reducedmotion,upright/lying; test realpageupdates/constantlayeralpha/menuprimarysurfacebreak/typehierarchy and retainedfirsttimehelp. Final5/5focused checks include welcomecontrast/surface assertions.187/187fullbrowser checks pass. Independentcritic8.4/10 approved release conditional on fullsuite, now passed. NoP1/P2; soleP3stalecomment removed. All desktop synthetic; no Quest/realDrive/Claude claims.

## Release

All tests/review complete; scans/commit/push/livecomparison pending. Currentlive040.
