# Regenerates library.js from Project Gutenberg plain-text files:
#   7256.txt (The Gift of the Magi), 160-0.txt saved as pg160.txt (Chopin),
#   1322.txt (Leaves of Grass), 575.txt (Bacon, Essays).
# Fetched from the GITenberg mirror (raw.githubusercontent.com/GITenberg/...).
# Usage: python3 -I tools/extract_library.py <dir-with-those-files> > library.js
import json, re, sys
T = sys.argv[1]
def lines(f, a, b):  # 1-based inclusive
    return open(f"{T}/{f}", encoding="utf-8-sig").read().split("\n")[a-1:b]
def fix(s):
    s = s.replace("--", "—")
    return re.sub(r"\s+", " ", s).strip()
def prose(ls):
    paras, cur = [], []
    for l in ls:
        if l.strip(): cur.append(l.strip())
        elif cur: paras.append(fix(" ".join(cur))); cur = []
    if cur: paras.append(fix(" ".join(cur)))
    return [{"type": "para", "text": p} for p in paras]
def poem(ls, join_cont=False):
    stanzas, cur = [], []
    for l in ls:
        if not l.strip():
            if cur: stanzas.append(cur); cur = []
            continue
        ind = len(l) - len(l.lstrip())
        text = l.strip().replace("--", "—")
        if join_cont and cur and ind >= 6:
            cur[-1]["text"] += " " + text
            continue
        cur.append({"text": text, "indent": max(0, (ind - 2) // 1)})
    if cur: stanzas.append(cur)
    base = min(x["indent"] for s in stanzas for x in s)
    return [{"type": "stanza", "lines": [{"text": x["text"], "indent": x["indent"] - base} for x in s]} for s in stanzas]
def find(f, start_pat, after=1):
    for i, l in enumerate(open(f"{T}/{f}", encoding="utf-8-sig").read().split("\n"), 1):
        if i >= after and re.fullmatch(start_pat, l.strip()): return i
    raise SystemExit("not found " + start_pat)
works = []
# Blake: keep the app's existing text (Songs of Experience, 1794)
works.append({"id": "blake-sick-rose", "kind": "poem", "title": "The Sick Rose", "author": "William Blake", "year": 1794, "place": "England",
  "source": "Songs of Experience (1794); public domain",
  "blocks": [{"type": "stanza", "lines": [{"text": t, "indent": 0} for t in ["O Rose thou art sick.", "The invisible worm,", "That flies in the night", "In the howling storm:"]]},
             {"type": "stanza", "lines": [{"text": t, "indent": 0} for t in ["Has found out thy bed", "Of crimson joy:", "And his dark secret love", "Does thy life destroy."]]}]})
a = find("1322.txt", r"When I Heard the Learn'd Astronomer", 8000)
works.append({"id": "whitman-astronomer", "kind": "poem", "title": "When I Heard the Learn'd Astronomer", "author": "Walt Whitman", "year": 1865, "place": "United States",
  "source": "Leaves of Grass; Project Gutenberg #1322", "blocks": poem(lines("1322.txt", a + 2, a + 11), join_cont=True)})
a = find("1322.txt", r"O Captain! My Captain!", 10000)
works.append({"id": "whitman-captain", "kind": "poem", "title": "O Captain! My Captain!", "author": "Walt Whitman", "year": 1865, "place": "United States",
  "source": "Leaves of Grass; Project Gutenberg #1322", "blocks": poem(lines("1322.txt", a + 2, a + 28))})
works.append({"id": "ohenry-magi", "kind": "story", "title": "The Gift of the Magi", "author": "O. Henry", "year": 1905, "place": "United States",
  "source": "Project Gutenberg #7256", "blocks": prose(lines("7256.txt", 43, 273))})
a = find("pg160.txt", r"DESIREE'S BABY", 6000); b = find("pg160.txt", r"A RESPECTABLE WOMAN", a)
works.append({"id": "chopin-desiree", "kind": "story", "title": "Desiree's Baby", "author": "Kate Chopin", "year": 1893, "place": "United States",
  "source": "Project Gutenberg #160", "blocks": prose(lines("pg160.txt", a + 1, b - 1))})
def essay(title, id_):
    a = find("575.txt", title, 120)
    # ends at the next "Of ..." heading line
    ls = open(f"{T}/575.txt", encoding="utf-8-sig").read().split("\n")
    b = next(i for i in range(a + 1, len(ls)) if re.fullmatch(r"Of [A-Z][A-Za-z ,']+", ls[i].strip()))
    return {"id": id_, "kind": "essay", "title": title, "author": "Francis Bacon", "year": 1625, "place": "England",
            "source": "Essays, Civil and Moral; Project Gutenberg #575", "blocks": prose(ls[a:b])}
works.append(essay("Of Studies", "bacon-studies"))
works.append(essay("Of Truth", "bacon-truth"))
print("// Starter shelf. Public-domain texts, extracted verbatim from the cited")
print("// Project Gutenberg editions (\"--\" rendered as an em dash, line wrapping removed).")
print("// Generated; do not hand-edit the texts.")
print("export const LIBRARY = " + json.dumps(works, ensure_ascii=False, indent=1) + ";")
