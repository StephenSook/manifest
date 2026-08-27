"""Native iOS guardrails that are not exercised by browser-only tests."""

from pathlib import Path


SCENE_DELEGATE = (
    Path(__file__).resolve().parent.parent / "ios" / "App" / "App" / "SceneDelegate.swift"
)


def test_status_bar_cover_uses_the_exact_top_safe_area() -> None:
    source = SCENE_DELEGATE.read_text()

    assert "ManifestBridgeViewController()" in source
    assert "view.safeAreaLayoutGuide.topAnchor" in source
    assert "statusBarCover.isUserInteractionEnabled = false" in source
