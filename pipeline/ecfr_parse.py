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
                chunks.extend(list(parse_part(el, 47)))
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
            chunks = list(parse_part(el, 15))
            output_file = output_dir / "title15-part960.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(chunks, f, indent=2, ensure_ascii=False)
            print(f"  Wrote {len(chunks)} chunks to {output_file}")
            break

    print("\neCFR parse complete.")
    print(f"AMDDATEs: Title 47 = {AMDDATE_BY_TITLE[47]}, Title 15 = {AMDDATE_BY_TITLE[15]}")


if __name__ == "__main__":
    main()
