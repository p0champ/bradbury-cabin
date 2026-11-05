"""Reproduce the French-catalogue boundaries from unchanged retained editions.

No network calls. --check compares the complete regenerated manifest, including
source hashes and every explicit inclusive one-based body boundary. This is
producer evidence only: independent HTML comparison must still approve works.

Each work is declared by exact source lines, never by line numbers alone: the
heading line (and, for headings set over several lines, its first line), which
occurrence of it to use, and the first line after the work. The body is every
source line between them, unchanged; trailing blank lines are not part of it.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

HERE = Path(__file__).resolve().parent
SOURCES = HERE / 'sources'
OUTPUT = HERE / 'expansion-french.json'
RETRIEVED = '2026-11-04'

# kind, display title, author, year, place, reading level (1 gentle, 2 medium,
# 3 harder), source ebook, heading line, occurrence, first heading line, first
# line after. Every work is in its original French; there is no translator.
WORKS = [
    ('story', 'La Chèvre de M. Seguin', 'Alphonse Daudet', '1869', 'France', 1,
     11770, 'LA CHÈVRE DE M. SEGUIN', 1, None, 'LES ÉTOILES'),
    ('story', 'Les Étoiles', 'Alphonse Daudet', '1869', 'France', 1,
     11770, 'LES ÉTOILES', 1, None, "L'ARLÉSIENNE"),
    ('story', "L'Arlésienne", 'Alphonse Daudet', '1869', 'France', 1,
     11770, "L'ARLÉSIENNE", 1, None, 'LA MULE DU PAPE'),
    ('story', 'Le Secret de maître Cornille', 'Alphonse Daudet', '1869', 'France', 1,
     11770, 'LE SECRET DE MAITRE CORNILLE', 1, None, 'LA CHÈVRE DE M. SEGUIN'),
    ('story', 'Le Curé de Cucugnan', 'Alphonse Daudet', '1869', 'France', 1,
     11770, 'LE CURÉ DE CUCUGNAN.', 1, None, 'LES VIEUX.'),
    ('story', 'La Mort du Dauphin', 'Alphonse Daudet', '1869', 'France', 1,
     11770, 'LA MORT DU DAUPHIN.', 1, 'I', 'II'),
    ('story', 'Le Sous-préfet aux champs', 'Alphonse Daudet', '1869', 'France', 1,
     11770, 'LE SOUS-PRÉFET AUX CHAMPS.', 1, 'II', 'LE PORTEFEUILLE DE BIXIOU'),
    ('story', 'Les Vieux', 'Alphonse Daudet', '1869', 'France', 2,
     11770, 'LES VIEUX.', 1, None, 'BALLADES EN PROSE'),
    ('story', 'Les Deux Auberges', 'Alphonse Daudet', '1869', 'France', 2,
     11770, 'LES DEUX AUBERGES', 1, None, 'A MILIANAH'),
    ('story', 'Les Trois Messes basses', 'Alphonse Daudet', '1869', 'France', 2,
     11770, 'LES TROIS MESSES BASSES.', 1, None, 'LES ORANGES.'),
    ('story', 'La Mule du pape', 'Alphonse Daudet', '1869', 'France', 2,
     11770, 'LA MULE DU PAPE', 1, None, 'LE PHARE DES SANGUINAIRES'),
    ('story', "L'Élixir du Révérend Père Gaucher", 'Alphonse Daudet', '1869', 'France', 2,
     11770, "L'ÉLIXIR DU REVEREND PÈRE GAUCHER", 1, None, 'EN CAMARGUE'),
    ('essay', 'Installation', 'Alphonse Daudet', '1869', 'France', 1,
     11770, 'INSTALLATION', 1, None, 'LA DILIGENCE DE BEAUCAIRE'),
    ('essay', 'Nostalgies de caserne', 'Alphonse Daudet', '1869', 'France', 2,
     11770, 'NOSTALGIES DE CASERNE.', 1, None, 'FIN.'),
    ('essay', 'Le Poète Mistral', 'Alphonse Daudet', '1869', 'France', 3,
     11770, 'LE POÈTE MISTRAL.', 1, None, 'LES TROIS MESSES BASSES.'),
    ('poem', "Demain, dès l'aube", 'Victor Hugo', '1856', 'France', 1,
     29844, 'XIV', 1, None, 'XV'),
    ('poem', 'Elle était déchaussée', 'Victor Hugo', '1856', 'France', 1,
     29843, 'XXI', 1, None, 'XXII'),
    ('poem', 'Vieille chanson du jeune temps', 'Victor Hugo', '1856', 'France', 1,
     29843, 'DU JEUNE TEMPS', 1, 'XIX', 'XX'),
    ('poem', 'Mes deux filles', 'Victor Hugo', '1856', 'France', 1,
     29843, 'MES DEUX FILLES', 1, 'III', 'IV'),
    ('poem', 'Veni, vidi, vixi', 'Victor Hugo', '1856', 'France', 2,
     29844, 'VENI, VIDI, VIXI', 1, 'XIII', 'XIV'),
    ('poem', 'Mors', 'Victor Hugo', '1856', 'France', 2,
     29844, 'MORS', 1, 'XVI', 'XVIII'),
    ('poem', 'Paroles sur la dune', 'Victor Hugo', '1856', 'France', 3,
     29844, 'PAROLES SUR LA DUNE', 1, 'XIII', 'XIV'),
    ('poem', 'Sensation', 'Arthur Rimbaud', '1870–1871', 'France', 1,
     56708, '    SENSATION', 1, None, '    TÊTE DE FAUNE'),
    ('poem', 'Ma Bohème', 'Arthur Rimbaud', '1870–1871', 'France', 1,
     56708, '    MA BOHÊME', 1, None, '    LES DOUANIERS'),
    ('poem', 'Le Dormeur du val', 'Arthur Rimbaud', '1870–1871', 'France', 1,
     56708, '    LE DORMEUR DU VAL', 1, None, '    LE BUFFET'),
    ('poem', 'Le Buffet', 'Arthur Rimbaud', '1870–1871', 'France', 2,
     56708, '    LE BUFFET', 1, None, '    MA BOHÊME'),
    ('poem', 'Le Bateau ivre', 'Arthur Rimbaud', '1870–1871', 'France', 3,
     56708, '    BATEAU IVRE', 1, None, '    LES CHERCHEUSES DE POUX'),
]


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode('utf-8')).hexdigest()


def load(number):
    return (SOURCES / f'pg{number}.txt').read_bytes().decode('utf-8-sig').replace('\r\n', '\n').replace('\r', '\n').split('\n')


def slug(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def discover():
    entries, exclusions = [], []
    for kind, title, author, year, place, level, number, heading, nth, first_heading, after in WORKS:
        lines = load(number)
        found = [i for i, line in enumerate(lines) if line == heading]
        assert len(found) >= nth, (title, 'heading not found')
        a = found[nth - 1]
        heading_start = None
        if first_heading is not None:
            # A heading set over several lines (title, subtitle, number)
            # starts at most four lines above its final line.
            heading_start = next(i for i in range(a - 1, max(a - 5, -1), -1) if lines[i] == first_heading)
        b = next(i for i in range(a + 1, len(lines)) if lines[i] == after)
        while b > a + 1 and not lines[b - 1].strip():
            b -= 1
        body = '\n'.join(lines[a + 1:b])
        assert body.strip(), title
        count = len(body.split())
        # Paired underscores are Gutenberg italic markup; an odd number of
        # outside-word delimiters cannot be interpreted without guessing.
        if len(re.findall(r'(?<!\w)_|_(?!\w)', body)) % 2:
            exclusions.append({'sourceFile': f'pg{number}.txt', 'title': title, 'reason': 'Unpaired Gutenberg italic delimiter in retained source; presentation would require guessing'})
            continue
        if kind != 'poem' and count > 6000:
            exclusions.append({'sourceFile': f'pg{number}.txt', 'title': title, 'reason': 'Complete work exceeds 6000 words', 'words': count})
            continue
        entry = {'id': slug(author) + '-' + slug(title), 'kind': kind, 'title': title, 'author': author,
                 'year': year, 'place': place, 'sourceFile': f'pg{number}.txt', 'headingLine': a + 1,
                 'startLine': a + 2, 'endLine': b, 'heading': lines[a], 'section': '',
                 'joinContinuations': False, 'bodySha256': digest(body),
                 'language': 'French', 'level': level}
        if heading_start is not None:
            entry['headingStartLine'] = heading_start + 1
        entries.append(entry)
    assert len({entry['id'] for entry in entries}) == len(entries)
    sources = {}
    for number in sorted({work[6] for work in WORKS}):
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
    for entry in manifest['works']:
        lines = load(manifest['sources'][entry['sourceFile']]['gutenbergId'])
        assert digest('\n'.join(lines[entry['startLine'] - 1:entry['endLine']])) == entry['bodySha256']
    print(json.dumps({'candidates': len(manifest['works']), 'byKind': {k: sum(e['kind'] == k for e in manifest['works']) for k in ('poem', 'story', 'essay')},
                      'wholeWorkExclusions': len(manifest['exclusions'])}, ensure_ascii=False))


if __name__ == '__main__':
    main()
