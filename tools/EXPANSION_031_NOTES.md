# Build 031 producer provenance and limitations

Retrieved unchanged UTF-8 plain-text source editions from gutenberg.org on 2026-10-28. `expansion-031.json` records byte hashes, body hashes, and explicit one-based inclusive boundaries. Run `python tools/expand_catalogue_031.py --check` without network access to reproduce all 58 candidate boundaries. Source snapshots include the complete book front matter, notes, and Gutenberg license, not only the selected reading text.

These are **producer candidates**, not approvals. A raw-slice hash proves reproducibility, not original-text authenticity or independent completeness. Only the separate critic comparison can approve publication.

| Edition | Candidates | Scope |
|---|---:|---|
| Yeats, *The Wind Among the Reeds*, PG32233 | 37 poems | All 37 standalone poems before the separate NOTES section. The edition identifies itself as fourth edition, 1903; collection first published 1899. |
| Poe, *Works*, Raven edition, Volume II, PG2148 | 13 stories | All complete stories within 6000 words that do not require remotely placed endnotes. Five stories with separate notes and four additional long stories excluded whole. |
| De Quincey, *Miscellaneous Essays*, PG10708 | 1 essay | Complete *On the Knocking at the Gate, in Macbeth* (first published 1823). Other essays in the volume not proposed in this expansion; no extraction of short portions from them. |
| Tagore, *Sadhana*, PG6842 | 7 essays | All separately named complete essays except *Soul Consciousness*, whose source has an unpaired italic delimiter. First published 1913; source front matter says 1916. Roman essay numbers belong to title furniture, not the preceding essay's body. |

Yeats's later NOTES section consists of separately headed author commentary, not inline footnote text; it remains in the source snapshot but is not presented as part of the standalone poems. Verse physical line breaks and indentation are retained by this producer. Some lines may represent the edition's typographic wrapping; independent HTML comparison must decide whether the resulting presentation is acceptable. No hand correction of rejected candidates is permitted.

Poe's five exclusions with separate endnotes are *The Thousand-and-Second Tale of Scheherazade*, *A Descent into the Maelstrom*, *The Island of the Fay*, *The Domain of Arnheim*, and *Berenice*. The current contiguous-slice schema cannot faithfully include their distant notes. The additional over-length exclusions are *The Purloined Letter*, *The Fall of the House of Usher*, *The Pit and the Pendulum*, and *William Wilson*. *The Pit and the Pendulum* is 6050 whitespace-delimited source words; it is excluded rather than shortened to meet the limit. No missing letters in an edition's contents are copied over the actual complete story heading.

The existing renderer removes Gutenberg underscore italic markers for prose. Yeats poetry contains such markers too. If presentation removes these markers, that must apply consistently to poetry while retaining words, punctuation, case, line breaks, and stanza structure, and must still pass the independent critic. Literal underscore artifacts should not be misrepresented as original poem punctuation.

Producer inspection found two additional markup issues. Poe's *The Black Cat* has the paired sequence `_a brute beast _` with whitespace before the closing delimiter; a general paired-marker parser may remove the two delimiters while preserving all enclosed text and whitespace. Tagore's *Soul Consciousness* has an unclosed italic opening marker before a passage with inline footnotes. It is excluded whole by an odd-delimiter-count rule; no missing marker or literary wording is invented.

De Quincey's title occupies three nonblank source lines separated by blank lines. The optional `headingStartLine` records the first `ON` line (75), while `headingLine` remains the final `IN MACBETH.` line (79). Its complete source title is validated across that range. The original body boundary remains unchanged; this additional heading metadata lets the independent comparator identify the complete title without changing literary text.

## Authorship, translations, and dates

Official Gutenberg metadata identifies original authors and dates: [Yeats, 1865–1939](https://www.gutenberg.org/ebooks/32233), [Poe, 1809–1849](https://www.gutenberg.org/ebooks/2148), [De Quincey, 1785–1859](https://www.gutenberg.org/ebooks/10708), [Tagore, 1861–1941](https://www.gutenberg.org/ebooks/6842). None of these source editions lists a separate translator on its title page or Gutenberg author metadata. That alone is not sufficient for Sadhana: its author's preface names the English-language contributors.

Tagore explicitly says the volume adapts ideas from Bengali discourses, using translations of some passages by Satish Chandra Roy and Ajit Kumar Chakravarti. *Realisation in Action* is translated from *Karma-yoga* by Surendra Nath Tagore. Ernest Rhys assisted with suggestions, revisions, and proofs. These credits must not be hidden by describing the English text as wholly unaided author translation.

- Satish Chandra Roy/Ray died 1904; Ajit Kumar Chakravarti died 1918: [Banglapedia, Ajit Kumar Chakravarty](https://en.banglapedia.org/index.php?title=Chakravarty%2C_Ajit_Kumar) records both dates (its Ajit birth date differs from other references; death date is consistent).
- Surendra Nath/Surendranath Tagore, 1872–1940: [Institut national d'histoire de l'art authority record](https://agorha.inha.fr/ark%3A/54721/1ba117f4-61e2-4da2-9a90-6198ac9aa154).
- Ernest Rhys, 1859–1946: [National Portrait Gallery](https://www.npg.org.uk/collections/search/person/mp03759/ernest-rhys?displayStyle=thumb).
- Publication of *Sadhana* in 1913: [Princeton Library's Bliss collection catalogue](https://static-prod.lib.princeton.edu/scsites/Bliss/_Main_Catalogue/Bliss_box06_S_Z.pdf). The retained source itself says 1916; the UI metadata explicitly distinguishes first publication from edition date.
- De Quincey essay first publication: [transcription of the October 1823 London Magazine text](https://durobrivis.net/macbeth/commentary/de-quincey-1823.pdf). The app uses the retained Gutenberg collected edition, not this different historical version.

Every credited contributor above died before 1956 and the retained historical editions predate 1931. The source-specific English wording is the chosen edition's wording; differences between original publication and later author/collected editions must not be described as an app rewrite.
