# Build 031 — more independently checked authors
28 October 2026.

## Delivered
56 complete new works:35 Yeats poems,13 Poe stories,one De Quincey essay and seven Tagore essays. The catalogue grows from185 to241 accepted works by nine authors:129 poems,46 stories,66 essays. Existing185 catalogue objects are unchanged, independently confirmed by the build reviewer.

Producer: authors031_producer independently extracts unchanged Gutenberg plain-text snapshots with tools/expand_catalogue_031.py; explicit source/body hashes and boundaries in tools/expansion-031.json. A separate source critic, authors031_source_critic, was spawned without inherited history and forbidden producer code/data. It downloaded its own HTML bytes and wrote its own DOM extractor tools/critic/extract_031.py. Saved critic extraction and retained HTML remain reproducible; the existing comparator is the only verdict writer and publication remains gated by exact blocks.

58 new candidates were compared:56 accepted. Two Yeats poems remain unpublished: Aedh Tells of the Rose in His Heart differs in verse-line structure, and Michael Robartes Asks Forgiveness Because of His Many Moods differs in Phoenix/Phœnix typography. Neither was hand-corrected. The existing Blake Night rejection remains. Tagore Soul Consciousness is excluded whole for unmatched source italic markup. Over-length Poe stories and stories requiring distant associated notes are excluded whole. The critic initially labelled four omitted-note narratives complete; root caught that, and the critic independently re-audited and corrected them to complete:false with note-boundary evidence before publication.

The paired italic-marker remover now also supports poetry and preserves whitespace immediately before the closing underscore; all literary characters still need exact independent HTML agreement. De Quincey's multiline source title is matched using recorded headingStartLine through headingLine, rather than just the last heading line; body boundaries/text unchanged. Reproducible discovery is now checked against the main manifest.

Edition metadata is explicit: Yeats first1899/source1903 fourth edition; Tagore first1913/source1916, with historical English translation/revision contributors documented in CREDITS and tools/EXPANSION_031_NOTES.md.

## Validation
-141 unit tests passed, including lossless pagination of every new work at all three sizes and safeguards keeping rejected/unsupported works unpublished.
-All source checks passed:244 candidates,241 accepted,3 rejected; retained raw hashes, complete reproducible manifests, rerun independent extraction, exact comparator verdicts, generated catalogue and starter-shelf parity.
-39 in-memory comparator damage cases rejected; undamaged texts accepted. Includes missing endings and negative independent completeness for all four authors.
-8/8 isolated source faults caught with passing baseline and restored fixture (../mutation-031/run.cjs):changed body hash, shortened boundary, substituted source hash, altered plain snapshot, shortened multiline heading, altered independent HTML, removed completeness acceptance, forged unreviewed publication.
-138/138 full PC browser checks passed. Four new browser cases load new authors from references; verify first/last source pages at Large text; resume saved endings offline after reload; inspect Today and upright/side/lying views. Synthetic XR/Drive are test doubles; WebGL is real.
-Additional targeted author run4/4 passed. Evidence ../build-031-evidence and ../build-031-full-evidence.

## Independent build review
build031_critic authored no code. Final9/10, no blocking or ranked findings. Independently ran141 tests/source checks, compared all185 prior works unchanged, inspected new source completeness/provenance, rejected16 additional in-memory corruptions, reviewed tests and screenshots including all four side/lying native previews and De Quincey's long Today title. Publication approval is for the scoped expansion.

## Deferred checks and scope
Bastian explicitly deferred real Claude/Google Drive and Quest checks, and instructed work to continue through completion. They remain recorded for later; no user test gate or new account/service. No saved Claude-account skill changed. This is source-catalogue independent verification, not a newly invented live second-agent backend for each daily pick.

All import/index queries v31; header BUILD031, diagnostics gestures-031. No gesture recognizer, handMapRevision9, menu indices or visual flow changed. Release verification to be recorded after deployment.


## Release
Code commit190959c pushed to build-031-more-authors and phase-1-gestures. Live Build031 verified: index.html, style.css and all26 JavaScript modules match reviewed local source (line endings normalised). Staged/committed secret scans passed44 changed files. Scanner subprocess buffer was increased to64MB in parent scanner scripts to support the expanded source catalogue; detection rules were not changed. Real Claude/Drive and Quest checks remain deferred as requested.
