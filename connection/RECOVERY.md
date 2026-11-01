# Connection and outage recovery

The owner still asks Claude for the daily three or a swap. The private
connection reads the same folder; it never chooses readings. Google renewal
credentials stay encrypted on the service. Public reader files, exports and
backup snapshots never contain those credentials or a device's restricted
connection token.

Normal saves commit and read back the complete private snapshot before
acknowledging it. Snapshot, edit sequence, duplicate receipt and mirror alarm
are committed together. An ordinary authenticated state read rearms a missing
alarm without discarding an existing retry's backoff. Google failure does not
prevent a checked private save.

When Cloudflare is unavailable, a manual Sync tap may use Google's existing
browser sign-in. It first checks the same previously verified Google owner;
an unknown or different owner cannot open the folder. It writes a separate,
immutable `cabin-recovery-*.json` copy, never `progress.json`. Reserve and save
the file identity before uploading; require exact full readback. A lost reply
reuses that identity. The managed outbox and pending edit operations remain
unacknowledged until the private service accepts them.

A freshly restored browser does not own the old Google calendar as new edits.
Its frozen envelope explicitly disables the first-device compatibility merge;
only actual captured edits may correct current private calendar/settings.
An existing original offline history keeps the compatibility path. The mode
is part of the duplicate receipt identity and cannot change on a lost reply.

On return, the service imports these complete copies through the ordinary
sequenced, duplicate-safe backup protocol. It retains the files. A durable
Google creation-time cursor includes every accepted ID at the boundary's
exact nanosecond; a newly visible lower ID at the same instant is not skipped.
Publish that checked cursor in the main Google backup. Read it before a fresh
restore or initial import; do not replay already represented old unticks over
newer private corrections. Listing uses Google's inclusive creation-time
filter and still follows every page. Imports are bounded and continue in
later batches; incomplete recovery is never described as fully current.

The service remains the sole `progress.json` writer. Conditional updates must
pass the actual owner's disposable Google-file probe before enabling the
mirror; local fake-account tests cannot prove Google's production behavior.
Failed, missing, corrupt or independently changed copies are held for
recovery, never treated as permission to replace them with empty progress.

If both providers fail, installed reading and the durable local queue remain
usable. An outside backup is confirmed only after complete stored readback.
Never clear browser data to repair an unsent copy. Actual account renewal,
personal backup restore and physical Quest behavior need separate evidence.
