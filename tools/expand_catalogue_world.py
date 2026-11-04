"""Reproduce the world-catalogue expansion boundaries from unchanged retained editions.

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
OUTPUT = HERE / 'expansion-world.json'
RETRIEVED = '2026-11-04'

# kind, display title, author, year (original; edition or translation), place,
# source ebook, heading line, occurrence, first heading line, first line after.
WORKS = [
    ('poem', 'Odes II.14, Eheu, Fugaces', 'Horace', '23 BC; John Conington translation 1863', 'Rome',
     5432, 'EHEU, FUGACES.', 1, None, 'XV.'),
    ('poem', 'The Confession of Golias', 'The Archpoet', 'c. 1163; John Addington Symonds translation 1884', 'Germany',
     18044, 'No. 5.', 1, 'THE CONFESSION OF GOLIAS.', 'XIV.'),
    ('poem', 'The Song of Maisuna', 'Maisun bint Bahdal', '7th century; J. D. Carlyle translation 1796', 'Syria',
     10121, 'THE SONG OF MAISUNA[8]', 1, None,
     ' [8] Maisuma was a daughter of the tribe of Calab; a tribe, according'),
    ('poem', 'Idyll XV, The Festival of Adonis', 'Theocritus', '3rd century BC; C. S. Calverley translation 1869', 'Greece',
     11533, 'The Festival of Adonis.', 1, 'IDYLL XV.', 'IDYLL XVI.'),
    ('poem', 'The Recruiting Sergeant', 'Du Fu', '8th century; L. Cranmer-Byng translation 1909', 'China',
     390, '  The Recruiting Sergeant', 2, None, '  Chants of Autumn'),
    ('poem', 'The Lute Girl', 'Bai Juyi', '816; L. Cranmer-Byng translation 1909', 'China',
     390, '  The Lute Girl', 2, None, '  The Never-ending Wrong'),
    ('poem', 'Rubáiyát of Omar Khayyám (First Edition)', 'Omar Khayyam', '11th–12th century; Edward FitzGerald translation 1859', 'Persia',
     246, 'First Edition', 1, None, 'Fifth Edition'),
    ('poem', 'The Epitaph in Form of a Ballad', 'François Villon', '1463; Algernon Charles Swinburne translation 1878', 'France',
     27401, 'ALONG WITH THEM', 1, 'THE EPITAPH IN FORM OF A BALLAD', 'FROM VICTOR HUGO'),
    ('poem', 'Coplas de Manrique', 'Jorge Manrique', '1476; Henry Wadsworth Longfellow translation 1833', 'Spain',
     1365, 'COPLAS DE MANRIQUE', 1, None, 'SONNETS'),
    ('poem', 'To Giovanni da Pistoja, On the Painting of the Sistine Chapel', 'Michelangelo Buonarroti',
     'c. 1510; John Addington Symonds translation 1878', 'Italy',
     10314, 'TO GIOVANNI DA PISTOJA.', 1, None, 'VI.'),
    ('poem', 'Prometheus', 'Johann Wolfgang von Goethe', '1773; Edgar Alfred Bowring translation 1853', 'Germany',
     1287, 'PROMETHEUS.', 1, None, '-----'),
    ('poem', 'The Prophet', 'Alexander Pushkin', '1826; Ivan Panin translation 1888', 'Russia',
     54991, '    THE PROPHET.', 1, None, 'Poems: Narrative.'),
    ('poem', 'In the Factory', 'Morris Rosenfeld', '1890s; Rose Pastor Stokes and Helena Frank translation 1914', 'Poland',
     6859, '  In the Factory', 2, None, '  My Boy'),
    ('poem', 'Faces in the Street', 'Henry Lawson', '1888', 'Australia',
     214, 'Faces in the Street', 1, None, 'The Roaring Days'),
    ('poem', 'The City of the End of Things', 'Archibald Lampman', '1899', 'Canada',
     22833, ' THE CITY OF THE END OF THINGS', 1, None, ' THE SONG SPARROW'),
    ('poem', 'Harlem Shadows', 'Claude McKay', '1918; book 1922', 'Jamaica',
     64989, '        HARLEM SHADOWS', 2, None, '        THE WHITE CITY'),
    ('poem', 'Channel Firing', 'Thomas Hardy', '1914', 'England',
     2863, 'CHANNEL FIRING', 1, None, 'THE CONVERGENCE OF THE TWAIN'),
    ('poem', 'Lucinda Matlock', 'Edgar Lee Masters', '1915', 'United States',
     1280, 'Lucinda Matlock', 1, None, 'Davis Matlock'),
    ('poem', 'Felix Randal', 'Gerard Manley Hopkins', 'written 1880; first published 1918', 'England',
     22403, 'Felix Randal_', 1, '_29', '_30'),
    ('poem', 'We Wear the Mask', 'Paul Laurence Dunbar', '1895', 'United States',
     18338, 'WE WEAR THE MASK', 1, None, 'THE MEADOW LARK'),
    ('story', 'The Shipwrecked Sailor', 'Anonymous Egyptian', 'c. 1900 BC; W. M. Flinders Petrie translation 1895', 'Egypt',
     7386, 'THE SHIPWRECKED SAILOR', 2, None, 'Remarks'),
    ('story', 'The Vision of Mirza', 'Joseph Addison', '1711', 'England',
     2791, 'THE VISION OF MIRZA.', 1, None, 'GENIUS.'),
    ('story', 'The Dream of Maxen Wledig', 'Anonymous Welsh', 'c. 1350 manuscript; Lady Charlotte Guest translation 1849', 'Wales',
     5160, 'THE DREAM OF MAXEN WLEDIG', 1, None, 'HERE IS THE STORY OF LLUDD AND LLEVELYS'),
    ('story', 'Federigo and his Falcon', 'Giovanni Boccaccio', 'c. 1353; J. M. Rigg translation 1903', 'Italy',
     13102, 'NOVEL IX.', 1, None, 'NOVEL X.'),
    ('story', 'Charan', 'Im Bang', 'c. 1700; James Scarth Gale translation 1913', 'Korea',
     51002, 'CHARAN', 1, None, 'II'),
    ('story', 'In the Land of the Free', 'Sui Sin Far', '1909; book 1912', 'Canada and United States',
     62940, '                        IN THE LAND OF THE FREE', 1, None, '                            THE CHINESE LILY'),
    ('story', 'She Was Good for Nothing', 'Hans Christian Andersen', '1853; H. W. Dulcken translation 1866', 'Denmark',
     27000, 'SHE WAS GOOD FOR NOTHING.', 1, None, '"THERE IS A DIFFERENCE."'),
    ('story', 'Misery', 'Anton Chekhov', '1886; Constance Garnett translation 1920', 'Russia',
     1732, 'MISERY', 1, None, 'CHAMPAGNE'),
    ('story', "The Attendant's Confession", 'Joaquim Maria Machado de Assis', '1884; Isaac Goldberg translation 1921', 'Brazil',
     21040, "THE ATTENDANT'S CONFESSION", 1, None, 'THE FORTUNE-TELLER'),
    ('story', 'If Not Higher', 'Isaac Loeb Peretz', '1900; Helena Frank translation 1906', 'Poland',
     37242, 'IF NOT HIGHER', 1, 'I', 'II'),
    ('story', 'Three Dreams in a Desert', 'Olive Schreiner', '1890', 'South Africa',
     1439, 'V. THREE DREAMS IN A DESERT.', 1, None, 'VI. A DREAM OF WILD BEES.'),
    ('story', 'The Star', 'H. G. Wells', '1897', 'England',
     27365, 'THE STAR', 1, None, 'A Story of the Stone Age'),
    ('story', "The Drover's Wife", 'Henry Lawson', '1892', 'Australia',
     7144, "THE DROVER'S WIFE", 1, None, "STEELMAN'S PUPIL"),
    ('story', 'The Alligator War', 'Horacio Quiroga', '1918; Arthur Livingston translation 1922', 'Uruguay',
     46051, '                           THE ALLIGATOR WAR', 1, None, '                 HOW THE FLAMINGOES GOT THEIR STOCKINGS'),
    ('story', 'Our Lord and Saint Peter', 'Selma Lagerlöf', '1904; Velma Swanston Howard translation 1908', 'Sweden',
     44818, '                        OUR LORD AND SAINT PETER', 1, None, '-' * 72),
    ('story', 'Life of Ma Parker', 'Katherine Mansfield', '1921', 'New Zealand',
     1429, 'Life of Ma Parker', 1, None, 'Marriage à la Mode'),
    ('story', 'Counterparts', 'James Joyce', '1914', 'Ireland',
     2814, 'COUNTERPARTS', 1, None, 'CLAY'),
    ('story', 'The Lay of the Were-Wolf', 'Marie de France', '12th century; Eugene Mason translation 1911', 'France',
     11417, 'THE LAY OF THE WERE-WOLF', 1, 'VIII', 'IX'),
    ('story', 'Hands', 'Sherwood Anderson', '1916; book 1919', 'United States',
     416, 'HANDS', 1, None, 'PAPER PILLS'),
    ('story', 'The War Prayer', 'Mark Twain', 'written 1904–05; first published 1923', 'United States',
     68604, '                             THE WAR PRAYER', 1, None, '                           CORN-PONE OPINIONS'),
    ('essay', 'Crito', 'Plato', '4th century BC; Benjamin Jowett translation 1871', 'Greece',
     1657, 'CRITO', 2, None, '*** END OF THE PROJECT GUTENBERG EBOOK CRITO ***'),
    ('essay', 'Ecclesiastes', 'Qoheleth', 'c. 3rd century BC; King James Version 1611', 'Ancient Israel',
     8021, 'Book 21        Ecclesiastes', 1, None,
     '*** END OF THE PROJECT GUTENBERG EBOOK THE BIBLE, KING JAMES VERSION, BOOK 21: ECCLESIASTES ***'),
    ('essay', 'A Street Singer', 'Lafcadio Hearn', '1896', 'Japan',
     8882, 'A STREET SINGER', 1, 'III', 'IV'),
    ('essay', 'Mathematical Creation', 'Henri Poincaré', '1908; George Bruce Halsted translation 1913', 'France',
     39713, 'MATHEMATICAL CREATION', 1, 'CHAPTER III', 'CHAPTER IV'),
    ('essay', 'The Vision', 'Lucian of Samosata', 'c. 160; H. W. and F. G. Fowler translation 1905', 'Syria',
     6327, 'A CHAPTER OF AUTOBIOGRAPHY', 1, 'THE VISION', 'A LITERARY PROMETHEUS'),
    ('essay', 'Use Makes Perfect', 'Michel de Montaigne', '1580; Charles Cotton translation 1685, edited by William Carew Hazlitt 1877', 'France',
     3600, 'USE MAKES PERFECT', 1, 'CHAPTER VI', '     ETEXT EDITOR’S BOOKMARKS:'),
    ('essay', 'Meditation XVII', 'John Donne', '1624', 'England',
     23772, 'XVII. MEDITATION.', 1, None, 'XVII. EXPOSTULATION.'),
    ('essay', 'A Modest Proposal', 'Jonathan Swift', '1729', 'Ireland',
     1080, 'A Modest Proposal', 1, None, '*** END OF THE PROJECT GUTENBERG EBOOK A MODEST PROPOSAL ***'),
    ('essay', 'On Noise', 'Arthur Schopenhauer', '1851; T. Bailey Saunders translation 1891', 'Germany',
     10732, 'ON NOISE.', 1, None, 'A FEW PARABLES.'),
    ('essay', 'The Superannuated Man', 'Charles Lamb', '1825', 'England',
     10343, 'THE SUPERANNUATED MAN', 1, None, 'THE GENTEEL STYLE IN WRITING'),
    ('essay', 'Night Walks', 'Charles Dickens', '1860', 'England',
     914, 'NIGHT WALKS', 1, 'XIII', 'XIV'),
    ('essay', 'On the Advisableness of Improving Natural Knowledge', 'Thomas Henry Huxley', '1866', 'England',
     16729, 'ON THE ADVISABLENESS OF IMPROVING NATURAL KNOWLEDGE.', 2, 'I.', 'II.'),
    ('essay', 'Silence', 'Maurice Maeterlinck', '1896; Alfred Sutro translation 1897', 'Belgium',
     48217, 'SILENCE', 2, None, 'THE AWAKENING OF THE SOUL'),
    ('essay', 'Preface to the Poems of Adam Lindsay Gordon', 'Marcus Clarke', 'written 1876; published 1880', 'Australia',
     258, 'PREFACE.', 1, None, 'GENERAL CONTENTS.'),
    ('essay', 'Solitude', 'Miguel de Unamuno', '1905; J. E. Crawford Flitch translation 1925', 'Spain',
     71260, 'SOLITUDE', 1, None, 'INTELLECTUALITY AND SPIRITUALITY'),
    ('essay', 'Cristiano: A Horse', 'W. H. Hudson', '1919', 'Argentina',
     79577, 'CRISTIANO: A HORSE', 1, 'XII', 'XIII'),
    ('essay', 'The Moral Equivalent of War', 'William James', '1910', 'United States',
     20768, 'THE MORAL EQUIVALENT OF WAR[1]', 1, 'XI', 'XII'),
    ('essay', 'Singing in the Village', 'Leo Tolstoy', '1910; Louise and Aylmer Maude translation 1910', 'Russia',
     51018, '                        SINGING IN THE VILLAGE', 1, None, '                         TRAVELLER AND PEASANT'),
    ('essay', 'How I Became a Socialist', 'Jack London', '1903', 'United States',
     1187, 'HOW I BECAME A SOCIALIST', 1, None, 'FOOTNOTES:'),
    ('essay', 'Marriage and Love', 'Emma Goldman', '1910', 'United States',
     2162, 'MARRIAGE AND LOVE', 1, None, 'THE MODERN DRAMA: A POWERFUL DISSEMINATOR OF RADICAL THOUGHT'),
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
    for kind, title, author, year, place, number, heading, nth, first_heading, after in WORKS:
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
                 'joinContinuations': False, 'bodySha256': digest(body)}
        if heading_start is not None:
            entry['headingStartLine'] = heading_start + 1
        entries.append(entry)
    assert len({entry['id'] for entry in entries}) == len(entries)
    sources = {}
    for number in sorted({work[5] for work in WORKS}):
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
