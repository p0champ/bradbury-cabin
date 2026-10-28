"""Crude regex-based cross-check of critic-extraction.json against raw HTML (different code path)."""
import html, json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(HERE, 'critic-extraction.json'), encoding='utf-8'))

def words(t):
    return t.replace(' ', ' ').split()

def raw(n):
    s = open(os.path.join(HERE, 'sources', 'pg%d-images.html' % n), encoding='utf-8').read()
    return s[s.index('</header>'):s.index('<footer')]

def plain(seg):
    seg = re.sub(r'<br\s*/?>', ' ', seg)
    seg = re.sub(r'<!--.*?-->', ' ', seg, flags=re.S)
    seg = re.sub(r'</?(i|b|em|strong|span|a)(\s[^>]*)?>', '', seg)
    seg = re.sub(r'<h3>.*?</h3>', ' ', seg, flags=re.S)  # Chopin part numerals (excluded by design)
    seg = re.sub(r'<[^>]+>', ' ', seg)
    return words(html.unescape(seg))

R = {n: raw(n) for n in (575, 2776, 160, 1934, 1322, 7256)}
bad = 0
for w in d['works']:
    n = w['gutenbergId']
    mine = words(' '.join(w['lines']))
    # find the work in raw text by its first 8 words, then take the same number of words
    allw = plain(R[n])
    k = len(mine)
    first = mine[:8]
    pos = [i for i in range(len(allw) - 8) if allw[i:i + 8] == first]
    if len(pos) != 1:
        print('LOCATE', n, w['title'], len(pos)); bad += 1
        if not pos: continue
    i = pos[0]
    if allw[i:i + k] != mine:
        j = next(x for x in range(k) if allw[i + x] != mine[x])
        print('DIFF', n, w['title'], 'at word', j, allw[i + j - 3:i + j + 4], mine[j - 3:j + 4]); bad += 1
    nxt = allw[i + k:i + k + 12]
    print('OK  ', n, w['title'][:35], '| next:', ' '.join(nxt)[:80])
print('problems:', bad)
