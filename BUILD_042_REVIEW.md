# Build 042 — native press owns the pointer lock

User report: pointer/clicker wayoff; clarified the dot is away from where the hand points. UI redesign follows the pointer repair and must meet a stronger visual gate; this release does not certify Apple quality.

## Investigation and agreement

Independent forensics reproduced a concrete041error: fingers29mm apart, native browser buttonOPEN, aim movedlibrary→mood for1second; dot remained roughly20cm behind. Opening fingers50mmreleasedit. Appfroze at rawdistance<30mmbefore a nativepress; native selectstartthen reusedthatstalesnapshot. Sourceplane math and1mmnormaloffset cannotexplainthat20cmerror. Headpointermode rendersnohanddot. Nativevshead-through-pinch remains a boundedoptionaldiagnosticcomparison, notevidenceforchangingthedefault ray.

Twoindependentinteractiondesigners (precision, calmreading) and separatejudge chose oneproposal: livefilterednativeaimuntil realnativepress; snapshot exactlydisplayedpoint; retainlockonlyacceptedowner/closed; allrelease/cancellation pathsreturnlive. No smoothing/raymodelguess. Twoidenticalhanddots/globalhoverownership remains a designissue fornewUI; notsilentlychangedhere.

## Repair and meaningful tests

Removed rawtipdistanceprefreeze. Storelivehit/targetwhilepressheld. Rejectingnativepressrestoreslivepoint. Finalraylist is rebuiltAFTEReventvalidationandgesturetick usingstill-validsources; onlyactualowner/closedmayretain snapshot. Deletedstalesourcescannotresurrectdots; callbackgapcancellationscannotleaveafrozenlock. Samehelddot/choiceexactselection retained.

27focusedpointerbrowserchecks pass:27/29mmOPENgapsbothhands upright/lying; press-driftselection; source/rayloss; contextchanges; staleeventimmediateinvisibility; overflow; callbackgapwithoutrelease; unarmed/otherhandrejectionwithdiagnosticreason; step/noise/ramp/stopfilterresponses. CurrentCOOLDOWN_MS=0, so a cooldownrejection is not reachable inproduction; genericaccepted-ownercheck stillcoversrejections ifconfigurationchanges.

178unit+sourcechecks pass,241reviewedworks unchanged. Final194/194fullbrowser checks pass. DesktopChromium syntheticXR only; no Questalignmenttest/realDrive/Claudeclaim.

## Independent critic

Round1:7.7/10, staleeventdotresurrection andcallbackgaplock findings. Bothfixedwithfinalsource/ownervalidationandtargetedregressions. Round2:8.5/10, no remainingblockingcodedefect, approvalconditionalonfinalfulltestsuccess, nowpassed. CriticexplicitlydoesnotcertifyphysicalQuestalignment orAppleUIquality.

## Release

Code9681d65 pushed tobuild-042-native-pointer andphase-1-gestures afterstaged/committedscans. Live https://p0champ.github.io/bradbury-cabin/?v=42 verified: index/style/all33rootJSmodules match reviewedsource. Finalindependentcritic8.5/10 releaseapproved after194/194fullbrowserchecks passed. No Questalignmentclaim. Branchbuild-042-native-pointer. Literarytexts/gestures/hitmap9/buttonrectangles/menuindices/readinggeometry/handmarkercontrast/rightwrist unchanged.
