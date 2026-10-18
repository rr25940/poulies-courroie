"""Belt sizing, following the course method step by step.

compute_v() sizes classic V-belts, compute_t() sizes timing belts. Both take the
client state (a dict) and return a JSON-ready dict whose keys the front end reads.
"""
from math import asin, ceil, cos, exp, floor, isfinite, pi, sin, sqrt

from . import data as D
from .numeric import interp, nearest, pchip, zone_of

G5F = {k: pchip(v) for k, v in D.G5.items()}


# ---------- input coercion ----------
def _num(v, default=None):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return default
    return x if isfinite(x) else default


def _member(values, v):
    """Return the element of values equal to v, or None."""
    x = _num(v)
    if x is None:
        return None
    for item in values:
        if abs(item - x) < 1e-9:
            return item
    return None


# ---------- table 4 ----------
def _row_at(vals, v):
    xs, ys = [0, *D.PBV], [0, *vals]
    last = len(ys) - 1
    while ys[last] is None:
        last -= 1
    vc, capped = v, False
    if v > xs[last]:
        vc, capped = xs[last], True
    j = 0
    while j < last - 1 and vc > xs[j + 1]:
        j += 1
    val = ys[j] + (ys[j + 1] - ys[j]) * (vc - xs[j]) / (xs[j + 1] - xs[j])
    return {"val": val, "c0": j - 1, "c1": j, "capped": capped}


def pb_lookup(sec, dp, v):
    rows, flag = D.PB[sec], None
    if dp <= rows[0][0]:
        i0 = i1 = 0
        flag = "below" if dp < rows[0][0] else None
    elif dp >= rows[-1][0]:
        i0 = i1 = len(rows) - 1
        flag = "above" if dp > rows[-1][0] else None
    else:
        i1 = next(i for i, r in enumerate(rows) if r[0] >= dp)
        i0 = i1 if rows[i1][0] == dp else i1 - 1
    a, b = _row_at(rows[i0][1], v), _row_at(rows[i1][1], v)
    t = 0 if i0 == i1 else (dp - rows[i0][0]) / (rows[i1][0] - rows[i0][0])
    return {"val": a["val"] + (b["val"] - a["val"]) * t, "i0": i0, "i1": i1,
            "c0": min(a["c0"], b["c0"]), "c1": max(a["c1"], b["c1"]),
            "capped": a["capped"] or b["capped"], "flag": flag}


# ---------- geometry ----------
def length(a, d, dd):
    return 2 * a + 1.57 * (dd + d) + (dd - d) ** 2 / (4 * a)


def real_a(lp, d, dd):
    b = lp - 1.57 * (dd + d)
    disc = b * b - 2 * (dd - d) ** 2
    return float("nan") if disc < 0 or b <= 0 else (b + sqrt(disc)) / 4


def wrap_deg(d, dd, a):
    x = max(-1.0, min(1.0, (dd - d) / (2 * a)))
    return 180 - 2 * asin(x) * 180 / pi


def _fits(lp, d, dd):
    a = real_a(lp, d, dd)
    return isfinite(a) and a > (dd + d) / 2


# ---------- automatic choices ----------
def auto_dp(sec, ps, nd, n_out):
    diams, rows = D.DIAMS[sec], D.PB[sec]
    cands = [d for d in diams if rows[0][0] <= d <= rows[-1][0]]
    best, best_score = None, float("inf")
    for d in cands:
        v = pi * d * nd / 60000
        if v > 25:
            break
        ideal = d * nd / n_out
        if ideal > diams[-1] * 1.05:
            continue
        dd = nearest([x for x in diams if x >= d], ideal)
        err = abs(nd * d / dd - n_out) / n_out
        nc = ceil(ps / (pb_lookup(sec, d, v)["val"] * 0.85))
        if nc <= 3 and err <= 0.03:
            return d
        score = nc + err * 40
        if score < best_score:
            best, best_score = d, score
    return best if best is not None else (cands[0] if cands else diams[0])


def auto_zd(kind, ps, nd, n_out):
    t = D.TIMING[kind]
    target, max_kb = t["w"][min(1, len(t["w"]) - 1)][1], t["w"][-1][1]
    first_ok, best, best_err = None, None, float("inf")
    for zd in t["teeth"]:
        v = nd * t["p"] * zd / 60000
        if v > D.G5MAX:
            break
        req = ps / G5F[kind](v)
        if req > max_kb:
            continue
        ideal = zd * nd / n_out
        if ideal > t["teeth"][-1] * 1.03:
            continue
        zD = nearest([z for z in t["teeth"] if z >= zd], ideal)
        err = abs(nd * zd / zD - n_out) / n_out
        if err <= 0.02 and req <= target:
            return zd
        if err <= 0.02 and first_ok is None:
            first_ok = zd
        if err < best_err:
            best, best_err = zd, err
    return first_ok if first_ok is not None else (best if best is not None else t["teeth"][0])


# ---------- shared steps ----------
class _Result(dict):
    def warn(self, lvl, key, *args):
        self["W"].append({"lvl": lvl, "key": key, "a": list(args)})


def _inputs(r, s):
    r["P"], r["Nd"], r["ND"] = _num(s.get("P")), _num(s.get("Nd")), _num(s.get("ND"))
    r["driver"] = "big" if s.get("driver") == "big" else "small"
    if not all(x is not None and 0 < x < 1e6 for x in (r["P"], r["Nd"], r["ND"])):
        r.warn("bad", "inBad")
        r["fatal"] = 1
        return False
    if r["ND"] > r["Nd"]:
        r.warn("bad", "inOrder")
        r["fatal"] = 1
        return False
    r["R"] = r["ND"] / r["Nd"]
    ks = s.get("ks") if isinstance(s.get("ks"), list) and len(s.get("ks")) == 2 else [1, 1]
    i = min(2, max(0, int(_num(ks[0], 1))))
    j = min(3, max(0, int(_num(ks[1], 1))))
    r["ks"], r["Ks"] = [i, j], D.KS[i][j]
    r["Ps"] = r["P"] * r["Ks"]
    return True


def _centre(r, s):
    r["q"] = r["Dp"] / r["dp"]
    r["aMin"] = (r["Dp"] + r["dp"]) / 2 + r["dp"] if r["q"] <= 3 else r["Dp"]
    r["aMax"] = 3 * (r["Dp"] + r["dp"])
    r["aAuto"] = ceil(r["aMin"] / 10) * 10
    r["aLo"] = ceil((r["Dp"] + r["dp"]) / 2 * 1.05 / 5) * 5
    r["aHi"] = ceil(r["aMax"] / 10) * 10
    a = _num(s.get("a"))
    r["a0"] = a if a is not None and r["aLo"] <= a <= r["aHi"] else r["aAuto"]
    r["LpCalc"] = length(r["a0"], r["dp"], r["Dp"])


def _check_centre(r):
    if r["theta"] < 90:
        r.warn("bad", "th90", r["theta"])
    elif r["theta"] < 120:
        r.warn("warn", "th120", r["theta"])


# ---------- V-belts ----------
def compute_v(s):
    r = _Result(W=[], mode="v")
    if not _inputs(r, s):
        return r
    r["secAuto"], out = zone_of(D.G1, r["Ps"], r["Nd"])
    if out:
        r.warn("warn", "g1out")
    r["sec"] = s.get("sec") if s.get("sec") in D.VSECS else r["secAuto"]
    if r["sec"] != r["secAuto"]:
        r.warn("warn", "secForced", r["sec"], r["secAuto"])
    sec, diams, rows = r["sec"], D.DIAMS[r["sec"]], D.PB[r["sec"]]
    r["pbMin"], r["pbMax"] = rows[0][0], rows[-1][0]

    # step 4: pitch diameters
    r["dpAuto"] = auto_dp(sec, r["Ps"], r["Nd"], r["ND"])
    r["dp"] = _member(diams, s.get("dp")) or r["dpAuto"]
    r["DpIdeal"] = r["dp"] * r["Nd"] / r["ND"]
    r["Dlist"] = [x for x in diams if x >= r["dp"]]
    r["DpAuto"] = nearest(r["Dlist"], r["DpIdeal"])
    r["Dp"] = _member(r["Dlist"], s.get("Dp")) or r["DpAuto"]
    r["NDreal"] = r["Nd"] * r["dp"] / r["Dp"]
    r["err"] = (r["NDreal"] - r["ND"]) / r["ND"]
    if abs(r["err"]) > 0.03:
        r.warn("warn", "ratio", r["err"])
    r["omega"] = pi * r["Nd"] / 30
    r["V"] = r["omega"] * r["dp"] / 2000
    if r["V"] > 30:
        r.warn("bad", "v30", r["V"])
    elif r["V"] > 25:
        r.warn("warn", "v25", r["V"])

    # step 5: centre distance and standard length
    _centre(r, s)
    lens = D.LENS[sec]
    r["LpAuto"] = nearest(lens, r["LpCalc"])
    chosen = _member(lens, s.get("Lp"))
    r["Lp"] = chosen or r["LpAuto"]
    if r["LpCalc"] > lens[-1] * 1.03 or r["LpCalc"] < lens[0] * 0.97:
        r.warn("warn", "lenRange")
    if not _fits(r["Lp"], r["dp"], r["Dp"]):
        ok = next((x for x in lens if _fits(x, r["dp"], r["Dp"]) and x >= r["LpCalc"]), None) \
            or next((x for x in lens if _fits(x, r["dp"], r["Dp"])), None)
        if ok is None:
            r.warn("bad", "lenShort")
            r["fatal"] = 5
            return r
        if chosen:
            r.warn("warn", "lpReset")
        r["Lp"] = ok
    r["a"] = real_a(r["Lp"], r["dp"], r["Dp"])
    if r["a"] < r["aMin"] - 0.5:
        r.warn("warn", "aMin", r["a"], r["aMin"])
    if r["a"] > r["aMax"]:
        r.warn("warn", "aMax")

    # step 6: basic power
    r["pb"] = pb_lookup(sec, r["dp"], r["V"])
    r["Pb"] = r["pb"]["val"]
    if r["pb"]["flag"] == "below":
        r.warn("warn", "dpBelow")
    if r["pb"]["flag"] == "above":
        r.warn("info", "dpAbove")
    if r["pb"]["capped"] and r["V"] <= 25:
        r.warn("warn", "pbCap")

    # step 7: admissible power
    r["theta"] = wrap_deg(r["dp"], r["Dp"], r["a"])
    r["Kth"] = interp(D.KTH, r["theta"])
    _check_centre(r)
    kl = D.KLD[sec]
    r["KL"] = interp(kl, r["Lp"])
    r["klClamp"] = r["Lp"] > kl[-1][0]
    if r["klClamp"]:
        r.warn("info", "klClamp")
    r["Pa"] = r["Pb"] * r["KL"] * r["Kth"]

    # step 8: number of belts
    r["ncRaw"] = r["Ps"] / r["Pa"]
    r["nc"] = max(1, ceil(r["ncRaw"] - 1e-9))
    r["load"] = r["Ps"] / (r["nc"] * r["Pa"])
    if r["nc"] > 6:
        r.warn("warn", "many", r["nc"])

    # step 9: belt tensions (general study)
    f, beta, k, m = _num(s.get("f")), _num(s.get("beta")), _num(s.get("k")), _num(s.get("m"))
    r["f"] = f if f and 0 < f <= 2 else 0.3
    r["beta"] = beta if beta and 10 <= beta <= 60 else 38
    r["k"] = k if k and 1 < k <= 50 else 5
    r["mAuto"] = not (m and m > 0)
    r["m"] = D.MASS[sec] if r["mAuto"] else m
    if r["k"] < 3 or r["k"] > 5:
        r.warn("info", "kRange")
    r["Fu"] = r["P"] * 1000 / (r["nc"] * r["V"])
    r["t"] = r["Fu"] / (r["k"] - 1)
    r["T"] = r["k"] * r["t"]
    r["Fc"] = r["m"] * r["V"] ** 2
    r["thRad"] = r["theta"] * pi / 180
    r["lim"] = exp(r["f"] * r["thRad"] / sin(r["beta"] * pi / 360))
    r["adh"] = (r["T"] - r["Fc"]) / (r["t"] - r["Fc"]) if r["t"] - r["Fc"] > 0 else None
    r["slip"] = r["adh"] is None or r["adh"] > r["lim"]
    if r["slip"]:
        r.warn("bad", "slip")
    r["F1"] = sqrt(r["T"] ** 2 + r["t"] ** 2 - 2 * r["T"] * r["t"] * cos(r["thRad"]))
    r["Fshaft"] = r["F1"] * r["nc"]
    r["beltH"] = D.PROFILE[sec]["h"]
    return r


# ---------- timing belts ----------
def compute_t(s):
    r = _Result(W=[], mode="t")
    if not _inputs(r, s):
        return r
    r["typeAuto"], out = zone_of(D.G4, r["Ps"], r["Nd"])
    if out:
        r.warn("warn", "g4out")
    r["type"] = s.get("type") if s.get("type") in D.TIMING else r["typeAuto"]
    if r["type"] != r["typeAuto"]:
        r.warn("warn", "typeForced", r["type"], r["typeAuto"])
    t = D.TIMING[r["type"]]
    r["p"] = t["p"]

    # step 4: tooth counts
    r["ZdAuto"] = auto_zd(r["type"], r["Ps"], r["Nd"], r["ND"])
    r["Zd"] = _member(t["teeth"], s.get("Zd")) or r["ZdAuto"]
    r["ZDIdeal"] = r["Zd"] * r["Nd"] / r["ND"]
    r["ZList"] = [z for z in t["teeth"] if z >= r["Zd"]]
    r["ZDAuto"] = nearest(r["ZList"], r["ZDIdeal"])
    r["ZD"] = _member(r["ZList"], s.get("ZD")) or r["ZDAuto"]
    r["dp"], r["Dp"] = r["p"] * r["Zd"] / pi, r["p"] * r["ZD"] / pi
    r["NDreal"] = r["Nd"] * r["Zd"] / r["ZD"]
    r["err"] = (r["NDreal"] - r["ND"]) / r["ND"]
    if abs(r["err"]) > 0.03:
        r.warn("warn", "ratio", r["err"])
    r["V"] = r["Nd"] * r["p"] * r["Zd"] / 60000
    if r["V"] > D.G5MAX:
        r.warn("warn", "v5", r["V"])

    # step 5: centre distance and belt tooth count
    _centre(r, s)
    zc = t["zc"]
    r["ZcCalc"] = r["LpCalc"] / r["p"]
    r["ZcAuto"] = nearest(zc, r["ZcCalc"])
    chosen = _member(zc, s.get("Zc"))
    r["Zc"] = chosen or r["ZcAuto"]
    if r["ZcCalc"] > zc[-1] * 1.03 or r["ZcCalc"] < zc[0] * 0.97:
        r.warn("warn", "lenRange")
    if not _fits(r["Zc"] * r["p"], r["dp"], r["Dp"]):
        ok = next((z for z in zc if _fits(z * r["p"], r["dp"], r["Dp"]) and z >= r["ZcCalc"]), None) \
            or next((z for z in zc if _fits(z * r["p"], r["dp"], r["Dp"])), None)
        if ok is None:
            r.warn("bad", "lenShort")
            r["fatal"] = 5
            return r
        if chosen:
            r.warn("warn", "lpReset")
        r["Zc"] = ok
    r["Lp"] = r["Zc"] * r["p"]
    r["a"] = real_a(r["Lp"], r["dp"], r["Dp"])
    if r["a"] < r["aMin"] - 0.5:
        r.warn("info", "aMin", r["a"], r["aMin"])
    if r["a"] > r["aMax"]:
        r.warn("warn", "aMax")
    r["theta"] = wrap_deg(r["dp"], r["Dp"], r["a"])
    _check_centre(r)

    # step 6: basic power, step 7: teeth in mesh
    r["P0"] = G5F[r["type"]](min(r["V"], D.G5MAX))
    r["Zpr"] = r["Zd"] * (0.5 - r["p"] * (r["ZD"] - r["Zd"]) / (2 * pi * pi * r["a"]))
    r["ZprN"] = floor(r["Zpr"] + 1e-9)
    r["Kz"] = 1.0 if r["ZprN"] >= 6 else dict(D.KZ).get(r["ZprN"], 0.0)
    if r["Kz"] == 0:
        r.warn("bad", "zpr2")
    elif r["ZprN"] < 6:
        r.warn("info", "zpr6", r["ZprN"])

    # step 8: width
    r["KbReq"] = r["Ps"] / (r["P0"] * r["Kz"]) if r["Kz"] > 0 else None
    widths = t["w"]
    w_auto = next((w for w in widths if r["KbReq"] is not None and w[1] >= r["KbReq"] - 1e-9), widths[-1])
    r["bAuto"] = w_auto[0]
    picked = next((w for w in widths if _num(s.get("b")) is not None and abs(w[0] - _num(s.get("b"))) < 1e-9), None)
    w_sel = picked or w_auto
    r["b"], r["Kb"], r["wCode"] = w_sel
    r["Pa"] = r["P0"] * r["Kb"] * r["Kz"]
    r["ok"] = r["Pa"] >= r["Ps"] - 1e-9
    r["load"] = r["Ps"] / r["Pa"] if r["Pa"] > 0 else None
    if not r["ok"]:
        r.warn("bad", "wSmall" if picked and r["KbReq"] is not None and r["KbReq"] <= widths[-1][1] else "wide")
    r["lenCode"] = round(r["Lp"] / 2.54)
    r["desig"] = f'{r["lenCode"]} {r["type"]} {r["wCode"]}'
    r["beltH"] = t["h"]
    return r


def json_safe(obj):
    """Replace inf/nan by None so the result is valid JSON."""
    if isinstance(obj, float):
        return obj if isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [json_safe(v) for v in obj]
    return obj
