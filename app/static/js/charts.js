/* Course charts redrawn in SVG from the server payload, with animated operating points. */
(function (root) {
'use strict';
const UI = root.BeltUI = root.BeltUI || {};
const DATA = UI.DATA = JSON.parse(document.getElementById('belt-data').textContent);
const L10 = Math.log10;
const f1 = v => (+v).toFixed(1);
const pts = arr => arr.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');
const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const last = new Map();     // chart id -> last marker position (px)
const lastSel = new Map();  // chart id -> last highlighted series

function interp(p, x) {
  if (x <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (x <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
  return p[p.length - 1][1];
}
UI.interp = interp;

function scaleOf(ax, r0, r1) {
  if (ax.type === 'log') { const a = L10(ax.d[0]), b = L10(ax.d[1]); return v => r0 + (L10(v) - a) / (b - a) * (r1 - r0); }
  if (ax.type === 'knots') return v => r0 + (interp(ax.knots, v) - ax.d[0]) / (ax.d[1] - ax.d[0]) * (r1 - r0);
  return v => r0 + (v - ax.d[0]) / (ax.d[1] - ax.d[0]) * (r1 - r0);
}
function logTicks(lo, hi, wide) {
  const out = [];
  for (let e = Math.floor(L10(lo)); e <= Math.ceil(L10(hi)); e++) for (let m = 1; m <= 9; m++) {
    const v = m * 10 ** e; if (v < lo * 0.999 || v > hi * 1.001) continue;
    out.push([v, (m === 1 || (wide && (m === 2 || m === 5))) ? UI.n(v, 1) : null, m === 1]);
  }
  return out;
}
function linTicks(lo, hi, step, every) {
  const out = []; let i = 0;
  for (let v = lo; v <= hi + 1e-9; v += step, i++) { const x = +v.toFixed(6); out.push([x, i % every === 0 ? UI.n(x, 2) : null, i % every === 0]); }
  return out;
}
const sub = (b, s, rest = '') => `<tspan font-style="italic">${b}</tspan><tspan dy="3" font-size="0.75em">${s}</tspan><tspan dy="-3">${rest}</tspan>`;

/* ---------- operating point ---------- */
function markerSVG() {
  return `<g class="mk-g"><line class="ch-guide mk-v"/><line class="ch-guide mk-h"/><circle class="ch-halo mk-halo" r="5"/><circle class="ch-pt mk-p" r="5"/>
    <text class="ch-val mk-lx"></text><text class="ch-val mk-ly"></text></g>`;
}
function placeMarker(svg, d, x, y, lx, ly) {
  const q = s => svg.querySelector(s), bottom = d.h - d.m.b;
  const v = q('.mk-v'), h = q('.mk-h');
  v.setAttribute('x1', f1(x)); v.setAttribute('x2', f1(x)); v.setAttribute('y1', f1(y)); v.setAttribute('y2', bottom);
  h.setAttribute('x1', d.m.l); h.setAttribute('x2', f1(x)); h.setAttribute('y1', f1(y)); h.setAttribute('y2', f1(y));
  for (const c of [q('.mk-p'), q('.mk-halo')]) { c.setAttribute('cx', f1(x)); c.setAttribute('cy', f1(y)); }
  const tx = q('.mk-lx'), ty = q('.mk-ly');
  if (lx != null) { tx.textContent = lx; tx.setAttribute('x', f1(x > d.w - 90 ? x - 4 : x + 4)); tx.setAttribute('y', bottom - 5); tx.setAttribute('text-anchor', x > d.w - 90 ? 'end' : 'start'); }
  if (ly != null) { ty.textContent = ly; ty.setAttribute('x', d.m.l + 4); ty.setAttribute('y', f1(y - 6)); }
}
function animateMarker(el, svg, d, to, lx, ly) {
  const from = last.get(el.id);
  last.set(el.id, to);
  if (!from || reduced() || (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5)) { placeMarker(svg, d, to.x, to.y, lx, ly); return; }
  const t0 = performance.now(), dur = 480, ease = t => 1 - Math.pow(1 - t, 3);
  const step = now => {
    if (!svg.isConnected) return;
    const k = ease(Math.min(1, (now - t0) / dur));
    placeMarker(svg, d, from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, lx, ly);
    if (k < 1) requestAnimationFrame(step);
  };
  placeMarker(svg, d, from.x, from.y, lx, ly);
  requestAnimationFrame(step);
}

/* ---------- generic frame ---------- */
function chart(el, cfg) {
  const w = Math.max(260, Math.round(el.clientWidth || 520));
  const h = Math.round(cfg.h ? cfg.h(w) : Math.min(330, Math.max(210, w * 0.56)));
  const m = Object.assign({ l: 50, r: 14, t: 24, b: 40 }, cfg.m || {});
  const X = cfg.x(w), Y = cfg.y(w), sx = scaleOf(X, m.l, w - m.r), sy = scaleOf(Y, h - m.b, m.t);
  const id = el.id + '-clip', pw = w - m.l - m.r, ph = h - m.t - m.b, dims = { w, h, m };
  let g = `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${cfg.aria}">`;
  g += `<defs><clipPath id="${id}"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/></clipPath></defs>`;
  g += `<rect class="ch-bg" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>`;
  for (const [v, lab, maj] of X.ticks) {
    const x = f1(sx(v));
    g += `<line class="ch-grid${maj ? ' major' : ''}" x1="${x}" x2="${x}" y1="${m.t}" y2="${h - m.b}"/>`;
    if (lab != null) g += `<text class="ch-tk" x="${x}" y="${h - m.b + 14}" text-anchor="middle">${lab}</text>`;
  }
  for (const [v, lab, maj] of Y.ticks) {
    const y = sy(v);
    g += `<line class="ch-grid${maj ? ' major' : ''}" x1="${m.l}" x2="${w - m.r}" y1="${f1(y)}" y2="${f1(y)}"/>`;
    if (lab != null) g += `<text class="ch-tk" x="${m.l - 6}" y="${f1(y + 3.5)}" text-anchor="end">${lab}</text>`;
  }
  g += `<g clip-path="url(#${id})">${cfg.body(sx, sy, dims)}</g><rect class="ch-frame" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/>`;
  if (cfg.labels) g += cfg.labels(sx, sy, dims);
  g += markerSVG();
  g += `<text class="ch-ax" x="${w - m.r}" y="${h - 6}" text-anchor="end">${X.label}</text><text class="ch-ax" x="${m.l}" y="${m.t - 9}">${Y.label}</text>`;
  el.innerHTML = g + '</svg>';
  const svg = el.firstChild, p = cfg.point;
  const to = { x: Math.max(m.l, Math.min(w - m.r, sx(p.x))), y: Math.max(m.t, Math.min(h - m.b, sy(p.y))) };
  animateMarker(el, svg, dims, to, p.lx, p.ly);
  // draw-in of the highlighted curve when the selection changes
  if (cfg.sel != null) {
    const prev = lastSel.get(el.id); lastSel.set(el.id, cfg.sel);
    const on = svg.querySelector('.ch-curve.on');
    if (on && prev !== undefined && prev !== cfg.sel && !reduced()) { on.style.setProperty('--len', on.getTotalLength().toFixed(0)); on.classList.add('draw'); }
  }
}

/* ---------- graphs 1 and 4 ---------- */
function zoneChart(el, G, cfg) {
  chart(el, {
    aria: cfg.aria, sel: cfg.sel,
    x: w => ({ type: 'log', d: cfg.xd, ticks: logTicks(cfg.xd[0], cfg.xt, w > 430), label: cfg.xl }),
    y: () => ({ type: 'log', d: cfg.yd, ticks: logTicks(cfg.yd[0], cfg.yt, true), label: cfg.yl }),
    body: (sx, sy) => {
      let g = '';
      for (const k in G.zones) g += `<polygon class="ch-zone${k === cfg.sel ? ' on' : ''}" points="${pts(G.zones[k].map(([P, N]) => [sx(P), sy(N)]))}"/>`;
      for (const line of G.lines) g += `<polyline class="ch-line" points="${pts(line.map(([P, N]) => [sx(P), sy(N)]))}"/>`;
      if (cfg.edge) g += `<polyline class="ch-line" points="${pts([[sx(cfg.edge), sy(cfg.yd[0])], [sx(cfg.edge), sy(G.yr[1])]])}"/>`;
      return g;
    },
    labels: (sx, sy) => Object.entries(G.lab).map(([k, [P, N]]) => `<text class="ch-lab${k === cfg.sel ? ' on' : ''}" x="${f1(sx(P))}" y="${f1(sy(N))}" text-anchor="middle">${k}</text>`).join(''),
    point: { x: cfg.P, y: cfg.N, lx: UI.n(cfg.P, 2) + ' kW', ly: UI.n(cfg.N, 0) }
  });
}
UI.chartG1 = (el, r) => zoneChart(el, DATA.G1, {
  aria: UI.tx('Graphe 1 : gamme des puissances transmissibles par section', 'Chart 1: power range by belt section'),
  xd: [0.1, 1500], xt: 1000, yd: [100, 6000], yt: 5000, edge: 1000, sel: r.sec, P: r.Ps, N: r.Nd,
  xl: UI.tx('Pₛ puissance (kW)', 'Pₛ power (kW)'), yl: sub('N', 'd', UI.tx(' petite poulie (tr/min)', ' small pulley (rpm)'))
});
UI.chartG4 = (el, r) => zoneChart(el, DATA.G4, {
  aria: UI.tx('Graphe 4 : gammes des puissances transmissibles des courroies crantées', 'Chart 4: timing belt power ranges'),
  xd: [0.1, 300], xt: 200, yd: [100, 15000], yt: 10000, sel: r.type, P: r.Ps, N: r.Nd,
  xl: UI.tx('Pₛ puissance (kW)', 'Pₛ power (kW)'), yl: sub('N', 'd', UI.tx(' (tr/min)', ' (rpm)'))
});

/* ---------- graph 2 : K_theta ---------- */
UI.chartG2 = (el, r) => chart(el, {
  aria: UI.tx('Graphe 2 : coefficient Kθ', 'Chart 2: Kθ factor'), m: { l: 42 },
  h: w => Math.min(260, Math.max(200, w * 0.62)),
  x: w => ({ type: 'lin', d: [90, 180], ticks: linTicks(90, 180, 10, w > 330 ? 1 : 2), label: 'θ (°)' }),
  y: () => ({ type: 'lin', d: [0.6, 1.0], ticks: linTicks(0.6, 1.0, 0.05, 2), label: sub('K', 'θ') }),
  body: (sx, sy) => `<polyline class="ch-curve on" points="${pts(DATA.KTH.map(([t, k]) => [sx(t), sy(k)]))}"/>`,
  point: { x: Math.max(90, r.theta), y: r.Kth, lx: UI.n(r.theta, 1) + '°', ly: UI.n(r.Kth, 3) }
});

/* ---------- graph 3 : KL (course axis) ---------- */
UI.chartG3 = (el, r) => {
  const kl = DATA.KLD[r.sec], Lx = Math.min(r.Lp, kl[kl.length - 1][0]);
  chart(el, {
    aria: UI.tx('Graphe 3 : coefficient KL', 'Chart 3: KL factor'), m: { l: 42 }, sel: r.sec,
    h: w => Math.min(260, Math.max(200, w * 0.62)),
    x: w => ({ type: 'knots', knots: DATA.KL_AXIS, d: [-0.5, 7.5], label: 'Lₚ (mm)',
      ticks: [500, 1000, 1500, 2000, 3000, 4000, 6000, 8000].map((v, i) => [v, (w > 330 || i % 2 === 1) ? UI.n(v, 0) : null, true]) }),
    y: () => ({ type: 'lin', d: [0.6, 1.4], ticks: linTicks(0.6, 1.4, 0.1, 2), label: sub('K', 'L') }),
    body: (sx, sy) => DATA.VSECS.map(k => `<polyline class="ch-curve${k === r.sec ? ' on' : ''}" points="${pts(DATA.KLD[k].map(([L, K]) => [sx(L), sy(K)]))}"/>`).join(''),
    labels: (sx, sy, d) => DATA.VSECS.map(k => { const c = DATA.KLD[k], [L, K] = c[c.length - 1];
      return `<text class="ch-lab${k === r.sec ? ' on' : ''}" x="${f1(Math.min(sx(L) + 3, d.w - d.m.r - 10))}" y="${f1(sy(K) - 4)}">${k}</text>`; }).join(''),
    point: { x: Lx, y: r.KL, lx: UI.n(r.Lp, 0) + (r.klClamp ? ' →' : ''), ly: UI.n(r.KL, 3) }
  });
};

/* ---------- graph 5 : P0 ---------- */
UI.chartG5 = (el, r) => chart(el, {
  aria: UI.tx('Graphe 5 : puissance de base des courroies crantées', 'Chart 5: timing belt basic power'), sel: r.type,
  x: () => ({ type: 'lin', d: [0, 36], ticks: linTicks(0, 35, 5, 1), label: 'V (m/s)' }),
  y: () => ({ type: 'lin', d: [0, 4.3], ticks: linTicks(0, 4, 0.5, 2), label: sub('P', '0', UI.tx(' (kW / 5 mm de largeur)', ' (kW / 5 mm of width)')) }),
  body: (sx, sy) => DATA.TSECS.map(k => `<polyline class="ch-curve${k === r.type ? ' on' : ''}" points="${pts(DATA.G5[k].map(([v, p]) => [sx(v), sy(p)]))}"/>`).join(''),
  labels: (sx, sy) => DATA.TSECS.map(k => `<text class="ch-lab${k === r.type ? ' on' : ''}" x="${f1(sx(27))}" y="${f1(sy(interp(DATA.G5[k], 27)) - 6)}" text-anchor="middle">${k}</text>`).join(''),
  point: { x: Math.min(r.V, DATA.G5MAX), y: r.P0, lx: UI.n(r.V, 2) + ' m/s', ly: UI.n(r.P0, 3) }
});

/* ---------- ISO 4183 profiles ---------- */
UI.profileSVG = sel => {
  const sc = 3.6, t20 = Math.tan(20 * Math.PI / 180), cx = 38 * sc / 2 + 8, y0 = 10, lx = 38 * sc + 22, W = lx + 34;
  let g = '', yl = -99, labs = '';
  for (const k of ['E', 'D', 'C', 'B', 'A', 'Z']) {
    const p = DATA.PROFILE[k], a = p.a * sc, h = p.h * sc, b = a - 2 * h * t20;
    g += `<polygon class="pf${k === sel ? ' on' : ''}" points="${pts([[cx - a / 2, y0], [cx + a / 2, y0], [cx + b / 2, y0 + h], [cx - b / 2, y0 + h]])}"/>`;
  }
  for (const k of DATA.VSECS) {
    const p = DATA.PROFILE[k], y = y0 + p.h * sc, xb = cx + (p.a * sc - 2 * p.h * sc * t20) / 2;
    yl = Math.max(y, yl + 11);
    labs += `<polyline class="pf-lead" points="${pts([[xb, y], [lx - 10, y], [lx - 4, yl - 3.5]])}"/><text class="pf-t${k === sel ? ' on' : ''}" x="${lx}" y="${f1(yl)}">${k}</text>`;
  }
  const H = Math.max(y0 + 25 * sc, yl) + 10;
  return `<svg class="prof" viewBox="0 0 ${f1(W)} ${f1(H)}" width="${f1(W)}" height="${f1(H)}" role="img" aria-label="${UI.tx('Profils ISO 4183 à l’échelle', 'ISO 4183 profiles to scale')}">${g}${labs}</svg>`;
};
})(window);
