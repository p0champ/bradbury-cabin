# Build 010 — confirmed Quest startup hotfix

Final independent score: **8/10 PC readiness for the targeted hotfix**, no blocker. Separate critic `/root/phase0_critic` independently passed **35 pure tests +97 Chromium checks** and audited production hand API usage.

Bastian's actual Build 009 error: `The layer test stopped: source.hand.has is not a function Return to the browser to read the test details.` The code assumed a JavaScript Map method on XRHand. A stricter readonly fixture with get/size/iteration and no Map-only methods reproduced that exact message BEFORE the production fix.

The hotfix replaces wrist/metacarpal declaration checks with `!!source.hand.get(name)`. All production XRHand calls are now get(name); remaining Map/Set calls refer to actual app-owned Map/Set objects. Test setup mutates a separate backing map, not the XRHand surface. The W3C XRHand IDL supports this distinction: https://www.w3.org/TR/webxr-hand-input-1/ .

Every module query is v10, header BUILD 010 and export gestures-010. handMapRevision deliberately stays9, preserving Build 009's requested hand flip without a second flip. Physical-anchor, rapid/native click, attention, boundary-label, hand animation, entry sound/mute, graphics and lifecycle workflows all pass under the corrected fixture. The critic edited no files.

Built: targeted API repair. PC-tested: 35+97 passing, independently repeated. Reviewed: 8/10. Committed: phase-1-gestures release only. Deployment target: https://p0champ.github.io/bradbury-cabin/?v=10; completion/live-file checks are reported in chat. Needs Quest check: startup now works and the original clicking verdict can finally be evaluated. Build 009 had no successful device entry, so no gesture/animation/audio approval was obtained. No 100% hardware reliability claim.