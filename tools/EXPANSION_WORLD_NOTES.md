# World expansion: producer provenance, rejections and limitations

Bastian started this version on 3 November 2026 with one scope: a wider literary catalogue (different writers, eras, subjects and parts of the world). No interface, feature, gesture or behaviour changed.

Retrieved unchanged UTF-8 plain-text editions from gutenberg.org on 2026-11-04. `expansion-world.json` records byte hashes, body hashes and explicit one-based inclusive boundaries. Each work is declared in `expand_catalogue_world.py` by exact source lines: the heading line (and the first line of a heading set over several lines), which occurrence of it, and the first line after the work. Run `python tools/expand_catalogue_world.py --check` without network access to reproduce all 60 candidate boundaries. These are **producer candidates**, not approvals.

## How the 60 candidates were chosen

Three separate list-makers drafted about 60 works each, with different emphases (geography and language; era; subject and reading quality). Two independent critics scored the lists against a fixed rubric and audited the hard rules: author and translator died before 1956, first published before 1931, complete self-contained works, stories and essays under 6,000 words, no authors already in the catalogue, at most two works per author. They also checked that no work needs notes or commentary removed from its slice. Bastian approved the merged list (critic score 9.2/10) on 4 November 2026.

## Independent critic

A separate agent in its own folder, with no access to the producer's code, manifest or output, received only a plain-words description of each work: ebook, title, and where the work ends. It downloaded the gutenberg.org HTML editions itself and extracted them with its own DOM code (`critic/extract_world.py`, saved output `critic/extraction-world.json`). `critic/extract.py` adds its works to the combined extraction exactly as it does for Build 031.

An independent reviewer then classified every rejection. Four were bugs in the critic's own HTML reading: leaked `pageno` spans, unclassed stanza lines, a `<pre>` paragraph rule and an unwrapped view that hid a heading. The critic fixed only its own code, without seeing producer text. A reviewer suggested two boundary changes (Du Fu: end before the asterisk note; Theocritus: fold the cast line into the heading). They were **not** applied, because choosing new boundaries after seeing which works failed would tune the result. The comparator, tests and thresholds are unchanged.

## Result: 35 of 60 accepted

The comparator accepted 12 poems, 12 stories and 11 essays. The 25 rejections below are genuine differences between the plain-text and HTML files of the same edition. None was hand-corrected; each remains a candidate in the manifest and is not published.

| Work | Reason |
|---|---|
| Theocritus, Idyll XV | Verse indentation differs (centred cast line) |
| Du Fu, The Recruiting Sergeant | Its asterisk note is one paragraph in HTML, four lines in text |
| Bai Juyi, The Lute Girl | Prose preface laid out differently |
| Omar Khayyam, Rubáiyát (First Edition) | Plain text prints a `*****` break the HTML does not have as text |
| Villon, The Epitaph in Form of a Ballad | HTML uses non-breaking hyphens (U+2011) |
| Manrique, Coplas | HTML prints each stanza as one run-on paragraph |
| Rosenfeld, In the Factory | Straight vs curly apostrophes |
| Hardy, Channel Firing | Small capitals and indentation differ |
| The Shipwrecked Sailor | Scanned-page HTML: paragraph breaks and capitals differ |
| Addison, The Vision of Mirza | "quae" vs "quæ" |
| Im Bang, Charan | Hyphen vs en dash, straight vs curly apostrophe |
| Sui Sin Far, In the Land of the Free | Paragraph breaks and quote style differ |
| Andersen, She Was Good for Nothing | Illustration caption and paragraphs differ |
| Peretz, If Not Higher | Section ornament and paragraphs differ |
| Lawson, The Drover's Wife | Straight vs curly apostrophes |
| Quiroga, The Alligator War | Straight vs curly quotation marks |
| Plato, Crito | Byline lines placed differently |
| Hearn, A Street Singer | Four dots vs ellipsis character |
| Lucian, The Vision | Straight vs curly apostrophes |
| Montaigne, Use Makes Perfect | Quote style and paragraph breaks differ |
| Schopenhauer, On Noise | Footnote paragraph placement differs |
| Dickens, Night Walks | Small capitals ("SOME" vs "Some") |
| Maeterlinck, Silence | Paragraph breaks differ |
| Unamuno, Solitude | Paragraph breaks differ |
| Jack London, How I Became a Socialist | Straight vs curly quotation marks |

The losses remove East, South and Central Asia, Persia, Egypt, Greece-in-verse, Spain, Japan, Korea, Denmark, Uruguay and Belgium from this expansion. Replacements are a separate later batch. They should be pre-checked so that both Gutenberg formats agree on quote style, special characters, small capitals and section breaks before they are proposed.

## Notes on accepted works

- **Maisuna:** the heading line carries the anthology's note marker `[8]`. Editor Epiphanius Wilson's note is printed after the poem and is not part of it; both sides end at the last verse line.
- **Michelangelo:** the slice starts with the edition's italic subtitle and its Italian first line, printed as a reference before Symonds's translation.
- **Goethe:** the edition dates the ode 1773.
- **Pushkin:** the slice includes Panin's reference line "IV. 19." and the date "1826.".
- **Hopkins:** first published 1918 by Robert Bridges; three printed turnover lines are kept as printed.
- **Machado de Assis:** the slice begins with the edition's byline lines.
- **Twain:** written 1904–05, first published 1923; Paine's introduction to the volume is not part of the slice.
- **Ecclesiastes:** the edition prints a verse label (for example 21:001:001) before every verse; both sides keep them.
- **Huxley and William James:** footnotes printed directly after the text are included.
- **Lucian's "H." signature, Lamb's epigraph and Swift's subtitle:** kept as part of each edition's presentation.

## Contributors and dates

Credited translators and editors of accepted works, all died before 1956: John Conington (1869), John Addington Symonds (1893), J. D. Carlyle (1804) with anthology editor Epiphanius Wilson (1916), Edgar Alfred Bowring (1911), Ivan Panin (1942), Robert Bridges (1930), Lady Charlotte Guest (1895), J. M. Rigg (1926), Constance Garnett (1946), Isaac Goldberg (1938), Velma Swanston Howard (1937), Eugene Mason (1935), George Bruce Halsted (1922), Louise Maude (1939) and Aylmer Maude (1938). Ecclesiastes is the 1611 King James Version. Every author died before 1956, and every work and translation was first published before 1931. Agreement with these digital editions does not establish error-free first-edition text.
