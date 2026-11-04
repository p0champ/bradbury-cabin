"""Independent critic extractor, French batch: Daudet, Hugo, Rimbaud from Project Gutenberg HTML.

Run: python -I extract_french.py [sources_dir] [output_file]
Reads only the HTML files in the sources folder (no network). Never edits them.

Method (adapted from the previous critic's extractor, same output format)
------
1. The HTML is parsed with Python's HTMLParser into a tiny DOM.
2. The DOM is flattened into "blocks" (p, pre, h1-h6, div.stanza / div.group, and
   divs or blockquotes that hold text directly), in document order.
3. Every table row names heading blocks (so the title is verified against the HTML),
   optional 'locate' blocks (skipped, used only to find the right book of an ebook),
   then an end block (exclusive).  The body is everything between.
4. Prose: one entry per paragraph (<br> splits a paragraph into lines, paragraphs are
   separated by ''), poems: one entry per verse line, '' between stanzas.
   Hugo editions: div.stanza of p.iN lines, a bare <br> between p's (or a doubled <br>
   inside a p) is the stanza break; indent = class number minus the poem's smallest.
   Rimbaud edition: whole sections are one <p> of <br>-separated lines; a poem is the
   lines between its printed title line and the next printed title line; indent from
   span margin-left (em) when present.
   Page-number elements (span.pagenum / pageno) and footnote reference marks
   (a.pginternal around <sup>, "(retour)" back-links) are dropped.
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

    def classes(self):
        return set((self.attrs.get('class') or '').split())

    def skipped(self):
        """Page numbers and footnote reference marks are not literary text."""
        if {'pagenum', 'pageno'} & self.classes():
            return True
        if self.tag == 'a' and 'pginternal' in self.classes():
            inner = ''.join(x.raw() if isinstance(x, Element) else x for x in self.children).strip()
            if any(isinstance(c, Element) and c.tag == 'sup' for c in self.children) or inner == '(retour)':
                return True
        return False

    def raw(self):
        return ''.join(x.raw() if isinstance(x, Element) else x for x in self.children)

    def skip_text(self):
        """What a dropped element leaves behind: a back-link keeps one space (it sat between words)."""
        return ' ' if self.raw().strip() == '(retour)' else ''

    def text(self):
        if self.skipped():
            return self.skip_text()
        if self.tag == 'br':
            return '\n'
        return ''.join(x.text() if isinstance(x, Element) else x for x in self.children)

    def break_text(self):
        if self.skipped():
            return self.skip_text()
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
    nbsp = sum(1 for ch in tail if ch in '\xa0     ')
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
            elif ch.tag == 'div' and {'stanza', 'group'} & ch.classes():
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
    if 'class' in m and m['class'] not in e.classes():
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


MARGIN = re.compile(r'margin-left:\s*([\d.]+)\s*(em|%)?')


def br_items(el):
    """Split an element at <br> into [(text, indent)].  Indent: margin-left (em) of a span that
    opens the line, else leading no-break spaces / spaces printed in the source."""
    items, buf, margin = [], [], [None]

    def flush():
        raw = ''.join(buf)
        t = clean(raw)
        if t:
            ind = margin[0] if margin[0] is not None else indent_of(raw)
        else:
            ind = 0
        items.append((t, ind))
        buf.clear()
        margin[0] = None

    def walk(node):
        for ch in node.children:
            if not isinstance(ch, Element):
                buf.append(ch)
                continue
            if ch.skipped():
                buf.append(ch.skip_text())
                continue
            if ch.tag == 'br':
                flush()
                continue
            if ch.tag == 'span' and margin[0] is None and not ''.join(buf).strip():
                m = MARGIN.search(ch.attrs.get('style', ''))
                if m and m.group(2) in (None, 'em'):
                    v = float(m.group(1))
                    margin[0] = int(v) if v == int(v) else v
            walk(ch)

    walk(el)
    flush()
    # the piece after the last <br> is just the end of the element when empty
    if items and not items[-1][0]:
        items.pop()
    return items


CLS_RE = re.compile(r'(?<![\w-])(?:i(\d+)|in(\d+)em)(?![\w-])')


def stanza_items(el):
    """Hugo-style div.stanza: p lines, a bare <br> (or an empty segment inside a p) = stanza break."""
    out = []
    for ch in el.children:
        if isinstance(ch, str):
            if ch.strip():
                raise ValueError(f'loose text in stanza: {ch.strip()[:40]!r}')
            continue
        if ch.skipped():
            continue
        if ch.tag == 'br':
            out.append(('', 0))
        elif ch.tag in ('p', 'div', 'span'):
            m = CLS_RE.search(ch.attrs.get('class', ''))
            ind = int(m.group(1) or m.group(2)) if m else 0
            for t, _ in br_items(ch):
                out.append((t, ind if t else 0))
        else:
            raise ValueError(f'unexpected element {ch.tag} in stanza')
    return out


def block_lines(block):
    """Return [(text, indent)], '' entries for blank lines inside the block."""
    el = block.el
    if block.kind == 'stanza':
        out = stanza_items(el)
    elif block.kind == 'pre':
        out = []
        for part in el.text().strip('\r\n').splitlines():
            t = clean(part)
            out.append((t, indent_of(part) if t else 0))
    else:
        out = br_items(el)
    while out and not out[0][0]:
        out.pop(0)
    while out and not out[-1][0]:
        out.pop()
    return out


# ---------------------------------------------------------------- the work table
# locate: matchers used only to position the search (not part of the title).
# heading: sequential matchers; their joined text must contain the TITLE.  end: exclusive end block.
# Options: marker_tags (tags whose text goes to sectionMarkers), marker_regex / markers (single-line
# blocks that are in-work headings), expect_markers, inblock (Rimbaud: poem is a range of lines of one block).
D = 'Alphonse Daudet'
H = 'Victor Hugo'
R = 'Arthur Rimbaud'


def h3(**kw):
    return dict(tag='h3', **kw)


WORKS = [
    dict(gid=11770, author=D, kind='story', title='LES ÉTOILES',
         heading=[h3(text='LES ÉTOILES')], end=h3(text="L'ARLÉSIENNE"), marker_tags=['h3'],
         note="Subtitle h3 \"RÉCIT D'UN BERGER PROVENÇAL.\" is a sectionMarker (before line 0). Author's footnote 2 (a blockquote div "
              "between two paragraphs of the dialogue) is kept as its own paragraph exactly as the "
              "HTML shows it, starting \"Footnote 2:\"; the footnote reference digit inside the text and the \"(retour)\" back-link are dropped. "
              "Empty spacer divs skipped."),
    dict(gid=11770, author=D, kind='story', title="L'ARLÉSIENNE",
         heading=[h3(text="L'ARLÉSIENNE")], end=h3(text='LA MULE DU PAPE'), note='Between h3 L\'ARLÉSIENNE and h3 LA MULE DU PAPE.'),
    dict(gid=11770, author=D, kind='story', title='LE SECRET DE MAITRE CORNILLE',
         heading=[h3(text='LE SECRET DE MAITRE CORNILLE')], end=h3(text='LA CHÈVRE DE M. SEGUIN'),
         note='Between h3 LE SECRET DE MAITRE CORNILLE and h3 LA CHÈVRE DE M. SEGUIN.'),
    dict(gid=11770, author=D, kind='story', title='LE CURÉ DE CUCUGNAN.',
         heading=[h3(text='LE CURÉ DE CUCUGNAN.')], end=h3(text='LES VIEUX.'),
         note='Between h3 LE CURÉ DE CUCUGNAN. and h3 LES VIEUX. Lines inside a paragraph that the HTML breaks with <br> are kept as lines (see unwrappedLines).'),
    dict(gid=11770, author=D, kind='story', title='I LA MORT DU DAUPHIN.',
         locate=[h3(text='BALLADES EN PROSE')],
         heading=[dict(tag='p', text='I'), dict(tag='p', text='LA MORT DU DAUPHIN.')], end=dict(tag='p', text='II'),
         note='First ballad: numeral p "I" + p "LA MORT DU DAUPHIN." are the heading; the unnumbered introductory '
              'paragraph under the h3 BALLADES EN PROSE is not part of it. Ends before the numeral p "II".'),
    dict(gid=11770, author=D, kind='story', title='II LE SOUS-PRÉFET AUX CHAMPS.',
         locate=[h3(text='BALLADES EN PROSE')],
         heading=[dict(tag='p', text='II'), dict(tag='p', text='LE SOUS-PRÉFET AUX CHAMPS.')],
         end=h3(text='LE PORTEFEUILLE DE BIXIOU'),
         note='Second ballad: numeral p "II" + p "LE SOUS-PRÉFET AUX CHAMPS."; ends before h3 LE PORTEFEUILLE DE BIXIOU.'),
    dict(gid=11770, author=D, kind='story', title='LES VIEUX.',
         heading=[h3(text='LES VIEUX.')], end=h3(text='BALLADES EN PROSE'), note='Between h3 LES VIEUX. and h3 BALLADES EN PROSE.'),
    dict(gid=11770, author=D, kind='story', title='LES DEUX AUBERGES',
         heading=[h3(text='LES DEUX AUBERGES')], end=h3(text='A MILIANAH'),
         note='Between h3 LES DEUX AUBERGES and h3 A MILIANAH. The two sung refrains are <br>-separated verse lines inside '
              'paragraphs: kept as lines; unwrappedLines joins each paragraph.'),
    dict(gid=11770, author=D, kind='story', title='LES TROIS MESSES BASSES.',
         heading=[h3(text='LES TROIS MESSES BASSES.')], end=h3(text='LES ORANGES.'),
         markers=[dict(tag='p', text='CONTE DE NOËL.')], marker_regex=r'[IVX]+', expect_markers=4,
         note='Subtitle p "CONTE DE NOËL." and the part numerals p I, II, III are sectionMarkers (4), not lines. Ends before h3 LES ORANGES.'),
    dict(gid=11770, author=D, kind='story', title='LA MULE DU PAPE',
         heading=[h3(text='LA MULE DU PAPE')], end=h3(text='LE PHARE DES SANGUINAIRES'),
         note='Between h3 LA MULE DU PAPE and h3 LE PHARE DES SANGUINAIRES.'),
    dict(gid=11770, author=D, kind='story', title='L\'ÉLIXIR DU REVEREND PÈRE GAUCHER',
         heading=[h3(text="L'ÉLIXIR DU REVEREND PÈRE GAUCHER")], end=h3(text='EN CAMARGUE'),
         note='Between h3 L\'ÉLIXIR DU REVEREND PÈRE GAUCHER and h3 EN CAMARGUE; <br>-separated song lines kept as lines.'),
    dict(gid=11770, author=D, kind='essay', title='INSTALLATION',
         heading=[h3(text='INSTALLATION')], end=h3(text='LA DILIGENCE DE BEAUCAIRE'),
         note='Between h3 INSTALLATION and h3 LA DILIGENCE DE BEAUCAIRE.'),
    dict(gid=11770, author=D, kind='essay', title='NOSTALGIES DE CASERNE.',
         heading=[h3(text='NOSTALGIES DE CASERNE.')], end=dict(tag='p', text='FIN.'),
         note='Between h3 NOSTALGIES DE CASERNE. and the closing p "FIN." (excluded).'),
    dict(gid=11770, author=D, kind='essay', title='LE POÈTE MISTRAL.',
         heading=[h3(text='LE POÈTE MISTRAL.')], end=h3(text='LES TROIS MESSES BASSES.'),
         note='Between h3 LE POÈTE MISTRAL. and h3 LES TROIS MESSES BASSES.'),
]

HUGO_NOTE = ('div.stanza of p.iN lines, a bare <br> between p elements = stanza break. Indent = class number minus the '
             'smallest class number used in the poem (all lines of the poem share the baseline class otherwise). ')

WORKS += [
    dict(gid=29844, author=H, kind='poem', title='XIV',
         locate=[dict(tag='h2', text='LIVRE QUATRIÈME')], heading=[h3(text='XIV')], end=h3(text='XV'),
         note='Book IV (Pauca meae), "Demain, dès l\'aube". ' + HUGO_NOTE + 'Dated line "3 Septembre 1847." kept as last line (own stanza).'),
    dict(gid=29843, author=H, kind='poem', title='XXI',
         locate=[dict(tag='h2', text='LIVRE PREMIER')], heading=[h3(text='XXI')], end=h3(text='XXII'),
         note='Book I (Aurore), "Elle était déchaussée…" (first h3 XXI in the ebook). ' + HUGO_NOTE),
    dict(gid=29843, author=H, kind='poem', title='XIX VIEILLE CHANSON DU JEUNE TEMPS',
         locate=[dict(tag='h2', text='LIVRE PREMIER')], heading=[h3(text='XIX'), h3(text='VIEILLE CHANSON DU JEUNE TEMPS')],
         end=h3(text='XX'), note='Book I. ' + HUGO_NOTE),
    dict(gid=29843, author=H, kind='poem', title='III MES DEUX FILLES',
         locate=[dict(tag='h2', text='LIVRE PREMIER')], heading=[h3(text='III'), h3(text='MES DEUX FILLES')],
         end=h3(text='IV'), note='Book I. ' + HUGO_NOTE),
    dict(gid=29844, author=H, kind='poem', title='XIII VENI, VIDI, VIXI',
         locate=[dict(tag='h2', text='LIVRE QUATRIÈME')], heading=[h3(text='XIII'), h3(text='VENI, VIDI, VIXI')],
         end=h3(text='XIV'), note='Book IV. ' + HUGO_NOTE),
    dict(gid=29844, author=H, kind='poem', title='XVI MORS',
         locate=[dict(tag='h2', text='LIVRE QUATRIÈME')], heading=[h3(text='XVI'), h3(text='MORS')],
         end=h3(text='XVII'), note='Book IV. Ends before h3 XVII (CHARLES VACQUERIE). ' + HUGO_NOTE),
    dict(gid=29844, author=H, kind='poem', title='XIII PAROLES SUR LA DUNE',
         locate=[dict(tag='h1', text='LIVRE CINQUIÈME')], heading=[h3(text='XIII'), h3(text='PAROLES SUR LA DUNE')],
         end=h3(text='XIV'), note='Book V (En marche). ' + HUGO_NOTE),
]

RIMBAUD_NOTE = ('Sections of the ebook are single <p> elements of <br>-separated lines (poems separated by four blank lines, '
                'title line, two blank lines, verse). The poem = the lines between its own printed title line (exclusive) and the '
                'next printed title line; blank line = stanza break; page-number spans dropped. ')
WORKS += [
    dict(gid=56708, author=R, kind='poem', title='SENSATION', inblock=True, end_line='TÊTE DE FAUNE',
         note=RIMBAUD_NOTE + 'Premiers vers section (not the notes or variants).'),
    dict(gid=56708, author=R, kind='poem', title='MA BOHÊME', inblock=True, end_line='LES DOUANIERS',
         note=RIMBAUD_NOTE + 'Premiers vers section.'),
    dict(gid=56708, author=R, kind='poem', title='LE DORMEUR DU VAL', inblock=True, end_line='LE BUFFET',
         note=RIMBAUD_NOTE + 'Premiers vers section (not the notes).'),
    dict(gid=56708, author=R, kind='poem', title='LE BUFFET', inblock=True, end_line='MA BOHÊME',
         note=RIMBAUD_NOTE + 'Premiers vers section.'),
    dict(gid=56708, author=R, kind='poem', title='BATEAU IVRE', inblock=True, end_line='LES CHERCHEUSES DE POUX',
         note=RIMBAUD_NOTE + 'Printed text of the main poems section.'),
]


# ---------------------------------------------------------------- extraction
def source_file(src, gid):
    for name in (f'pg{gid}-images.html', f'pg{gid}.html'):
        if (src / name).exists():
            return name
    raise FileNotFoundError(f'no HTML for ebook {gid} in {src}')


def build_result(entry, lines, indents, markers, start_proof, end_proof, unwrapped=None):
    nonblank = [t for t in lines if t]
    result = dict(
        gutenbergId=entry['gid'], author=entry['author'], kind=entry['kind'], section='',
        title=entry['title'], lines=lines, indents=indents, complete=entry.get('complete', True),
        wordCount=wordcount(lines),
        boundaryProof=dict(start=start_proof, end=end_proof,
                           first=nonblank[0] if nonblank else '', last=nonblank[-1] if nonblank else ''),
        note=entry['note'])
    if markers or entry['kind'] != 'poem':
        result['sectionMarkers'] = markers
    if unwrapped:
        result['unwrappedLines'] = unwrapped
    return result


class Collector:
    """Accumulates lines with single blank separators and pending section markers."""

    def __init__(self, prose):
        self.prose = prose
        self.lines, self.indents, self.markers, self.pending = [], [], [], []

    def marker(self, text):
        self.pending.append('subheading: ' + text)

    def blank(self):
        if self.lines and self.lines[-1]:
            self.lines.append('')
            self.indents.append(0)

    def line(self, t, ind):
        if not t:
            self.blank()
            return
        self.lines.append(t)
        self.indents.append(0 if self.prose else ind)
        for m in self.pending:
            self.markers.append(dict(beforeLine=len(self.lines) - 1, marker=m))
        self.pending.clear()

    def finish(self):
        while self.lines and not self.lines[-1]:
            self.lines.pop()
            self.indents.pop()
        for m in self.pending:
            self.markers.append(dict(beforeLine=len(self.lines), marker=m))
        self.pending.clear()
        if not self.prose:  # indent relative to the poem's own baseline
            base = min((n for t, n in zip(self.lines, self.indents) if t), default=0)
            self.indents = [n - base if t else 0 for t, n in zip(self.lines, self.indents)]


def extract_inblock(entry, blocks):
    title, end_line = entry['title'], entry['end_line']
    hits = [(i, k) for i, b in enumerate(blocks) if b.kind == 'text'
            for k, (t, _) in enumerate(block_lines(b)) if t == title]
    if len(hits) != 1:
        raise ValueError(f'{title!r}: expected exactly one printed title line, found {len(hits)}')
    i, k = hits[0]
    pairs = block_lines(blocks[i])
    ends = [j for j in range(k + 1, len(pairs)) if pairs[j][0] == end_line]
    if not ends:
        raise ValueError(f'{title!r}: end line {end_line!r} not in the same block')
    body = pairs[k + 1:ends[0]]
    col = Collector(prose=False)
    for t, ind in body:
        col.line(t, ind)
    col.finish()
    return build_result(entry, col.lines, col.indents, col.markers,
                        f"p: {pairs[k][0]}", f"p: {pairs[ends[0]][0]}")


def extract_one(entry, blocks):
    if entry.get('inblock'):
        return extract_inblock(entry, blocks), entry['title']
    pos = 0
    for m in entry.get('locate', []):
        pos = find(blocks, m, pos) + 1
    heading_blocks = []
    for m in entry['heading']:
        pos = find(blocks, m, pos)
        heading_blocks.append(blocks[pos])
        pos += 1
    heading_text = ' '.join(b.text() for b in heading_blocks)
    if norm(entry['title']) != norm(heading_text):
        raise ValueError(f"title mismatch: {entry['title']!r} vs {heading_text!r}")
    end_pos = find(blocks, entry['end'], pos)
    body = blocks[pos:end_pos]
    prose = entry['kind'] != 'poem'
    marker_re = entry.get('marker_regex')
    col = Collector(prose)
    paras = []
    for block in body:
        if block.el.classes() & FIGURE_CLASSES:
            continue
        pairs = block_lines(block)
        if not pairs:
            continue
        if block.el.tag in entry.get('marker_tags', ()):
            for t, _ in pairs:
                col.marker(t)
            continue
        if block.kind in ('text', 'pre') and len(pairs) == 1 and (
                (marker_re and re.fullmatch(marker_re, pairs[0][0])) or
                any(matches(block, m) for m in entry.get('markers', []))):
            col.marker(pairs[0][0])
            continue
        col.blank()
        group = []
        for t, ind in pairs:
            col.line(t, ind)
            if t:
                group.append(t)
            elif group:
                paras.append(group)
                group = []
        if group:
            paras.append(group)
    col.finish()
    if entry.get('expect_markers') is not None and len(col.markers) != entry['expect_markers']:
        raise ValueError(f"expected {entry['expect_markers']} section markers, got {len(col.markers)}")
    unwrapped = None
    if prose and not col.markers and any(len(g) > 1 for g in paras):
        unwrapped = []
        for g in paras:
            if unwrapped:
                unwrapped.append('')
            joined = g[0]
            for t in g[1:]:
                joined += ('' if joined.endswith('-') else ' ') + t
            unwrapped.append(joined)
    result = build_result(
        entry, col.lines, col.indents, col.markers,
        f"{heading_blocks[-1].ident()}: {heading_blocks[-1].text()[:80]}",
        f"{blocks[end_pos].ident()}: {blocks[end_pos].text()[:80]}", unwrapped)
    return result, heading_text


def stanza_count(lines):
    groups, cur = 0, False
    for t in lines:
        if t and not cur:
            groups += 1
            cur = True
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
        work, heading_text = extract_one(entry, blocks_by_gid[gid])
        work['stanzaCount'] = stanza_count(work['lines'])
        work['lineCount'] = sum(1 for t in work['lines'] if t)
        works.append(work)
        notes.append(f"{gid} {entry['title'][:40]!r}: heading text in HTML = {heading_text!r}")
    notes.append('Critic extraction from Gutenberg HTML only; whitespace inside a line collapsed to one space and stripped; '
                 'pagenum elements and footnote reference marks dropped; no text typed or corrected by hand.')
    return dict(critic='independent', sources=sources, works=works, notes=notes)


if __name__ == '__main__':
    source_dir = sys.argv[1] if len(sys.argv) > 1 else None
    output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).with_name('extraction-french.json')
    result = extract(source_dir)
    with open(output, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps([dict(id=w['gutenbergId'], title=w['title'][:40], lines=w['lineCount'],
                           stanzas=w['stanzaCount'], words=w['wordCount'], complete=w['complete'])
                      for w in result['works']], ensure_ascii=False, indent=1))
