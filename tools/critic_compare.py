"""Compare the producer's texts with an independent critic's extraction.

Usage: python -I tools/critic_compare.py [--check]

The critic (a separate agent that never saw the generator, manifest or
catalogue) downloaded its own copies from www.gutenberg.org and wrote its own
extraction code: tools/critic/extract.py -> tools/critic/critic-extraction.json.
This script is the only writer of tools/critic/verdicts.json. A work is
accepted only when the critic found the same work, judged it complete, and
every word, punctuation mark, capital, verse line and stanza break agrees.
The generator publishes accepted works only, bound to the exact blocks
compared here; any later change to a work's text makes it unpublished again.

--check reruns the critic's extraction code on its saved downloads and
recomputes every verdict; it fails if anything differs from the files on disk.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unicodedata

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
CRITIC = TOOLS / "critic"
EXTRACTION = CRITIC / "critic-extraction.json"
VERDICTS = CRITIC / "verdicts.json"
sys.path.insert(0, str(TOOLS))
import generate_source_catalogue as producer  # noqa: E402

# The one tolerated difference between Gutenberg's plain-text and HTML files
# of the same edition: the plain text spells the em dash "--". Quotes,
# apostrophes, accents and every other character must match exactly. Runs of
# whitespace (including no-break spaces) are layout, not text.
def canon(s):
    return re.sub(r"\s+", " ", s.replace("—", "--").replace(" ", " ")).strip()


def digest(value):
    return hashlib.sha256(value if isinstance(value, bytes) else value.encode("utf-8")).hexdigest()


def blocks_digest(blocks):
    return digest(json.dumps(blocks, ensure_ascii=False, sort_keys=True))


def title_key(s):
    s = unicodedata.normalize("NFKD", canon(s)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", s.casefold()).strip()


def groups_of(lines, indents=None):
    """Blank-line separated groups of (text, indent) pairs."""
    groups, cur = [], []
    for i, line in enumerate(lines + [""]):
        if line.strip():
            cur.append((canon(line), indents[i] if indents and i < len(indents) else None))
        elif cur:
            groups.append(cur)
            cur = []
    return groups


def levels(values):
    """Indent depths as levels (0, 1, 2...) so plain-text spaces and HTML
    no-break spaces compare, while any change in the stepping does not."""
    order = sorted(set(values))
    return [order.index(v) for v in values]


def first_difference(a, b):
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return f"position {i}: producer {' '.join(a[max(0, i - 3):i + 4])!r} / critic {' '.join(b[max(0, i - 3):i + 4])!r}"
    longer, who = (a, "producer") if len(a) > len(b) else (b, "critic")
    n = min(len(a), len(b))
    return f"{who} continues after the other ends: {' '.join(longer[n:n + 8])!r}"


def critic_view(cw):
    """The critic's lines and indents, with its recorded part numerals
    restored in place. Where the critic found transcriber wraps in verse, its
    own unwrapped view is the verse line structure the producer must match."""
    if isinstance(cw.get("unwrappedLines"), list):
        # Each unwrapped line takes the critic's indent for its first raw line.
        raw = [(l, i) for l, i in zip(cw["lines"], cw.get("indents") or [None] * len(cw["lines"])) if l.strip()]
        lines, indents, k = list(cw["unwrappedLines"]), [], 0
        for line in lines:
            if not line.strip():
                indents.append(None)
                continue
            indents.append(raw[k][1] if k < len(raw) else None)
            joined = ""
            while k < len(raw) and canon(joined) != canon(line):
                joined = (joined + " " + raw[k][0]).strip()
                k += 1
        return lines, indents, True
    lines = [l for l in cw.get("lines", []) if isinstance(l, str)]
    indents = cw.get("indents")
    for m in sorted(cw.get("sectionMarkers", []), key=lambda m: -m["beforeLine"]):
        if m["marker"].startswith("subheading: "):
            at = m["beforeLine"]
            lines[at:at] = [m["marker"][len("subheading: "):], ""]
            if indents:
                indents[at:at] = [0, 0]
    return lines, indents, False


def compare(kind, blocks, cw):
    reasons, warnings = [], []
    if cw.get("complete") is not True:
        reasons.append("critic judged the work incomplete: " + str(cw.get("note", "")))
    if cw.get("kind") != kind:
        reasons.append(f"kind differs: producer {kind}, critic {cw.get('kind')}")
    lines, indents, unwrapped = critic_view(cw)
    critic_tokens = canon(" ".join(lines)).split()
    if kind == "poem":
        if unwrapped:
            warnings.append("transcriber wraps rejoined; compared with the critic's unwrapped view")
        mine = [[(canon(l["text"]), l["indent"]) for l in b["lines"]] for b in blocks]
        theirs = groups_of(lines, indents)
        producer_tokens = " ".join(t for s in mine for t, _ in s).split()
        if [len(s) for s in mine] != [len(s) for s in theirs]:
            reasons.append(f"stanza/line structure differs: producer {[len(s) for s in mine]}, critic {[len(s) for s in theirs]}")
        else:
            for si, (a, b) in enumerate(zip(mine, theirs)):
                for li, ((x, _), (y, _)) in enumerate(zip(a, b)):
                    if x != y:
                        reasons.append(f"stanza {si + 1} line {li + 1}: producer {x!r} / critic {y!r}")
            theirs_ind = [i for s in theirs for _, i in s]
            if all(i is not None for i in theirs_ind):
                mine_ind = [i for s in mine for _, i in s]
                if levels(mine_ind) != levels(theirs_ind):
                    reasons.append(f"indentation differs: producer levels {levels(mine_ind)}, critic {levels(theirs_ind)}")
            else:
                reasons.append("critic recorded no indentation for this poem")
    else:
        if any(b.get("type") != "para" for b in blocks):
            reasons.append("prose work contains non-paragraph blocks")
        producer_paras = [canon(b["text"]) for b in blocks if b.get("type") == "para"]
        producer_tokens = " ".join(producer_paras).split()
        critic_paras = groups_of(lines)
        # Every critic paragraph break must be a producer break; a producer
        # break may only fall where the critic has a break or a line break.
        def breaks(paragraph_tokens):
            out, n = set(), 0
            for p in paragraph_tokens:
                n += len(p)
                out.add(n)
            return out
        paragraph_ends = breaks([" ".join(t for t, _ in p).split() for p in critic_paras])
        line_ends = breaks([t.split() for p in critic_paras for t, _ in p])
        mine_ends = breaks([p.split() for p in producer_paras])
        if not paragraph_ends <= mine_ends:
            reasons.append(f"producer merges paragraphs the edition separates (after token {min(paragraph_ends - mine_ends)})")
        if not mine_ends <= line_ends:
            reasons.append(f"producer splits a paragraph where the edition has no break (after token {min(mine_ends - line_ends)})")
    if producer_tokens != critic_tokens:
        reasons.append("text differs at " + first_difference(producer_tokens, critic_tokens))
    return reasons, warnings


def verdicts(extraction):
    by_key = {}
    for cw in extraction["works"]:
        key = (int(cw["gutenbergId"]), title_key(cw["title"]), cw.get("section") or "")
        by_key.setdefault(key, []).append(cw)
    source_ok = {}
    saved = {digest(p.read_bytes()) for p in (CRITIC / "sources").iterdir() if p.is_file()}
    producer_hashes = {s["sha256"] for s in json.loads(producer.MANIFEST.read_text(encoding="utf-8"))["sources"].values()}
    for gid, s in extraction["sources"].items():
        # Independent: fetched from gutenberg.org, kept unchanged, not the producer's file.
        source_ok[int(gid)] = (s["url"].startswith("https://www.gutenberg.org/") and s["sha256"] in saved
                               and s["sha256"] not in producer_hashes)
    manifest = json.loads(producer.MANIFEST.read_text(encoding="utf-8"))
    # A source heading can span several physical lines. Match its complete
    # source text, never merely its last line or an invented display title.
    def source_heading(e):
        a = e.get("headingStartLine", e["headingLine"])
        assert 1 <= a <= e["headingLine"], "invalid heading boundary"
        return " ".join(producer.load(e["sourceFile"])[a - 1:e["headingLine"]]).strip()
    candidates = [(e["id"], manifest["sources"][e["sourceFile"]]["gutenbergId"], source_heading(e),
                   e.get("section", ""), w)
                  for e, w in zip(manifest["works"], producer.render_works(manifest))]
    out, used = {}, set()
    for vid, gid, heading, section, work in candidates:
        key = (gid, title_key(heading), section)
        matches = by_key.get(key, [])
        reasons, warnings = [], []
        if not source_ok.get(gid):
            reasons.append(f"critic has no verified independent gutenberg.org download for #{gid}")
        if len(matches) != 1:
            reasons.append(f"critic found {len(matches)} works titled {heading!r} in #{gid}")
        else:
            used.add(id(matches[0]))
            r, warnings = compare(work["kind"], work["blocks"], matches[0])
            reasons += r
        out[vid] = {"status": "rejected" if reasons else "accepted", "gutenbergId": gid, "title": heading,
                    "blocksSha256": blocks_digest(work["blocks"]), "reasons": reasons, "warnings": warnings,
                    "criticSourceSha256": extraction["sources"].get(str(gid), {}).get("sha256")}
    unmatched = [f"#{cw['gutenbergId']} {cw['title']}" for cw in extraction["works"] if id(cw) not in used]
    return {"version": 1, "extractionSha256": digest(EXTRACTION.read_bytes()), "verdicts": out,
            "criticWorksNotInCatalogue": unmatched}


def rerun_critic():
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "critic-extraction.json"
        subprocess.run([sys.executable, "-I", str(CRITIC / "extract.py"), str(CRITIC / "sources"), str(target)], check=True)
        return target.read_bytes() == EXTRACTION.read_bytes()


def main():
    extraction = json.loads(EXTRACTION.read_text(encoding="utf-8"))
    result = verdicts(extraction)
    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if "--check" in sys.argv:
        assert rerun_critic(), "critic extraction is not reproducible from its saved downloads"
        assert VERDICTS.read_text(encoding="utf-8") == text, "verdicts differ; rerun tools/critic_compare.py"
    else:
        VERDICTS.write_text(text, encoding="utf-8", newline="\n")
    v = result["verdicts"].values()
    rejected = [(k, x["reasons"]) for k, x in result["verdicts"].items() if x["status"] != "accepted"]
    print(f"Accepted {sum(x['status'] == 'accepted' for x in v)} of {len(result['verdicts'])}; rejected {len(rejected)}.")
    for k, r in rejected:
        print(" REJECTED", k, "|", "; ".join(r)[:400])


if __name__ == "__main__":
    main()
