# Build 044 — pointer alignment investigation

User evidence: the dot responds, but selections act below it and the top controls cannot be reached. This is newer evidence than the premature finger-gap lock fixed in 042.

Inspected the current native hand ray, page-plane filter, compact Home/Settings offsets, actual painter/hit rectangles, quad upload and texture orientation. No static vertical discrepancy was established in the hand path. No guessed vertical calibration, new ray model or smoothing change was introduced.

A separate synthetic repro did establish a Head pointer event race: Shelf is displayed at press time, but queued events processed after the head moves to Settings select Settings. Native press now snapshots the displayed target; release uses that snapshot, with cancellation on context/tracking/event invalidation.

The separate design judge chose one page-coordinate authority. The dot now draws into the same texture as the button at the exact pixel used to select it. Independent cursor quads are removed. Movement restores the previous small area and uploads only changed areas, rather than repainting the full portrait texture. Native viewport offsets and rescaling are accounted for. Page conversion uses actual native quad dimensions/transform when available, with requested geometry as fallback. Optional existing diagnostics export actual geometry, upload viewport/texture dimensions and displayed-point reprojection differences.

Independent real WebGL readback checks cover native top/bottom cursor pixels, incorrect vertical mirror absence, old-pixel restoration, nonzero/resized viewports, projection rendering, no cursor-layer allocations, small updates and no stationary uploads. Synthetic hand checks retain both hands/upright/lying, native press drift, stale/context/tracking/rejected press cancellation and response/noise measurements. These establish software behavior, not Quest physical alignment.

Additional closing-screen regression: the actual pointed Back/Mark button takes priority over hand-direction fallback. NEXT/BACK without aiming remains available as the requested simple finishing sequence.

Real Quest alignment, top-control reachability and perceived Apple quality remain unverified until Bastian tries the released build. Do not report them as tested.
