"""
pipeline/tests/test_decay.py
Tests for the NRLMSISE-00 orbital decay lifetime estimator.

Tests verify:
  - Physical plausibility (lower altitude decays faster, higher F10.7 decays faster)
  - FCC compliance boundary at 5 years
  - Solar-cycle sensitivity (the project differentiator)
  - Output shape matches the DecayEstimate contract
  - Edge cases (minimum/maximum valid altitudes)
  - Table generation produces correct number of entries
"""

import json
import os
import tempfile
from pathlib import Path

import pytest

# Guard: skip if pyatmos is not installed (CI without pipeline dependencies)
pyatmos_available = True
try:
    from pyatmos.msise.nrlmsise00_subfunc import gtd7d  # noqa: F401
except ImportError:
    pyatmos_available = False

pytestmark = pytest.mark.skipif(
    not pyatmos_available,
    reason="pyatmos/NRLMSISE-00 not available in this environment",
)

# Import after guard
if pyatmos_available:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from pipeline.decay import (
        DecayEstimate,
        F107_SOLAR_MAX,
        F107_SOLAR_MIN,
        _lifetime_years,
        _nrl_density,
        estimate_decay,
        generate_decay_table,
    )


# ---------------------------------------------------------------------------
# Density tests
# ---------------------------------------------------------------------------

class TestNrlDensity:
    def test_density_decreases_with_altitude(self):
        """Higher altitude means lower atmospheric density."""
        rho_400 = _nrl_density(400.0, 120.0)
        rho_600 = _nrl_density(600.0, 120.0)
        assert rho_400 > rho_600, "Density must decrease with altitude"

    def test_density_increases_with_f107(self):
        """Higher solar activity means higher thermospheric density."""
        rho_low = _nrl_density(550.0, F107_SOLAR_MIN)
        rho_high = _nrl_density(550.0, F107_SOLAR_MAX)
        assert rho_high > rho_low, "Density must increase with F10.7"

    def test_density_solar_swing_at_550km_exceeds_10x(self):
        """
        The project differentiator: solar min vs max density ratio at 550km
        must be at least 10x. This drives the 5-year compliance boundary.
        """
        rho_min = _nrl_density(550.0, F107_SOLAR_MIN)
        rho_max = _nrl_density(550.0, F107_SOLAR_MAX)
        ratio = rho_max / rho_min
        assert ratio >= 10.0, (
            f"Solar swing ratio at 550km is {ratio:.1f}x; expected >= 10x. "
            "This is the physical basis of the deorbit compliance differentiator."
        )

    def test_density_at_400km_is_plausible(self):
        """Sanity: 400km density should be roughly 1e-12 to 1e-11 kg/m^3."""
        rho = _nrl_density(400.0, 150.0)
        assert 1e-13 < rho < 1e-10, f"400km density {rho:.2e} outside plausible range"


# ---------------------------------------------------------------------------
# Lifetime integrator tests
# ---------------------------------------------------------------------------

class TestLifetimeYears:
    def test_lower_altitude_decays_faster(self):
        """400km orbit decays faster than 600km orbit."""
        lt_400 = _lifetime_years(400.0, 180.0, 120.0)
        lt_600 = _lifetime_years(600.0, 180.0, 120.0)
        assert lt_400 < lt_600, "Lower orbit must decay faster"

    def test_higher_bc_decays_slower(self):
        """Higher ballistic coefficient (heavier/smaller satellite) decays more slowly."""
        lt_light = _lifetime_years(550.0, 100.0, 120.0)
        lt_heavy = _lifetime_years(550.0, 300.0, 120.0)
        assert lt_light < lt_heavy, "Higher Bc must mean slower decay"

    def test_solar_max_decays_faster_than_min(self):
        """At solar maximum, orbit decays faster than at solar minimum."""
        lt_min = _lifetime_years(550.0, 180.0, F107_SOLAR_MIN)
        lt_max = _lifetime_years(550.0, 180.0, F107_SOLAR_MAX)
        assert lt_max < lt_min, "Solar max must produce faster decay than solar min"

    def test_550km_solar_max_compliant(self):
        """
        The differentiator: at 550km solar max, a 3U CubeSat (Bc~180)
        must decay within 5 years (FCC-compliant).
        """
        lt = _lifetime_years(550.0, 180.0, F107_SOLAR_MAX)
        assert lt <= 5.0, (
            f"550km solar max lifetime {lt:.2f}yr must be <= 5yr for FCC compliance"
        )

    def test_550km_solar_min_non_compliant(self):
        """
        The differentiator: at 550km solar min, a 3U CubeSat (Bc~180)
        must NOT decay within 5 years (non-compliant -- FCC 5-year rule violated).
        """
        lt = _lifetime_years(550.0, 180.0, F107_SOLAR_MIN)
        assert lt > 5.0, (
            f"550km solar min lifetime {lt:.2f}yr must be > 5yr "
            "(non-compliant -- this is the deorbit compliance differentiator)"
        )

    def test_400km_solar_min_compliant(self):
        """400km orbit should comply at solar min due to dense thermosphere."""
        lt = _lifetime_years(400.0, 180.0, F107_SOLAR_MIN)
        assert lt <= 5.0, f"400km solar min lifetime {lt:.2f}yr should be <= 5yr"

    def test_raises_on_invalid_bc(self):
        with pytest.raises(ValueError, match="ballisticCoefficient"):
            _lifetime_years(550.0, 0.0, 120.0)

    def test_raises_on_altitude_out_of_range(self):
        with pytest.raises(ValueError, match="altitudeKm"):
            _lifetime_years(50.0, 180.0, 120.0)


# ---------------------------------------------------------------------------
# estimate_decay output contract tests
# ---------------------------------------------------------------------------

class TestEstimateDecay:
    def test_output_keys_match_contract(self):
        """All required DecayEstimate keys must be present."""
        result = estimate_decay(550.0, 180.0, "2026-08")
        required_keys = {
            "altitudeKm", "ballisticCoefficient", "launchYearMonth",
            "lifetimeYears", "lifetimeYearsLow", "lifetimeYearsHigh",
            "f107Assumed", "method", "generatedAt",
        }
        assert required_keys <= set(result.keys()), (
            f"Missing keys: {required_keys - set(result.keys())}"
        )

    def test_altitude_roundtrip(self):
        result = estimate_decay(550.0, 180.0, "2026-08")
        assert result["altitudeKm"] == 550.0

    def test_bc_roundtrip(self):
        result = estimate_decay(180.0, 180.0, "2026-08")
        assert result["ballisticCoefficient"] == 180.0

    def test_launch_year_month_roundtrip(self):
        result = estimate_decay(550.0, 180.0, "2026-08")
        assert result["launchYearMonth"] == "2026-08"

    def test_f107_nominal_default_is_120(self):
        result = estimate_decay(550.0, 180.0, "2026-08")
        assert result["f107Assumed"] == 120.0

    def test_lifetime_ordering(self):
        """low scenario has longest lifetime (solar min = slower decay)."""
        result = estimate_decay(550.0, 180.0, "2026-08")
        assert result["lifetimeYearsLow"] >= result["lifetimeYears"] >= result["lifetimeYearsHigh"], (
            "Lifetime ordering violated: low >= nominal >= high must hold"
        )

    def test_method_mentions_nrlmsise00(self):
        result = estimate_decay(550.0, 180.0, "2026-08")
        assert "NRLMSISE-00" in result["method"]

    def test_generated_at_is_iso(self):
        from datetime import datetime
        result = estimate_decay(550.0, 180.0, "2026-08")
        # Should not raise
        dt = datetime.fromisoformat(result["generatedAt"])
        assert dt is not None

    def test_custom_f107_propagates(self):
        result = estimate_decay(550.0, 180.0, "2026-08", f107_nominal=150.0)
        assert result["f107Assumed"] == 150.0


# ---------------------------------------------------------------------------
# Table generation tests
# ---------------------------------------------------------------------------

class TestGenerateDecayTable:
    def test_table_written_to_temp_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            out = Path(tmpdir) / "decay-table.json"
            table = generate_decay_table(output_path=out)
            assert out.exists(), "decay-table.json must be created"

    def test_table_is_valid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            out = Path(tmpdir) / "decay-table.json"
            generate_decay_table(output_path=out)
            with open(out) as fh:
                data = json.load(fh)
            assert isinstance(data, list), "decay-table.json must be a JSON array"

    def test_table_entry_count(self):
        """Standard table: 7 altitudes x 3 ballistic coefficients = 21 entries."""
        with tempfile.TemporaryDirectory() as tmpdir:
            out = Path(tmpdir) / "decay-table.json"
            table = generate_decay_table(output_path=out)
            assert len(table) == 21, f"Expected 21 table entries, got {len(table)}"

    def test_table_all_entries_have_required_keys(self):
        required_keys = {
            "altitudeKm", "ballisticCoefficient", "launchYearMonth",
            "lifetimeYears", "lifetimeYearsLow", "lifetimeYearsHigh",
            "f107Assumed", "method", "generatedAt",
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            out = Path(tmpdir) / "decay-table.json"
            table = generate_decay_table(output_path=out)
            for i, entry in enumerate(table):
                missing = required_keys - set(entry.keys())
                assert not missing, f"Entry {i} missing keys: {missing}"

    def test_table_includes_550km_row(self):
        """Table must include the 550km altitude -- the key compliance boundary."""
        with tempfile.TemporaryDirectory() as tmpdir:
            out = Path(tmpdir) / "decay-table.json"
            table = generate_decay_table(output_path=out)
            alts = {entry["altitudeKm"] for entry in table}
            assert 550.0 in alts, "Table must include 550km altitude entry"
