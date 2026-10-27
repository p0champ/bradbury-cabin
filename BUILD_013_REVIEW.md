# Build 013 independent review — Challenge calendar

Separate critic agent (wrote none of the code). Round 1: **7/10**, three blockers:
- an unreadable saved record was silently overwritten;
- blocked storage pretended to save;
- a repeat pinch after opening a day could tick it.

All three were fixed with regressions, along with eight should-fix items:
- hover now draws as a ring, not a fill;
- every imported entry is validated;
- a legend was added;
- Sundays before tracking began show "not recorded";
- small text is larger;
- the calendar repaints at midnight;
- the footer says to export from the Quest browser;
- a page-turn assert was added.

Round 2: **8.5/10, no blockers**. Its nice-to-haves 1, 2, 3 and 7 were applied afterwards:
- the notice only claims a backup if one was really kept;
- otherwise nothing is saved until an import;
- repeated launches don't duplicate backups;
- the unreadable text goes into the export file;
- dates must be real dates between 2000 and 2100.

Not done:
- browser-level wiring of the 600 ms day guard (the recogniser already rejects that repeat, and the guard function is unit-tested);
- "guarded" badge feedback;
- 36 px legend text.

Final counts: **48 pure tests + 104 isolated Chromium checks pass.** This is synthetic PC evidence, not a headset check.

Storage is the browser's localStorage (headset cache) with Export/Import on the PC page. Durable bridge sync is Phase 3, so the plan's "durable progress" requirement is only partly met until then.
