---
name: bradbury-daily-three
description: Use when Bastian asks for his daily three, today's three, Bradbury picks, or to swap one of them (poem, story or essay) for his Bradbury Cabin reading app.
---

# Bradbury Cabin: today's three

Bastian is doing the Bradbury Challenge. Every day he reads one poem, one short story and one essay, in his Quest app, Bradbury Cabin. The app picks up whatever you save to his Google Drive. Your job: choose the three, fetch the full texts, save one file, and check it. There are no windows and no voice.

If the Google Drive connector isn't available, or saving fails, say so plainly in one line and don't give the picks. They'd never reach the app.

## 1. Find the folder and read his history

1. Search Drive for: `title = 'Bradbury Cabin' and mimeType = 'application/vnd.google-apps.folder'`.
   - Ignore anything in the trash.
   - If several match, use the one that contains `progress.json`.
   - Create the folder (at the top of My Drive) only if the search really returns nothing.
   - Keep its folder ID. Every file you create below goes in it, with that ID as the parent.
2. Read **progress.json** in the folder if it exists. The app writes it. In `days["YYYY-MM-DD"].picks` you'll find "Title — Author" for the poem, story and essay given on each day. Ticks look like `poem/story/essay: true`.
3. Also look at picks files in the folder: `parentId = '<folderId>' and title contains 'picks-'`. Read two kinds:
   - any created after progress.json's `savedAt`;
   - any whose name date has no `picks` entry in progress.json.

   Their titles count as already given.
4. If **tutor-notes.json** exists, read it. Its priorities steer your choice of themes, forms and skills to practise.
5. Known history: the challenge started 18 Oct 2026. On 21 Oct the three were:
   - The Guest House (Rumi)
   - The Story of an Hour (Kate Chopin)
   - The Death of the Moth (Virginia Woolf)

**Never repeat** any title from this history.

## 2. Choose

- Pick one **poem**, one **short story** and one **essay**. Each should take about 5–30 minutes to read. Keep stories and essays **under about 6,000 words**.
- **Vary** them by era, country, original language and field (nature, war, love, science, art, politics, the city…). Don't give three works from the same century or country.
- **Only works that are free to read in full, legally, in Germany and the US:**
  - the author died before 1 January 1956;
  - **and** for translations, the translator also died before 1956;
  - **and** it was first published before 1931.

  Watch out for popular modern translations: Coleman Barks's Rumi, for example, is NOT free. Use an old public-domain translation or another work.
- Bastian wants the whole work, never an excerpt.
- **Swap** (e.g. "swap the essay"): read today's newest **valid** picks file, replace only that kind, and save the **full three-pick file** again (step 4). The app reads only the newest file, so a file with just one pick would hide the other two.

## 3. Get the exact full text

- Use legal free sources only: Project Gutenberg, Wikisource or americanliterature.com.
- Copy the text **verbatim**: no summary, no modernising, no cuts.
- Check that the last line you have matches the end of the work at the source, so nothing is cut off.
- Format the text as plain text:
  - **Poems:** one line per line, a blank line between stanzas, leading spaces for indented lines.
  - **Prose:** a blank line between paragraphs.
- If you can't get the complete text legally, choose another work.

## 4. Save it to Drive, then check it

Build the JSON. If you have a code tool, **build it with code** (e.g. Python `json.dumps`) so quotes, backslashes and line breaks are escaped correctly.

```json
{
  "version": 1,
  "date": "2026-10-28",
  "picks": {
    "poem":  { "title": "...", "author": "...", "year": 1818, "place": "England", "source": "<URL of the text>", "text": "..." },
    "story": { "title": "...", "author": "...", "year": 1884, "place": "France",  "source": "<URL of the text>", "text": "..." },
    "essay": { "title": "...", "author": "...", "year": "c. 1580", "place": "France", "source": "<URL of the text>", "text": "..." }
  }
}
```

- `date` is today in Europe/Berlin.
- `year` may be a number or a short string such as "c. 1580".

Create the file with the Drive `create_file` tool, using exactly these fields:

| Field | Value |
|---|---|
| `title` | `picks-YYYY-MM-DD.json` (today) |
| `parentId` | the Bradbury Cabin folder ID |
| `textContent` | the JSON text |
| `contentMimeType` | `"application/json"` |
| `disableConversionToGoogleType` | `true` (**required**: otherwise Drive turns it into a Google Doc that the app can't read) |

You can't overwrite files. If a file for today already exists, use the next free number: `picks-YYYY-MM-DD-2.json`, then `-3`, and so on. The app reads today's newest valid file.

**Check:** download the file you just created with `download_file_content` (not `read_file_content`). It returns **base64**: decode it first, then confirm three things:
- it parses as JSON;
- `date` is today;
- all three titles and texts are present.

If anything is wrong:
- move the bad file to the trash (`trash_file`);
- fix the JSON;
- save it again as the next number.

## 5. Reply

Keep it short. For each of the three:
- title and author;
- one line on why it's worth reading today, with no spoilers;
- a link that includes a **study guide**. Try americanliterature.com, then LitCharts or SparkNotes, then Poetry Foundation for poems. Only give a URL you actually found. If none exists for that work, say "no study guide found".

End with: "In the cabin: Sync with Drive on the start page, then Menu → Library."

Don't add content or trigger warnings. He finds them spoilers.
