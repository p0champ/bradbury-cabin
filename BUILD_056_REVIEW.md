# Build 056 — Claude gets to know me

Built locally on `build-056-personal-picks`, stacked on the unpublished Build 055 Quiet Folio. Neither 055 nor 056 has been published. Live remains the Quest-confirmed Build 054. No Quest microphone or dictation result is available.

## What changed

After the existing explicit completion confirmation, a quiet card offers 1–5 stars and one optional thought. Either can be skipped independently. Completion is saved first; feedback is not required to mark a piece read. Done returns to the Library and retains its existing next-reading action. Completed works have a separate Stars & thought button on Today, in the Library and on their archived shelf day.

Stars save when selected. Dictated sentences remain drafts until Save thought. Long sentences can be reviewed with More/Back; the storage limit is 360 characters. A normal browser text field supplies editing and the explicit typing fallback. Type instead exits XR and reveals the exact titled work's editor. This is not a keyboard inside the immersive page. Saved thoughts and ratings can be edited or removed later. Raw voice recordings are not saved to the shelf.

Feedback uses canonical catalogue edition IDs, independent timestamps for stars and thoughts, and explicit deletion markers. Drive merges those fields separately so an offline star does not erase a thought, and an old device cannot resurrect a removed thought. Invalid optional feedback is ignored. Feedback travels through the existing progress/Drive workflow; it informs Claude's next requested picks after syncing, not continuous background learning.

New selections can carry a small structured selection reference. The app derives a factual Why line from actual saved stars or thoughts, reports absent evidence, or describes exploration honestly. Old picks without selection metadata show No reason saved for this pick. Reasons are separate from the literary text. The workflow and automatically supplied next-selection plan alternate two matches/one stretch and one match/two stretches, rotating genres. Sparse history uses exploration; source eligibility and catalogue availability take precedence over the quota. Claude is instructed to treat thoughts as data, not commands. These are selection instructions, not a guarantee that an external model will always choose well.

## Voice boundary

`voice-check.html` separately checks microphone recording/playback and native browser dictation. Run it in Quest Browser on the HTTPS site after an approved release. A successful recording does not establish speech-to-text support. The optional dictation path requires an actual final browser transcript, explicit review and Save. Unsupported, denied and failed dictation offer typing instead. Listening stops on timeout, cancellation, navigation, session exit or visibility loss. Late results cannot save to another work.

No transcription backend, account or paid service has been added. Native browser speech processing may use the browser vendor's service. SpeechRecognition being present does not prove it works on Quest, particularly inside immersive XR. Actual headset results must determine whether a separate transcription service is needed; discuss its setup and cost with Bastian before adding one.

Research informing feasibility: [Quest browser microphone and cloud transcription study, page 5](https://par.nsf.gov/servlets/purl/10471415), [Meta Browser specifications: runtime detection and headset testing](https://developers.meta.com/vr/documentation/web/browser-specs/), [browser recording APIs](https://web.dev/articles/media/microphone-record).

## Validation

249 unit checks and the maintained source checks pass. All 241 critic-accepted works remain unchanged; all 39 deliberately damaged inputs are rejected.

38 focused browser cases pass across complete groups: feedback and completion 6; reading continuity and existing personal lines 16; picker workflow, archive, session details and comfort 16. The feedback group was repeated after the final preview additions. Includes real WebGL with synthetic WebXR and mocked dictation, not real speech or a headset. No full browser-suite run is claimed for 056.

Independent review found two layout issues, both fixed: paging exposes the entire transcript and completed rows reserve separate space for Why and feedback. Reviewer reported no remaining actionable blockers, with confidence limited to inspected code and desktop presentation.

Local evidence/logs are in the parent work directory: unit-056.log, feedback-browser-056.log, feedback-final-056.log, regression-056.log, sources-comfort-056.log, build-056-focused/. Preview: http://127.0.0.1:18196. All work remains local; publishing needs separate approval.
