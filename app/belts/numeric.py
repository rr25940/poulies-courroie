"""Small numeric helpers: interpolation and chart-zone lookup."""
from math import inf, log10


def interp(pts, x):
    """Piecewise-linear interpolation, clamped at both ends."""
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def nearest(values, x):
    """Closest value; the smaller one wins a tie."""
    best = values[0]
    for v in values:
        if abs(v - x) < abs(best - x) - 1e-9:
            best = v
    return best


def pchip(pts):
    """Monotone cubic (Fritsch–Carlson) interpolant through pts, clamped outside."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    n = len(pts)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    m[0], m[-1] = d[0], d[-1]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = 0
        while x > xs[i + 1]:
            i += 1
        t = (x - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
                + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])
    return f


def log_interp(d, n):
    """Power on a straight log-log line through two (P, N) points, at speed n."""
    (p1, n1), (p2, n2) = d
    return 10 ** (log10(p1) + (log10(n) - log10(n1)) * (log10(p2) - log10(p1)) / (log10(n2) - log10(n1)))


def right_edge(sec, n):
    """Largest power of a chart zone at speed n (−inf above the zone)."""
    if n > sec["Nmax"] * 1.0001:
        return -inf
    if not sec["d"]:
        return sec["Pmax"]
    return log_interp(sec["d"], n) if n <= sec["d"][1][1] else sec["Pmax"]


def pick_zone(chart, p, n):
    for sec in chart["secs"]:
        if n <= sec["Nmax"] * 1.0001 and p <= right_edge(sec, n):
            return sec["k"]
    return None


def zone_of(chart, p, n):
    """(zone, outside_chart). Points off the chart fall back to the nearest edge."""
    z = pick_zone(chart, p, n)
    if z is None:
        z = pick_zone(chart, min(p, chart["xr"][1] * 0.999), min(n, chart["secs"][0]["Nmax"])) or chart["secs"][-1]["k"]
    inside = chart["xr"][0] <= p <= chart["xr"][1] and chart["yr"][0] <= n <= chart["yr"][1]
    return z, not inside
