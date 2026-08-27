"""Failure-path tests for the native static-export wrapper."""

from __future__ import annotations

import os
import signal
import shutil
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
BUILD_SCRIPT = REPO_ROOT / "scripts" / "build-mobile.sh"


def make_fixture(tmp_path: Path) -> tuple[Path, dict[str, str]]:
    root = tmp_path / "repo"
    (root / "scripts").mkdir(parents=True)
    (root / "app" / "api").mkdir(parents=True)
    (root / "bin").mkdir()
    shutil.copy2(BUILD_SCRIPT, root / "scripts" / "build-mobile.sh")
    (root / "app" / "api" / "marker.txt").write_text("api")
    (root / "scripts" / "run_status.ts").write_text("status")
    (root / "app" / "manifest.ts").write_text("manifest")

    fake_npx = root / "bin" / "npx"
    fake_npx.write_text(
        "#!/usr/bin/env bash\n"
        "if [ \"${MOBILE_TEST_BLOCK:-0}\" = \"1\" ]; then\n"
        "  echo mobile-test-ready $$\n"
        "  exec python3 -c 'import time; time.sleep(30)'\n"
        "fi\n"
        "exit 0\n"
    )
    fake_npx.chmod(0o755)
    env = os.environ.copy()
    env["PATH"] = f"{root / 'bin'}{os.pathsep}{env['PATH']}"
    return root, env


def run_build(root: Path, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["bash", "scripts/build-mobile.sh"],
        cwd=root,
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
    )


def assert_sources_intact(root: Path) -> None:
    assert (root / "app" / "api" / "marker.txt").read_text() == "api"
    assert (root / "scripts" / "run_status.ts").read_text() == "status"
    assert (root / "app" / "manifest.ts").read_text() == "manifest"
    assert not (root / ".mobile-build-hold").exists()


def test_sigterm_restores_every_moved_source(tmp_path: Path) -> None:
    root, env = make_fixture(tmp_path)
    env["MOBILE_TEST_BLOCK"] = "1"
    process = subprocess.Popen(
        ["bash", "scripts/build-mobile.sh"],
        cwd=root,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    assert process.stdout is not None
    ready, child_pid_text = process.stdout.readline().strip().split()
    assert ready == "mobile-test-ready"
    child_pid = int(child_pid_text)

    os.kill(process.pid, signal.SIGTERM)
    try:
        returncode = process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        os.kill(child_pid, signal.SIGTERM)
        returncode = process.wait(timeout=5)
    finally:
        try:
            os.kill(child_pid, signal.SIGTERM)
        except ProcessLookupError:
            pass

    assert returncode != 0
    assert_sources_intact(root)


def test_existing_hold_directory_is_refused_without_mutation(tmp_path: Path) -> None:
    root, env = make_fixture(tmp_path)
    hold = root / ".mobile-build-hold"
    hold.mkdir()
    (hold / "recovery-marker.txt").write_text("preserve")

    result = run_build(root, env)

    assert result.returncode != 0
    assert "already exists" in result.stderr
    assert (hold / "recovery-marker.txt").read_text() == "preserve"
    assert (root / "app" / "api" / "marker.txt").read_text() == "api"
    assert (root / "scripts" / "run_status.ts").read_text() == "status"
    assert (root / "app" / "manifest.ts").read_text() == "manifest"


def test_missing_source_is_refused_without_partial_move(tmp_path: Path) -> None:
    root, env = make_fixture(tmp_path)
    (root / "app" / "manifest.ts").unlink()

    result = run_build(root, env)

    assert result.returncode != 0
    assert "missing required mobile build source" in result.stderr
    assert (root / "app" / "api" / "marker.txt").read_text() == "api"
    assert (root / "scripts" / "run_status.ts").read_text() == "status"
    assert not (root / ".mobile-build-hold").exists()
