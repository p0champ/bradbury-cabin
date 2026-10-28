# Build 028 — Your shelf

28 October 2026. Phase 2 of the Today design.

## What changed

- **Your shelf** (`shelf-panel.js`): earlier days newest first, six per page
  (Earlier / Later), each with date, challenge day, the three titles (read in
  ink, unread muted) and how many were read. A day opens its three; a work
  opens as the exact critic-accepted catalogue edition under the id it had on
  its day, so a saved place carries over, and it reopens after a reload.
- Works not in the catalogue (e.g. Rumi on 21 Oct, the rejected Yeats / Poe /
  De Quincey on 28 Oct) are listed as **Not in the cabin** and cannot open.
- From now on each synced day also stores its catalogue IDs
  (`progress.days[d].ids`), validated and merged together with the labels. An
  ID that disagrees with the day's own label is ignored.
- Menu row 1 reads **Today** when a trio exists, otherwise **Your shelf**.
  Today's bottom button leads to Your shelf; the shelf leads on to the whole
  Library. The shelf shows why Today is missing when picks were rejected.
- Midnight with Today or a closing page open now falls back to Your shelf.

Known limit: past works reopen without their study notes (only today's picks
file is cached); an "After reading" place from across midnight falls back to
the start of the text after a reload.

## Review

Independent build critic (wrote no code): **7.5/10** in round 1. Must-fix:
a Drive merge could pair a day's label with another work's ID, reopening a
checked but wrong poem; the reason for no Today was hidden. Also blank rows,
double-pinch on shared back buttons, midnight row shift, carried work in the
Library. Round 2: **8.5/10**, all confirmed fixed with its own probe; its last
point (the shelf note was cut off) was then fixed and tested with the real
messages by the author only.

## Evidence (author)

- 136 unit tests, then `check:sources` (185/186 accepted, 31/31 damaged inputs
  rejected).
- 129/129 PC browser checks, including the shelf, day page, exact-edition
  reopening, reload, "Not in the cabin" and midnight.
- 8/8 shelf mutations caught (`../mutation-028/`), 5/5 Today and 10/10
  earlier mutations still caught.
- Screenshots: `../build-028-evidence/shelf*.png`.
- No Quest hardware check yet.
