"""Read-only data sent to the browser for drawing tables and charts.

The browser never recomputes the sizing; it only needs table values and chart
geometry (zones, boundary lines, sampled curves) already expressed in data units.
"""
from functools import lru_cache
from math import log10

from . import data as D
from .calc import G5F
from .numeric import log_interp, right_edge


def _r(v):
    return round(v, 5)


def _region(chart, i):
    sec = chart["secs"][i]
    prev = chart["secs"][i - 1] if i > 0 else None
    lo, top = chart["yr"][0], sec["Nmax"]
    ns = [10 ** (log10(lo) + (log10(top) - log10(lo)) * k / 48) for k in range(49)]
    for v in (sec["d"][1][1] if sec["d"] else None, prev["d"][1][1] if prev and prev["d"] else None):
        if v and v < top:
            ns += [v, v * 1.0002]
    ns.sort()
    x0, x1 = chart["xr"]
    right = [[max(x0, min(right_edge(sec, n), x1)), n] for n in ns]
    left = [[max(right_edge(prev, n), x0) if prev else x0, n] for n in reversed(ns)]
    return [[_r(p), _r(n)] for p, n in right + left]


def _boundary(chart, i):
    sec = chart["secs"][i]
    prev = chart["secs"][i - 1] if i > 0 else None
    if not sec["d"]:
        return []
    lo, n2 = chart["yr"][0] * 0.8, sec["d"][1][1]
    out = [[log_interp(sec["d"], n), n] for n in (10 ** (log10(lo) + (log10(n2) - log10(lo)) * k / 24) for k in range(25))]
    if n2 < sec["Nmax"]:
        out += [[sec["Pmax"], n2], [sec["Pmax"], sec["Nmax"]]]
    out.append([right_edge(prev, sec["Nmax"]) if prev else chart["xr"][0] * 0.5, sec["Nmax"]])
    return [[_r(p), _r(n)] for p, n in out]


def _zones(chart):
    return {
        "xr": chart["xr"], "yr": chart["yr"], "lab": chart["lab"],
        "zones": {s["k"]: _region(chart, i) for i, s in enumerate(chart["secs"])},
        "lines": [b for b in (_boundary(chart, i) for i in range(len(chart["secs"]))) if b],
    }


def _g5_curves():
    out = {}
    for k, f in G5F.items():
        pts, v = [], 0.0
        while v <= D.G5MAX + 1e-9:
            pts.append([_r(v), _r(f(v))])
            v += 0.4
        pts.append([D.G5MAX, _r(f(D.G5MAX))])
        out[k] = pts
    return out


@lru_cache(maxsize=1)
def client_payload():
    return {
        "KS": D.KS, "VSECS": D.VSECS, "PROFILE": D.PROFILE, "MASS": D.MASS, "DIAMS": D.DIAMS,
        "LENS": D.LENS, "ISOL": D.ISOL, "PB": D.PB, "PBV": D.PBV,
        "KTH": D.KTH, "KLD": D.KLD, "KL_AXIS": D.KL_AXIS,
        "G1": _zones(D.G1), "G4": _zones(D.G4), "G5": _g5_curves(), "G5MAX": D.G5MAX,
        "TSECS": D.TSECS, "TIMING": D.TIMING, "KZ": D.KZ,
    }
