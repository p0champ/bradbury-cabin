# Build 019 independent review: Claude's daily three through Google Drive

## What was reviewed

A separate critic reviewed both the code and the Claude skill (CLAUDE_SKILL_DAILY_THREE.md) that Claude follows on Bastian's phone.

## Round 1: 7/10

Code blockers:
- After about an hour the Google token expired, and the Drive backup stopped with no warning.
- The first sync could create a duplicate folder or a duplicate progress.json.
- The app picked the picks file in a fragile way.

Skill blockers:
- A swap wrote only the one swapped pick, not all three.
- Nothing guaranteed the JSON was valid, and there was no read-back check.
- The public-domain rule was wrong for Germany. The corrected rule: author and translator died before 1956, AND first published before 1931.

Real-Drive finding: Claude's connector can create JSON files with conversion disabled, but it cannot overwrite them. So every request creates a new dated file.

## Fixes

- A pending-changes count, with an honest "sign-in expired · ticks kept on headset" note.
- Writes now run one at a time.
- A client-side filter on picks file names.
- The work ID now includes a title hash.
- Unticks are kept as explicit `false`.
- Size caps on picks files.
- The Google sign-in script is preloaded.
- Author names are truncated so they fit.
- The skill was rewritten to cover all of the above.

## Round 2: code 8/10, skill 8/10

One remaining blocker: a today work would fall back to the sampler at midnight, while Bastian was mid-read.

Fixed afterwards:
- The open work is now carried past midnight. A browser check covers it, and a mutation test showed that check fails without the fix. That required correcting "Save test details" to report the work actually shown.
- The app now syncs automatically after a reload while Google's sign-in is still valid.
- Among today's files, the most complete file wins, and older files are opened only as far as needed.
- The skill now names the exact connector fields (`disableConversionToGoogleType: true`), says to decode the base64 download before checking, gives exact history queries, closes the history gap, and trashes failed attempts.

## Not done

- Merge-on-save between the PC page and the Quest at the same time.
- Choosing which `trackingSince` wins.
- A layout cache.

## Final counts

90 unit tests + 113 browser checks pass. Google itself is a stand-in in these tests. The real Drive connector was exercised separately, as noted above.
