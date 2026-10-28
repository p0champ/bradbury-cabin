# Build 030 — current Claude workflow delivered through Drive

28 October 2026.

## Change
The app already attached catalogue metadata and a short protocol summary to progress.json, but relied on the saved Claude skill for the complete saving/checking procedure. It now delivers the complete maintained CLAUDE_SKILL_DAILY_THREE.md as cabinPickerInstructions.workflow on both initial file creation and subsequent updates. The contract is the first top-level field, identifies protocol v2 and Europe/Berlin, includes source catalogue and current rejection reasons, and replaces stale merged contract data without discarding progress.

tools/generate_picker_workflow.mjs generates picker-workflow.js from the maintained skill. The standard checks reject stale generated instructions, so future workflow changes cannot silently leave Drive on an older version. Updated skill copy no longer says newest valid file: it accurately explains that the newest file is authoritative and an invalid latest request must be repaired. Replies point to Today.

This does not modify the saved skill in Claude's account. It makes its replacement instructions available through the progress file the existing workflow already reads. Actual Claude compliance has not been tested. This adds no daily agent/backend; independently checked catalogue and existing runtime rejection remain the literary text boundary. No reading text, source verdict, gesture behavior, menu geometry or UI appearance was changed.

All import/index queries are v30, header BUILD030, diagnostic gestures-030.

## Evidence
- Baseline: 137 unit tests and source checks passed before edits.
- Final: 139 unit tests and all source checks pass, including exact generated workflow parity and prior independent-source comparisons. Catalogue remains185 accepted of186 candidates; rejected Blake Night stays excluded. Prior comparator rejects31 damaged inputs.
- Full PC browser suite:134/134 pass.
- Two new browser checks exercise upright and lying: reject unsupported legacy text; intercept actual Drive write; verify complete current workflow and rejection reasons; construct a synthetic v2 trio from only that wire contract; re-sync and accept it; open Today; inspect browser errors and screenshots.
- The synthetic producer is test code, not a real Claude run. Google endpoints and XR inputs are mocked; WebGL is real.
- Final corrected-workflow targeted checks rerun:2/2 pass.
- Isolated ../mutation-030/run.cjs:6/6 caught, passing baseline and passing restored fixture. Faults: missing workflow, stale workflow, dropped rejection reasons, stale merged contract overriding current, missing automatic delivery, stale generated module. Production files never mutated.
- Evidence: ../build-030-full-evidence and ../build-030-picker-evidence.

## Independent review
build030_critic wrote none of the production code. Score9/10, no blocking findings. Independently ran27 Drive tests, checked generated parity and an isolated stale-instruction mutation, and inspected front/side/lying images. One wording inconsistency about newest valid file was corrected in the maintained skill and regenerated module. Final sign-off after correction:9/10, no remaining findings; critic independently confirmed corrected authoritative-newest wording and generated parity.

## Remaining real-world check
No actual Claude connector/Google Drive account request or Quest hardware test was run. Open Build030, sync once to send current instructions, ask Claude for the daily three normally, sync again, and confirm all three appear with notes. If Claude ignores the delivered workflow, report its actual response or the app's rejection; do not claim changing prompt wording guarantees obedience. Source diversity (five authors), historical study-note persistence and optional lines remain separate work.


## Release
Code commit e3f4cc9 pushed to build-030-picker-workflow and phase-1-gestures. Live https://p0champ.github.io/bradbury-cabin/?v=30 verified: index.html, style.css and all26 JavaScript modules match reviewed source after normalising line endings. Staged and committed secret scans passed. Real Claude/Drive and Quest checks remain outstanding.
