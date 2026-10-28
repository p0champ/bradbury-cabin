---
name: bradbury-daily-three
description: Use when Bastian asks for his daily three, today's three, Bradbury picks, or to swap one of them (poem, story or essay) for his Bradbury Cabin reading app.
---

# Bradbury Cabin: today's three

Bastian is doing the Bradbury Challenge. Every day he reads one poem, one short story and one essay, in his Quest app, Bradbury Cabin. The app picks up whatever you save to his Google Drive. Your job: choose three reviewed source editions, save their catalogue references, and check the file. The cabin supplies the original literary text itself; never compose, reconstruct or copy a work into the picks file. There are no windows and no voice.

If the Google Drive connector isn't available, or saving fails, say so plainly in one line and don't give the picks. They'd never reach the app.

## 1. Find the folder and read his history

1. Search Drive for: `title = 'Bradbury Cabin' and mimeType = 'application/vnd.google-apps.folder'`.
   - Ignore anything in the trash.
   - If several match, use the one that contains `progress.json`.
   - Create the folder (at the top of My Drive) only if the search really returns nothing.
   - Keep its folder ID. Every file you create below goes in it, with that ID as the parent.
2. Read **progress.json** in the folder if it exists. The app writes it. In `days["YYYY-MM-DD"].picks` you'll find "Title — Author" for the poem, story and essay given on each day. Ticks look like `poem/story/essay: true`.
   Read `cabinPickerInstructions` and the selectable source catalogue metadata
   attached to progress.json. Follow that source contract even if an older copy
   of this skill requests full text. It supersedes the old text-import format.
   It supplies the current catalogue IDs, titles, authors, kinds and edition links.
   Its `workflow` contains these complete current instructions, delivered by the
   app at every successful Drive sync. Use that workflow in place of an outdated
   saved skill. Never ask Bastian to re-paste a skill, photograph or import texts.
   Its `lastCheck` is the app's verdict on the newest picks file. If
   `accepted` is false, fix every listed problem in the next file.
3. Also look at picks files in the folder: `parentId = '<folderId>' and title contains 'picks-'`. Read two kinds:
   - any created after progress.json's `savedAt`;
   - any whose name date has no `picks` entry in progress.json.

   Their titles count as already given. For version 2 files, resolve each `catalogueId` against the catalogue metadata to recover its title and author.
4. If **tutor-notes.json** exists, read it. Its priorities steer your choice of themes, forms and skills to practise.
5. Known history: the challenge started 18 Oct 2026. On 21 Oct the three were:
   - The Guest House (Rumi)
   - The Story of an Hour (Kate Chopin)
   - The Death of the Moth (Virginia Woolf)

**Never repeat** any title from this history.

## 2. Choose

- Choose only IDs in the app's current reviewed catalogue, and none of the
  starter-shelf IDs (`shelfIds`) already in his Library. Pick one **poem**, one **short story** and one **essay**. Each should take about 5–30 minutes to read. Keep stories and essays **under about 6,000 words**.
- **Vary** them by era, country, original language and field (nature, war, love, science, art, politics, the city…). Don't give three works from the same century or country.
- **Only works that are free to read in full, legally, in Germany and the US:**
  - the author died before 1 January 1956;
  - **and** for translations, the translator also died before 1956;
  - **and** it was first published before 1931.

  Watch out for popular modern translations: Coleman Barks's Rumi, for example, is NOT free. Use an old public-domain translation or another work.
- Bastian wants the whole work, never an excerpt.
- **Swap** (e.g. "swap the essay"): read today's newest picks file and its `lastCheck`. If it was rejected, repair every listed problem. Preserve the other two supported selections and save the **full three-pick file** again (step 4). The app checks only the newest file; an invalid or incomplete latest file is rejected rather than replaced silently with an older one.

## 3. Select the exact source edition

- Use the catalogue metadata in progress.json as the primary source of supported
  IDs. If it is unavailable, consult the published catalogue:
  https://raw.githubusercontent.com/p0champ/bradbury-cabin/phase-1-gestures/source-catalogue.js (each entry's `id` is its catalogueId)
- Match the requested kind exactly. The app loads that ID's reviewed complete
  source edition. You cannot add an unsupported work by supplying text or a URL.
- Never invent an ID or substitute a title, author, translation or edition.
- Read the named source to write accurate study notes. The literary text stays
  outside model generation: no summaries, modernising, cuts or reconstructed text.
- If no suitable unread work remains in one kind, say the reviewed catalogue
  needs expansion. Do not repeat a previous work or imply that you expanded the
  app automatically. No photographs, copying or imports are needed from Bastian.

## 4. Save references to Drive, then check them

Build the JSON with code when available (for example Python `json.dumps`). Use
version 2; only `catalogueId` and original `guide` notes belong inside each pick.
Do not send `text`, fabricated verification flags, checksums or source metadata.

```json
{
  "version": 2,
  "date": "2026-10-28",
  "picks": {
    "poem":  { "catalogueId": "<exact poem ID from catalogue>" },
    "story": { "catalogueId": "<exact story ID from catalogue>" },
    "essay": { "catalogueId": "<exact essay ID from catalogue>" }
  }
}
```

- `date` is today in Europe/Berlin.
- Optional top-level `dedication`: at most 70 Unicode characters, one calm,
  original line to welcome him before reading. Set the mood only: no plot,
  outcomes, surprises or explanations of connections. No quotations unless
  they are exact words from one of the three selected editions.
- Optional top-level `thread`: at most 160 Unicode characters, an original
  reflection connecting the three readings. It appears only after all three
  are marked read. It may discuss their connection after reading; it is not
  a plot summary or an answer key. Use exact source quotations only.
- Both fields are single-line strings. Omit them when you have nothing useful
  to add. The app drops an invalid, over-length or misquoted field on its own;
  that never rejects the three readings. Short quotations in these fields
  are checked too. Do not supply a quotation from memory or another author.
- On a swap, reconsider both optional lines for the new trio. Do not keep
  a reflection about works no longer selected. Replaced works become unread;
  the other selections keep their read status and saved places.
- When swapping a selection, preserve the other two supported IDs and guides.
  Resolve any legacy title/author to a unique exact catalogue match; if a legacy
  selection cannot be matched, replace it with an eligible unread catalogue work
  and explain the replacement briefly. Never forward old unchecked text.

Include an original `guide` object inside **each pick**, alongside `catalogueId`:

```json
"guide": {
  "context": "A short paragraph: author, era, and why this work matters. No spoilers.",
  "notice": ["One or two details of language or form to notice, without revealing outcomes."],
  "themes": "A short discussion to read AFTER the work. Spoilers are allowed here.",
  "questions": ["Two or three specific, open questions grounded in the work."]
}
```

The app machine-checks your notes: anything inside double quotation marks
must be the edition's exact words (punctuation and capitals included; an
ellipsis may join exact parts in order). A misquote rejects the whole file.
Write titles of other works without quotation marks.
Write concise notes, not a plot summary or an answer key. Verify historical
claims against reliable sources; present interpretations as possibilities.
Keep `context` and `notice` strictly spoiler-free: no endings, reversals,
revealed identities or explanations that give away a discovery. Keep all
spoilers in `themes` and `questions`. No content or trigger warnings.
Each field accepts a string or an array of strings; use the shape above.
Limit each string to 1,200 characters and each array to 8 entries. A missing
guide still loads the text, but include all four fields for new picks.
When swapping a pick, preserve the other two picks and their guides.
The cabin attaches the notes to each work: Before reading, then the full text,
then After reading — spoilers, using ordinary page turns. No guide menu is needed.

Create the file with the Drive `create_file` tool, using exactly these fields:

| Field | Value |
|---|---|
| `title` | `picks-YYYY-MM-DD.json` (today) |
| `parentId` | the Bradbury Cabin folder ID |
| `textContent` | the JSON text |
| `contentMimeType` | `"application/json"` |
| `disableConversionToGoogleType` | `true` (**required**: otherwise Drive turns it into a Google Doc that the app can't read) |

You can't overwrite files. If a file for today already exists, use the next free number: `picks-YYYY-MM-DD-2.json`, then `-3`, and so on. The app checks today's newest file. If it fails, correct the problems and save a new complete file; do not assume the app will fall back to an older one.

**Check:** download the file you just created with `download_file_content` (not `read_file_content`). It returns **base64**: decode it first, then confirm three things:
- it parses as JSON;
- `date` is today;
- all three catalogue IDs exist, match poem/story/essay respectively, and match the intended named editions; no literary `text` field is present.
- all three picks have the four guide fields, with no spoilers in context or notice.

If anything is wrong:
- move the bad file to the trash (`trash_file`);
- fix the JSON;
- save it again as the next number.

## 5. Reply

Only claim success after all three references have been saved and checked. Keep it short. For each of the three:
- title and author;
- one line on why it's worth reading today, with no spoilers;
- a verified link to the full text source. The study guide is included in the cabin.

End with: "In the cabin: Sync with Drive on the start page. Today's three will be ready on Today, with notes before and after each text."

Don't add content or trigger warnings. He finds them spoilers.
