"""Damaged inputs must be rejected by the comparator. Run: python -I tools/test_critic_compare.py"""
import copy
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import critic_compare as cc  # noqa: E402
import generate_source_catalogue as producer  # noqa: E402

extraction = json.loads(cc.EXTRACTION.read_text(encoding="utf-8"))
manifest = json.loads(producer.MANIFEST.read_text(encoding="utf-8"))
works = {w["id"]: w for w in producer.render_works(manifest)}


def critic(title):
    return next(w for w in extraction["works"] if cc.title_key(w["title"]) == cc.title_key(title))


def last_text(lines):
    return max(i for i, l in enumerate(lines) if l.strip())


cases = 0


def must_reject(work_id, title, damage, label):
    global cases
    cw = copy.deepcopy(critic(title))
    damage(cw)
    reasons, _ = cc.compare(works[work_id]["kind"], works[work_id]["blocks"], cw)
    assert reasons, label + " was not rejected"
    cases += 1


def must_accept(work_id, title):
    reasons, _ = cc.compare(works[work_id]["kind"], works[work_id]["blocks"], critic(title))
    assert not reasons, reasons


must_accept("blake-sick-rose", "THE SICK ROSE")
must_accept("ohenry-magi", "THE GIFT OF THE MAGI")
must_accept("bacon-truth", "Of Truth")

for wid, title in [("blake-sick-rose", "THE SICK ROSE"), ("ohenry-magi", "THE GIFT OF THE MAGI"), ("bacon-truth", "Of Truth")]:
    def changed_word(cw):
        i = last_text(cw["lines"])
        cw["lines"][i] = cw["lines"][i].replace(cw["lines"][i].split()[0], "Altered", 1)
    must_reject(wid, title, changed_word, f"{wid}: changed word")

    def changed_punctuation(cw):
        i = next(i for i, l in enumerate(cw["lines"]) if any(c in l for c in ",;:."))
        cw["lines"][i] = next(cw["lines"][i].replace(c, "", 1) for c in ",;:." if c in cw["lines"][i])
    must_reject(wid, title, changed_punctuation, f"{wid}: dropped punctuation")

    def capital(cw):
        cw["lines"][0] = cw["lines"][0].swapcase()
    must_reject(wid, title, capital, f"{wid}: changed capitals")

    def truncated(cw):
        del cw["lines"][last_text(cw["lines"])]
    must_reject(wid, title, truncated, f"{wid}: truncated ending")

    def extended(cw):
        cw["lines"] += ["", "An invented closing line."]
    must_reject(wid, title, extended, f"{wid}: invented addition")

    def incomplete(cw):
        cw["complete"] = False
    must_reject(wid, title, incomplete, f"{wid}: critic says incomplete")


def merged_stanzas(cw):
    cw["lines"] = [l for l in cw["lines"] if l.strip()]
    cw.pop("indents", None)
must_reject("blake-sick-rose", "THE SICK ROSE", merged_stanzas, "merged stanzas")


def joined_lines(cw):
    cw["lines"][0:2] = [cw["lines"][0] + " " + cw["lines"][1]]
    cw.pop("indents", None)
must_reject("blake-sick-rose", "THE SICK ROSE", joined_lines, "two verse lines joined")


def lost_indent(cw):
    cw["indents"] = [0 for _ in cw["indents"]]
must_reject("blake-sick-rose", "THE SICK ROSE", lost_indent, "stepped indentation lost")

# Damage on the producer side (the text the app would show).
def producer_must_reject(work_id, title, damage, label):
    global cases
    blocks = copy.deepcopy(works[work_id]["blocks"])
    damage(blocks)
    reasons, _ = cc.compare(works[work_id]["kind"], blocks, critic(title))
    assert reasons, label + " was not rejected"
    cases += 1


def first_with(blocks, ch):
    return next(b for b in blocks if ch in b["text"])


def swap_quote(blocks):
    b = first_with(blocks, "’")
    b["text"] = b["text"].replace("’", "‘", 1)
producer_must_reject("ohenry-magi", "THE GIFT OF THE MAGI", swap_quote, "right quote turned left")


def open_to_close(blocks):
    b = first_with(blocks, "“")
    b["text"] = b["text"].replace("“", "”", 1)
producer_must_reject("ohenry-magi", "THE GIFT OF THE MAGI", open_to_close, "opening quote turned closing")


def merge_paragraphs(blocks):
    blocks[0:2] = [{"type": "para", "text": blocks[0]["text"] + " " + blocks[1]["text"]}]
producer_must_reject("ohenry-magi", "THE GIFT OF THE MAGI", merge_paragraphs, "two paragraphs merged")


def split_paragraph(blocks):
    words = blocks[0]["text"].split(" ")
    blocks[0:1] = [{"type": "para", "text": " ".join(words[:5])}, {"type": "para", "text": " ".join(words[5:])}]
producer_must_reject("ohenry-magi", "THE GIFT OF THE MAGI", split_paragraph, "paragraph split mid-sentence")


def deeper_indent(blocks):
    line = next(l for b in blocks for l in b["lines"] if l["indent"] > 0)
    line["indent"] += 8
producer_must_reject("blake-sick-rose", "THE SICK ROSE", deeper_indent, "indent made deeper")


def indent_joined_poem(blocks):
    blocks[0]["lines"][1]["indent"] = 4
producer_must_reject("whitman-astronomer", "When I Heard the Learn’d Astronomer", indent_joined_poem, "indent added to a rejoined poem")


def unjoined_wrap(blocks):
    line = blocks[0]["lines"][0]
    head, tail = line["text"].rsplit(" ", 1)
    blocks[0]["lines"][0:1] = [{"text": head, "indent": 0}, {"text": tail, "indent": 4}]
producer_must_reject("whitman-astronomer", "When I Heard the Learn’d Astronomer", unjoined_wrap, "a verse line split in two")


def dropped_stanza(blocks):
    del blocks[-1]
producer_must_reject("blake-sick-rose", "THE SICK ROSE", dropped_stanza, "last stanza dropped")


# Source independence: a critic copy from the producer's host, or a file the
# critic did not keep unchanged, means no acceptance for that book at all.
for url_fault in ["https://raw.githubusercontent.com/GITenberg/x/y/1934.txt", None]:
    bad = copy.deepcopy(extraction)
    if url_fault:
        bad["sources"]["1934"]["url"] = url_fault
    else:
        bad["sources"]["1934"]["sha256"] = "0" * 64
    result = cc.verdicts(bad)["verdicts"]
    assert result["blake-sick-rose"]["status"] == "rejected", url_fault
    assert result["bacon-truth"]["status"] == "accepted"
    cases += 1

# New editions exercise the same exact-text boundary independently of old works.
for wid, title in [
    ("w-b-yeats-the-song-of-wandering-aengus", "THE SONG OF WANDERING AENGUS"),
    ("edgar-allan-poe-the-tell-tale-heart", "THE TELL-TALE HEART."),
    ("thomas-de-quincey-on-the-knocking-at-the-gate-in-macbeth", "ON THE KNOCKING AT THE GATE, IN MACBETH."),
    ("rabindranath-tagore-realisation-in-love", "REALISATION IN LOVE"),
]:
    must_accept(wid, title)
    def remove_end(cw):
        # Every edition's final words must be included, not just its beginning.
        i = last_text(cw["lines"])
        cw["lines"][i] = " ".join(cw["lines"][i].split()[:-1])
    must_reject(wid, title, remove_end, wid + ": final word removed")
    def not_complete(cw):
        cw["complete"] = False
    must_reject(wid, title, not_complete, wid + ": independent completeness denied")

assert producer.unitalic("_a brute beast _—next") == "a brute beast —next"
assert producer.unitalic("_verse line\nnext line_") == "verse line\nnext line"
assert producer.unitalic("N_w Yo_k") == "N_w Yo_k"
assert producer.unitalic("_unfinished") == "_unfinished"
print(f"Comparator rejected all {cases} damaged inputs and accepted the undamaged ones.")
