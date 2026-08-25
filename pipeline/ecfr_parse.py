"""
pipeline/ecfr_parse.py

Parse eCFR bulk XML snapshots into JSON chunks for corpus embedding.

Critical parsing rule: citation paragraph paths come from parsing the hardcoded
paragraph labels inside <P> elements, NOT from element nesting, NOT from the NODE attribute.

Usage:
  uv run --python 3.12 --project pipeline python pipeline/ecfr_parse.py
"""

import json
import re
from pathlib import Path
from lxml import etree
from typing import Iterator


# AMDDATE values from eCFR versioner API (https://www.ecfr.gov/api/versioner/v1/titles.json)
# Title 47 last amended: 2026-08-13
# Title 15 last amended: 2026-08-18
AMDDATE_BY_TITLE = {
    47: "2026-08-13",
    15: "2026-08-18",
}


def extract_paragraph_label(text: str) -> tuple[str, str]:
    """
    Extract paragraph label from the start of text (e.g. "(g)", "(g)(1)", "(g)(1)(i)").
    Returns (label, remaining_text).
    If no label found, returns ("", text).
    """
    # Pattern: one or more nested parenthetical labels at the start
    # Examples: (g), (g)(1), (g)(1)(i), (1), (i), (A)
    pattern = r'^(\([a-zA-Z0-9]+\)(\([a-zA-Z0-9]+\))*)\s*'
    match = re.match(pattern, text.strip())
    if match:
        label = match.group(1)
        remaining = text[match.end():]
        return (label, remaining)
    return ("", text)


# Roman numerals that appear as CFR subparagraph labels.
_ROMAN = {
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8,
    "ix": 9, "x": 10, "xi": 11, "xii": 12, "xiii": 13, "xiv": 14, "xv": 15,
    "xvi": 16, "xvii": 17, "xviii": 18, "xix": 19, "xx": 20,
}


def _classify_label(label: str, stack: list[tuple[str, str]]) -> tuple[str, str]:
    """Return (type, token) for a single parenthetical like '(g)' or '(1)'."""
    inner = label.strip()[1:-1]
    if inner.isdigit():
        return "num", inner
    if len(inner) == 1 and inner.isupper() and inner.isalpha():
        return "caps", inner
    if inner in _ROMAN:
        if stack and stack[-1][0] in ("num", "roman"):
            return "roman", inner
        if inner == "i" and stack and stack[-1][0] == "letter" and stack[-1][1] == "h":
            return "letter", inner
        if stack and stack[-1][0] == "letter" and len(inner) == 1:
            return "letter", inner
        return "roman", inner
    if len(inner) == 1 and inner.islower() and inner.isalpha():
        return "letter", inner
    return "other", inner


_FIRST_TOKENS = {"num": "1", "letter": "a", "caps": "A", "roman": "i"}


def _is_forward_sibling(typ: str, prev: str, tok: str) -> bool:
    """tok continues prev's list at the same level, allowing gaps.

    CFR numbering skips reserved and removed labels, so consecutive
    ordinals cannot be assumed: 97.3(a) jumps from (2) to (4), and treating
    (4) as a child of (2) corrupts every later path in the section.
    """
    if typ in ("letter", "caps"):
        return len(prev) == 1 and len(tok) == 1 and ord(tok) > ord(prev)
    if typ == "num":
        return int(tok) > int(prev)
    if typ == "roman":
        return _ROMAN.get(tok, -99) > _ROMAN.get(prev, -1)
    return False


def _apply_label(stack: list[tuple[str, str]], typ: str, tok: str) -> None:
    # A first ordinal ((1), (a), (i), (A)) opens a child level under the
    # current top; lists never continue INTO their first ordinal. Any other
    # ordinal continues the nearest open list of its type that it moves
    # forward, even across numbering gaps.
    if tok != _FIRST_TOKENS.get(typ):
        for i in range(len(stack) - 1, -1, -1):
            if stack[i][0] == typ and _is_forward_sibling(typ, stack[i][1], tok):
                del stack[i + 1 :]
                stack[i] = (typ, tok)
                return
    stack.append((typ, tok))


def reconstruct_nested_paths(
    chunks: list[dict], *, provenance: str
) -> list[dict]:
    """
    eCFR <P> text usually carries only the innermost label: '(1)' not '(g)(1)'.
    Walk each section in document order and rebuild the full paragraphPath
    by sibling-continuation of the CFR hierarchy (letter / number / roman / cap).

    provenance MUST be the literal "raw-xml", declared by the caller. This
    transform is only defined over labels as parsed from the raw eCFR bulk
    XML. It is NOT idempotent, and no ratio heuristic can reliably tell raw
    from reconstructed input (Codex round 4: reconstructed 960.8 measures
    30.8 percent multi-segment, under any usable cutoff, and a second pass
    corrupted 8 of 14 of its paths). Anything except an explicit raw-xml
    declaration fails closed instead of guessing.
    """
    if provenance != "raw-xml":
        raise ValueError(
            "reconstruct_nested_paths only accepts provenance='raw-xml', "
            f"got {provenance!r}. Re-running reconstruction on its own "
            "output corrupts paths; regenerate from pipeline/raw instead "
            "(see repair_committed_chunks)."
        )

    by_section: dict[tuple, list[dict]] = {}
    order: list[tuple] = []
    for c in chunks:
        key = (c.get("cfrTitle"), c.get("part"), c.get("section"))
        if key not in by_section:
            by_section[key] = []
            order.append(key)
        by_section[key].append(c)

    repaired: list[dict] = []
    for key in order:
        stack: list[tuple[str, str]] = []
        for c in by_section[key]:
            lab = c.get("paragraphPath") or ""
            if not lab:
                repaired.append(c)
                continue
            segs = re.findall(r"\([^)]+\)", lab)
            # Multi-segment labels from the XML can be ABSOLUTE ("(a)(1)")
            # or PARTIAL ("(4)(i)" relative to an open (c) list). Applying
            # each segment through the same sibling/child logic handles
            # both: an absolute path's first segment continues or opens at
            # the right level, and a partial path merges into the open
            # hierarchy instead of resetting it.
            for seg in segs:
                typ, tok = _classify_label(seg, stack)
                _apply_label(stack, typ, tok)
            path = "".join(f"({t})" for _, t in stack)
            updated = dict(c)
            updated["paragraphPath"] = path
            cid = f"{updated['cfrTitle']}-{updated['part']}-{updated['section']}"
            if path:
                cid += f"-{path.replace('(', '').replace(')', '_')}"
            updated["id"] = cid
            repaired.append(updated)
    return repaired


def parse_part(part_element: etree._Element, cfr_title: int) -> Iterator[dict]:
    """
    Parse a DIV5:PART element and yield chunks for each Section and paragraph.
    """
    part_num_raw = part_element.get('N', '')
    if not part_num_raw:
        return

    # Part number is typically just digits (e.g. "97", "960")
    part_num = int(re.search(r'\d+', part_num_raw).group()) if re.search(r'\d+', part_num_raw) else None
    if part_num is None:
        return

    amddate = AMDDATE_BY_TITLE.get(cfr_title, "")
    if not amddate:
        raise ValueError(f"AMDDATE not defined for Title {cfr_title}")

    # Find all DIV8:SECTION elements within this part
    for section_el in part_element.iter():
        tag = section_el.tag.split('}')[-1] if '}' in section_el.tag else section_el.tag
        if tag != 'DIV8':
            continue

        section_n = section_el.get('N', '').strip()
        if not section_n:
            continue

        # Section N is typically "§ 97.207" or "§ 960.10"
        # Extract the numeric section (e.g. "97.207", "960.10")
        section_match = re.search(r'(\d+)\.(\d+)', section_n)
        if not section_match:
            continue
        section_num = section_match.group(0)  # e.g. "97.207"

        # Parse all P elements in this section
        for p_el in section_el.findall('P'):
            text = ''.join(p_el.itertext()).strip()
            if not text:
                continue

            # Extract paragraph label from the start of the text
            paragraph_path, clean_text = extract_paragraph_label(text)

            # Build chunk ID
            chunk_id = f"{cfr_title}-{part_num}-{section_num}"
            if paragraph_path:
                chunk_id += f"-{paragraph_path.replace('(','').replace(')','_')}"

            sourceUrl = f"https://www.govinfo.gov/bulkdata/ECFR/title-{cfr_title}/ECFR-title{cfr_title}.xml"

            yield {
                "id": chunk_id,
                "cfrTitle": cfr_title,
                "part": part_num,
                "section": section_num,
                "paragraphPath": paragraph_path,
                "text": clean_text,
                "amddate": amddate,
                "sourceUrl": sourceUrl,
            }


def main():
    raw_dir = Path("pipeline/raw")
    output_dir = Path("corpus/chunks")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Parse Title 47 Parts 5, 25, 97
    title47_file = raw_dir / "ECFR-title47.xml"
    print(f"Parsing {title47_file}...")
    tree47 = etree.parse(str(title47_file))
    root47 = tree47.getroot()

    for part_target in ["5", "25", "97"]:
        chunks = []
        for el in root47.iter():
            tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
            n = el.get('N', '')
            typ = el.get('TYPE', '')
            # Match DIV5:PART with N=part_target
            if tag == 'DIV5' and typ == 'PART' and n == part_target:
                print(f"  Found Part {part_target}")
                chunks.extend(
                    reconstruct_nested_paths(
                        list(parse_part(el, 47)), provenance="raw-xml"
                    )
                )
                break

        output_file = output_dir / f"title47-part{part_target}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(chunks, f, indent=2, ensure_ascii=False)
        print(f"  Wrote {len(chunks)} chunks to {output_file}")

    # Parse Title 15 Part 960
    title15_file = raw_dir / "ECFR-title15.xml"
    print(f"\nParsing {title15_file}...")
    tree15 = etree.parse(str(title15_file))
    root15 = tree15.getroot()

    for el in root15.iter():
        tag = el.tag.split('}')[-1] if '}' in el.tag else el.tag
        n = el.get('N', '')
        typ = el.get('TYPE', '')
        if tag == 'DIV5' and typ == 'PART' and n == "960":
            print(f"  Found Part 960")
            chunks = reconstruct_nested_paths(
                list(parse_part(el, 15)), provenance="raw-xml"
            )
            output_file = output_dir / "title15-part960.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(chunks, f, indent=2, ensure_ascii=False)
            print(f"  Wrote {len(chunks)} chunks to {output_file}")
            break

    print("\neCFR parse complete.")
    print(f"AMDDATEs: Title 47 = {AMDDATE_BY_TITLE[47]}, Title 15 = {AMDDATE_BY_TITLE[15]}")


def repair_committed_chunks() -> None:
    """REFUSED: in-place repair of reconstructed paths loses information.

    Reconstruction consumes RAW innermost labels. Committed chunks carry
    reconstructed absolute paths; re-running the transform over them
    corrupts valid hierarchy (Codex round-3: a second pass changed 1,461
    paths). The only safe repair is regeneration from the raw XML:
    download to pipeline/raw/ and run this script with no flags.
    """
    print("--repair-only is refused: reconstructed paths cannot be safely")
    print("re-reconstructed in place. Regenerate from pipeline/raw/ECFR-*.xml")
    print("by running pipeline/ecfr_parse.py with no flags.")
    sys.exit(2)


if __name__ == "__main__":
    import sys
    if "--repair-only" in sys.argv:
        repair_committed_chunks()
    else:
        main()
