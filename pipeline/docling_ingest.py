"""
pipeline/docling_ingest.py

Ingest regulatory PDFs through Docling 2.x and produce JSON chunks
for corpus embedding. Tables are extracted and serialized as markdown rows.

PDF sources (local only - never committed, D10):
  - FCC-26-47A1.pdf     Part 100 R&O (FCC 2026)
  - FCC-22-74A1.pdf     5-year orbital disposal rule (FCC 2022)
  - NASA-CubeSat-101.pdf  CubeSat 101 guide (NASA 2017 - flag the age)
  - DAS-3.2-UserGuide.pdf DAS 3.2 User Guide (cited as authority per D4)
  - NASA-STD-8719.14C.pdf NASA debris standard (if available; manual extraction fallback)

Usage:
  uv run --python 3.12 --project pipeline python pipeline/docling_ingest.py
"""

import json
import re
from pathlib import Path
from datetime import date


# -------------------------------------------------------------------------
# Document metadata: amddate and sourceUrl per PDF
# amddate = the document's publication/effective date (not the download date)
# -------------------------------------------------------------------------
PDF_META: dict[str, dict] = {
    "FCC-26-47A1.pdf": {
        "amddate": "2026-07-22",   # FCC 26-47 adopted July 22, 2026
        "sourceUrl": "https://docs.fcc.gov/public/attachments/FCC-26-47A1.pdf",
        "sourceDoc": "FCC 26-47 (Part 100 Report and Order)",
        "age_note": None,
    },
    "FCC-22-74A1.pdf": {
        "amddate": "2022-09-29",   # FCC 22-74 adopted September 29, 2022
        "sourceUrl": "https://docs.fcc.gov/public/attachments/FCC-22-74A1.pdf",
        "sourceDoc": "FCC 22-74 (5-Year Orbital Disposal Rule)",
        "age_note": None,
    },
    "NASA-CubeSat-101.pdf": {
        "amddate": "2017-08-01",   # NASA CubeSat 101, August 2017
        "sourceUrl": "https://www.nasa.gov/wp-content/uploads/2017/08/nasa_csli_cubesat_101_508.pdf",
        "sourceDoc": "NASA CubeSat 101 (2017)",
        "age_note": "[Source: NASA CubeSat 101, August 2017. Note: figures and durations date to 2017.]",
    },
    "DAS-3.2-UserGuide.pdf": {
        "amddate": "2024-01-01",   # DAS 3.2 guide, approximately 2024 ESTIMATED
        "sourceUrl": "https://www.orbitaldebris.jsc.nasa.gov/library/das/DAS3.2_UsersGuide.pdf",
        "sourceDoc": "NASA DAS 3.2 User Guide (cited as authority per D4 - not a DAS run)",
        "age_note": "[Source: NASA DAS 3.2 User Guide. Note: DAS is cited as authority; Manifest computes independent NRLMSISE-00 estimates per D4.]",
    },
    "NASA-STD-8719.14C.pdf": {
        "amddate": "2019-09-27",   # NASA-STD-8719.14C, September 2019
        "sourceUrl": "https://standards.nasa.gov/standard/nasa/nasa-std-871914c",
        "sourceDoc": "NASA-STD-8719.14C (Process for Limiting Orbital Debris)",
        "age_note": None,
    },
}

# Minimum characters for a chunk to be worth keeping
MIN_CHUNK_CHARS = 40


def table_to_text(table, doc=None) -> str:
    """Convert a Docling table to a markdown-style text block."""
    try:
        # Docling 2.x requires doc argument for export_to_dataframe
        df = table.export_to_dataframe(doc=doc) if doc is not None else table.export_to_dataframe()
        if df is None or df.empty:
            return ""
        lines = ["| " + " | ".join(str(v) for v in df.columns) + " |"]
        lines.append("| " + " | ".join(["---"] * len(df.columns)) + " |")
        for _, row in df.iterrows():
            lines.append("| " + " | ".join(str(v) for v in row.values) + " |")
        return "\n".join(lines)
    except Exception:
        # Fallback: export to markdown directly
        try:
            return table.export_to_markdown()
        except Exception:
            return ""


def chunk_document(doc, meta: dict, pdf_stem: str) -> list[dict]:
    """
    Convert a Docling DoclingDocument into JSON chunks.
    One chunk per page section. Tables are serialized inline.
    """
    chunks = []
    chunk_index = 0

    # Export full document text as a list of text blocks
    # Docling 2.x: iterate doc.texts for text items and doc.tables for tables
    try:
        all_items = list(doc.iterate_items())
    except AttributeError:
        # Fallback to export_to_markdown and split by page
        md = doc.export_to_markdown()
        pages = md.split("\n\n")
        for page_idx, text in enumerate(pages):
            text = text.strip()
            if len(text) < MIN_CHUNK_CHARS:
                continue
            age_note = meta.get("age_note", "")
            if age_note:
                text = f"{age_note} {text}"
            chunk_id = f"pdf-{pdf_stem}-p{page_idx:03d}"
            chunks.append({
                "id": chunk_id,
                "cfrTitle": 0,
                "part": 0,
                "section": "",
                "paragraphPath": "",
                "text": text,
                "amddate": meta["amddate"],
                "sourceUrl": meta["sourceUrl"],
                "sourceDoc": meta["sourceDoc"],
                "page": page_idx,
            })
        return chunks

    current_page = 0
    current_texts: list[str] = []

    def flush_page():
        nonlocal current_texts, chunk_index
        text = " ".join(current_texts).strip()
        # Clean up excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        if len(text) < MIN_CHUNK_CHARS:
            current_texts = []
            return
        age_note = meta.get("age_note", "")
        if age_note:
            text = f"{age_note} {text}"
        chunk_id = f"pdf-{pdf_stem}-p{current_page:03d}-c{chunk_index:03d}"
        chunks.append({
            "id": chunk_id,
            "cfrTitle": 0,
            "part": 0,
            "section": "",
            "paragraphPath": "",
            "text": text,
            "amddate": meta["amddate"],
            "sourceUrl": meta["sourceUrl"],
            "sourceDoc": meta["sourceDoc"],
            "page": current_page,
        })
        chunk_index += 1
        current_texts = []

    for item, level in all_items:
        # Get page number
        prov = getattr(item, 'prov', [])
        page = prov[0].page_no if prov else current_page
        if page != current_page:
            flush_page()
            current_page = page

        item_type = type(item).__name__
        if item_type in ('TextItem', 'SectionHeaderItem', 'ListItem'):
            text = getattr(item, 'text', '') or ''
            if text.strip():
                current_texts.append(text.strip())
        elif item_type == 'TableItem':
            # Flush preceding text first
            flush_page()
            # Then emit the table as its own chunk
            table_text = table_to_text(item, doc=doc)
            if table_text and len(table_text) >= MIN_CHUNK_CHARS:
                age_note = meta.get("age_note", "")
                if age_note:
                    table_text = f"{age_note} {table_text}"
                chunk_id = f"pdf-{pdf_stem}-p{current_page:03d}-table-c{chunk_index:03d}"
                chunks.append({
                    "id": chunk_id,
                    "cfrTitle": 0,
                    "part": 0,
                    "section": "",
                    "paragraphPath": "",
                    "text": table_text,
                    "amddate": meta["amddate"],
                    "sourceUrl": meta["sourceUrl"],
                    "sourceDoc": meta["sourceDoc"],
                    "page": current_page,
                    "is_table": True,
                })
                chunk_index += 1

    flush_page()
    return chunks


def main():
    raw_dir = Path("pipeline/raw")
    output_dir = Path("corpus/chunks")
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        from docling.document_converter import DocumentConverter
    except ImportError as exc:
        raise SystemExit(f"docling not installed: {exc}")

    converter = DocumentConverter()

    for pdf_name, meta in PDF_META.items():
        pdf_path = raw_dir / pdf_name
        if not pdf_path.exists():
            print(f"  SKIP {pdf_name} (not found - manual extraction required)")
            # Write an empty marker so downstream knows it was attempted
            output_file = output_dir / f"pdf-{pdf_path.stem}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump([], f)
            continue

        # Validate it is actually a PDF before running Docling
        with open(pdf_path, 'rb') as fh:
            header = fh.read(4)
        if header != b'%PDF':
            print(f"  SKIP {pdf_name} (not a valid PDF - file starts with {header!r})")
            continue

        print(f"Processing {pdf_name} ({pdf_path.stat().st_size // 1024}K)...")
        try:
            result = converter.convert(str(pdf_path))
            doc = result.document
            chunks = chunk_document(doc, meta, pdf_path.stem)
        except Exception as exc:
            print(f"  ERROR: {exc}")
            chunks = []

        output_file = output_dir / f"pdf-{pdf_path.stem}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(chunks, f, indent=2, ensure_ascii=False)

        table_count = sum(1 for c in chunks if c.get('is_table'))
        print(f"  Wrote {len(chunks)} chunks ({table_count} tables) to {output_file}")

    print("\nDocling ingest complete.")
    print(f"Generated at: {date.today().isoformat()}")


if __name__ == "__main__":
    main()
