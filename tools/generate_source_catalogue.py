"""Reproduce the reading catalogue from pinned, locally retained source editions.

Normal use: python tools/generate_source_catalogue.py [--check]
--discover is a maintainer operation: it rewrites the explicit boundary manifest
from the narrowly supported collections below. Review every changed boundary.
No network access or language model is involved in generation/verification.
"""
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
SOURCES = Path(__file__).resolve().parent / "sources"
MANIFEST = Path(__file__).resolve().parent / "source-manifest.json"
OUTPUT = ROOT / "source-catalogue.js"
VERDICTS = Path(__file__).resolve().parent / "critic" / "verdicts.json"
# Current gutenberg.org plain-text editions, saved unchanged and pinned by
# SHA-256 in the manifest. (Build 026's critic rejected the older GITenberg
# copies: accents stripped and several word errors fixed upstream since.)
REGISTRY = {
    "pg575.txt": (575, "Francis Bacon", "essay", 1625, "England"),
    "pg2776.txt": (2776, "O. Henry", "story", 1906, "United States"),
    "pg160.txt": (160, "Kate Chopin", "story", "1890s", "United States"),
    "pg1322.txt": (1322, "Walt Whitman", "poem", "1855–1892", "United States"),
    "pg1934.txt": (1934, "William Blake", "poem", "1789 / 1794", "England"),
}
RETRIEVED = "2026-10-28"


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode("utf-8")).hexdigest()


def load(path):
    return (SOURCES / path).read_bytes().decode("utf-8-sig").replace("\r\n", "\n").replace("\r", "\n").split("\n")


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


SPECIAL_IDS = {
    ("Francis Bacon", "Of Studies"): "bacon-studies",
    ("Francis Bacon", "Of Truth"): "bacon-truth",
    ("O. Henry", "THE GIFT OF THE MAGI"): "ohenry-magi",
    ("Kate Chopin", "DÉSIRÉE’S BABY"): "chopin-desiree",
    ("Walt Whitman", "When I Heard the Learn’d Astronomer"): "whitman-astronomer",
    ("Walt Whitman", "O Captain! My Captain!"): "whitman-captain",
    ("William Blake", "THE SICK ROSE"): "blake-sick-rose",
}


def discover():
    entries = []

    def add(path, start, stop, section="", join_continuations=False):
        ls = load(path)
        number, author, kind, year, place = REGISTRY[path]
        heading = ls[start]
        while not ls[stop - 1].strip():
            stop -= 1  # trailing blank lines belong to no work
        body = "\n".join(ls[start + 1:stop])
        assert body.strip(), heading
        assert len(body.split()) <= 6000, heading
        title = heading.strip()
        identifier = SPECIAL_IDS.get((author, title), slug(author) + "-" + slug(section + " " + title))
        entries.append({"id": identifier, "kind": kind, "title": title, "author": author,
                        "year": year, "place": place, "sourceFile": path,
                        "headingLine": start + 1, "startLine": start + 2, "endLine": stop,
                        "heading": heading, "section": section, "joinContinuations": join_continuations,
                        "bodySha256": digest(body)})

    def gutenberg_end(ls):
        return next(i for i, s in enumerate(ls) if s.startswith("*** END OF THE PROJECT GUTENBERG"))

    # Bacon: the publisher's contents give the complete heading set; locate
    # each whole heading line in sequence in the body.
    ls = load("pg575.txt")
    first = ls.index("THE ESSAYS")
    titles = []
    for s in ls[first + 1:]:
        if s.startswith("     Of "):
            titles.append(s.strip())
        elif titles and not s.strip():
            break
    assert len(titles) == 59, len(titles)
    body_from = first + 2 + len(titles)
    starts = []
    for title in titles:
        matches = [i for i, s in enumerate(ls) if i > body_from and s.replace(",", "").casefold() == title.replace(",", "").casefold()]
        assert len(matches) == 1, (title, matches)
        starts.append(matches[0])
    assert starts == sorted(starts)
    # Of Fame is a posthumous fragment ("This essay was not finished"). Exclude it.
    for a, b in zip(starts, starts[1:]):
        add("pg575.txt", a, b)

    # The Four Million: every contents entry, in the same order.
    ls = load("pg2776.txt")
    toc = ls.index("Contents") + 1
    titles = []
    for s in ls[toc:]:
        if s.startswith(" "):
            titles.append(s.strip())
        elif titles and not s.strip():
            break
    assert len(titles) == 25, len(titles)
    starts = [next(i for i in range(toc + len(titles), len(ls)) if ls[i] == t) for t in titles]
    assert starts == sorted(starts)
    for a, b in zip(starts, starts[1:] + [gutenberg_end(ls)]):
        add("pg2776.txt", a, b)

    # Chopin: the entire eight-story section after the novel.
    ls = load("pg160.txt")
    titles = ["BEYOND THE BAYOU", "MA’AME PÉLAGIE", "DÉSIRÉE’S BABY", "A RESPECTABLE WOMAN",
              "THE KISS", "A PAIR OF SILK STOCKINGS", "THE LOCKET", "A REFLECTION"]
    starts = [ls.index(t) for t in titles]
    assert starts == sorted(starts)
    for a, b in zip(starts, starts[1:] + [gutenberg_end(ls)]):
        add("pg160.txt", a, b)

    # Blake: all poems. Upper-case headings; the two section headers divide
    # Innocence from Experience and belong to no poem.
    ls = load("pg1934.txt")
    end = gutenberg_end(ls)
    innocence, experience = ls.index("SONGS OF INNOCENCE"), ls.index("SONGS OF EXPERIENCE")
    headings = [i for i in range(innocence + 1, end) if ls[i].strip() and ls[i] == ls[i].upper()
                and ls[i][0].isalpha() and not ls[i].startswith("SONGS OF ")]
    assert len(headings) == 47, len(headings)
    for a, b in zip(headings, headings[1:] + [end]):
        stop = experience if a < experience < b else b
        add("pg1934.txt", a, stop, "Innocence" if a < experience else "Experience")

    # Whitman: every poem of Book I (Inscriptions) plus explicitly selected
    # complete short poems. Headings are flush left; verse is indented.
    ls = load("pg1322.txt")
    book, first_end = ls.index("BOOK I.  INSCRIPTIONS"), ls.index("Starting from Paumanok")
    starts = [i for i in range(book + 1, first_end) if ls[i] and not ls[i][0].isspace() and not ls[i].startswith("BOOK ")]
    selected = ["When I Heard the Learn’d Astronomer", "O Captain! My Captain!", "O Me! O Life!", "I Sit and Look Out",
                "A Noiseless Patient Spider", "Miracles", "A Clear Midnight", "The World below the Brine",
                "On the Beach at Night Alone", "After the Sea-Ship", "A Farm Picture", "Beautiful Women",
                "Mother and Babe", "The Runner", "Reconciliation", "Look Down Fair Moon", "A Glimpse", "To a Stranger",
                "I Saw in Louisiana a Live-Oak Growing", "When I Heard at the Close of the Day", "A Hand-Mirror",
                "The Last Invocation", "Joy, Shipmate, Joy!", "The Untold Want"]
    for t in selected:
        assert ls.count(t) == 1, t
    starts += [ls.index(t) for t in selected]
    for a in starts:
        b = next(i for i in range(a + 1, len(ls)) if ls[i] and not ls[i][0].isspace())
        assert all(not s.strip() or s.startswith("  ") for s in ls[a + 1:b]), ls[a]
        # This edition hard-wraps long verse lines with a +4 continuation
        # indent. Poems with deeper stepped indents (O Captain!) use +4 as
        # real verse indentation, so their lines are never joined.
        body = [len(s) - len(s.lstrip()) for s in ls[a + 1:b] if s.strip()]
        add("pg1322.txt", a, b, join_continuations=max(body) < min(body) + 8)
    ids = [e["id"] for e in entries]
    assert len(ids) == len(set(ids)), "duplicate IDs"
    # Blake repeats five titles across the two books; name the book so the
    # titles (shown in the reader and used to detect repeats) stay distinct.
    keys = [(e["author"], e["title"].casefold()) for e in entries]
    for e, key in zip(entries, keys):
        if keys.count(key) > 1:
            assert e["section"], e["id"]
            e["title"] = f"{e['title']} (Songs of {e['section']})"
    keys = [(e["author"], e["title"].casefold()) for e in entries]
    assert len(keys) == len(set(keys)), "duplicate titles"
    sources = {}
    for path, (number, *_rest) in REGISTRY.items():
        sources[path] = {"gutenbergId": number, "path": path, "retrieved": RETRIEVED,
                         "sha256": digest((SOURCES / path).read_bytes()),
                         "url": f"https://www.gutenberg.org/cache/epub/{number}/{path}"}
    return {"version": 2, "sources": sources, "works": entries}


def unitalic(text):
    # Gutenberg plain text marks italics as _word_; the reader has no italics.
    return re.sub(r"(?<![\w_])_(\S(?:[^_]*?\S)?)_(?![\w_])", r"\1", text)


def blocks_for(kind, lines, join_continuations=False):
    groups, current = [], []
    for line in lines + [""]:
        if line.strip():
            current.append(line)
        elif current:
            groups.append(current)
            current = []
    if kind != "poem":
        return [{"type": "para", "text": " ".join(line.strip() for line in group)} for group in groups]
    stanzas = []
    base = min(len(line) - len(line.lstrip()) for group in groups for line in group)
    for group in groups:
        stanza = []
        for line in group:
            indent = len(line) - len(line.lstrip())
            if join_continuations and indent == base + 4:
                assert stanza, "dangling wrapped line"
                stanza[-1]["text"] += " " + line.strip()
            else:
                stanza.append({"text": line.strip(), "indent": indent - base})
        stanzas.append({"type": "stanza", "lines": stanza})
    return stanzas


def render_works(manifest):
    """Every candidate work, before the independent critic's verdicts."""
    for source in manifest["sources"].values():
        assert digest((SOURCES / source["path"]).read_bytes()) == source["sha256"], "source snapshot changed"
    works = []
    for entry in manifest["works"]:
        path = entry["sourceFile"]
        ls = load(path)
        assert ls[entry["headingLine"] - 1] == entry["heading"]
        assert entry["startLine"] == entry["headingLine"] + 1
        body_lines = ls[entry["startLine"] - 1:entry["endLine"]]
        body = "\n".join(body_lines)
        assert digest(body) == entry["bodySha256"], entry["id"] + " source slice changed"
        if entry["kind"] != "poem":
            # Italic spans may cross a paragraph break, so mark-up goes first.
            body_lines = unitalic(body).split("\n")
            # Underscores inside a word are text (O. Henry's "N_w Yo_k").
            assert not re.search(r"(?<!\w)_|_(?!\w)", unitalic(body)), entry["id"] + " unmatched italic marker"
        blocks = blocks_for(entry["kind"], body_lines, entry["joinContinuations"])
        rendered = " ".join(b["text"] if b["type"] == "para" else " ".join(l["text"] for l in b["lines"]) for b in blocks)
        # Independently compare all original whitespace-delimited tokens:
        # punctuation/case are part of each token. No word may be lost,
        # inserted, reordered, modernised or silently truncated.
        assert rendered.split() == unitalic(body).split(), entry["id"] + " text changed"
        source = manifest["sources"][path]
        edition = {**source, **{k: entry[k] for k in ("headingLine", "startLine", "endLine", "heading", "bodySha256")}}
        work = {k: entry[k] for k in ("id", "kind", "title", "author", "year", "place")}
        work.update(source=f"https://www.gutenberg.org/ebooks/{source['gutenbergId']}", blocks=blocks, sourceEdition=edition)
        works.append(work)
    return works


def blocks_digest(blocks):
    return digest(json.dumps(blocks, ensure_ascii=False, sort_keys=True))


def render(manifest):
    # Publish only works the comparator accepted for exactly these blocks.
    verdicts = json.loads(VERDICTS.read_text(encoding="utf-8"))["verdicts"] if VERDICTS.is_file() else {}
    works = [w for w in render_works(manifest)
             if verdicts.get(w["id"], {}).get("status") == "accepted"
             and verdicts[w["id"]]["blocksSha256"] == blocks_digest(w["blocks"])]
    for w in works:
        w["critic"] = "independent gutenberg.org extraction matched; tools/critic/verdicts.json"
    return "// Generated by tools/generate_source_catalogue.py; do not edit.\n// Exact wording and punctuation from pinned source editions; presentation whitespace reflowed.\nexport const SOURCE_CATALOGUE = " + json.dumps(works, ensure_ascii=False, indent=1) + ";\n"


def main():
    if "--discover" in sys.argv:
        MANIFEST.write_text(json.dumps(discover(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    output = render(manifest)
    if "--check" in sys.argv:
        assert OUTPUT.read_text(encoding="utf-8") == output, "generated catalogue differs; regenerate"
    else:
        OUTPUT.write_text(output, encoding="utf-8", newline="\n")
    published = json.loads(output[output.index("["):output.rstrip().rindex("]") + 1])
    counts = {kind: sum(w["kind"] == kind for w in published) for kind in ("poem", "story", "essay")}
    print(f"Checked {len(manifest['works'])} source slices; published {len(published)} critic-accepted works: {counts}.")


if __name__ == "__main__":
    main()
