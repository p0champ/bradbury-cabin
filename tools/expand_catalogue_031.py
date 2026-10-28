"""Reproduce Build 031 candidate boundaries from unchanged retained editions.

No network calls. --check compares the complete regenerated manifest, including
source hashes and every explicit inclusive one-based body boundary. This is
producer evidence only: independent HTML comparison must still approve works.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

HERE = Path(__file__).resolve().parent
SOURCES = HERE / 'sources'
OUTPUT = HERE / 'expansion-031.json'
RETRIEVED = '2026-10-28'
REGISTRY = {
    32233: ('W. B. Yeats', 'poem', '1899; 1903 edition', 'Ireland'),
    2148: ('Edgar Allan Poe', 'story', '1830s–1840s; Raven edition', 'United States'),
    10708: ('Thomas De Quincey', 'essay', 1823, 'England'),
    6842: ('Rabindranath Tagore', 'essay', '1913; 1916 edition', 'India'),
}


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode('utf-8')).hexdigest()


def load(number):
    return (SOURCES / f'pg{number}.txt').read_bytes().decode('utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').split('\n')


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def discover():
    entries = []
    exclusions = []

    def add(number, a, b, title=None, section='', heading_start=None):
        lines = load(number)
        while b > a + 1 and not lines[b - 1].strip():
            b -= 1
        body = '\n'.join(lines[a + 1:b])
        assert body.strip()
        author, kind, year, place = REGISTRY[number]
        title = title or lines[a].strip()
        count = len(body.split())
        # Paired underscores are Gutenberg italic markup; an odd number of
        # outside-word delimiters cannot be interpreted without guessing.
        # Exclude the complete work rather than insert a missing delimiter or
        # risk dropping genuine text. Internal word underscores are literal.
        if len(re.findall(r'(?<!\w)_|_(?!\w)', body)) % 2:
            exclusions.append({'sourceFile': f'pg{number}.txt', 'title': title, 'reason': 'Unpaired Gutenberg italic delimiter in retained source; presentation would require guessing'})
            return
        if count > 6000:
            exclusions.append({'sourceFile': f'pg{number}.txt', 'title': title, 'reason': 'Complete work exceeds 6000 words', 'words': count})
            return
        entries.append({'id': slug(author) + '-' + slug(title), 'kind': kind,
                        'title': title, 'author': author, 'year': year, 'place': place,
                        'sourceFile': f'pg{number}.txt', 'headingLine': a + 1,
                        'startLine': a + 2, 'endLine': b, 'heading': lines[a],
                        'section': section, 'joinContinuations': False,
                        'bodySha256': digest(body)})
        if heading_start is not None:
            assert 0 <= heading_start <= a
            entries[-1]['headingStartLine'] = heading_start + 1

    # All standalone poems. NOTES is a separately titled author-commentary
    # section, not verse and not a continuation of the final poem. Retain the
    # complete book so that exclusion is explicit and auditable.
    ls = load(32233)
    first = ls.index('THE HOSTING OF THE SIDHE')
    notes = ls.index('NOTES', first)
    starts = [i for i in range(first, notes) if ls[i] and not ls[i][0].isspace() and ls[i].isupper()]
    assert len(starts) == 37
    for a, b in zip(starts, starts[1:] + [notes]):
        assert all(not line.strip() or line.startswith('    ') for line in ls[a + 1:b]), ls[a]
        add(32233, a, b)

    # All 22 tales, with whole-work exclusions for length and remote notes.
    # Never silently discard a note reference or append unrelated endnotes.
    ls = load(2148)
    first = ls.index('THE PURLOINED LETTER')
    notes = ls.index('NOTES TO THE SECOND VOLUME')
    starts = [i for i in range(first, notes) if ls[i] and not ls[i][0].isspace() and ls[i].isupper()]
    assert len(starts) == 22
    for a, b in zip(starts, starts[1:] + [notes]):
        body = '\n'.join(ls[a + 1:b])
        if re.search(r'\(\*\d+\)', body):
            exclusions.append({'sourceFile': 'pg2148.txt', 'title': ls[a], 'reason': 'Has separate endnotes; contiguous-slice format cannot include them faithfully'})
        else:
            add(2148, a, b)

    # This edition lays out the title over three separated lines. Its final
    # heading line anchors the exact body; title records the full heading.
    ls = load(10708)
    a = ls.index('IN MACBETH.')
    assert ls[a - 4:a + 1] == ['ON', '', 'THE KNOCKING AT THE GATE,', '', 'IN MACBETH.']
    assert ' '.join(line.strip() for line in ls[a - 4:a + 1] if line.strip()) == 'ON THE KNOCKING AT THE GATE, IN MACBETH.'
    b = ls.index('ON MURDER,', a)
    add(10708, a, b, 'On the Knocking at the Gate, in Macbeth', heading_start=a - 4)

    # Eight complete named essays, never arbitrary chapter excerpts. Roman
    # numerals are title furniture for the NEXT essay and excluded there.
    ls = load(6842)
    toc = ls.index('CONTENTS')
    titles = [re.sub(r'^[IVX]+\. ', '', line) for line in ls[toc + 1:toc + 15] if re.match(r'^[IVX]+\. ', line)]
    assert len(titles) == 8
    starts = [ls.index(title, toc + 15) for title in titles]
    end = next(i for i, line in enumerate(ls) if line.startswith('*** END OF THE PROJECT GUTENBERG'))
    for index, (a, next_a) in enumerate(zip(starts, starts[1:] + [end])):
        b = next_a
        if index < len(starts) - 1:
            while not ls[b - 1].strip():
                b -= 1
            assert re.fullmatch('[IVX]+', ls[b - 1]), ls[b - 1]
            b -= 1
        add(6842, a, b)

    assert len({entry['id'] for entry in entries}) == len(entries)
    sources = {}
    for number in REGISTRY:
        path = f'pg{number}.txt'
        sources[path] = {'gutenbergId': number, 'path': path, 'retrieved': RETRIEVED,
                         'sha256': digest((SOURCES / path).read_bytes()),
                         'url': f'https://www.gutenberg.org/cache/epub/{number}/{path}'}
    return {'version': 2, 'sources': sources, 'works': entries, 'exclusions': exclusions}


def main():
    manifest = discover()
    result = json.dumps(manifest, ensure_ascii=False, indent=2) + '\n'
    if '--check' in sys.argv:
        assert OUTPUT.read_text(encoding='utf-8') == result, 'Expansion manifest differs; investigate source/boundaries before regenerating'
    else:
        OUTPUT.write_text(result, encoding='utf-8', newline='\n')
    # Every retained body is exactly the pinned source slice. Presentation and
    # independent original-edition validation belong to later stages.
    for entry in manifest['works']:
        lines = load(manifest['sources'][entry['sourceFile']]['gutenbergId'])
        assert digest('\n'.join(lines[entry['startLine'] - 1:entry['endLine']])) == entry['bodySha256']
    print(json.dumps({'candidates': len(manifest['works']),
                      'byAuthor': {author: sum(e['author'] == author for e in manifest['works']) for author, *_ in REGISTRY.values()},
                      'wholeWorkExclusions': len(manifest['exclusions'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
