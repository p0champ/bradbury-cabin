"""Independent critic extraction. Reads only critic/sources/, writes critic/critic-extraction.json.
Run: python -I extract.py   (paths are resolved relative to this file)
"""
import hashlib, json, os, re, sys
import runpy
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'sources')
OUT = os.path.join(HERE, 'critic-extraction.json')
# Added by the producer for reproducibility checks only: optional paths.
if len(sys.argv) == 3: SRC, OUT = sys.argv[1], sys.argv[2]
NBSP = ' '

def read(n):
    p = os.path.join(SRC, 'pg%d-images.html' % n)
    raw = open(p, 'rb').read()
    return raw.decode('utf-8'), hashlib.sha256(raw).hexdigest()

def body_region(s):
    """Text between the end of the PG header and the start of the PG footer."""
    a = s.index('</header>') + len('</header>')
    b = s.index('<footer', a)
    return s[a:b]

class Blocks(HTMLParser):
    """Turns the HTML into a flat list of blocks:
    ('h', level, text) ; ('p', cls, text_with_\\n_for_br) ; ('pre', text) ; ('hr',) ; ('img',)
    Inline tags (i, span, a, b, strong) are dropped, their text kept."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks = []
        self.cur = None  # [kind, extra, [chunks]]
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if re.fullmatch(r'h[1-6]', tag):
            self.cur = ['h', int(tag[1]), []]
        elif tag == 'p':
            self.cur = ['p', a.get('class', '') or '', []]
        elif tag == 'pre':
            self.cur = ['pre', None, []]
        elif tag == 'br':
            if self.cur is not None:
                self.cur[2].append('\x00BR\x00')
        elif tag == 'hr':
            self.blocks.append(('hr',))
        elif tag == 'img':
            self.blocks.append(('img',))
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
    def handle_endtag(self, tag):
        if self.cur is None:
            return
        k = self.cur[0]
        if (k == 'h' and tag == 'h%d' % self.cur[1]) or (k == 'p' and tag == 'p') or (k == 'pre' and tag == 'pre'):
            txt = ''.join(self.cur[2])
            if k == 'pre':
                self.blocks.append(('pre', txt))
            else:
                self.blocks.append((k, self.cur[1], txt))
            self.cur = None
    def handle_data(self, d):
        if self.cur is not None:
            self.cur[2].append(d)

def blocks_of(s):
    b = Blocks(); b.feed(body_region(s)); b.close(); return b.blocks

def flow_lines(txt):
    """Paragraph/heading text: source whitespace collapses; <br> -> line break.
    Returns list of (leading_nbsp_count, text) per line."""
    txt = re.sub(r'[ \t\r\n]+', ' ', txt)
    out = []
    for ln in txt.split('\x00BR\x00'):
        ln = ln.strip(' ')
        m = re.match('[' + NBSP + ' ]*', ln)
        lead = m.group(0).count(NBSP)
        ln = ln[m.end():]
        ln = re.sub('[' + NBSP + ' ]+', ' ', ln).strip(' ')
        out.append((lead, ln))
    return out

def htext(txt):
    return ' '.join(flow_lines(txt)[0][1].split()) if '\x00BR\x00' not in txt else \
        ' '.join(' '.join(t for _, t in flow_lines(txt)).split())

def pre_lines(txt):
    if txt.startswith('\r\n'): txt = txt[2:]
    elif txt.startswith('\n'): txt = txt[1:]
    lines = txt.split('\n')
    while lines and lines[-1].strip() == '':
        lines.pop()
    while lines and lines[0].strip() == '':
        lines.pop(0)
    res = []
    for ln in lines:
        ln = ln.rstrip()
        lead = len(ln) - len(ln.lstrip(' '))
        res.append((lead, ln.lstrip(' ')))
    return res

def norm_title(t):
    return re.sub(r'\s+', ' ', t.replace('’', "'").replace('‘', "'")).strip().casefold()

notes = []
works = []
sources = {}

def prose_from_blocks(blks, removals):
    """blks: blocks of one work (after its heading). Returns lines, sectionMarkers, hr count."""
    lines, markers, hrs = [], [], 0
    def para(ls):
        if lines: lines.append('')
        lines.extend(ls)
    for b in blks:
        if b[0] == 'p':
            fl = flow_lines(b[2])
            ls = [t for _, t in fl]
            if all(t == '' for t in ls):
                continue
            # drop empty lines produced by stray <br>
            ls = [t for t in ls if t != '']
            para(ls)
        elif b[0] == 'pre':
            ls = [t for _, t in pre_lines(b[1])]
            para(ls)
        elif b[0] == 'hr':
            hrs += 1
            markers.append({'beforeLine': len(lines) + (1 if lines else 0), 'marker': '<hr> scene break'})
        elif b[0] == 'h':
            markers.append({'beforeLine': len(lines) + (1 if lines else 0), 'marker': 'subheading: ' + htext(b[2])})
        elif b[0] == 'img':
            pass
    return lines, markers, hrs

# ---------------- 575 Bacon ----------------
s, h = read(575)
sources['575'] = {'url': 'https://www.gutenberg.org/cache/epub/575/pg575-images.html', 'sha256': h, 'format': 'html'}
B = blocks_of(s)
h2 = [i for i, b in enumerate(B) if b[0] == 'h' and b[1] == 2]
titles = [htext(B[i][2]) for i in h2]
start = titles.index('Of Truth')
end = titles.index('A Glossary Of Archaic Words And Phrases')
for k in range(start, end):
    i, j = h2[k], h2[k + 1]
    blk = B[i + 1:j]
    # trailing editorial note "[This essay was not finished]"
    complete, note = True, ''
    kept = []
    for b in blk:
        if b[0] == 'p' and re.fullmatch(r'\s*\[This essay was not finished\]\s*', b[2]):
            complete = False
            note = 'Edition marks this essay as unfinished with an editorial line "[This essay was not finished]" after the text; that line is excluded from lines.'
            continue
        kept.append(b)
    lines, markers, hrs = prose_from_blocks(kept, None)
    w = {'gutenbergId': 575, 'author': 'Francis Bacon', 'kind': 'essay', 'section': '', 'title': titles[k],
         'lines': lines, 'complete': complete, 'note': note}
    if markers: w['sectionMarkers'] = markers
    works.append(w)

# ---------------- 2776 O. Henry ----------------
s, h = read(2776)
sources['2776'] = {'url': 'https://www.gutenberg.org/cache/epub/2776/pg2776-images.html', 'sha256': h, 'format': 'html'}
B = blocks_of(s)
h2 = [i for i, b in enumerate(B) if b[0] == 'h' and b[1] == 2]
titles = [htext(B[i][2]) for i in h2]
start = titles.index('Contents') + 1
for k in range(start, len(h2)):
    i = h2[k]; j = h2[k + 1] if k + 1 < len(h2) else len(B)
    lines, markers, hrs = prose_from_blocks(B[i + 1:j], None)
    w = {'gutenbergId': 2776, 'author': 'O. Henry', 'kind': 'story', 'section': '', 'title': titles[k],
         'lines': lines, 'complete': True, 'note': ('%d <hr> scene break(s) in source, not represented in lines (see sectionMarkers)' % hrs) if hrs else ''}
    if markers: w['sectionMarkers'] = markers
    works.append(w)

# ---------------- 160 Chopin ----------------
s, h = read(160)
sources['160'] = {'url': 'https://www.gutenberg.org/cache/epub/160/pg160-images.html', 'sha256': h, 'format': 'html'}
B = blocks_of(s)
h2 = [i for i, b in enumerate(B) if b[0] == 'h' and b[1] == 2]
titles = [htext(B[i][2]) for i in h2]
start = titles.index('THE AWAKENING') + 1
for k in range(start, len(h2)):
    i = h2[k]; j = h2[k + 1] if k + 1 < len(h2) else len(B)
    blk = B[i + 1:j]
    lines, markers, hrs = prose_from_blocks(blk, None)
    p2 = 0; idx = 0
    # mark paragraphs with class p2 (extra top spacing = section break in this edition)
    for b in blk:
        if b[0] == 'p' and 'p2' in b[1].split():
            p2 += 1
    note = ''
    if p2:
        note = '%d paragraph(s) carry class "p2" (extra space above, i.e. an unmarked section break); not represented in lines.' % p2
    sub = [m for m in markers if m['marker'].startswith('subheading')]
    if sub:
        note = (note + ' ' if note else '') + 'Part numerals (h3) omitted from lines; positions in sectionMarkers.'
    w = {'gutenbergId': 160, 'author': 'Kate Chopin', 'kind': 'story', 'section': '', 'title': titles[k],
         'lines': lines, 'complete': True, 'note': note}
    if markers: w['sectionMarkers'] = markers
    works.append(w)

# ---------------- 7256 Gift of the Magi ----------------
s, h = read(7256)
sources['7256'] = {'url': 'https://www.gutenberg.org/cache/epub/7256/pg7256-images.html', 'sha256': h, 'format': 'html'}
B = blocks_of(s)
t1 = [htext(b[2]) for b in B if b[0] == 'h' and b[1] == 1][0]
first_p = next(i for i, b in enumerate(B) if b[0] == 'p')
pre_hr = sum(1 for b in B[:first_p] if b[0] == 'hr')
lines, markers, hrs = prose_from_blocks(B[first_p:], None)
works.append({'gutenbergId': 7256, 'author': 'O. Henry', 'kind': 'story', 'section': '', 'title': t1,
              'lines': lines, 'complete': True,
              'note': 'Title from the h1 of the single-story ebook; byline h2 "by O. Henry" excluded.' + (' %d <hr> inside text.' % hrs if hrs else '')})

# ---------------- 1934 Blake ----------------
s, h = read(1934)
sources['1934'] = {'url': 'https://www.gutenberg.org/cache/epub/1934/pg1934-images.html', 'sha256': h, 'format': 'html'}
B = blocks_of(s)
h2 = [i for i, b in enumerate(B) if b[0] == 'h' and b[1] == 2]
titles = [htext(B[i][2]) for i in h2]
section = None
for k in range(titles.index('SONGS OF INNOCENCE'), len(h2)):
    t = titles[k]
    if t == 'SONGS OF INNOCENCE': section = 'Innocence'; continue
    if t == 'SONGS OF EXPERIENCE': section = 'Experience'; continue
    i = h2[k]; j = h2[k + 1] if k + 1 < len(h2) else len(B)
    lines, indents = [], []
    other = []
    for b in B[i + 1:j]:
        if b[0] == 'p':
            if 'poem' not in b[1].split():
                other.append(htext(b[2]))
            fl = flow_lines(b[2])
            # a stray <br> right before </p> (e.g. Innocence "Nurse's Song") yields an empty last line: drop it
            while fl and fl[-1][1] == '':
                fl.pop()
            while fl and fl[0][1] == '':
                fl.pop(0)
            if not fl:
                continue
            if any(t == '' for _, t in fl):
                other.append('empty line inside stanza')
            if lines: lines.append(''); indents.append(0)
            for lead, tx in fl:
                lines.append(tx); indents.append(lead)
        elif b[0] in ('pre', 'h'):
            other.append(b[0])
    mn = min(x for x, t in zip(indents, lines) if t != '')
    indents = [max(0, x - mn) if t != '' else 0 for x, t in zip(indents, lines)]
    note = 'indents = count of leading no-break spaces (U+00A0) in the HTML source line.'
    if other: note += ' Unexpected non-poem blocks: %r' % other
    works.append({'gutenbergId': 1934, 'author': 'William Blake', 'kind': 'poem', 'section': section, 'title': t,
                  'lines': lines, 'indents': indents, 'complete': True, 'note': note})

# ---------------- 1322 Whitman ----------------
s, h = read(1322)
sources['1322'] = {'url': 'https://www.gutenberg.org/cache/epub/1322/pg1322-images.html', 'sha256': h, 'format': 'html'}
B = blocks_of(s)
# headings: every h2 and every non-empty plain <p> inside the body (this edition titles
# the first poem of a numbered "BOOK" and some sub-poems with a <p> instead of an h2).
heads = []
started = False
for i, b in enumerate(B):
    if b[0] == 'h' and b[1] == 2 and htext(b[2]).startswith('BOOK I. INSCRIPTIONS'):
        started = True
    if not started:
        continue
    if b[0] == 'h' and b[1] == 2:
        heads.append((i, htext(b[2]), 'h2'))
    elif b[0] == 'p' and htext(b[2]):
        heads.append((i, htext(b[2]), 'p'))

def is_cont(ind, t, stepped):
    # heuristic: wrap-continuation = exactly +4 indent, unless the poem uses stepped
    # indentation (levels beyond +5, e.g. O Captain! My Captain!), where +4 is genuine verse indent
    return t != '' and ind == 4 and not stepped

def whitman_poem(hidx):
    i, title, how = heads[hidx]
    j = heads[hidx + 1][0] if hidx + 1 < len(heads) else len(B)
    pres = [b for b in B[i + 1:j] if b[0] == 'pre']
    others = [b[0] for b in B[i + 1:j] if b[0] not in ('pre',)]
    pl = []
    for k, p in enumerate(pres):
        if k: pl.append((0, ''))
        pl.extend(pre_lines(p[1]))
    lines = [t for _, t in pl]
    mn = min(x for x, t in pl if t != '')
    indents = [x - mn if t != '' else 0 for x, t in pl]
    # wrapped continuation lines in this edition are indented +4 relative to base
    stepped = any(x > 5 for x in indents)
    unwrapped = []
    for ind, t in zip(indents, lines):
        if is_cont(ind, t, stepped) and unwrapped and unwrapped[-1] != '':
            unwrapped[-1] = unwrapped[-1] + ' ' + t
        else:
            unwrapped.append(t)
    cont = sum(1 for ind, t in zip(indents, lines) if is_cont(ind, t, stepped))
    note = 'Body from <pre>; indents = leading spaces relative to the poem\'s base indent. Heading was a <%s>.' % how
    if cont:
        note += ' %d line(s) (indented +4 in a poem without stepped indentation) look like typographic wrap-continuations of the previous verse line (kept as separate entries in lines; see unwrappedLines).' % cont
    if len(pres) != 1:
        note += ' NOTE: %d <pre> blocks under this heading.' % len(pres)
    if others:
        note += ' Other blocks under heading: %r.' % others
    return title, lines, indents, unwrapped, note, cont

i0 = next(k for k, x in enumerate(heads) if x[1].startswith('BOOK I. INSCRIPTIONS'))
i1 = next(k for k, x in enumerate(heads) if x[1] == 'BOOK II')
wanted_scope = [(k, 'Inscriptions') for k in range(i0 + 1, i1)]
extra = ["When I Heard the Learn'd Astronomer", 'O Captain! My Captain!', 'O Me! O Life!', 'I Sit and Look Out',
         'A Noiseless Patient Spider', 'Miracles', 'A Clear Midnight', 'The World below the Brine',
         'On the Beach at Night Alone', 'After the Sea-Ship', 'A Farm Picture', 'Beautiful Women', 'Mother and Babe',
         'The Runner', 'Reconciliation', 'Look Down Fair Moon', 'A Glimpse', 'To a Stranger',
         'I Saw in Louisiana a Live-Oak Growing', 'When I Heard at the Close of the Day', 'A Hand-Mirror',
         'The Last Invocation', 'Joy, Shipmate, Joy!', 'The Untold Want']
# book membership for each heading
book = {}
cur = ''
for k, (i, t, how) in enumerate(heads):
    if t.startswith('BOOK'):
        cur = t
    book[k] = cur
for name in extra:
    hits = [k for k, x in enumerate(heads) if norm_title(x[1]) == norm_title(name)]
    if len(hits) != 1:
        notes.append('Whitman: title %r matched %d headings: %r' % (name, len(hits), [heads[k][1] for k in hits]))
    for k in hits[:1]:
        wanted_scope.append((k, book[k]))
for k, bk in wanted_scope:
    title, lines, indents, unwrapped, note, cont = whitman_poem(k)
    w = {'gutenbergId': 1322, 'author': 'Walt Whitman', 'kind': 'poem', 'section': '', 'title': title,
         'lines': lines, 'indents': indents, 'complete': True, 'note': note + ' Book: ' + bk}
    if cont: w['unwrappedLines'] = unwrapped
    works.append(w)

notes += [
    'All sources are the gutenberg.org HTML editions (pg<N>-images.html), downloaded unchanged into critic/sources/; no .txt used.',
    'Text region = between </header> (end of PG header incl. START line) and <footer (PG END line/licence).',
    'HTML entities and numeric refs decoded by html.parser (convert_charrefs). <br> -> line break. All inline tags (<i>, <span class=smallcaps>, <a>, <b>) removed, their text kept: italics and small-caps styling are therefore lost (e.g. Chopin "Salve!" italic, O. Henry letters in italics/small caps).',
    'Prose (essays/stories): one entry per paragraph (<p>) with source line-wrapping whitespace collapsed to single spaces; paragraphs separated by "". A <br> inside a paragraph (letters, signatures, poem quotations in prose) produces consecutive entries with no "" between them. Leading runs of U+00A0 (used to right-align signatures, e.g. "JIMMY.") are dropped and internal runs of U+00A0/space are collapsed to one ordinary space (e.g. "Arnold: I want" in Lost on Dress Parade had two NBSPs).',
    'Prose <pre> blocks (Latin/English verse quotations in Bacon) are emitted as their own "paragraph" with one entry per source line, leading indentation stripped; the blank line inside "When hempe is spun / / England\'s done:" (Of Prophecies) is kept as "".',
    'Empty <p> elements, <hr>, images and the Bacon "H2 anchor" placeholder paragraphs are not text and are skipped. <hr> scene breaks (O. Henry) and h3 part numerals (Chopin Ma\'ame Pelagie, The Locket) are recorded in sectionMarkers (beforeLine = index in lines where the next paragraph starts), not in lines.',
    'Removed editorial matter: Bacon "Of Fame" trailing "[This essay was not finished]" (flagged complete=false). Bacon dedication, contents and glossary excluded. No footnote anchors or page numbers were found in any of these HTML files.',
    'Blake: each <p class="poem"> = one stanza, each <br> = verse line; trailing <br> before </p> (Innocence "Nurse’s Song", 2 stanzas) ignored so no spurious blank lines. indents are counts of leading U+00A0 (0 / 4 / 8) relative to the poem minimum.',
    'Blake: SONGS OF INNOCENCE / SONGS OF EXPERIENCE h2 headings used as section dividers only. Every other h2 is a poem; this edition (Astolat/R. Brimley Johnson 1901) contains no editorial introduction or notes as text, only illustrations (skipped). Note it includes "A Divine Image" and "A Cradle Song" in Experience, and titles "THE TIGER" (not Tyger).',
    'Whitman: poem bodies are <pre> blocks; the edition hard-wraps long verse lines with a +4-space continuation indent. "lines" keeps the source lines exactly (not unwrapped); a heuristic "unwrappedLines" (continuations joined with one space) is provided where wraps exist, as a secondary view only. "When I Heard the Learn\'d Astronomer" is titled by a <p> placed inside the chapter div of the preceding h2 poem, not by an h2; the extractor treats every non-empty plain <p> in the Whitman body as a heading (this edition uses <p> only for such titles), so the preceding poem ends at that <p>.',
]

extra = runpy.run_path(os.path.join(HERE, 'extract_031.py'), run_name='cabin_expansion')['extract'](SRC)
assert not set(sources).intersection(extra['sources']), 'critic expansion overwrites an existing source'
sources.update(extra['sources'])
works.extend(extra['works'])
notes.extend(extra['notes'])
out = {'critic': 'independent', 'sources': sources, 'works': works, 'notes': notes}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
from collections import Counter
print(Counter(w['gutenbergId'] for w in works))
