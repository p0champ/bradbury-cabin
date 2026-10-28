// Sent to Claude in the progress file it already reads. No user-managed
// uploads or a new account are needed to discover the reference-only format.
import { SOURCE_CATALOGUE } from "./source-catalogue.js?v=30";
import { LIBRARY } from "./library.js?v=30";
import { PICKER_WORKFLOW } from "./picker-workflow.js?v=30";

// lastCheck: the app's verdict on Claude's newest picks file, so a rejected
// selection reaches Claude with its reasons on the next request.
export function withPickerContract(text, lastCheck = null) {
  const progress = JSON.parse(text);
  const contract = {
    version: 2,
    protocol: "bradbury-daily-three/v2",
    timezone: "Europe/Berlin",
    priority: "Read this current app workflow before choosing. It replaces outdated Bradbury skill instructions to copy or fetch full literary texts into a picks file. No skill upload or manual text import is required. Follow the workflow below using the catalogue and lastCheck in this same object.",
    workflow: PICKER_WORKFLOW,
    instruction: "Bradbury Cabin now loads literary texts from its source-checked catalogue. Choose one unused poem, story and essay from the catalogue below. Save picks-YYYY-MM-DD[-n].json in this folder with version:2, date, and picks:{poem:{catalogueId,guide},story:{catalogueId,guide},essay:{catalogueId,guide}}. Do not transcribe, generate or supply literary text. The app supplies the complete original edition. Preserve the four guide fields required by your daily-three skill. Read all previous picks/history to avoid repeats. Do not choose the starter-shelf works already in the Library (shelfIds). For a swap, preserve the other two catalogueId selections and guides. If no suitable unread work remains, explain the limitation; do not invent an ID or substitute an unchecked text. The app machine-checks every file: unknown or wrong-kind IDs, works given on an earlier day, invalid dates and any guide quotation in double quotation marks that is not the edition's exact words (an ellipsis may join exact parts) make it reject the whole file. Put titles of other works without quotation marks. lastCheck reports the app's verdict on the newest picks file; if it was rejected, fix every listed problem in a new file.",
    lastCheck,
    shelfIds: LIBRARY.map((w) => w.id),
    catalogue: SOURCE_CATALOGUE.map(({ id, kind, title, author, year, place, source }) =>
      ({ catalogueId: id, kind, title, author, year, place, source })),
  };
  // Put the complete current workflow first, where even a short connector
  // preview can find it. Discard any stale contract from a merged Drive copy.
  const { cabinPickerInstructions: ignored, ...saved } = progress;
  return JSON.stringify({ cabinPickerInstructions: contract, ...saved });
}
