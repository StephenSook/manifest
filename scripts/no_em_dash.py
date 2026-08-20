"""
no_em_dash.py

Checks all tracked and untracked text files in the repo for em-dash characters (U+2014).
Uses git ls-files --cached --others --exclude-standard so it catches files about to be added.

Usage:
  python scripts/no_em_dash.py --check   # exits 1 if any em-dash found
  python scripts/no_em_dash.py           # prints report, exits 0

CI: run bare with no pipe. The exit code is the gate.
"""

import argparse
import subprocess
import sys

# File extensions to scan (text files only)
TEXT_EXTENSIONS = {
    ".md", ".ts", ".tsx", ".js", ".jsx", ".py",
    ".json", ".yaml", ".yml", ".txt", ".toml", ".sh",
    ".html", ".css", ".env.example",
}

EM_DASH = "\u2014"


def get_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ERROR: git ls-files failed: {result.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
    return [f.strip() for f in result.stdout.splitlines() if f.strip()]


def should_scan(path: str) -> bool:
    import os
    _, ext = os.path.splitext(path)
    # handle .env.example and similar dotfiles with compound names
    if path.endswith(".env.example"):
        return True
    return ext.lower() in TEXT_EXTENSIONS


def scan_file(path: str) -> list[tuple[int, str]]:
    violations: list[tuple[int, str]] = []
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for lineno, line in enumerate(fh, start=1):
                if EM_DASH in line:
                    violations.append((lineno, line.rstrip()))
    except (OSError, IsADirectoryError):
        pass
    return violations


def main() -> None:
    parser = argparse.ArgumentParser(description="Check for em-dash characters in repo files.")
    parser.add_argument("--check", action="store_true", help="Exit 1 if any em-dash found")
    args = parser.parse_args()

    all_files = get_files()
    scanned = [f for f in all_files if should_scan(f)]

    if not scanned:
        print("ERROR: no files scanned. Guard resolved an empty file set.", file=sys.stderr)
        sys.exit(1)

    total_violations = 0
    for path in scanned:
        hits = scan_file(path)
        for lineno, line in hits:
            print(f"{path}:{lineno}: em-dash found: {line!r}")
            total_violations += 1

    print(f"Scanned {len(scanned)} files. Found {total_violations} em-dash violation(s).")

    if args.check and total_violations > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
