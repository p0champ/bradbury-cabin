"""Independent critic extractor: poems/stories/essays from Project Gutenberg HTML editions.

Run: python -I extract_world.py [sources_dir] [output_file]
Reads only HTML files in the sources folder (no network). Never edits them.
The work list is the WORKS table below: to add a batch, append rows to the table.

Method
------
1. The HTML is parsed with Python's HTMLParser into a tiny DOM.
2. The DOM is flattened into "blocks" (p, pre, h1-h6, div.stanza, and divs or
   blockquotes that hold text directly), in document order.
3. Every table row names heading blocks (so the title can be verified against the
   HTML), then an end block (exclusive).  The body is everything between.
4. Blocks become verse lines: <br> splits a paragraph, <pre> splits at newlines,
   div.stanza yields one line per <p> or span.iN; a stanza/paragraph is separated
   from the next by one blank line.  Page-number elements are dropped.
"""
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


# ---------------------------------------------------------------- tiny DOM
class Element:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def all(self, predicate=lambda n: True):
        for item in self.children:
            if isinstance(item, Element):
                if predicate(item):
                    yield item
                yield from item.all(predicate)

    def is_pagenum(self):
        return bool({'pagenum', 'pageno'} & set((self.attrs.get('class') or '').split()))

    def text(self):
        if self.is_pagenum():
            return ''
        if self.tag == 'br':
            return '\n'
        return ''.join(x.text() if isinstance(x, Element) else x for x in self.children)

    def break_text(self):
        if self.is_pagenum():
            return ''
        if self.tag == 'br':
            return '\x00'
        return ''.join(x.break_text() if isinstance(x, Element) else x for x in self.children)


class Reader(HTMLParser):
    VOID = {'br', 'hr', 'img', 'meta', 'link', 'input', 'wbr', 'source', 'area', 'base', 'col', 'embed'}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Element()
        self.feed(source)
        self.close()

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


# ---------------------------------------------------------------- helpers
def clean(text):
    return re.sub(r'\s+', ' ', text).strip()


def norm(text):
    """Loose form for title checks only (case, punctuation, spacing ignored)."""
    return re.sub(r'[\W_]+', '', text.casefold())


def wordcount(lines):
    return len(re.findall(r"\b[\w]+(?:[’'-][\w]+)*\b", ' '.join(lines)))


def indent_of(raw):
    """Printed indentation of a verse line: leading no-break spaces, else leading spaces."""
    lead = re.match(r'[\s\xa0]*', raw).group()
    tail = re.split(r'[\r\n]', lead)[-1]
    nbsp = sum(1 for ch in tail if ch in '\xa0     ')
    if nbsp:
        return nbsp
    return sum(2 if ch == '\t' else 1 for ch in tail if ch in ' \t')


FIGURE_CLASSES = {'figcenter', 'figleft', 'figright', 'figure', 'fig', 'illustration'}
BLOCK_TAGS = {'p', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}
CONTAINER_TAGS = {'div', 'blockquote', 'td', 'li', 'center'}
NESTED_BLOCKS = BLOCK_TAGS | CONTAINER_TAGS | {'table', 'ul', 'ol', 'dl', 'dd', 'dt'}


class Block:
    def __init__(self, el, kind):
        self.el, self.kind = el, kind

    def text(self):
        return clean(self.el.text())

    def ident(self):
        e = self.el
        return f"{e.tag}#{e.attrs.get('id', '')}" if e.attrs.get('id') else e.tag


def flatten(root):
    blocks = []

    def walk(node):
        for ch in node.children:
            if not isinstance(ch, Element):
                continue
            if ch.tag in ('script', 'style', 'head'):
                continue
            if ch.tag in BLOCK_TAGS:
                blocks.append(Block(ch, 'pre' if ch.tag == 'pre' else 'text'))
            elif ch.tag == 'div' and {'stanza', 'group'} & set((ch.attrs.get('class') or '').split()):
                blocks.append(Block(ch, 'stanza'))
            elif ch.tag in CONTAINER_TAGS:
                nested = any(True for _ in ch.all(lambda n: n.tag in NESTED_BLOCKS))
                if not nested and (clean(ch.text()) or any(
                        isinstance(c, Element) and c.tag == 'br' for c in ch.children)):
                    blocks.append(Block(ch, 'text'))
                else:
                    walk(ch)
            else:
                walk(ch)

    walk(root)
    return blocks


def matches(block, m):
    e = block.el
    if 'tag' in m and e.tag != m['tag']:
        return False
    if 'id' in m:
        ids = {e.attrs.get('id')} | {d.attrs.get('id') for d in e.all(lambda n: 'id' in n.attrs)}
        if m['id'] not in ids:
            return False
    if 'class' in m and m['class'] not in (e.attrs.get('class') or '').split():
        return False
    if 'text' in m and block.text() != m['text']:
        return False
    if 'startswith' in m and not block.text().startswith(m['startswith']):
        return False
    if 'contains' in m and m['contains'] not in block.text():
        return False
    return True


def find(blocks, m, start):
    for i in range(start, len(blocks)):
        if matches(blocks[i], m):
            return i
    raise LookupError(f'no block matches {m} after block {start}')


def block_lines(block):
    """Return [(text, indent)], '' entries for blank lines inside the block."""
    el, out = block.el, []
    if block.kind == 'stanza':
        cls_re = re.compile(r'(?<![\w-])(?:i(\d+)|in(\d+)em)(?![\w-])')

        def is_line(n):
            if n.tag == 'p':
                return True
            return n.tag in ('span', 'div') and cls_re.search(n.attrs.get('class', '')) is not None

        for n in el.all(is_line):
            t = clean(n.text())
            if not t:
                continue
            m = cls_re.search(n.attrs.get('class', ''))
            out.append((t, int(m.group(1) or m.group(2)) if m else 0))
        if not out:
            # unclassed lines: leaf child divs (div.line / bare div), else <br>-separated text
            leaf = [n for n in el.all(lambda n: n.tag == 'div' and not any(
                isinstance(c, Element) and c.tag == 'div' for c in n.children))]
            if leaf:
                out = [(clean(n.text()), 0) for n in leaf if clean(n.text())]
            else:
                out = [(clean(x), 0) for x in el.break_text().split('\x00') if clean(x)]
        return out
    if block.kind == 'pre':
        raw = el.text().strip('\r\n')
        parts = raw.splitlines()
    else:
        parts = el.break_text().split('\x00')
    for part in parts:
        t = clean(part)
        out.append((t, indent_of(part) if t else 0))
    while out and not out[0][0]:
        out.pop(0)
    while out and not out[-1][0]:
        out.pop()
    return out


# ---------------------------------------------------------------- the work table
# heading: sequential matchers; the last one ends the heading.  end: exclusive end block.
# Optional: start_inclusive/start_after_text (title sits inside a text block),
# end_inclusive/end_before_text (next title sits at the end of a block),
# marker_regex / markers / line_markers (in-work headings or labels: go to sectionMarkers, not lines), indent_base ('min'),
# indent_pre_only (indent of plain text blocks is source pretty-printing, so 0).
WORKS = [
    dict(gid=5432, author='Horace', kind='poem', title='EHEU, FUGACES.',
         heading=[dict(tag='h5', text='EHEU, FUGACES.')],
         end=dict(tag='h2', id='id00177'),
         note='Ode II.14 between h5 EHEU, FUGACES. and the h2 numeral XV. that opens the next ode. '
              'One p of 28 verse lines; the HTML has no stanza separators (only the alternating nbsp indent 5/7 '
              'shows the 4-line stanzas), so none are inserted. Indent = count of leading no-break spaces.'),
    dict(gid=18044, author='The Archpoet', kind='poem', title='THE CONFESSION OF GOLIAS. No. 5.',
         heading=[dict(tag='h2', id='THE_CONFESSION_OF_GOLIAS'), dict(tag='h3', text='No. 5.')],
         end=dict(tag='h2', text='XIV.'),
         note='Poem is div.poem of div.stanza blocks (class i0/i2 per verse line); inline pagenum spans dropped; '
              'ends at last stanza before the h2 XIV. (Symonds prose).'),
    dict(gid=10121, author='Maisun bint Bahdal', kind='poem', title='THE SONG OF MAISUNA[8]',
         heading=[dict(tag='h4', id='id00199')],
         end=dict(tag='p', id='id00205'),
         note='Five 4-line stanzas (one p each). Editor footnote [8] (p id00205) excluded. Indent = count of leading '
              'ordinary spaces printed in the source (2 / 4); they collapse in a browser.'),
    dict(gid=11533, author='Theocritus', kind='poem', title='IDYLL XV. The Festival of Adonis.',
         heading=[dict(tag='h2', text='IDYLL XV.'), dict(tag='div', text='The Festival of Adonis.')],
         end=dict(tag='h2', text='IDYLL XVI.'), indent_pre_only=True,
         note='Dialogue idyll. Body = italic cast line (GORGO. PRAXINOÄ.) then div.stanza blocks; speaker names are '
              'their own lines. Verse lines are p elements (transcriber wraps inside a p collapsed to one line); '
              'indent from class iN. Includes the embedded Song (class i2).'),
    dict(gid=390, author='Du Fu', kind='poem', title='The Recruiting Sergeant',
         heading=[dict(tag='p', id='id00209')],
         end=dict(tag='p', id='id00214'),
         note='Poem paragraphs plus the ". . . . ." gap marker paragraph (kept as a line) and the asterisk note under '
              'the poem (p id00213: em-dash rules, "*  All words ending in `ao\' ... etc."). The note has no <br>, so '
              'the DOM view is one line; the source file breaks it over 4 raw lines (dash, two text lines, dash). '
              'Indent = count of leading nbsp (two half-line continuations) .'),
    dict(gid=390, author='Bai Juyi', kind='poem', title='The Lute Girl',
         heading=[dict(tag='p', id='id00283')],
         end=dict(tag='p', id='id00294'),
         note='Includes the editor lead-in sentence, the poet\'s own prose preface (as printed), the ". . . . ." gap '
              'markers and the verse proper (id00291 and id00293). Prose paragraphs have no <br>, so each is one line '
              '(source hard wraps collapsed). Indent = count of leading ordinary spaces in the source line.'),
    dict(gid=246, author='Omar Khayyam', kind='poem', title='First Edition',
         heading=[dict(tag='h2', text='First Edition')],
         end=dict(tag='h2', text='Fifth Edition'),
         marker_regex=r'[IVXLC]+\.', markers=[dict(tag='pre', startswith='KUZA')], expect_markers=76, indent_base='min', indent_pre_only=True,
         note='75 quatrains (one <pre> each). The 75 printed Roman numerals (I.-LXXV.) and the interior sub-heading '
              'KUZA—NAMA. ("Book of Pots") (its own <pre>, between LVIII and LIX) are in sectionMarkers, not in lines '
              '(76 markers). The closing colophon TAMAM SHUD. (a p under LXXV) stays in lines as a final one-line stanza. '
              'Indent = leading spaces in the pre minus the common margin of 1.'),
    dict(gid=27401, author='François Villon', kind='poem',
         title='THE EPITAPH IN FORM OF A BALLAD WHICH VILLON MADE FOR HIMSELF AND HIS COMRADES, EXPECTING TO BE HANGED ALONG WITH THEM',
         heading=[dict(tag='h4', text='THE EPITAPH IN FORM OF A BALLAD'), dict(tag='h5', startswith='WHICH VILLON')],
         end=dict(tag='h2', id='FROM_VICTOR_HUGO'),
         note='Three 10-line stanzas plus a 5-line envoi; a blank <br> = stanza break. Indent = leading '
              'ordinary spaces (3 / 0); a pagenum span inside a line dropped.'),
    dict(gid=1365, author='Jorge Manrique', kind='poem', title='COPLAS DE MANRIQUE',
         heading=[dict(tag='h3', id='chap523')],
         end=dict(tag='h3', id='chap524'), indent_pre_only=True,
         note='Heading is "FROM THE SPANISH / COPLAS DE MANRIQUE" (h3 with <br>). IMPORTANT: this edition prints every '
              'stanza as one run-on <p> (verse lines are NOT separated in the HTML, only capitalised mid-sentence), so '
              'each stanza is a single entry in lines. Text is complete; line structure is not recoverable from this HTML.'),
    dict(gid=10314, author='Michelangelo Buonarroti', kind='poem', title='TO GIOVANNI DA PISTOJA.',
         heading=[dict(tag='h5', id='id00100')],
         end=dict(tag='h3', id='id00104'),
         note='Body = italic subtitle (ON THE PAINTING OF THE SISTINE CHAPEL.), italic Italian first line, then the 20-line '
              'sonnet (single p, no stanza breaks in the HTML). The h3 numeral V. before the title is excluded; VI. is the end '
              'boundary. Indent = leading ordinary spaces (0/4/8).'),
    dict(gid=1287, author='Johann Wolfgang von Goethe', kind='poem', title='PROMETHEUS.',
         heading=[dict(tag='p', id='id03423')], start_inclusive=True, start_after_text='PROMETHEUS.',
         end=dict(tag='p', id='id03431'), end_inclusive=True, end_before_text='GANYMEDE.',
         note='Title is printed at the end of the previous paragraph (after "1774.*" and a rule), so the body starts '
              'after that title string. Seven stanzas (p each), then the date 1773. (p id03431) which is included; the '
              'rule "——-" and the next title GANYMEDE. in that paragraph are cut off.'),
]


# ---------------------------------------------------------------- batch 2 (poems + one story)
WORKS += [
    dict(gid=54991, author='Alexander Pushkin', kind='poem', title='THE PROPHET.',
         heading=[dict(tag='p', contains='THE PROPHET. IV. 19.')], start_inclusive=True, start_after_text='THE PROPHET.',
         end=dict(tag='h3', text='Poems: Narrative.'), line_markers=[r'IV\. 19\.'],
         note='The poem sits inside one large p of many poems separated by <br>; the body starts after the title line and '
              'ends at the p end, before the h3 "Poems: Narrative.". The printed edition reference "IV. 19." under the title is '
              'a sectionMarker (before line 0), not a line. The date "1826." is kept as the last line. Page-number spans dropped.'),
    dict(gid=6859, author='Morris Rosenfeld', kind='poem', title='In the Factory',
         heading=[dict(tag='h2', id='inthefactory')], end=dict(tag='h2', id='myboy'),
         note='Eight 8-line stanzas, one p each, lines split by <br>.'),
    dict(gid=214, author='Henry Lawson', kind='poem', title='Faces in the Street',
         heading=[dict(tag='h2', text='Faces in the Street')], end=dict(tag='h2', text='The Roaring Days'),
         indent_base='min',
         note='One <pre> block with blank lines between stanzas; leading single space of the pre removed (indent_base min).'),
    dict(gid=22833, author='Archibald Lampman', kind='poem', title='THE CITY OF THE END OF THINGS',
         heading=[dict(tag='h3', id='p3')], end=dict(tag='h3', id='p4'),
         note='div.stanza of p lines; indent from class inNem where present; p.pagenum dropped.'),
    dict(gid=64989, author='Claude McKay', kind='poem', title='HARLEM SHADOWS',
         heading=[dict(tag='h2', id='HARLEM_SHADOWS')], end=dict(tag='h2', id='THE_WHITE_CITY'),
         note='Three 6-line stanzas (span.i0/i2 lines); page-number spans dropped. The book title (h1) and contents are not used.'),
    dict(gid=2863, author='Thomas Hardy', kind='poem', title='CHANNEL FIRING',
         heading=[dict(tag='h3', id='page7')], end=dict(tag='h3', contains='CONVERGENCE'),
         note='Stanzas are p.poetry with <br> lines; the printed date line "April 1914." is kept as the last line; page-number spans '
              '(p. 7, p. 8) dropped. Source wraps inside a line collapsed.'),
    dict(gid=1280, author='Edgar Lee Masters', kind='poem', title='Lucinda Matlock',
         heading=[dict(tag='h2', id='chapM19')], end=dict(tag='h2', id='chapM18'),
         note='One p of 28 lines separated by <br>; no stanza breaks in the HTML.'),
    dict(gid=22403, author='Gerard Manley Hopkins', kind='poem', title='29 Felix Randal',
         heading=[dict(tag='p', id='id00259')], end=dict(tag='p', id='id00264'),
         note='Title is the italic p "29 / Felix Randal" (numeral + name, whitespace collapsed). Some long lines are continued on an '
              'indented next line ("handsome", "offended!", "sandal!"): they stay as separate lines exactly as printed, with indent 5 '
              '(no unwrappedLines view).'),
    dict(gid=18338, author='Paul Laurence Dunbar', kind='poem', title='WE WEAR THE MASK',
         heading=[dict(tag='h4', text='WE WEAR THE MASK')], end=dict(tag='h4', text='THE MEADOW LARK'),
         note='Three stanzas (5, 4, 6 lines); verse lines are div.iN inside div.stanza; indents 0/2 from the classes.'),
    dict(gid=7386, author='Anonymous Egyptian', kind='story', title='THE SHIPWRECKED SAILOR',
         heading=[dict(tag='p', contains='XIITH DYNASTY THE SHIPWRECKED SAILOR')], start_inclusive=True,
         end=dict(tag='p', contains='REMARKS This tale is only known in one copy'), end_inclusive=True,
         spans_mode=True, drop_span_classes=['font5'], stop_unit=r'REMARKS This tale',
         strip_prefix=[r'XIITH DYNASTY THE SHIPWRECKED SAILOR\s+', r'\d+ THE SHIPWRECKED SAILOR\s+(?=\S)'],
         strip_suffix=[r'\s7 81'],
         drop_units=[r'\d+ THE SHIPWRECKED SAILOR', r'THE SHIPWRECKED SAILOR \d+', r'REMARKS( \d+)?', r'\d+'],
         note='Scanned-page HTML: each page is a p of spans (one span = one paragraph, but a span can continue the previous page). '
              'Dropped by pattern: running heads ("82 THE SHIPWRECKED SAILOR", "THE SHIPWRECKED SAILOR 83", fused ones stripped from the '
              'front of text), figure captions (span.font5), trailing page number. The opening "XIITH DYNASTY THE SHIPWRECKED SAILOR" '
              'is removed as heading. Paragraphs split by a page break are rejoined (previous has no terminal punctuation and the '
              'next starts lower-case or "("). The first page ends "Hear me, my 7 81": "81" is the page number, "7" an unexplained '
              'stray digit; both removed. Tale ends with the scribe colophon ("This is finished ... health!"); the following REMARKS span is excluded.'),
]

# ---------------------------------------------------------------- batch 3 (stories)
WORKS += [
    dict(gid=2791, author='Joseph Addison', kind='story', title='THE VISION OF MIRZA.',
         heading=[dict(tag='h2', text='THE VISION OF MIRZA.')], end=dict(tag='h2', text='GENIUS.'),
         note='Includes the Latin epigraph (blockquote, lines split at <br>), its attribution, the English rendering and all paragraphs.'),
    dict(gid=5160, author='Anonymous Welsh', kind='story', title='THE DREAM OF MAXEN WLEDIG',
         heading=[dict(tag='h2', id='chap11')], end=dict(tag='h2', id='chap12'),
         note='Footnote reference [4] stays inline; the footnote text itself is printed at the end of the book, outside the range, so not included.'),
    dict(gid=13102, author='Giovanni Boccaccio', kind='story', title='NOVEL IX.',
         heading=[dict(tag='h4', id='id00155')], end=dict(tag='h4', id='id00166'),
         note='Fifth Day Novel IX (rubric p id00156 names Federigo degli Alberighi); starts with its rubric; ends before NOVEL X.'),
    dict(gid=51002, author='Im Bang', kind='story', title='CHARAN',
         heading=[dict(tag='h2', text='CHARAN', **{'class': 'main'})], end=dict(tag='h2', text='II', **{'class': 'label'}),
         note="Starts with Gale's bracketed headnote paragraph; ends with the signature paragraph \"Im Bang.\" Empty spacer paragraphs skipped."),
    dict(gid=62940, author='Sui Sin Far', kind='story', title='IN THE LAND OF THE FREE',
         heading=[dict(tag='h3', id='p161')], end=dict(tag='h3', id='p178'), marker_tags=['h4'],
         note='The h4 section numerals inside the story are sectionMarkers.'),
    dict(gid=27000, author='Hans Christian Andersen', kind='story', title='SHE WAS GOOD FOR NOTHING.',
         heading=[dict(tag='h2', text='SHE WAS GOOD FOR NOTHING.')], end=dict(tag='h2', text='"THERE IS A DIFFERENCE."'),
         note='Illustration caption div.figcenter skipped.'),
    dict(gid=1732, author='Anton Chekhov', kind='story', title='MISERY',
         heading=[dict(tag='h2', text='MISERY')], end=dict(tag='h2', text='CHAMPAGNE'),
         note='The h3 epigraph is kept as the first line.'),
    dict(gid=21040, author='Joaquim Maria Machado de Assis', kind='story', title="THE ATTENDANT'S CONFESSION",
         heading=[dict(tag='p', text="THE ATTENDANT'S CONFESSION", **{'class': 'chapter'})],
         end=dict(tag='p', text='THE FORTUNE-TELLER', **{'class': 'chapter'}),
         note='Starts with the two byline paragraphs (p.head).'),
    dict(gid=37242, author='Isaac Loeb Peretz', kind='story', title='I IF NOT HIGHER',
         heading=[dict(tag='h3', text='I IF NOT HIGHER')], end=dict(tag='h3', text='II DOMESTIC HAPPINESS'),
         note='The numeral II heading belongs to the next story and is excluded.'),
    dict(gid=1439, author='Olive Schreiner', kind='story', title='V. THREE DREAMS IN A DESERT.',
         heading=[dict(tag='h2', text='V. THREE DREAMS IN A DESERT.')], end=dict(tag='h2', text='VI. A DREAM OF WILD BEES.'),
         note='The h3 subtitle "Under a Mimosa-Tree." opens the body as the first line (as the spec requires).'),
]

# ---------------------------------------------------------------- batch 4 (stories + one essay)
WORKS += [
    dict(gid=27365, author='H. G. Wells', kind='story', title='THE STAR',
         heading=[dict(tag='h2', text='THE STAR')], end=dict(tag='div', text='A Story of the Stone Age', **{'class': 'bk5'}),
         note='Ends before the decorative title div of the next story.'),
    dict(gid=7144, author='Henry Lawson', kind='story', title="THE DROVER'S WIFE",
         heading=[dict(tag='h2', startswith='THE DROVER')], end=dict(tag='h2', startswith='STEELMAN'),
         note="Ends before the h2 for Steelman's Pupil."),
    dict(gid=46051, author='Horacio Quiroga', kind='story', title='THE ALLIGATOR WAR',
         heading=[dict(tag='h2', id='st5')], end=dict(tag='h2', id='st6'), note='Ends before the h2 HOW THE FLAMINGOES GOT THEIR STOCKINGS.'),
    dict(gid=44818, author='Selma Lagerlöf', kind='story', title='OUR LORD AND SAINT PETER',
         heading=[dict(tag='h2', id='story10')], end=dict(tag='h2', id='story11'),
         note='The separator rule (hr) before the next legend is not a block.'),
    dict(gid=1429, author='Katherine Mansfield', kind='story', title='Life of Ma Parker',
         heading=[dict(tag='h2', text='Life of Ma Parker')], end=dict(tag='h2', startswith='Marriage'), note=''),
    dict(gid=2814, author='James Joyce', kind='story', title='COUNTERPARTS',
         heading=[dict(tag='h2', text='COUNTERPARTS')], end=dict(tag='h2', text='CLAY'), note=''),
    dict(gid=11417, author='Marie de France', kind='story', title='VIII THE LAY OF THE WERE-WOLF',
         heading=[dict(tag='h2', text='VIII'), dict(tag='p', text='THE LAY OF THE WERE-WOLF')], end=dict(tag='h2', text='IX'),
         note='Heading is h2 "VIII" + p "THE LAY OF THE WERE-WOLF".'),
    dict(gid=416, author='Sherwood Anderson', kind='story', title='HANDS',
         heading=[dict(tag='h2', text='HANDS')], end=dict(tag='h2', text='PAPER PILLS'), note=''),
    dict(gid=68604, author='Mark Twain', kind='story', title='THE WAR PRAYER',
         heading=[dict(tag='h2', contains='THE WAR PRAYER')], start_inclusive=True, start_after_text='THE WAR PRAYER',
         end=dict(tag='h2', startswith='CORN-PONE'),
         note='The h2 reads "THE WAR PRAYER (Dictated 1904-05)"; the title is cut after "THE WAR PRAYER" so the body opens with "(Dictated 1904-05)".'),
    dict(gid=1657, author='Plato', kind='essay', title='CRITO',
         heading=[dict(tag='h2', text='CRITO')], end=dict(id='pg-end-separator'),
         note='Second CRITO heading (h2 after Jowett\'s introduction) to the PG end marker. In this HTML the "CRITO / BY / PLATO / TRANSLATED BY ..." '
              'title lines sit BEFORE the introduction, not after the second heading, so they are not in the body; the body opens with PERSONS OF THE DIALOGUE.'),
]

# ---------------------------------------------------------------- batch 5 (essays)
WORKS += [
    dict(gid=8021, author='Qoheleth', kind='essay', title='Book 21 Ecclesiastes',
         heading=[dict(tag='h1', text='Book 21 Ecclesiastes')], end=dict(id='pg-end-separator'),
         note='One paragraph per verse, with the printed verse label (21:001:001 ...) at the start of each.'),
    dict(gid=8882, author='Lafcadio Hearn', kind='essay', title='III A STREET SINGER',
         heading=[dict(tag='h3', text='III'), dict(tag='h5', text='A STREET SINGER')], end=dict(tag='h3', text='IV'), note=''),
    dict(gid=39713, author='Henri Poincaré', kind='essay', title='CHAPTER III MATHEMATICAL CREATION',
         heading=[dict(tag='h3', text='CHAPTER III'), dict(tag='h3', text='Mathematical Creation')],
         end=dict(tag='h3', text='CHAPTER IV'),
         note='Science and Method, Book I, Chapter III (h3 "CHAPTER III" + h3 "Mathematical Creation").'),
    dict(gid=6327, author='Lucian of Samosata', kind='essay', title='THE VISION A CHAPTER OF AUTOBIOGRAPHY',
         heading=[dict(tag='h3', text='THE VISION'), dict(tag='p', text='A CHAPTER OF AUTOBIOGRAPHY')], end=dict(tag='h3', text='A LITERARY PROMETHEUS'),
         note='Ends with the translator initial "H." (p.right).'),
    dict(gid=3600, author='Michel de Montaigne', kind='essay', title='CHAPTER VI USE MAKES PERFECT',
         heading=[dict(tag='h2', contains='USE MAKES PERFECT')], end=dict(tag='h2', contains='OF RECOMPENSES OF HONOUR'),
         note="Ends before the next chapter heading (CHAPTER VII, Of Recompenses of Honour); the editor's bookmark list named in the spec sits at the end of the whole book, not after this chapter."),
    dict(gid=23772, author='John Donne', kind='essay', title='XVII. MEDITATION.',
         heading=[dict(tag='p', text='XVII. MEDITATION.')], end=dict(tag='p', text='XVII. EXPOSTULATION.'),
         note='The Latin/English heading lines before the MEDITATION label are not part of the body.'),
    dict(gid=1080, author='Jonathan Swift', kind='essay', title='A Modest Proposal',
         heading=[dict(tag='h1', text='A Modest Proposal')], end=dict(id='pg-end-separator'),
         note='Body = subtitle (h3), byline (h2), date 1729 (h3) as lines, then the paragraphs.'),
    dict(gid=10732, author='Arthur Schopenhauer', kind='essay', title='ON NOISE.',
         heading=[dict(tag='h2', text='ON NOISE.')], end=dict(tag='h2', text='A FEW PARABLES.'), note=''),
    dict(gid=10343, author='Charles Lamb', kind='essay', title='THE SUPERANNUATED MAN',
         heading=[dict(tag='h2', id='id00700')], end=dict(tag='h2', id='id00722'),
         note='Starts with the epigraph "Sera tamen respexit Libertas." and its attribution "VIRGIL." (h5, kept as a line).'),
    dict(gid=914, author='Charles Dickens', kind='essay', title='XIII NIGHT WALKS',
         heading=[dict(tag='h2', text='XIII NIGHT WALKS')], end=dict(tag='h2', text='XIV CHAMBERS'), note=''),
]

# ---------------------------------------------------------------- batch 6 (essays)
WORKS += [
    dict(gid=16729, author='Thomas Henry Huxley', kind='essay', title='I. ON THE ADVISABLENESS OF IMPROVING NATURAL KNOWLEDGE.',
         heading=[dict(tag='h2', text='I.'), dict(tag='h3', text='ON THE ADVISABLENESS OF IMPROVING NATURAL KNOWLEDGE.')],
         end=dict(tag='h2', text='II.'), marker_tags=['h3'],
         note='The h3 "FOOTNOTE:" before the footnote is a sectionMarker; the footnote paragraph is the last line.'),
    dict(gid=48217, author='Maurice Maeterlinck', kind='essay', title='SILENCE',
         heading=[dict(tag='h2', text='SILENCE')], end=dict(tag='p', text='THE AWAKENING OF THE SOUL', **{'class': 'pc4'}),
         note='Ends before the half-title paragraph of the next essay.'),
    dict(gid=258, author='Marcus Clarke', kind='essay', title='PREFACE.',
         heading=[dict(tag='h2', text='PREFACE.')], end=dict(tag='h2', text='GENERAL CONTENTS.'),
         note='Includes the signature "Marcus Clarke." (a pre).'),
    dict(gid=71260, author='Miguel de Unamuno', kind='essay', title='SOLITUDE',
         heading=[dict(tag='h2', text='SOLITUDE')], end=dict(tag='h2', text='INTELLECTUALITY AND SPIRITUALITY'), note=''),
    dict(gid=79577, author='W. H. Hudson', kind='essay', title='XII CRISTIANO: A HORSE',
         heading=[dict(tag='p', id='c12'), dict(tag='h2', text='CRISTIANO: A HORSE')], end=dict(tag='p', id='c13'), note=''),
    dict(gid=20768, author='William James', kind='essay', title='XI THE MORAL EQUIVALENT OF WAR[1]',
         heading=[dict(tag='h2', id='id00354'), dict(tag='h5', id='id00355')], end=dict(tag='h2', id='id00387'),
         note='Includes the notes [1]-[4] printed after the essay (before XII).'),
    dict(gid=51018, author='Leo Tolstoy', kind='essay', title='SINGING IN THE VILLAGE',
         heading=[dict(tag='h2', id='singing')], end=dict(tag='h2', id='traveller'), note=''),
    dict(gid=1187, author='Jack London', kind='essay', title='HOW I BECAME A SOCIALIST',
         heading=[dict(tag='h2', text='HOW I BECAME A SOCIALIST')], end=dict(tag='h2', text='FOOTNOTES:'),
         note='The "* * * * *" section break paragraph is kept as a line.'),
    dict(gid=2162, author='Emma Goldman', kind='essay', title='MARRIAGE AND LOVE',
         heading=[dict(tag='h3', text='MARRIAGE AND LOVE')], end=dict(tag='h3', startswith='THE MODERN DRAMA'), note=''),
]


def source_file(src, gid):
    for name in (f'pg{gid}-images.html', f'pg{gid}.html'):
        if (src / name).exists():
            return name
    raise FileNotFoundError(f'no HTML for ebook {gid} in {src}')


def trim_start(pairs, text):
    for i, (t, ind) in enumerate(pairs):
        cut = t.find(text)
        if cut >= 0:
            rest = t[cut + len(text):].strip()
            return ([(rest, ind)] if rest else []) + pairs[i + 1:]
    raise ValueError(f'start_after_text {text!r} not found')


def trim_end(pairs, text):
    for i, (t, ind) in enumerate(pairs):
        cut = t.find(text)
        if cut >= 0:
            kept = re.sub(r'[\s—–\-_]+$', '', t[:cut])
            return pairs[:i] + ([(kept, ind)] if kept else [])
    raise ValueError(f'end_before_text {text!r} not found')


TERMINAL = ".!?\"”'’)]"


def extract_spans(entry, blocks, body, heading_blocks, heading_text, end_pos):
    """Scanned-page editions: paragraphs are <span>s inside page-sized <p>s.
    Drops running heads / captions / page numbers by pattern and rejoins paragraphs
    that a page break split (previous ends without terminal punctuation and the
    next begins lower-case or with a parenthesis). No words are added or changed."""
    units, stop = [], False
    for block in body:
        for ch in block.el.children:
            if not (isinstance(ch, Element) and ch.tag == 'span'):
                continue
            if set(ch.attrs.get('class', '').split()) & set(entry.get('drop_span_classes', [])):
                continue
            t = clean(ch.text())
            for r in entry.get('strip_prefix', []):
                t = re.sub('^' + r, '', t).strip()
            for r in entry.get('strip_suffix', []):
                t = re.sub(r + '$', '', t).strip()
            if entry.get('stop_unit') and re.match(entry['stop_unit'], t):
                stop = True
                break
            if not t or any(re.fullmatch(r, t) for r in entry.get('drop_units', [])):
                continue
            units.append(t)
        if stop:
            break
    paras = []
    for t in units:
        if paras and paras[-1][-1] not in TERMINAL and (t[0].islower() or t[0] == '('):
            paras[-1] += ' ' + t
        else:
            paras.append(t)
    lines, indents = [], []
    for t in paras:
        if lines:
            lines.append(''); indents.append(0)
        lines.append(t); indents.append(0)
    return build_result(entry, lines, indents, [], heading_blocks, blocks, end_pos), heading_text


def build_result(entry, lines, indents, markers, heading_blocks, blocks, end_pos, unwrapped=None):
    nonblank = [t for t in lines if t]
    result = dict(
        gutenbergId=entry['gid'], author=entry['author'], kind=entry['kind'], section='',
        title=entry['title'], lines=lines, indents=indents, complete=entry.get('complete', True),
        wordCount=wordcount(lines),
        boundaryProof=dict(
            start=f"{heading_blocks[-1].ident()}: {heading_blocks[-1].text()[:80]}",
            end=f"{blocks[end_pos].ident()}: {blocks[end_pos].text()[:80]}",
            first=nonblank[0] if nonblank else '', last=nonblank[-1] if nonblank else ''),
        note=entry['note'])
    if markers or entry['kind'] != 'poem':
        result['sectionMarkers'] = markers
    if unwrapped:
        result['unwrappedLines'] = unwrapped
    return result


def unwrap(lines, indents, min_indent):
    out, changed = [], False
    for t, ind in zip(lines, indents):
        if t and ind >= min_indent and out and out[-1]:
            out[-1] = out[-1] + ('' if out[-1].endswith('-') else ' ') + t
            changed = True
        else:
            out.append(t)
    return out if changed else None


def extract_one(entry, blocks, expected_title_ok):
    pos = 0
    heading_blocks = []
    for m in entry['heading']:
        pos = find(blocks, m, pos)
        heading_blocks.append(blocks[pos])
        pos += 1
    heading_text = ' '.join(b.text() for b in heading_blocks)
    if norm(entry['title']) not in norm(heading_text):
        raise ValueError(f"title mismatch: {entry['title']!r} not in {heading_text!r}")
    first_body = pos - 1 if entry.get('start_inclusive') else pos
    end_pos = find(blocks, entry['end'], pos)
    last_body = end_pos + 1 if entry.get('end_inclusive') else end_pos
    body = blocks[first_body:last_body]
    skip = entry.get('skip', [])
    prose = entry['kind'] != 'poem'
    if entry.get('spans_mode'):
        return extract_spans(entry, blocks, body, heading_blocks, heading_text, end_pos)

    marker_re = entry.get('marker_regex')
    line_marker_res = entry.get('line_markers', [])
    lines, indents, markers, pending, paras = [], [], [], [], []

    def put_marker(text):
        pending.append('subheading: ' + text)

    def put_line(t, ind):
        if not t:
            if lines and lines[-1]:
                lines.append(''); indents.append(0)
            return
        lines.append(t); indents.append(0 if prose else ind)
        for m in pending:
            markers.append(dict(beforeLine=len(lines) - 1, marker=m))
        pending.clear()

    for index, block in enumerate(body):
        if any(matches(block, m) for m in skip):
            continue
        if set((block.el.attrs.get('class') or '').split()) & FIGURE_CLASSES:
            continue
        pairs = block_lines(block)
        if index == 0 and entry.get('start_after_text'):
            pairs = trim_start(pairs, entry['start_after_text'])
        if index == len(body) - 1 and entry.get('end_before_text'):
            pairs = trim_end(pairs, entry['end_before_text'])
        if (entry.get('indent_pre_only') and block.kind == 'text') or block.el.tag.startswith('h'):
            pairs = [(t, 0) for t, _ in pairs]
        if not pairs:
            continue
        if block.el.tag in entry.get('marker_tags', ()):
            for t, _ in pairs:
                put_marker(t)
            continue
        if block.kind in ('text', 'pre') and len(pairs) == 1 and (
                (marker_re and re.fullmatch(marker_re, pairs[0][0])) or
                any(matches(block, m) for m in entry.get('markers', []))):
            put_marker(pairs[0][0])
            continue
        put_line('', 0)
        group = []
        for t, ind in pairs:
            if t and any(re.fullmatch(r, t) for r in line_marker_res):
                put_marker(t)
                continue
            put_line(t, ind)
            if t:
                group.append(t)
            elif group:
                paras.append(group)  # a blank line inside a block is a paragraph break
                group = []
        if group:
            paras.append(group)
    while lines and not lines[-1]:
        lines.pop(); indents.pop()
    for m in pending:
        markers.append(dict(beforeLine=len(lines), marker=m))
    if entry.get('indent_base') == 'min':
        base = min((n for t, n in zip(lines, indents) if t and n), default=0)
        indents = [max(n - base, 0) if t else 0 for t, n in zip(lines, indents)]
    if entry.get('expect_markers') is not None and len(markers) != entry['expect_markers']:
        raise ValueError(f"expected {entry['expect_markers']} section markers, got {len(markers)}")
    unwrapped = unwrap(lines, indents, entry['unwrap_indent']) if entry.get('unwrap_indent') else None
    if prose and not markers and any(len(g) > 1 for g in paras):  # comparator ignores sectionMarkers when unwrappedLines is present
        # secondary view: one entry per source paragraph (br-wrapped lines joined)
        unwrapped = []
        for g in paras:
            if unwrapped:
                unwrapped.append('')
            joined = g[0]
            for t in g[1:]:
                joined += ('' if joined.endswith('-') else ' ') + t
            unwrapped.append(joined)
    return build_result(entry, lines, indents, markers, heading_blocks, blocks, end_pos, unwrapped), heading_text


def stanza_count(lines):
    groups, cur = 0, False
    for t in lines:
        if t and not cur:
            groups += 1; cur = True
        elif not t:
            cur = False
    return groups


def extract(sources_directory=None):
    src = Path(sources_directory) if sources_directory else Path(__file__).parent / 'sources'
    sources, blocks_by_gid, works, notes = {}, {}, [], []
    for entry in WORKS:
        gid = entry['gid']
        if gid not in blocks_by_gid:
            name = source_file(src, gid)
            raw = (src / name).read_bytes()
            sources[str(gid)] = dict(url=f'https://www.gutenberg.org/cache/epub/{gid}/{name}',
                                     sha256=hashlib.sha256(raw).hexdigest(), format='html')
            blocks_by_gid[gid] = flatten(Reader(raw.decode('utf-8-sig')).root)
        work, heading_text = extract_one(entry, blocks_by_gid[gid], True)
        work['stanzaCount'] = stanza_count(work['lines'])
        work['lineCount'] = sum(1 for t in work['lines'] if t)
        works.append(work)
        notes.append(f"{gid} {entry['title'][:40]!r}: heading text in HTML = {heading_text!r}")
    notes.append('Critic extraction from Gutenberg HTML only; whitespace inside a line collapsed to one space and stripped; '
                 'pagenum elements dropped; no text typed or corrected by hand.')
    return dict(critic='independent', sources=sources, works=works, notes=notes)


if __name__ == '__main__':
    source_dir = sys.argv[1] if len(sys.argv) > 1 else None
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name('extraction-world.json')
    result = extract(source_dir)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps([dict(id=w['gutenbergId'], title=w['title'][:40], lines=w['lineCount'],
                           stanzas=w['stanzaCount'], words=w['wordCount'], complete=w['complete'])
                      for w in result['works']], ensure_ascii=False, indent=1))
