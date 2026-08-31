#!/bin/sh
# Launch the Manifest eval MCP server for IBM Bob, from any working directory.
#
# Why a launcher rather than a bare command in mcp.json. Each reason is a way a
# judge's Bob session fails SILENTLY, which is worse than failing loudly: an MCP
# server that cannot start shows up inside Bob as a server with no tools, and
# that reads as "this project's MCP does not work" rather than "you are missing
# an interpreter".
#
# 1. The working directory. mcp.json takes a cwd, but rather than depend on the
#    host honouring it, this script moves to the repository root itself. $0's
#    directory is .bob/, so the parent is the root. A judge who opens Bob from a
#    subfolder still gets a server that finds eval/ and corpus/.
#
# 2. Which interpreter. .bob/mcp.json used to hardcode `.venv-forge/bin/python`.
#    That path is in .gitignore and is documented nowhere, so on a fresh clone it
#    does not exist and the server never starts. The project venv is preferred
#    because it is the interpreter the eval suite was run under; python3 is the
#    fallback, since eval/mcp_server.py holds to the standard library plus the
#    corpus reader.
#
# 3. A missing interpreter must SAY SO. Falling through to nothing leaves Bob
#    holding a server that never answers initialize.
#
# Borrowed from a rival (batch 11, TraceTriage), which ships exactly this
# launcher with exactly these reasons written down, and then wires it as
# `cmd /c .bob\run-evidence.cmd`. `cmd` does not exist on macOS or Linux, so
# their runnable Bob artifact is dead for every judge not on Windows. The idea
# is theirs and it is a good one. The implementation has to be portable or it
# reproduces the bug it was written to prevent, which is why this is /bin/sh and
# not bash, zsh or cmd.

set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$REPO_ROOT"

if [ -n "${MANIFEST_PYTHON:-}" ]; then
  exec "$MANIFEST_PYTHON" -m eval.mcp_server
fi

for candidate in .venv-forge/bin/python .venv/bin/python; do
  if [ -x "$candidate" ]; then
    exec "$candidate" -m eval.mcp_server
  fi
done

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m eval.mcp_server
fi

echo "manifest-eval MCP server cannot start: no Python interpreter found." >&2
echo "Looked for \$MANIFEST_PYTHON, .venv-forge/bin/python, .venv/bin/python, then python3." >&2
echo "Repository root resolved to: $REPO_ROOT" >&2
echo "Install Python 3.11 or newer, or set MANIFEST_PYTHON to an interpreter." >&2
exit 127
