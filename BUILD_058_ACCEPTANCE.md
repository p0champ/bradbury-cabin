# Build 058 acceptance map

Build 058 uses tap-to-Sync only. Cloudflare, encrypted renewal, private snapshots and their real-account proof are deferred to Build 059 under the owner's one-working-day limit. Retained managed/fallback tests still run against an explicitly enabled local test edition, including matching offline hashes; they do not mean those features are enabled in Build 058. The direct-release browser checks separately exercise the actual published configuration, including stale managed settings and old callback links.

This maps the 26 frozen RULES.md inventory rows to stable IDs. Every listed unit/browser file runs in the complete gate; the gate also refuses an omitted maintained browser module. Names inside browser.log are the individual assertions. A code mapping is not a passing result.

Local evidence: `evidence/verify/receipt.json`, `unit.log`, `browser.log` and the source-check logs. The receipt must be allPassed:true for the exact commit and bytes. GitHub repeats the whole gate and retains the complete-reader-evidence artifact. The Linux publishing symlink assertion runs there; Windows reports that platform-specific assertion as skipped.

| ID | Frozen area | Maintained checks (under tests/) | Separate owner/hardware evidence |
|---|---|---|---|
| BC-01 | Browser entrance | `frontdoor-browser.cjs`, `entry-exit-browser.cjs` | Readability and native Quest entry; pending until recorded |
| BC-02 | Placement and intro | `lamp-arrival-browser.cjs`, `entry-exit-browser.cjs`, `arrival.test.mjs` | Stationary pose, passthrough and comfort; pending until recorded |
| BC-03 | Passthrough and exits | `entry-exit-browser.cjs`, `gl-compose-browser.cjs` | Real room, native exit and tracking loss; pending until recorded |
| BC-04 | Pointer | `pointer-truth-browser.cjs`, `surface-pointer-browser.cjs`, `pointer-visibility-browser.cjs` | Displayed target and both hands on Quest; pending until recorded |
| BC-05 | Gestures | `gestures.test.mjs`, `selection-browser.cjs`, `press-drift-browser.cjs` | Native hand timing, cancel and boundaries; pending until recorded |
| BC-06 | Reading page | `glass-folio-browser.cjs`, `folio.test.mjs`, `core.test.mjs` | Text comfort, page placement and actual display; pending until recorded |
| BC-07 | Position and resume | `reading-continuity-browser.cjs`, `restore-browser.cjs`, `offline-browser.cjs`, `reader.test.mjs` | Actual Quest restart and personal place restore; pending until recorded |
| BC-08 | Today | `today-missing-browser.cjs`, `picks-arrival-browser.cjs`, `today.test.mjs` | Normal daily opening and arrival; pending until recorded |
| BC-09 | Claude and Drive | `direct-release-browser.cjs`, `drive-failure-browser.cjs`, `picks-arrival-browser.cjs`, `drive-pagination.test.mjs`; deferred managed checks also retained | Actual tap-to-Sync; seven real manual Claude deliveries; Build 059 renewal/probe deferred |
| BC-10 | Sources and critic | `picker-browser.cjs`, `authors-browser.cjs` | Real display only; original source checks run separately below; pending until recorded |
| BC-11 | Guides and personal lines | `guide-archive-browser.cjs`, `study-guide-browser.cjs`, `personal-browser.cjs` | Spoiler separation and readability; pending until recorded |
| BC-12 | Shelf | `shelf.test.mjs`, `coherent-browser.cjs` | Earlier exact editions on the headset; pending until recorded |
| BC-13 | Library | `coherent-browser.cjs`, `finish-next-browser.cjs` | Actual native targets and optional gifts; pending until recorded |
| BC-14 | Completion and challenge | `finish-browser.cjs`, `weekly-sync-browser.cjs`, `weekly-sync.test.mjs`, `progress.test.mjs` | Explicit finish and calendar corrections; pending until recorded |
| BC-15 | Wrist watch | `glance-watch-browser.cjs`, `watch.test.mjs` | Actual wrist, cue, fade and posture; pending until recorded |
| BC-16 | Streak and rewards | `rewards.test.mjs`, `rewards-browser.cjs` | Real-count goal wording on Quest; pending until recorded |
| BC-17 | Reward ceremony | `rewards-browser.cjs` | Native skip and reduced motion; pending until recorded |
| BC-18 | Stars and thoughts | `feedback-browser.cjs`, `thought-drafts.test.mjs`, `managed-connection-browser.cjs` | Saved/removal/draft behavior with actual input; pending until recorded |
| BC-19 | Voice | `feedback-browser.cjs` | Actual Quest Speak transcript REQUIRED; no fixture proves it; pending until recorded |
| BC-20 | Word tap | `comfort-browser.cjs`, `comfort.test.mjs` | Deliberate real pinch and network-failure comfort; pending until recorded |
| BC-21 | Reading comfort | `comfort-browser.cjs`, `settings-comfort-browser.cjs` | Actual dim, seasons and stationary reading; pending until recorded |
| BC-22 | Appearance and controls | `settings-comfort-browser.cjs`, `volume-browser.cjs`, `settings-panel.test.mjs` | Physical legibility, sounds and comfort; pending until recorded |
| BC-23 | Failure and offline reading | `offline-browser.cjs`, `recovery-browser.cjs`, `fallback-browser.cjs`, `reader-lease-browser.cjs` | Real Quest Wi-Fi return and safe duplicate-tab note; pending until recorded |
| BC-24 | Backup and restore | `restore-browser.cjs`, `managed-connection-browser.cjs`, `connection-recovery.test.mjs`, `connection-native-store.test.mjs` | Actual personal outside copy and empty restore; first real Quest full sync; pending until recorded |
| BC-25 | Updates | `offline-browser.cjs`, `offline.test.mjs` | Actual installed Quest update and restart; pending until recorded |
| BC-26 | Advanced tools | `session-details-browser.cjs`, `release-receipt.test.mjs`, `public-site.test.mjs` | Actual Quest export/import and plain problem report; pending until recorded |

Original-text evidence is the unchanged full chain: expand_catalogue_031, generate_source_catalogue, critic_compare, extract_library and test_critic_compare, plus generated-picker and complete-offline-inventory checks. Passing graphics mocks cannot waive a source failure.

For Build 059, the deferred owner setup separately exercises encrypted Google renewal, conditional write/readback and cleanup on a disposable file, complete immutable fallback upload/readback/reconciliation, normal Google mirror readback, and exact personal-data equivalence. A fake account passes code tests only. Record the actual owner result and the fields present in that real copy; do not invent Quest places/settings absent from an older Google backup.

Report built, automatically checked, independently reviewed, published, physically Quest-checked and seven real days separately. Independent code review is not supplied by this map. Keep the current private copy, full local queue and original device intact during recovery; never reset data for a test.
