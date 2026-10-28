"""Independent Build031 audit. Reads only retained Gutenberg HTML, not production text.

Run: python extract_031.py [source_directory] [output_file]
The small DOM reader below is independently implemented with Python's HTMLParser.
"""
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class Element:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def all(self, predicate):
        for item in self.children:
            if isinstance(item, Element):
                if predicate(item):
                    yield item
                yield from item.all(predicate)

    def text(self):
        if self.attrs.get('class') == 'pagenum':
            return ''
        if self.tag == 'br':
            return '\n'
        return ''.join(x.text() if isinstance(x, Element) else x for x in self.children)

    def break_text(self):
        if self.tag == 'br':
            return '\x00'
        if self.attrs.get('class') == 'pagenum':
            return ''
        return ''.join(x.break_text() if isinstance(x, Element) else x for x in self.children)


class Reader(HTMLParser):
    VOID = {'br', 'hr', 'img', 'meta', 'link', 'input', 'wbr', 'source', 'area', 'base', 'col', 'embed'}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Element()
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in self.VOID:
            self.current = node

    def handle_endtag(self, tag):
        candidate = self.current
        while candidate.parent is not None and candidate.tag != tag:
            candidate = candidate.parent
        if candidate.parent is not None:
            self.current = candidate.parent

    def handle_data(self, data):
        self.current.children.append(data)


def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def wordcount(lines):
    return len(re.findall(r"\b[\w]+(?:[’'-][\w]+)*\b", ' '.join(lines)))


def work(gid, author, kind, title, lines, bounds, **extra):
    return dict(gutenbergId=gid, author=author, kind=kind, section='', title=title,
                lines=lines, indents=[0] * len(lines), complete=True,
                wordCount=wordcount(lines), boundaryProof=dict(start=bounds[0], end=bounds[1],
                  first=next((x for x in lines if x), ''), last=next((x for x in reversed(lines) if x), '')),
                note='Full heading-bounded work extracted independently from retained Gutenberg HTML.', **extra)


def flat_blocks(root):
    return list(root.all(lambda n: n.tag in {'p', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}))


def paragraphs(nodes):
    result = []
    for node in nodes:
        if node.tag == 'p':
            parts = [clean(part) for part in node.break_text().split('\x00')]
            while parts and not parts[-1]:
                parts.pop()
            if any(parts):
                if result:
                    result.append('')
                result.extend(parts)
        elif node.tag == 'pre':
            text = node.text().strip('\r\n')
            if text.strip():
                if result:
                    result.append('')
                result.extend(line.strip() for line in text.splitlines())
    return result


def extract(sources_directory=None):
    src = Path(sources_directory) if sources_directory else Path(__file__).parent / 'sources'
    sources, roots, works, notes = {}, {}, [], []
    for gid in [32233, 2148, 10708, 6842]:
        name = f'pg{gid}-images.html'
        raw = (src / name).read_bytes()
        sources[str(gid)] = dict(url=f'https://www.gutenberg.org/cache/epub/{gid}/{name}',
                                sha256=hashlib.sha256(raw).hexdigest(), format='html')
        roots[gid] = Reader(raw.decode('utf-8-sig')).root

    # Yeats: every h2 between the first actual poem and NOTES; stanza and verse-span DOM.
    root = roots[32233]
    elements = list(root.all(lambda n: True))
    heads = [n for n in elements if n.tag == 'h2']
    start = next(i for i, n in enumerate(heads) if clean(n.text()) == 'THE HOSTING OF THE SIDHE')
    end = next(i for i, n in enumerate(heads) if clean(n.text()) == 'NOTES')
    for idx in range(start, end):
        head, following = heads[idx], heads[idx + 1]
        interval = elements[elements.index(head) + 1:elements.index(following)]
        stanzas = [n for n in interval if n.tag == 'div' and n.attrs.get('class') == 'stanza']
        lines, indents = [], []
        for stanza in stanzas:
            if lines:
                lines.append(''); indents.append(0)
            for line in stanza.all(lambda n: n.tag == 'span' and re.fullmatch(r'i\d+', n.attrs.get('class', ''))):
                lines.append(clean(line.text()))
                indents.append(int(line.attrs['class'][1:]))
        entry = work(32233, 'W. B. Yeats', 'poem', clean(head.text()), lines,
                     (clean(head.text()), clean(following.text())))
        entry['indents'] = indents
        works.append(entry)
    notes.append('32233: title page explicitly FOURTH EDITION, MDCCCCIII (1903). This is not evidence of the exact 1899 text. All 37 poems precede NOTES; page numbers and the separate explanatory NOTES excluded, stanza boundaries and class iN indents retained.')

    # Poe: actual story anchors chap2.1 through .22, bounded by next anchored h2.
    blocks = flat_blocks(roots[2148])
    # The source collects original-looking referenced notes separately after all stories.
    # Extract only narrative here, but never certify it as a complete full work if those
    # associated notes have been left out. Their headings provide independent evidence.
    note_heading_to_title = {
        'Notes — Scheherazade': 'THE THOUSAND-AND-SECOND TALE OF SCHEHERAZADE',
        'Notes—Maelstrom': 'A DESCENT INTO THE MAELSTROM.',
        'Notes—Island of the Fay': 'THE ISLAND OF THE FAY',
        'Notes — Domain of Arnheim': 'THE DOMAIN OF ARNHEIM',
        'Notes—Berenice': 'BERENICE',
    }
    separate_notes = {}
    for note_pos, node in enumerate(blocks):
        heading = clean(node.text())
        if node.tag == 'h3' and heading in note_heading_to_title:
            stop = next((i for i in range(note_pos + 1, len(blocks))
                         if blocks[i].tag.startswith('h')), len(blocks))
            note_lines = paragraphs(blocks[note_pos + 1:stop])
            separate_notes[note_heading_to_title[heading]] = dict(
                heading=heading, wordCount=wordcount(note_lines),
                first=next((x for x in note_lines if x), ''),
                last=next((x for x in reversed(note_lines) if x), ''))
    heads = [(i, n) for i, n in enumerate(blocks) if n.tag == 'h2' and any(
        re.fullmatch(r'chap2\.\d+', a.attrs.get('id', '')) for a in n.all(lambda a: a.tag == 'a'))]
    for (pos, head), (nextpos, following) in zip(heads, heads[1:]):
        lines = paragraphs(blocks[pos + 1:nextpos])
        count = wordcount(lines)
        title = clean(head.text())
        if count <= 6000:
            entry = work(2148, 'Edgar Allan Poe', 'story', title, lines,
                         (title, clean(following.text())))
            if title in separate_notes:
                entry['complete'] = False
                entry['missingSourceNotes'] = separate_notes[title]
                entry['note'] = ('Narrative body is heading-bounded, but NOT a complete full work: '
                    'associated source notes under ' + separate_notes[title]['heading'] +
                    ' in NOTES TO THE SECOND VOLUME are omitted. Strict completeness gate must reject this extraction.')
            works.append(entry)
        else:
            notes.append(f'2148 excluded over 6000 words: {title} ({count} words including epigraph).')
    notes.append('2148: story epigraphs and embedded verse included. Separate NOTES TO THE SECOND VOLUME excluded; inline footnote-reference numerals retained, because they are present in story paragraphs. Scheherazade, Island of the Fay, Domain of Arnheim and Berenice are therefore explicitly complete:false, with source-note boundary evidence. Stories bounded solely by chap2 anchors.')

    # De Quincey: semantic section starts independently verified against the HTML contents.
    blocks = flat_blocks(roots[10708])
    ids = {n.attrs.get('id'): i for i, n in enumerate(blocks)}
    ranges = [('id00017', 'id00025', 'ON THE KNOCKING AT THE GATE, IN MACBETH.', 3),
              ('id00025', 'id00087', 'ON MURDER, CONSIDERED AS ONE OF THE FINE ARTS.', 2),
              ('id00087', 'id00126', 'SECOND PAPER ON MURDER, CONSIDERED AS ONE OF THE FINE ARTS.', 2),
              ('id00126', 'id00194', 'JOAN OF ARC', 2),
              ('id00194', 'id00250', 'THE ENGLISH MAIL-COACH; OR, THE GLORY OF MOTION.', 3),
              ('id00250', 'id00300', 'THE VISION OF SUDDEN DEATH.', 1),
              ('id00300', None, 'DINNER, REAL AND REPUTED.', 1)]
    for first, last, title, heading_count in ranges:
        startpos = ids[first]
        endpos = ids[last] if last else next(i for i, n in enumerate(blocks) if n.attrs.get('id') == 'pg-footer-heading')
        chosen = blocks[startpos + heading_count:endpos]
        lines = paragraphs(chosen)
        # Authorial notes printed within a bounded essay are part of that essay, not boilerplate.
        count = wordcount(lines)
        if count <= 6000 and first != 'id00250':
            entry = work(10708, 'Thomas De Quincey', 'essay', title, lines,
                         (first, last or 'pg-footer-heading'))
            entry['sectionMarkers'] = []
            linepos = 0
            for n in chosen:
                if n.tag.startswith('h'):
                    entry['sectionMarkers'].append(dict(beforeLine=linepos, marker='subheading: ' + clean(n.text())))
                elif n.tag == 'p' and clean(n.text()):
                    linepos += len(paragraphs([n])) + (1 if linepos else 0)
            works.append(entry)
        else:
            notes.append(f'10708 excluded {title} ({count} words): ' + ('linked Vision/Dream-Fugue sequence is not a standalone short essay.' if first == 'id00250' else 'over 6000 words.'))
    notes.append('10708: inline [Footnote N: ...] paragraphs and references retained. Knocking is bounded id00017 through preceding id00025. No modern editorial prose added.')
    notes.append('10708 independent re-audit: Second Paper on Murder ends at id00125 immediately before Joan of Arc id00126, including both Latin chorus lines and internal CHORUS heading marker. No separately titled notes for Second Paper occur in this HTML. Knocking includes its authorial Footnote 1 paragraph at id00022. These two essay extractions have no identified omitted associated notes.')

    # Sadhana: numbered chapter title headings, not the combined contents list.
    blocks = flat_blocks(roots[6842])
    chapter_ids = ['id00020', 'id00062', 'id00096', 'id00125', 'id00183', 'id00231', 'id00261', 'id00284']
    for index, hid in enumerate(chapter_ids):
        pos = next(i for i, n in enumerate(blocks) if n.attrs.get('id') == hid)
        stop = next((i for i in range(pos + 1, len(blocks)) if blocks[i].tag in {'h2', 'h3'}), len(blocks))
        lines = paragraphs(blocks[pos + 1:stop])
        title = clean(blocks[pos].text())
        if wordcount(lines) <= 6000:
            works.append(work(6842, 'Rabindranath Tagore', 'essay', title, lines,
                              (hid, blocks[stop].attrs.get('id', '') if stop < len(blocks) else 'end')))
        else:
            notes.append(f'6842 excluded over 6000 words: {title} ({wordcount(lines)}).')
    notes.extend([
        '6842: English title page explicitly dated 1916, not 1913; this source alone does not establish exact 1913 first-edition text. Preface id00014 credits translated passages by Babu Satish Chandra Roy and Babu Ajit Kumar Chakravarti, and Realisation in Action from Karma-yoga by Babu Surendra Nath Tagore; id00015 credits Ernest Rhys suggestions/revisions/proofs. Therefore this is historical collaborative English text, not a new translation. Inline bracketed footnotes retained.',
        'Gutenberg primary ebook metadata independently checked: Yeats 1865-1939 (#32233); Poe 1809-1849 (#2148); De Quincey 1785-1859 (#10708); Tagore 1861-1941 (#6842). Each metadata page labels its edition public domain in the USA. This alone does not establish worldwide rights for all translation contributors.',
        'Independent word counts use Unicode word tokens allowing internal apostrophes and hyphens; this can differ slightly from whitespace counts. HTML whitespace collapsed only within prose paragraphs and source verse spans. No text sourced from producer files.'
    ])
    return dict(critic='independent', sources=sources, works=works, notes=notes)


if __name__ == '__main__':
    source_dir = sys.argv[1] if len(sys.argv) > 1 else None
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name('extraction-031.json')
    result = extract(source_dir)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(dict(works=len(result['works']), bySource={str(g): sum(w['gutenbergId'] == g for w in result['works']) for g in [32233, 2148, 10708, 6842]}, notes=result['notes']), ensure_ascii=False, indent=2))
