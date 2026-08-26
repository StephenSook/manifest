"""
eval/mcp_server.py

Task 3.2: the eval runner exposed as a stdio MCP tool so Bob can invoke
the regression suite during development.

Architecture:
  This file is a plain stdio FastMCP server. .bob/mcp.json points Bob at
  it with an empty env. The Context Forge gateway (mcp-contextforge-gateway
  on port 4444) was never registered; do not claim it. PLAN 3.2 is parked
  at stdio.

Run standalone (stdio):
  .venv-forge/bin/python -m eval.mcp_server

Tools:
  run_eval        Run the 28+6 bank. mode="fixtures" is offline and safe to
                  call anywhere; mode="url" drives a running /api/ask.
  eval_last_report  Return the most recent eval/report.json summary.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

ROOT = Path(__file__).resolve().parent.parent
RUNNER = ROOT / "eval" / "runner.py"
REPORT = ROOT / "eval" / "report.json"

mcp = FastMCP("manifest-eval")


def _summary(report: dict) -> dict:
    return {
        "mode": report.get("mode"),
        "generatedAt": report.get("generatedAt"),
        "score_pct": report.get("score_pct"),
        "questions_correct": report.get("questions_correct"),
        "questions": report.get("questions"),
        "traps_abstained": report.get("traps_abstained"),
        "traps": report.get("traps"),
        "passed": report.get("passed"),
        "failures": [
            {"id": r["id"], "detail": r["detail"]}
            for r in report.get("results", [])
            if not r.get("pass")
        ],
    }


@mcp.tool()
def run_eval(mode: str = "fixtures", url: str = "http://localhost:3000",
             min_score: float = 50.0) -> dict:
    """Run the 34-row eval bank (28 questions + 6 abstention traps).

    mode="fixtures" scores the committed response fixtures offline (no
    network, no key). mode="url" POSTs every bank question to a running
    deployment's /api/ask at the given url. Returns the scored summary
    with per-question failures. The submission bar is 90 percent with all
    traps abstaining; min_score sets the exit-code threshold only.
    """
    if mode not in ("fixtures", "url"):
        return {"error": "mode must be 'fixtures' or 'url'"}
    cmd = [
        sys.executable, str(RUNNER),
        "--mode", mode,
        "--min-score", str(min_score),
    ]
    if mode == "url":
        cmd += ["--url", url]
    proc = subprocess.run(
        cmd, cwd=str(ROOT), capture_output=True, text=True, timeout=1800,
    )
    if not REPORT.exists():
        return {
            "error": "runner produced no report",
            "exit_code": proc.returncode,
            "stderr": proc.stderr[-2000:],
        }
    report = json.loads(REPORT.read_text())
    out = _summary(report)
    out["exit_code"] = proc.returncode
    return out


@mcp.tool()
def eval_last_report() -> dict:
    """Return the summary of the most recent eval run (eval/report.json)."""
    if not REPORT.exists():
        return {"error": "no report yet: call run_eval first"}
    return _summary(json.loads(REPORT.read_text()))


if __name__ == "__main__":
    mcp.run()
