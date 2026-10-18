/* To-scale drawing of the drive: geometry morphs between results, belt and pulleys turn continuously. */
(function (root) {
'use strict';
const UI = root.BeltUI = root.BeltUI || {};
const PI = Math.PI, f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2);
const W = 640, H = 360;
const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
const anim = UI.anim = { on: true, mult: 1, last: 0, a1: 0, a2: 0, off: 0, v: 0, vTarget: 0, cur: null, tween: null, r: null, els: null };

function pulley(id, R, teeth) {
  let g = `<g class="rot" id="${id}">`;
  if (teeth) { const rt = R - 1.6, c = 2 * PI * rt / teeth; g += `<circle class="p-teeth" r="${f2(rt)}" stroke-width="3.4" stroke-dasharray="${f2(c / 2)} ${f2(c / 2)}"/>`; }
  const rim = R + (teeth ? -2.6 : 1.5);
  if (rim > 34) {
    const ri = rim * 0.8, hub = Math.max(7, rim * 0.2), sw = Math.max(3, hub * 0.55);
    let sp = '', so = '';
    for (let k = 0; k < 6; k++) {
      const t = k * PI / 3, c = Math.cos(t), s = Math.sin(t);
      const seg = `x1="${f1(hub * c)}" y1="${f1(hub * s)}" x2="${f1(ri * c)}" y2="${f1(ri * s)}"`;
      so += `<line class="p-spoke-o" ${seg} stroke-width="${f1(sw + 2)}"/>`;
      sp += `<line class="p-spoke" ${seg} stroke-width="${f1(sw)}"/>`;
    }
    g += so + sp + `<circle class="p-ring" r="${f2((rim + ri) / 2)}" stroke-width="${f2(rim - ri)}"/><circle class="p-out" r="${f2(rim)}"/><circle class="p-out" r="${f2(ri)}"/>`;
    g += `<circle class="p-disc" r="${f1(hub)}"/><circle class="p-hole" r="${f1(hub * 0.42)}"/><line class="p-mark" x1="${f1(hub + 2)}" y1="0" x2="${f1(ri - 2)}" y2="0"/>`;
  } else {
    g += `<circle class="p-disc" r="${f2(Math.max(rim, 3))}"/>`;
    if (rim > 15) for (let k = 0; k < 4; k++) { const t = k * PI / 2 + PI / 4; g += `<circle class="p-hole" cx="${f1(rim * 0.55 * Math.cos(t))}" cy="${f1(rim * 0.55 * Math.sin(t))}" r="${f1(rim * 0.15)}"/>`; }
    g += `<circle class="p-hole" r="${f1(Math.max(1.5, rim * 0.16))}"/>`;
    if (rim > 8) g += `<line class="p-mark" x1="${f1(rim * 0.3)}" y1="0" x2="${f1(rim * 0.85)}" y2="0"/>`;
  }
  return g + '</g>';
}
const sym = (b, s, rest) => `<tspan font-style="italic">${b}</tspan><tspan dy="3" font-size="0.75em">${s}</tspan><tspan dy="-3">${rest}</tspan>`;

/* Build the whole drawing for geometry p = {D, d, a, h, Zd, ZD} and labels taken from result r. */
function build(svg, p, r) {
  // k > 1 on narrow screens: bigger labels, with room made for them
  const k = Math.min(1.6, Math.max(1, 560 / (svg.clientWidth || W)));
  const { D, d, a } = p, mL = 30, mR = 40 + 46 * k, mT = 64, mB = 66;
  const s = Math.min((W - mL - mR) / (D / 2 + a + d / 2), (H - mT - mB) / D);
  const R = D / 2 * s, rr = d / 2 * s, A = a * s;
  const x1 = mL + ((W - mL - mR) - (D / 2 + a + d / 2) * s) / 2 + R, x2 = x1 + A, cy = mT + (H - mT - mB) / 2;
  const phi = Math.asin(Math.max(-1, Math.min(1, (R - rr) / A))), sn = Math.sin(phi), cs = Math.cos(phi);
  const P1 = [x1 + R * sn, cy - R * cs], P2 = [x2 + rr * sn, cy - rr * cs], Q2 = [x2 + rr * sn, cy + rr * cs], Q1 = [x1 + R * sn, cy + R * cs];
  const pt = q => f2(q[0]) + ' ' + f2(q[1]);
  const path = `M${pt(P1)} L${pt(P2)} A${f2(rr)} ${f2(rr)} 0 0 1 ${pt(Q2)} L${pt(Q1)} A${f2(R)} ${f2(R)} 0 1 1 ${pt(P1)} Z`;
  const bw = Math.max(3, Math.min(12, p.h * s)), timing = r.mode === 't', tp = timing ? 2 * PI * rr / p.Zd : 0;
  const up = r.driver === 'small', tight = up ? [P1, P2] : [Q2, Q1], slack = up ? [Q2, Q1] : [P1, P2];
  const mid = q => [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2];
  const rpm = UI.tx('tr/min', 'rpm');
  let g = `<defs><pattern id="mm" width="10" height="10" patternUnits="userSpaceOnUse"><path class="dw-grid" d="M10 0H0V10"/></pattern>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dim-arrow" d="M0 1.5L10 5L0 8.5z"/></marker></defs>
    <rect width="${W}" height="${H}" fill="url(#mm)"/>`;
  g += `<g transform="translate(${f2(x1)} ${f2(cy)})">${pulley('rot-big', R, timing ? p.ZD : 0)}</g>`;
  g += `<g transform="translate(${f2(x2)} ${f2(cy)})">${pulley('rot-small', rr, timing ? p.Zd : 0)}</g>`;
  g += `<line class="belt-glow" x1="${f2(tight[0][0])}" y1="${f2(tight[0][1])}" x2="${f2(tight[1][0])}" y2="${f2(tight[1][1])}" stroke-width="${f1(bw + 10)}"/>`;
  g += `<path class="belt" d="${path}" stroke-width="${f1(bw)}"/>`;
  g += `<line class="belt-T" x1="${f2(tight[0][0])}" y1="${f2(tight[0][1])}" x2="${f2(tight[1][0])}" y2="${f2(tight[1][1])}" stroke-width="${f1(bw)}"/>`;
  const dash = timing ? `${f2(tp * 0.45)} ${f2(tp * 0.55)}` : '2 11';
  g += `<path id="marks" class="belt-marks" d="${path}" stroke-width="${f1(Math.max(1.5, bw * (timing ? 0.55 : 0.4)))}" stroke-dasharray="${dash}"/>`;
  g += `<path class="cl" d="M${f1(x1 - R - 14)} ${f1(cy)}H${f1(x2 + rr + 14)}M${f1(x1)} ${f1(cy - R - 10)}V${f1(cy + R + 10)}M${f1(x2)} ${f1(cy - rr - 10)}V${f1(cy + rr + 10)}"/>`;
  // rotation arrow (both pulleys turn clockwise)
  const ro = R + bw / 2 + 8, ang = t => [x1 + ro * Math.cos(t), cy + ro * Math.sin(t)];
  if (R > 20) g += `<path class="rot-arrow" d="M${pt(ang(0.80 * PI))} A${f2(ro)} ${f2(ro)} 0 0 1 ${pt(ang(1.05 * PI))}" marker-end="url(#arr)"/>`;
  const mt = mid(tight), ms = mid(slack);
  const below = 7 + 8 * k;
  g += `<text class="dw-t acc" x="${f1(mt[0])}" y="${f1(mt[1] + (up ? -bw / 2 - 7 : bw / 2 + below))}" text-anchor="middle">T · ${UI.tx('brin tendu', 'tight side')}</text>`;
  g += `<text class="dw-t s" x="${f1(ms[0])}" y="${f1(ms[1] + (up ? bw / 2 + below : -bw / 2 - 7))}" text-anchor="middle">t · ${UI.tx('brin mou', 'slack side')}</text>`;
  const ra = rr + bw / 2 + 9, A1 = [x2 + ra * sn, cy - ra * cs], A2 = [x2 + ra * sn, cy + ra * cs];
  g += `<path class="th-arc" d="M${pt(A1)} A${f2(ra)} ${f2(ra)} 0 0 1 ${pt(A2)}" marker-end="url(#arr)" marker-start="url(#arr)"/>`;
  g += `<text class="dw-t acc" x="${f1(x2 + ra + 6)}" y="${f1(cy + 4 * k)}">θ = ${UI.n(r.theta, k > 1.2 ? 0 : 1)}°</text>`;
  const yd = cy + R + 30;
  g += `<path class="dim" d="M${f1(x1)} ${f1(cy + R + 6)}V${f1(yd + 6)}M${f1(x2)} ${f1(cy + rr + 6)}V${f1(yd + 6)}"/>`;
  g += `<line class="dim" x1="${f1(x1)}" y1="${f1(yd)}" x2="${f1(x2)}" y2="${f1(yd)}" marker-start="url(#arr)" marker-end="url(#arr)"/>`;
  g += `<text class="dw-t" x="${f1((x1 + x2) / 2)}" y="${f1(yd - 5)}" text-anchor="middle">a = ${UI.n(r.a, 1)} mm</text>`;
  const close = A < 150 + 40 * k, line2 = cy - R - 14, top = line2 - 14 * k;
  const lab = (x, anchor, l1, l2) => `<text class="dw-t" x="${f1(x)}" y="${f1(top)}" text-anchor="${anchor}">${l1}</text><text class="dw-t s" x="${f1(x)}" y="${f1(line2)}" text-anchor="${anchor}">${l2}</text>`;
  const drv = UI.tx('motrice', 'driver');
  const bigL1 = timing ? sym('Z', 'D', ` ${r.ZD} · Ø ${UI.n(r.Dp, 1)}`) : sym('D', 'p', ` = ${UI.n(r.Dp, 0)} mm`);
  const smL1 = timing ? sym('Z', 'd', ` ${r.Zd} · Ø ${UI.n(r.dp, 1)}`) : sym('d', 'p', ` = ${UI.n(r.dp, 0)} mm`);
  g += lab(close ? x1 + R : x1, close ? 'end' : 'middle', bigL1, `${UI.n(r.NDreal, 0)} ${rpm}${r.driver === 'big' ? ' · ' + drv : ''}`);
  g += lab(close ? Math.max(x2 - rr, x1 + R + 8) : Math.min(x2, W - 70), close ? 'start' : 'middle', smL1, `${UI.n(r.Nd, 0)} ${rpm}${r.driver === 'small' ? ' · ' + drv : ''}`);
  svg.innerHTML = g;
  svg.style.setProperty('--k', k.toFixed(2));
  anim.els = { R1: R, R2: rr, period: timing ? tp : 13, marks: svg.querySelector('#marks'), rot1: svg.querySelector('#rot-big'), rot2: svg.querySelector('#rot-small') };
  apply();
}

function apply() {
  const e = anim.els; if (!e) return;
  e.rot1.setAttribute('transform', `rotate(${(anim.a1 % 360).toFixed(2)})`);
  e.rot2.setAttribute('transform', `rotate(${(anim.a2 % 360).toFixed(2)})`);
  e.marks.style.strokeDashoffset = (-(anim.off % (e.period * 1000))).toFixed(2);
}

UI.drawDrive = r => {
  const svg = document.getElementById('drive');
  if (!r || r.fatal) {
    anim.cur = anim.tween = anim.els = null; anim.r = null;
    svg.innerHTML = `<text class="dw-msg" x="${W / 2}" y="${H / 2}" text-anchor="middle">${UI.tx('Complétez les données pour voir la transmission', 'Complete the inputs to see the drive')}</text>`;
    return;
  }
  const target = { D: r.Dp, d: r.dp, a: r.a, h: r.beltH, Zd: r.Zd || 0, ZD: r.ZD || 0, mode: r.mode };
  anim.r = r;
  anim.vTarget = Math.max(22, Math.min(170, 16 + r.V * 5.5));
  svg.setAttribute('aria-label', UI.tx(`Transmission : poulies ${UI.n(r.Dp, 0)} et ${UI.n(r.dp, 0)} mm, entraxe ${UI.n(r.a, 0)} mm`, `Drive: pulleys ${UI.n(r.Dp, 0)} and ${UI.n(r.dp, 0)} mm, centre distance ${UI.n(r.a, 0)} mm`));
  const from = anim.cur;
  if (!from || from.mode !== target.mode || reduced()) { anim.cur = target; anim.tween = null; if (!anim.v) anim.v = anim.vTarget; build(svg, target, r); return; }
  anim.tween = { from: Object.assign({}, from), to: target, t0: performance.now(), dur: 520 };
};

function frame(ts) {
  const dt = anim.last ? Math.min(0.1, (ts - anim.last) / 1000) : 0;
  anim.last = ts;
  const tw = anim.tween, svg = document.getElementById('drive');
  if (tw && anim.r) {
    const k = Math.min(1, (ts - tw.t0) / tw.dur), e = 1 - Math.pow(1 - k, 3), L = (a, b) => a + (b - a) * e;
    const p = { D: L(tw.from.D, tw.to.D), d: L(tw.from.d, tw.to.d), a: L(tw.from.a, tw.to.a), h: L(tw.from.h, tw.to.h), Zd: tw.to.Zd, ZD: tw.to.ZD, mode: tw.to.mode };
    anim.cur = p;
    build(svg, p, anim.r);
    if (k >= 1) { anim.tween = null; anim.cur = tw.to; }
  }
  anim.v += (anim.vTarget - anim.v) * Math.min(1, dt * 3);
  if (anim.on && anim.els) {
    const dl = anim.v * anim.mult * dt;
    anim.off += dl; anim.a1 += dl / anim.els.R1 * 180 / PI; anim.a2 += dl / anim.els.R2 * 180 / PI;
    apply();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})(window);
