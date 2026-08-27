"""Regression tests for the generated fact staleness gate."""

from __future__ import annotations

import copy
import json

import pytest

from scripts import facts


def measured_facts(headline_days: int) -> dict:
    return {
        "differentiator": {
            "lifetime_years_nominal": 7.0,
            "lifetime_years_solar_min": 15.0,
            "lifetime_years_solar_max": 2.57,
            "verdict_solar_min": "VIOLATED",
            "verdict_solar_max": "OK",
            "verdict_nominal": "VIOLATED",
        },
        "engine": {
            "test_count": 112,
            "ask_route_test_count": 81,
            "test_count_total": 193,
        },
        "eval": {
            "score_pct": 53.6,
            "questions_correct": 15,
            "questions_total": 28,
            "traps_total": 6,
            "traps_abstained": 6,
            "rows_scored": 34,
        },
        "headline": {
            "deadline_violations_days": headline_days,
            "violated_node_count": 3,
            "violated_nodes": ["A", "B", "C"],
            "node_count": 12,
        },
    }


def test_check_rejects_a_stale_time_varying_headline(
    tmp_path, monkeypatch, capsys
) -> None:
    existing = measured_facts(162)
    fresh = measured_facts(163)
    facts_path = tmp_path / "FACTS.json"
    facts_path.write_text(json.dumps(existing))
    monkeypatch.setattr(facts, "FACTS_OUT", facts_path)
    monkeypatch.setattr(facts, "compute_facts", lambda: fresh)

    with pytest.raises(SystemExit):
        facts.check_not_stale()

    assert "headline.deadline_violations_days" in capsys.readouterr().err


def test_check_fails_closed_when_headline_cannot_be_measured(
    tmp_path, monkeypatch, capsys
) -> None:
    existing = measured_facts(162)
    fresh = copy.deepcopy(existing)
    fresh["headline"] = None
    facts_path = tmp_path / "FACTS.json"
    facts_path.write_text(json.dumps(existing))
    monkeypatch.setattr(facts, "FACTS_OUT", facts_path)
    monkeypatch.setattr(facts, "compute_facts", lambda: fresh)

    with pytest.raises(SystemExit):
        facts.check_not_stale()

    assert "headline could not be measured" in capsys.readouterr().err
