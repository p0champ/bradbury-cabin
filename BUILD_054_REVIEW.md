# Build 054 — "Glass folio" reading page

Bastian found the app floating in his room boring and soulless. He wanted Vision Pro glass with soul, coming from beautiful book type and gentle motion. He wanted it comfortable when reading on the couch, leaning back, and passthrough had to stay. Three ideas went to an independent judge: Glass folio (9/10), Floating paper (7/10) and Open book (5/10). Bastian approved Glass folio with the judge's refinements. It was built overnight and is **not published**.

## What changed

- **Glass and paper.**
  - The reading page is warm, lamp-toned paper (#f5eedf, slightly warmer than before) inside a thin translucent glass frame, about 2 cm, so the room shows through the frame.
  - The frame has a light rim, and the paper sits in it with a hairline of shade.
  - The text area and margins are unchanged.
- **Book type (Literata, already bundled).**
  - The title, author line and running header are in small capitals.
  - Stories and essays (never poems) open with a two-line-tall first letter, with the first two lines wrapped beside it.
  - Typographic quotes are applied at display time only.
  - The page number sits centred at the foot ("3 / 14").
- **Page turns.**
  - The old words slide about 2.5 cm out and fade while the new words glide in from the other side, over 0.46 s. The glass and running header stay still.
  - With reduced motion, the turn is a crossfade in place.
  - It is composed on the GPU over a still snapshot of the page without its words. Only the new page's words are uploaded; the old page's are already cached.
- **Glass highlight.** About every 25 s of reading, a faint highlight travels the straight part of the top glass rim over 2.4 s. It is drawn once, moved, and never passes over the words. It is off with reduced motion.

### The texts are unchanged

Stored texts, catalogue checks, pagination areas and saved-place anchors are unchanged. The opening letter is laid out with exact word counting, so every word appears once and in order, and saved places still land on the right page. Curly quotes are a drawing-time substitution only. Elisions such as 'tis keep a right-pointing apostrophe, and any character that is already typographic is left alone.

### Couch mode: no new behaviour (needs Bastian's decision)

Placement already copies the head pose. The window sits along the line of sight and turns to face the eyes, so placing it while leaning back already tilts it back and raises it. A version that moves the window by itself when he reclines after placement would break the app's rule that it re-centres only on request. That was not built; it is left as a decision for Bastian.

## Verification (desktop; not a Quest)

- 229 unit tests and all source checks pass. New `tests/folio.test.mjs`:
  - With the opening letter, every word of every Library work survives at every size, in order.
  - Lines beside the letter stay inside the page.
  - Saved places from the plain layout land on the right page.
  - Typographic quotes, page-turn timing and glass-highlight timing.
- New native-pixel checks (`tests/glass-folio-browser.cjs`):
  - The glass frame is translucent and the paper is opaque and warm.
  - The title and author are in small capitals, prose has an opening letter, poems do not, and the folio is in Literata.
  - The page turn is animated both ways with the correct direction and slide, composed on the GPU, with at most 3 canvas uploads. It rests on exactly the page.
  - With reduced motion, the turn crossfades without sliding.
  - The glass highlight appears within about 25 s and changes pixels only above y = 56 (the glass band). It leaves no trace.
- One deliberate expectation changed: the paper sample colour in `coherent-browser.cjs`.
- Story, mid-turn and poem pages were rendered and inspected.
- **Full browser suite: 300/300** in one clean run, covering 052 + 053 + 054.
- **Test updates for the translucent glass frame.**
  - Quad-pixel comparisons now work in premultiplied space: opaque pixels must still match exactly, and translucent glass may round by one.
  - Paper samples moved off the glass band.
  - The window-shape check now also asserts that the glass band is translucent.
  - Comparisons after a page turn wait for the 0.46 s turn to rest.
  - The reading Exit circle is measured on its paper half.
- **Text-reading tests** use the app's own layout options and display-time quotes. The reading words are again drawn onto the page every paint; the separate band is used only for turns.
- **Reading Exit unchanged.** Its geometry is the same as before. The circle sits where the glass frame meets the paper at the top-right corner. Moving it fully onto the paper was tried, then reverted to keep the tested reach and exit safety unchanged overnight.

## Not verified

No Quest result. Crispness of the small capitals at reading distance, the feel of the turn, how visible the highlight is over a real room, and GPU cost need Bastian's check.
