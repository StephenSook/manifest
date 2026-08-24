# Manual Extractions

Files in this directory are manually extracted corpus chunks for documents
where Docling could not produce a valid output. Each file follows the same
JSON schema as the automated chunks.

## NASA-STD-8719.14C

**Status:** NOT EXTRACTED - document is behind the NASA Technical Standards
System login wall (standards.nasa.gov requires an account).

**What this document contains:** Process for Limiting Orbital Debris, the
NASA standard governing debris assessment requirements for spacecraft design
and operations. Revision C published September 2019.

**How it is used in Manifest:** Cited as authority for NASA debris assessment
requirements. The actual orbital lifetime computation uses NRLMSISE-00 via
pyatmos (pipeline/decay.py) per D4 (DAS is cited, not run).

**Citation path for /api/ask:** Any answer citing NASA-STD-8719.14C must
abstain and direct the user to the NASA Technical Standards System at
https://standards.nasa.gov/standard/nasa/nasa-std-871914c because no
ingested text is available to support a citation-bearing answer.

**Workaround:** The DAS 3.2 User Guide (pdf-DAS-3.2-UserGuide.json) covers
the same debris assessment methodology and is fully ingested.
