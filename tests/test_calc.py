"""Sizing engine: worked examples checked by hand, plus robustness sweeps."""
import math

import pytest

from app.belts import compute_t, compute_v, json_safe

V_EXAMPLE = {"P": 7.5, "Nd": 1450, "ND": 600, "driver": "small", "ks": [1, 1], "f": 0.3, "beta": 38, "k": 5}
T_EXAMPLE = {"P": 3, "Nd": 1450, "ND": 725, "driver": "small", "ks": [0, 1]}


def test_v_belt_worked_example():
    r = compute_v(V_EXAMPLE)
    assert r["W"] == []
    assert r["Ps"] == pytest.approx(9.75)
    assert (r["sec"], r["dp"], r["Dp"], r["Lp"], r["nc"]) == ("B", 150, 355, 1668, 3)
    assert r["a"] == pytest.approx(425.2, abs=0.1)
    assert r["theta"] == pytest.approx(152.1, abs=0.1)
    assert r["Pb"] == pytest.approx(4.358, abs=1e-3)
    assert r["Pa"] == pytest.approx(3.806, abs=1e-3)
    assert r["Fshaft"] == pytest.approx(972, abs=1)
    assert not r["slip"]


def test_timing_belt_worked_example():
    r = compute_t(T_EXAMPLE)
    assert r["W"] == []
    assert (r["type"], r["Zd"], r["ZD"], r["Zc"], r["b"]) == ("H", 18, 36, 60, 25.4)
    assert r["desig"] == "300 H 100"
    assert r["Kz"] == 1.0
    assert r["Pa"] >= r["Ps"]


def test_forced_choices_are_respected_and_flagged():
    r = compute_v({**V_EXAMPLE, "sec": "C"})
    assert r["sec"] == "C"
    assert any(w["key"] == "secForced" for w in r["W"])


def test_invalid_inputs_are_reported_not_raised():
    assert compute_v({**V_EXAMPLE, "ND": 2000})["fatal"] == 1
    assert compute_v({"P": "abc"})["fatal"] == 1
    assert compute_t({})["fatal"] == 1


@pytest.mark.parametrize("fn", [compute_v, compute_t])
def test_sweep_has_no_invalid_numbers(fn):
    for p in (0.2, 1, 3, 7.5, 15, 40, 90, 200, 600):
        for nd in (300, 700, 1450, 2900):
            for ratio in (1, 0.8, 0.5, 0.3, 0.15):
                r = fn({"P": p, "Nd": nd, "ND": nd * ratio, "ks": [1, 1]})
                if r.get("fatal"):
                    continue
                for key in ("Pa", "a", "theta", "V"):
                    assert math.isfinite(r[key]), (fn.__name__, p, nd, ratio, key)


def test_json_safe_replaces_non_finite():
    assert json_safe({"x": [float("inf"), 1.0, float("nan")]}) == {"x": [None, 1.0, None]}
