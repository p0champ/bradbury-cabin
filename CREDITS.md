# Texts and type

The seven bundled complete works come from the critic-accepted source catalogue (see [SOURCE_CATALOGUE.md](SOURCE_CATALOGUE.md)); `tools/extract_library.py` copies their texts unchanged. Prose source wrapping is joined. Words, capitalization and punctuation are those of the current Project Gutenberg editions, retrieved 28 October 2026. Poetry line breaks, stanza divisions and stepped indents are retained. Another printed edition can differ editorially.

- William Blake, **The Sick Rose**: *Songs of Innocence and of Experience*, edited by R. Brimley Johnson (1901), [Project Gutenberg #1934](https://www.gutenberg.org/ebooks/1934).
- Walt Whitman, **When I Heard the Learn’d Astronomer** and **O Captain! My Captain!**: *Leaves of Grass*, [Project Gutenberg #1322](https://www.gutenberg.org/ebooks/1322).
- O. Henry, **The Gift of the Magi**: *The Four Million*, [Project Gutenberg #2776](https://www.gutenberg.org/ebooks/2776). The labelled sampler shows two whole paragraphs of this edition.
- Kate Chopin, **Désirée’s Baby**: *The Awakening and Selected Short Stories*, [Project Gutenberg #160](https://www.gutenberg.org/ebooks/160).
- Francis Bacon, **Of Studies** and **Of Truth**: *The Essays or Counsels, Civil and Moral*, [Project Gutenberg #575](https://www.gutenberg.org/ebooks/575).

The sampler's Blake poem is the same #1934 text, with its indents. A unit test checks both sampler excerpts against the shelf.

All these authors died more than 70 years ago. Only the underlying public-domain literary text is displayed; source snapshots retain their original notices for auditability.

**Literata**, Google Fonts / TypeTogether: bundled unmodified variable font under SIL Open Font License 1.1. See [assets/Literata-OFL.txt](assets/Literata-OFL.txt) and the [official source](https://github.com/google/fonts/tree/main/ofl/literata). The interface uses installed device sans-serif fonts.

The skip icons, hold rings, paper-and-gold welcome leaves, hand-entry orbit and hand labels are original procedural Canvas artwork. The welcome chime and background sound are synthesized, without third-party recordings.

## Build 031 daily-source additions

- W. B. Yeats, The Wind Among the Reeds, fourth edition1903 (collection first1899), [Project Gutenberg32233](https://www.gutenberg.org/ebooks/32233):35 accepted complete poems; two differing transcriptions remain excluded.
- Edgar Allan Poe, The Works of Edgar Allan Poe, Raven edition, volumeII, [Project Gutenberg2148](https://www.gutenberg.org/ebooks/2148):13 complete stories; over-length works and works requiring distant source notes excluded whole.
- Thomas De Quincey, On the Knocking at the Gate, in Macbeth (first1823), collected in Miscellaneous Essays, [Project Gutenberg10708](https://www.gutenberg.org/ebooks/10708). Inline footnote retained.
- Rabindranath Tagore, Sadhana, the Realisation of Life, source edition1916 (first1913), [Project Gutenberg6842](https://www.gutenberg.org/ebooks/6842):seven complete essays. The source preface credits translated passages by Satish Chandra Roy and Ajit Kumar Chakravarti; Realisation in Action is translated by Surendra Nath Tagore; Ernest Rhys assisted revisions and proofs. These historical English contributions are part of the identified edition. Source-specific dates and authority links are retained in tools/EXPANSION_031_NOTES.md.

Raw full-book snapshots and separate critic HTML downloads are retained unchanged for provenance. Only independently accepted complete works enter the reader; unsupported source markup and differing words/verse structure are not repaired by model generation.
