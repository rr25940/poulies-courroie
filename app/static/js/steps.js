/* Step-by-step rendering of a server result. */
(function (root) {
'use strict';
const UI = root.BeltUI, DATA = UI.DATA, $ = s => document.querySelector(s);
const tx = (...a) => UI.tx(...a), n = (...a) => UI.n(...a), nf = (...a) => UI.nf(...a);
const pct = e => (e >= 0 ? '+' : '−') + n(Math.abs(e) * 100, 1) + tx(' %', '%');
const rpm = () => tx('tr/min', 'rpm');
const ISO = Object.fromEntries(Object.entries(DATA.ISOL).map(([k, v]) => [k, new Set(v)]));
const S = {
  P: '<i>P</i>', Ps: '<i>P</i><sub>s</sub>', Ks: '<i>K</i><sub>s</sub>', Nd: '<i>N</i><sub>d</sub>', ND: '<i>N</i><sub>D</sub>',
  dp: '<i>d</i><sub>p</sub>', Dp: '<i>D</i><sub>p</sub>', a: '<i>a</i>', Lp: '<i>L</i><sub>p</sub>', V: '<i>V</i>', R: '<i>R</i>',
  Pb: '<i>P</i><sub>b</sub>', Pa: '<i>P</i><sub>a</sub>', KL: '<i>K</i><sub>L</sub>', Kth: '<i>K</i><sub>θ</sub>', th: '<i>θ</i>',
  nc: '<i>n</i><sub>c</sub>', Zd: '<i>Z</i><sub>d</sub>', ZD: '<i>Z</i><sub>D</sub>', Zc: '<i>Z</i><sub>c</sub>', Zpr: '<i>Z</i><sub>pr</sub>',
  Kz: '<i>K</i><sub>z</sub>', Kb: '<i>K</i><sub>b</sub>', P0: '<i>P</i><sub>0</sub>', p: '<i>p</i>', b: '<i>b</i>', w: '<i>ω</i><sub>d</sub>'
};
const eq = (...lines) => `<div class="eq">${lines.map(l => `<div>${l}</div>`).join('')}</div>`;
const res = x => `<span class="res">${x}</span>`;
const okb = (ok, a, b) => ok ? `<span class="okt">${a}</span>` : `<span class="badt">${b}</span>`;
const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
const placeholder = () => `<p class="placeholder">${tx('En attente de données valides.', 'Waiting for valid inputs.')}</p>`;

/* ---------- messages ---------- */
const WM = {
  inBad: () => tx('Entrez des valeurs positives pour <i>P</i>, <i>N</i><sub>d</sub> et <i>N</i><sub>D</sub>.', 'Enter positive values for <i>P</i>, <i>N</i><sub>d</sub> and <i>N</i><sub>D</sub>.'),
  inOrder: () => tx('La grande poulie tourne moins vite que la petite : il faut <i>N</i><sub>D</sub> ≤ <i>N</i><sub>d</sub>.', 'The large pulley turns slower than the small one: <i>N</i><sub>D</sub> must be ≤ <i>N</i><sub>d</sub>.'),
  g1out: () => tx('Point (<i>P</i><sub>s</sub>, <i>N</i><sub>d</sub>) hors du graphe 1 : section estimée au bord de l’abaque.', 'Point (<i>P</i><sub>s</sub>, <i>N</i><sub>d</sub>) is off chart 1: section estimated at the chart edge.'),
  g4out: () => tx('Point (<i>P</i><sub>s</sub>, <i>N</i><sub>d</sub>) hors du graphe 4 : type estimé au bord de l’abaque.', 'Point (<i>P</i><sub>s</sub>, <i>N</i><sub>d</sub>) is off chart 4: type estimated at the chart edge.'),
  secForced: (k, a) => tx(`Section ${k} imposée ; le graphe 1 conseille ${a}.`, `Section ${k} forced; chart 1 suggests ${a}.`),
  typeForced: (k, a) => tx(`Type ${k} imposé ; le graphe 4 conseille ${a}.`, `Type ${k} forced; chart 4 suggests ${a}.`),
  ratio: e => tx(`Vitesse de sortie à ${pct(e)} de la valeur demandée : essayez un autre couple de poulies.`, `Output speed is ${pct(e)} off target: try another pulley pair.`),
  v25: V => tx(`<i>V</i> = ${nf(V, 1)} m/s dépasse le tableau 4 (25 m/s) : <i>P</i><sub>b</sub> est plafonnée.`, `<i>V</i> = ${nf(V, 1)} m/s exceeds table 4 (25 m/s): <i>P</i><sub>b</sub> is capped.`),
  v30: V => tx(`<i>V</i> = ${nf(V, 1)} m/s : trop rapide pour une courroie classique, réduisez <i>d</i><sub>p</sub>.`, `<i>V</i> = ${nf(V, 1)} m/s is too fast for a classic V-belt: reduce <i>d</i><sub>p</sub>.`),
  pbCap: () => tx('Case « – » du tableau 4 : ce diamètre n’est pas prévu à cette vitesse. <i>P</i><sub>b</sub> est lue à la dernière vitesse disponible.', 'Table 4 shows “–” here: this diameter is not rated at this speed. <i>P</i><sub>b</sub> is read at the last listed speed.'),
  dpBelow: () => tx('<i>d</i><sub>p</sub> plus petit que la première ligne du tableau 4 : <i>P</i><sub>b</sub> est surestimée.', '<i>d</i><sub>p</sub> is below the first row of table 4: <i>P</i><sub>b</sub> is overestimated.'),
  dpAbove: () => tx('<i>d</i><sub>p</sub> au-delà du tableau 4 : <i>P</i><sub>b</sub> lue sur la dernière ligne (valeur prudente).', '<i>d</i><sub>p</sub> is beyond table 4: <i>P</i><sub>b</sub> read on the last row (conservative).'),
  lenRange: () => tx('Longueur calculée hors de la gamme normalisée : ajustez l’entraxe.', 'Calculated length is outside the standard range: adjust the centre distance.'),
  lenShort: () => tx('Aucune longueur normalisée ne convient à ces poulies.', 'No standard length fits these pulleys.'),
  lpReset: () => tx('Longueur choisie trop courte pour ces poulies : remplacée par la plus proche possible.', 'Chosen length is too short for these pulleys: replaced by the nearest workable one.'),
  aMin: (a, m) => tx(`Entraxe réel ${n(a, 0)} mm, sous le minimum conseillé (${n(m, 0)} mm).`, `Actual centre distance ${n(a, 0)} mm is below the recommended minimum (${n(m, 0)} mm).`),
  aMax: () => tx('Entraxe au-delà de 3(<i>D</i><sub>p</sub> + <i>d</i><sub>p</sub>) : le brin mou risque de battre.', 'Centre distance exceeds 3(<i>D</i><sub>p</sub> + <i>d</i><sub>p</sub>): the slack side may flap.'),
  klClamp: () => tx('<i>L</i><sub>p</sub> au-delà du graphe 3 : <i>K</i><sub>L</sub> lu en bout de courbe (valeur prudente).', '<i>L</i><sub>p</sub> is beyond chart 3: <i>K</i><sub>L</sub> read at the end of the curve (conservative).'),
  th120: t => tx(`Angle d’enroulement faible (${n(t, 0)}°) : augmentez l’entraxe.`, `Small wrap angle (${n(t, 0)}°): increase the centre distance.`),
  th90: t => tx(`Angle d’enroulement de ${n(t, 0)}°, sous 90° : augmentez l’entraxe.`, `Wrap angle ${n(t, 0)}° is below 90°: increase the centre distance.`),
  many: c => tx(`${c} courroies : passez à une section supérieure ou à un <i>d</i><sub>p</sub> plus grand.`, `${c} belts: move to a larger section or a larger <i>d</i><sub>p</sub>.`),
  slip: () => tx('Glissement : (<i>T</i> − <i>F</i><sub>c</sub>)/(<i>t</i> − <i>F</i><sub>c</sub>) dépasse la limite d’adhérence. Augmentez la tension de pose ou l’angle d’enroulement.', 'Slip: (<i>T</i> − <i>F</i><sub>c</sub>)/(<i>t</i> − <i>F</i><sub>c</sub>) exceeds the grip limit. Increase the installation tension or the wrap angle.'),
  kRange: () => tx('<i>T</i>/<i>t</i> hors de la plage usuelle de 3 à 5.', '<i>T</i>/<i>t</i> is outside the usual 3 to 5 range.'),
  v5: V => tx(`<i>V</i> = ${nf(V, 1)} m/s au-delà du graphe 5 : <i>P</i><sub>0</sub> lue en bout de courbe.`, `<i>V</i> = ${nf(V, 1)} m/s is beyond chart 5: <i>P</i><sub>0</sub> read at the end of the curve.`),
  zpr6: z => tx(`${z} dents en prise seulement : <i>K</i><sub>z</sub> réduit la puissance admissible.`, `Only ${z} teeth in mesh: <i>K</i><sub>z</sub> reduces the admissible power.`),
  zpr2: () => tx('Moins de 2 dents en prise : la courroie sauterait des dents. Augmentez <i>Z</i><sub>d</sub> ou l’entraxe.', 'Fewer than 2 teeth in mesh: the belt would jump teeth. Increase <i>Z</i><sub>d</sub> or the centre distance.'),
  wSmall: () => tx('Largeur choisie insuffisante : <i>P</i><sub>a</sub> &lt; <i>P</i><sub>s</sub>.', 'Chosen width is too narrow: <i>P</i><sub>a</sub> &lt; <i>P</i><sub>s</sub>.'),
  wide: () => tx('Même la plus grande largeur ne suffit pas : augmentez <i>Z</i><sub>d</sub> ou passez au type supérieur.', 'Even the widest belt is not enough: increase <i>Z</i><sub>d</sub> or move up a type.')
};
/* which step each message belongs to */
const STEP_OF = {
  v: { inBad: 1, inOrder: 1, g1out: 3, secForced: 3, ratio: 4, v25: 4, v30: 4, lenRange: 5, lenShort: 5, lpReset: 5, aMin: 5, aMax: 5, dpBelow: 6, dpAbove: 6, pbCap: 6, th90: 7, th120: 7, klClamp: 7, many: 8, slip: 9, kRange: 9 },
  t: { inBad: 1, inOrder: 1, g4out: 3, typeForced: 3, ratio: 4, lenRange: 5, lenShort: 5, lpReset: 5, aMin: 5, aMax: 5, th90: 5, th120: 5, v5: 6, zpr2: 7, zpr6: 7, wSmall: 8, wide: 8 }
};
UI.stepStatus = r => {
  const count = r.mode === 'v' ? 9 : 8, out = {}, rank = { ok: 0, info: 0, warn: 1, bad: 2 };
  for (let i = 1; i <= count; i++) out[i] = r.fatal && i > (r.fatal === 1 ? 1 : 5) ? 'idle' : 'ok';
  for (const w of r.W) { const st = STEP_OF[r.mode][w.key]; if (st && out[st] !== 'idle' && rank[w.lvl] > rank[out[st]]) out[st] = w.lvl; }
  return out;
};
UI.issues = r => {
  if (!r.W.length) return `<p class="allgood">${tx('Toutes les vérifications du cours sont satisfaites.', 'All course checks pass.')}</p>`;
  const order = { bad: 0, warn: 1, info: 2 };
  return `<ul class="issues">${r.W.slice().sort((x, y) => order[x.lvl] - order[y.lvl]).map(w => `<li class="${w.lvl}"><span>${WM[w.key] ? WM[w.key](...w.a) : w.key}</span></li>`).join('')}</ul>`;
};

/* ---------- shared blocks ---------- */
function driverSeg(id, d) {
  set(id, [['small', tx('Petite · réducteur', 'Small · reducer')], ['big', tx('Grande · multiplicateur', 'Large · step-up')]]
    .map(([v, l]) => `<button type="button" data-act="driver" data-val="${v}" aria-pressed="${d === v}">${l}</button>`).join(''));
}
const out1 = r => eq(`${S.R} = ${S.ND} / ${S.Nd} = ${n(r.ND, 0)} / ${n(r.Nd, 0)} = ${res(nf(r.R, 3))}`) +
  `<p class="note">${r.driver === 'small' ? tx('Réducteur : la petite poulie, motrice, entraîne la grande.', 'Reducer: the small pulley drives the large one.') : tx('Multiplicateur : la grande poulie, motrice, entraîne la petite.', 'Step-up: the large pulley drives the small one.')}</p>`;
function ksTable(sel) {
  const cols = tx(['service léger<br><small>0 à 6 h/jour</small>', 'service normal<br><small>6 à 16 h/jour</small>', 'service dur<br><small>16 à 24 h/jour</small>', 'service très dur<br><small>en continu</small>'],
    ['light duty<br><small>0–6 h/day</small>', 'normal duty<br><small>6–16 h/day</small>', 'heavy duty<br><small>16–24 h/day</small>', 'very heavy<br><small>continuous</small>']);
  const rows = tx(['transmission uniforme sans à-coups', 'avec légers à-coups et chocs modérés', 'avec à-coups et chocs élevés *'], ['uniform, no shocks', 'light shocks, moderate impacts', 'heavy shocks *']);
  let h = `<table class="t ks"><thead><tr><th></th>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>`;
  DATA.KS.forEach((row, i) => {
    h += `<tr><th scope="row">${rows[i]}</th>` + row.map((k, j) => { const on = sel[0] === i && sel[1] === j;
      return `<td><button type="button" class="ks-b${on ? ' sel' : ''}" data-act="ks" data-val="${i},${j}" aria-pressed="${on}">${nf(k, 1)}</button></td>`; }).join('') + '</tr>';
  });
  return h + `</tbody></table><p class="note" style="margin-top:6px">${tx('* avec inversions de sens, démarrages fréquents sous forts couples. Cliquez une case pour choisir <i>K</i><sub>s</sub>.', '* with reversals or frequent starts under high torque. Click a cell to pick <i>K</i><sub>s</sub>.')}</p>`;
}
const out2 = r => eq(`${S.Ps} = ${S.P} × ${S.Ks} = ${n(r.P, 2)} × ${nf(r.Ks, 1)} = ${res(n(r.Ps, 2) + ' kW')}`);
const centreRule = (r, indicative) => eq(
  `${S.Dp}/${S.dp} = ${nf(r.q, 2)} ${r.q <= 3 ? '≤ 3' : '> 3'} → ${S.a} ≥ ${r.q <= 3 ? `(${S.Dp} + ${S.dp})/2 + ${S.dp}` : S.Dp} = ${res(n(r.aMin, 1) + ' mm')}`,
  `${tx('limite', 'limit')} ${S.a} &lt; 3(${S.Dp} + ${S.dp}) = ${n(r.aMax, 0)} mm`
) + (indicative ? `<p class="note">${tx('Règle des courroies trapézoïdales, appliquée ici à titre indicatif.', 'V-belt rule, used here as a guide.')}</p>` : '');
function syncA(m, r) {
  const ar = $(`#${m}-a`), an = $(`#${m}-an`);
  ar.min = r.aLo; ar.max = r.aHi; ar.step = 5;
  if (document.activeElement !== ar) ar.value = r.a0;
  if (document.activeElement !== an) an.value = Math.round(r.a0);
}
function lengthLines(r) {
  const B = r.Lp - 1.57 * (r.Dp + r.dp);
  return [
    `${S.Lp} = 2${S.a} + ${n(1.57, 2)}(${S.Dp} + ${S.dp}) + (${S.Dp} − ${S.dp})²/4${S.a}`,
    `&nbsp;&nbsp;= 2×${n(r.a0, 0)} + ${n(1.57, 2)}×${n(r.Dp + r.dp, 1)} + ${n(r.Dp - r.dp, 1)}²/${n(4 * r.a0, 0)} = ${res(n(r.LpCalc, 1) + ' mm')}`,
    `${tx('Entraxe réel', 'Actual centre distance')} : ${S.a} = [<i>B</i> + √(<i>B</i>² − 2(${S.Dp} − ${S.dp})²)]/4 ${tx('avec', 'with')} <i>B</i> = ${S.Lp} − ${n(1.57, 2)}(${S.Dp} + ${S.dp}) = ${n(B, 1)}`,
    `&nbsp;&nbsp;${S.a} = ${res(n(r.a, 1) + ' mm')}`
  ];
}
function fatalFill(r, ids, phs) {
  ids.forEach(id => set(id, '')); phs.forEach(id => set(id, placeholder()));
}

/* ---------- V-belts ---------- */
UI.renderV = (r, s) => {
  driverSeg('v-driver', r.driver || s.driver);
  set('v-ks', ksTable(r.ks || s.ks));
  if (r.fatal === 1) {
    set('v-o1', UI.issues(r));
    fatalFill(r, ['v-g1', 'v-sec', 'v-prof', 'v-dp', 'v-Dp', 'v-o5a', 'v-pb', 'v-o7a', 'v-g2', 'v-g3', 'v-forces'], ['v-o2', 'v-o3', 'v-o4', 'v-o5', 'v-o6', 'v-o7', 'v-o8', 'v-o9']);
    return;
  }
  set('v-o1', out1(r)); set('v-o2', out2(r));
  UI.chartG1($('#v-g1'), r);
  set('v-sec', `<button type="button" data-act="sec" data-val="" aria-pressed="${!s.sec}">Auto · ${r.secAuto}</button>` +
    DATA.VSECS.map(k => `<button type="button" data-act="sec" data-val="${k}" aria-pressed="${s.sec === k}" class="${k === r.sec && !s.sec ? 'is-auto' : ''}">${k}</button>`).join(''));
  set('v-prof', UI.profileSVG(r.sec));
  const pf = DATA.PROFILE[r.sec];
  set('v-o3', `<p class="big-pick">${tx('Section', 'Section')} ${r.sec} ${r.sec === r.secAuto ? `<span class="tag">${tx('lue sur le graphe 1', 'read on chart 1')}</span>` : `<span class="tag warn">${tx('imposée', 'forced')}</span>`}</p>
    <dl class="spec"><div><dt>a</dt><dd>${n(pf.a, 1)} mm</dd></div><div><dt>h</dt><dd>${n(pf.h, 1)} mm</dd></div><div><dt>l<sub>p</sub></dt><dd>${n(pf.lp, 1)} mm</dd></div><div><dt>${tx('angle', 'angle')}</dt><dd>40°</dd></div><div><dt>d<sub>p</sub> ${tx('usuel', 'usual')}</dt><dd>${pf.du} mm</dd></div></dl>`);
  const D = DATA.DIAMS[r.sec];
  set('v-dp', `<button type="button" class="chip${!s.dp ? ' sel' : ''}" data-act="dp" data-val="">Auto</button>` +
    D.map(d => `<button type="button" class="chip${d === r.dp ? ' sel' : ''}${d < r.pbMin || d > r.pbMax ? ' out' : ''}${d === r.dpAuto ? ' auto' : ''}" data-act="dp" data-val="${d}">${d}</button>`).join(''));
  set('v-Dp', `<button type="button" class="chip${!s.Dp ? ' sel' : ''}" data-act="Dp" data-val="">Auto</button>` +
    r.Dlist.map(d => `<button type="button" class="chip${d === r.Dp ? ' sel' : ''}${d === r.DpAuto ? ' auto' : ''}" data-act="Dp" data-val="${d}">${d}</button>`).join(''));
  set('v-o4', eq(
    `${S.R} = ${S.ND}/${S.Nd} = ${S.dp}/${S.Dp}`,
    `${S.Dp} ${tx('idéal', 'ideal')} = ${S.dp} × ${S.Nd}/${S.ND} = ${n(r.dp, 0)} × ${n(r.Nd, 0)}/${n(r.ND, 0)} = ${n(r.DpIdeal, 1)} mm → ${res(n(r.Dp, 0) + ' mm')}`,
    `${S.ND} ${tx('obtenue', 'obtained')} = ${S.Nd} × ${S.dp}/${S.Dp} = ${res(n(r.NDreal, 1) + ' ' + rpm())} (${pct(r.err)})`,
    `${S.V} = ${S.w} × ${S.dp}/2 = ${n(r.omega, 1)} rad/s × ${n(r.dp / 2000, 4)} m = ${res(nf(r.V, 2) + ' m/s')}`));
  if (r.fatal === 5) {
    fatalFill(r, ['v-o5a', 'v-pb', 'v-o7a', 'v-g2', 'v-g3', 'v-forces'], ['v-o6', 'v-o7', 'v-o8', 'v-o9']);
    set('v-o5', UI.issues(r)); return;
  }
  set('v-o5a', centreRule(r, false));
  syncA('v', r);
  const sel = $('#v-Lp'), Ls = DATA.LENS[r.sec], iso = ISO[r.sec];
  sel.innerHTML = `<option value="">Auto · ${n(r.LpAuto, 0)}</option>` + Ls.map(L => `<option value="${L}">${n(L, 0)}${iso.has(L) ? ' *' : ''}</option>`).join('');
  sel.value = Ls.includes(s.Lp) ? String(s.Lp) : '';
  const ll = lengthLines(r);
  set('v-o5', eq(ll[0], ll[1], `${tx('Longueur normalisée', 'Standard length')} → ${S.Lp} = ${res(n(r.Lp, 0) + ' mm')}${iso.has(r.Lp) ? ' (NF ISO 4184)' : ''}`, ll[2], ll[3]) +
    `<p class="note">${tx('Désignation', 'Designation')} : <b>${r.sec}${r.Lp}</b> ${tx('(section + longueur, comme Z1420 dans le cours)', '(section + length, like Z1420 in the course)')}</p>`);
  set('v-pb', pbTable(r));
  set('v-o6', eq(`${S.Pb}(${S.dp} = ${n(r.dp, 0)} mm ; ${S.V} = ${nf(r.V, 2)} m/s) ≈ ${res(nf(r.Pb, 2) + ' kW')}`) +
    `<p class="note">${tx('Interpolation linéaire entre les cases surlignées (jaune foncé). Sous 5 m/s, interpolation depuis 0.', 'Linear interpolation between the highlighted cells (dark yellow). Below 5 m/s, interpolated from 0.')}</p>`);
  set('v-o7a', eq(`${S.th} = 180° − 2·arcsin[(${S.Dp} − ${S.dp})/2${S.a}] = 180° − 2·arcsin(${n(r.Dp - r.dp, 0)}/${n(2 * r.a, 1)}) = ${res(nf(r.theta, 1) + '°')}`));
  UI.chartG2($('#v-g2'), r); UI.chartG3($('#v-g3'), r);
  set('v-o7', eq(
    `${S.Kth} = ${nf(r.Kth, 3)} ${tx('(graphe 2)', '(chart 2)')} ; ${S.KL} = ${nf(r.KL, 3)} ${tx('(graphe 3)', '(chart 3)')}`,
    `${S.Pa} = ${S.Pb} × ${S.KL} × ${S.Kth} = ${nf(r.Pb, 2)} × ${nf(r.KL, 3)} × ${nf(r.Kth, 3)} = ${res(nf(r.Pa, 2) + ' kW')}`));
  const belts = r.nc > 1 ? tx('courroies', 'belts') : tx('courroie', 'belt');
  set('v-o8', eq(`${S.nc} = ${S.Ps}/${S.Pa} = ${n(r.Ps, 2)}/${nf(r.Pa, 2)} = ${nf(r.ncRaw, 2)} → ${res(r.nc + ' ' + belts)}`) +
    `<div class="final"><span class="final-n">${r.nc} × ${r.sec}${r.Lp}</span><span class="note">${tx('poulies', 'pulleys')} ${S.dp} ${n(r.dp, 0)} / ${S.Dp} ${n(r.Dp, 0)} mm · ${S.a} ${n(r.a, 0)} mm · ${tx('charge', 'load')} ${n(r.load * 100, 0)} %</span></div>`);
  $('#v-m').placeholder = n(DATA.MASS[r.sec], 2) + ' ' + tx('(typique)', '(typical)');
  forces(r);
  set('v-o9', eq(
    `${tx('Effort utile par courroie', 'Effective pull per belt')} : <i>F</i><sub>u</sub> = <i>T</i> − <i>t</i> = <i>P</i>/(${S.nc}·${S.V}) = ${n(r.P * 1000, 0)}/(${r.nc} × ${nf(r.V, 2)}) = ${res(n(r.Fu, 1) + ' N')}`,
    `<i>T</i> = ${n(r.k, 2)}·<i>t</i> → <i>t</i> = <i>F</i><sub>u</sub>/(${n(r.k, 2)} − 1) = ${res(n(r.t, 1) + ' N')} ; <i>T</i> = ${res(n(r.T, 1) + ' N')}`,
    `<i>F</i><sub>c</sub> = <i>m′</i>·${S.V}² = ${n(r.m, 3)} × ${nf(r.V, 2)}² = ${res(n(r.Fc, 1) + ' N')}${r.mAuto ? ' ' + tx('(m′ typique)', '(typical m′)') : ''}`,
    `e<sup><i>f</i>θ/sin(β/2)</sup> = e<sup>${n(r.f, 2)} × ${nf(r.thRad, 3)} / sin ${n(r.beta / 2, 1)}°</sup> = ${res(nf(r.lim, 2))}`,
    `(<i>T</i> − <i>F</i><sub>c</sub>)/(<i>t</i> − <i>F</i><sub>c</sub>) = ${r.adh == null ? '∞' : nf(r.adh, 2)} ${r.slip ? '&gt;' : '≤'} ${nf(r.lim, 2)} → ${okb(!r.slip, tx('pas de glissement', 'no slip'), tx('glissement', 'slip'))}`,
    `${tx('Charge sur chaque arbre', 'Load on each shaft')} : <i>F</i> = ${S.nc}·√(<i>T</i>² + <i>t</i>² − 2<i>Tt</i>·cos θ) = ${res(n(r.Fshaft, 0) + ' N')}`
  ) + `<p class="note">${tx('Indication du cours : 3 ≤ <i>T</i>/<i>t</i> ≤ 5, le plus souvent <i>T</i> ≈ 5<i>t</i>. Les tensions sont celles d’une courroie.', 'Course guidance: 3 ≤ <i>T</i>/<i>t</i> ≤ 5, most often <i>T</i> ≈ 5<i>t</i>. Tensions are per belt.')}</p>`);
};
function forces(r) {
  const el = $('#v-forces'), rows = [['T', tx('T · brin tendu', 'T · tight'), r.T], ['t', tx('t · brin mou', 't · slack'), r.t], ['c', tx('F<sub>c</sub> centrifuge', 'F<sub>c</sub> centrifugal'), r.Fc], ['F', tx('F / arbre', 'F / shaft'), r.Fshaft]];
  const max = Math.max(...rows.map(x => x[2]));
  if (!el.children.length) el.innerHTML = rows.map(([k]) => `<div class="fbar ${k}"><span class="k"></span><div class="track"><div class="fill" style="width:0"></div></div><span class="v"></span></div>`).join('');
  rows.forEach(([k, label, v], i) => {
    const row = el.children[i];
    row.querySelector('.k').innerHTML = label;
    row.querySelector('.v').textContent = n(v, 0) + ' N';
    const fill = row.querySelector('.fill');
    requestAnimationFrame(() => { fill.style.width = (100 * v / max).toFixed(1) + '%'; });
  });
}
function pbTable(r) {
  const rows = DATA.PB[r.sec], pb = r.pb;
  let h = `<table class="t"><thead><tr><th rowspan="2">${S.dp} (mm)</th><th colspan="5">${tx('vitesse linéaire', 'belt speed')} ${S.V} (m/s)</th></tr><tr>${DATA.PBV.map(v => `<th>${v}</th>`).join('')}</tr></thead><tbody>`;
  rows.forEach(([d, vals], i) => {
    const inR = i >= pb.i0 && i <= pb.i1;
    h += `<tr><th scope="row" class="${inR ? 'hit' : ''}">${d}</th>` + vals.map((v, j) => {
      const inC = j >= Math.max(0, pb.c0) && j <= pb.c1, cls = inR && inC ? 'hit' : (inR || inC) ? 'br' : '';
      return `<td class="${cls}">${v == null ? '–' : nf(v, 2)}</td>`;
    }).join('') + '</tr>';
  });
  return h + `</tbody></table><p class="note" style="margin-top:6px">${tx('Section', 'Section')} ${r.sec} · ${tx('puissances moyennes en kW, variables d’un fabricant à l’autre.', 'average power in kW; varies between manufacturers.')}</p>`;
}

/* ---------- timing belts ---------- */
UI.renderT = (r, s) => {
  driverSeg('t-driver', r.driver || s.driver);
  set('t-ks', ksTable(r.ks || s.ks));
  if (r.fatal === 1) {
    set('t-o1', UI.issues(r));
    fatalFill(r, ['t-g4', 't-type', 't-o5a', 't-g5', 't-kz', 't-w'], ['t-o2', 't-o3', 't-o4', 't-o5', 't-o6', 't-o7', 't-o8']);
    return;
  }
  set('t-o1', out1(r)); set('t-o2', out2(r));
  UI.chartG4($('#t-g4'), r);
  set('t-type', `<button type="button" data-act="type" data-val="" aria-pressed="${!s.type}">Auto · ${r.typeAuto}</button>` +
    DATA.TSECS.map(k => `<button type="button" data-act="type" data-val="${k}" aria-pressed="${s.type === k}" class="${k === r.type && !s.type ? 'is-auto' : ''}">${k}</button>`).join(''));
  const T = DATA.TIMING[r.type];
  set('t-o3', `<p class="big-pick">${tx('Type', 'Type')} ${r.type} ${r.type === r.typeAuto ? `<span class="tag">${tx('lu sur le graphe 4', 'read on chart 4')}</span>` : `<span class="tag warn">${tx('imposé', 'forced')}</span>`}</p>
    <dl class="spec"><div><dt>${tx('pas', 'pitch')} p</dt><dd>${nf(T.p, T.p < 10 ? 3 : 2)} mm · ${T.inch}</dd></div><div><dt>h</dt><dd>${n(T.h, 1)} mm</dd></div><div><dt>${tx('angle', 'angle')}</dt><dd>${T.ang}°</dd></div>
    <div><dt>${tx('largeurs', 'widths')}</dt><dd>${T.w.map(w => n(w[0], 1)).join(' · ')}</dd></div><div><dt>Z<sub>c</sub></dt><dd>${T.zc[0]} ${tx('à', 'to')} ${T.zc[T.zc.length - 1]}</dd></div></dl>`);
  const zd = $('#t-Zd'), zD = $('#t-ZD');
  zd.innerHTML = `<option value="">Auto · ${r.ZdAuto}</option>` + T.teeth.map(z => `<option value="${z}">${z}</option>`).join('');
  zd.value = T.teeth.includes(s.Zd) ? String(s.Zd) : '';
  zD.innerHTML = `<option value="">Auto · ${r.ZDAuto}</option>` + r.ZList.map(z => `<option value="${z}">${z}</option>`).join('');
  zD.value = r.ZList.includes(s.ZD) ? String(s.ZD) : '';
  set('t-o4', eq(
    `${S.dp} = ${S.p}·${S.Zd}/π = ${nf(r.p, 3)} × ${r.Zd}/π = ${res(n(r.dp, 2) + ' mm')}`,
    `${S.ZD} ${tx('idéal', 'ideal')} = ${S.Zd}·${S.Nd}/${S.ND} = ${n(r.ZDIdeal, 2)} → ${S.ZD} = ${r.ZD} → ${S.Dp} = ${res(n(r.Dp, 2) + ' mm')}`,
    `${S.ND} ${tx('obtenue', 'obtained')} = ${S.Nd}·${S.Zd}/${S.ZD} = ${res(n(r.NDreal, 1) + ' ' + rpm())} (${pct(r.err)})`,
    `${S.V} = ${S.Nd}·${S.p}·${S.Zd}/60 = ${n(r.Nd, 0)} × ${nf(r.p, 3)} × ${r.Zd}/60 000 = ${res(nf(r.V, 2) + ' m/s')}`
  ) + `<p class="note">${tx('Liste des dents permises pour ce type (tableau du cours). Avec <i>p</i> en mm, on divise par 1 000 pour obtenir des m/s.', 'Tooth counts allowed for this type (course table). With <i>p</i> in mm, divide by 1,000 to get m/s.')}</p>`);
  if (r.fatal === 5) {
    fatalFill(r, ['t-o5a', 't-g5', 't-kz', 't-w'], ['t-o6', 't-o7', 't-o8']);
    set('t-o5', UI.issues(r)); return;
  }
  set('t-o5a', centreRule(r, true));
  syncA('t', r);
  const zc = $('#t-Zc');
  zc.innerHTML = `<option value="">Auto · ${r.ZcAuto}</option>` + T.zc.map(z => `<option value="${z}">${z} (${n(z * r.p, 1)} mm)</option>`).join('');
  zc.value = T.zc.includes(s.Zc) ? String(s.Zc) : '';
  const ll = lengthLines(r);
  set('t-o5', eq(ll[0], ll[1], `${S.Zc} = ${S.Lp}/${S.p} = ${n(r.ZcCalc, 1)} → ${tx('normalisé', 'standard')} ${S.Zc} = ${res(r.Zc)} → ${S.Lp} = ${S.p}·${S.Zc} = ${res(n(r.Lp, 1) + ' mm')}`, ll[2], ll[3]));
  UI.chartG5($('#t-g5'), r);
  set('t-o6', eq(`${S.P0}(${S.V} = ${nf(r.V, 2)} m/s) ≈ ${res(nf(r.P0, 3) + ' kW')} ${tx('(graphe 5, courbe', '(chart 5, curve')} ${r.type})`));
  set('t-o7', eq(
    `${S.Zpr} = ${S.Zd}·[${n(0.5, 1)} − ${S.p}(${S.ZD} − ${S.Zd})/(2π²${S.a})]`,
    `&nbsp;&nbsp;= ${r.Zd} × [${n(0.5, 1)} − ${nf(r.p, 3)} × ${r.ZD - r.Zd}/(2π² × ${n(r.a, 1)})] = ${res(nf(r.Zpr, 2))}`,
    `→ ${r.ZprN} ${tx('dents en prise', 'teeth in mesh')} → ${S.Kz} = ${res(nf(r.Kz, 1))}`));
  const kzSel = r.ZprN >= 6 ? 6 : r.ZprN;
  set('t-kz', `<table class="t"><thead><tr><th>${tx('dents en prise', 'teeth in mesh')} ${S.Zpr}</th>${DATA.KZ.map(k => `<th>${k[0]}${k[0] === 6 ? '+' : ''}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">${S.Kz}</th>${DATA.KZ.map(k => `<td class="${k[0] === kzSel ? 'hit' : ''}">${nf(k[1], 1)}</td>`).join('')}</tr></tbody></table>`);
  set('t-w', `<button type="button" class="chip${!s.b ? ' sel' : ''}" data-act="b" data-val="">Auto</button>` +
    T.w.map(w => `<button type="button" class="chip${w[0] === r.b ? ' sel' : ''}${w[0] === r.bAuto ? ' auto' : ''}${r.KbReq == null || w[1] < r.KbReq ? ' out' : ''}" data-act="b" data-val="${w[0]}">${n(w[0], 1)} · K<sub>b</sub> ${nf(w[1], 2)}</button>`).join(''));
  set('t-o8', eq(
    `${S.Kb} ${tx('requis', 'required')} ≥ ${S.Ps}/(${S.P0}·${S.Kz}) = ${n(r.Ps, 2)}/(${nf(r.P0, 3)} × ${nf(r.Kz, 1)}) = ${res(r.KbReq == null ? '∞' : nf(r.KbReq, 2))}`,
    `${S.b} = ${n(r.b, 1)} mm → ${S.Kb} = ${nf(r.Kb, 2)}`,
    `${S.Pa} = ${S.P0}·${S.Kb}·${S.Kz} = ${nf(r.P0, 3)} × ${nf(r.Kb, 2)} × ${nf(r.Kz, 1)} = ${res(nf(r.Pa, 2) + ' kW')} ${r.ok ? '≥' : '&lt;'} ${S.Ps} → ${okb(r.ok, tx('convient', 'OK'), tx('insuffisant', 'not enough'))}`
  ) + `<div class="final"><span class="final-n">${r.desig}</span><span class="note">${tx('désignation ISO 5296 : longueur en dixièmes de pouce, type, largeur en centièmes de pouce', 'ISO 5296 code: length in tenths of an inch, type, width in hundredths of an inch')}</span></div>`);
};

/* ---------- result panel ---------- */
let lastBig = '', lastMeter = 0;
UI.renderResult = r => {
  const el = $('#result');
  if (r.fatal) { el.innerHTML = `<div class="res-h"><span class="pill bad">${tx('Calcul impossible', 'Cannot compute')}</span></div>${UI.issues(r)}`; lastBig = ''; return; }
  const lvl = r.W.some(w => w.lvl === 'bad') ? 'bad' : r.W.some(w => w.lvl === 'warn') ? 'warn' : 'ok';
  const pill = `<span class="pill ${lvl}">${{ ok: tx('Conforme', 'Within limits'), warn: tx('À vérifier', 'Check'), bad: tx('Non conforme', 'Not valid') }[lvl]}</span>`;
  const kv = items => `<dl class="kv">${items.map(([k, v], i) => `<div><dt>${k}</dt><dd data-kv="${i}">${v}</dd></div>`).join('')}</dl>`;
  const load = r.load == null ? 2 : r.load;
  const meter = cap => `<div class="meter-row"><div class="meter${load > 1 ? ' over' : ''}"><span style="width:${(Math.min(100, lastMeter * 100)).toFixed(1)}%"></span></div><span>${r.load == null ? '—' : n(load * 100, 0) + ' %'}</span></div><p class="res-sub">${cap}</p>`;
  const prevKv = [...el.querySelectorAll('[data-kv]')].map(d => d.textContent);
  let big, body;
  if (r.mode === 'v') {
    big = `${r.nc} × ${r.sec}${r.Lp}`;
    body = `<p class="res-sub">${r.nc} ${r.nc > 1 ? tx('courroies trapézoïdales classiques', 'classic V-belts') : tx('courroie trapézoïdale classique', 'classic V-belt')}, ${tx('section', 'section')} ${r.sec}, <i>L</i><sub>p</sub> = ${n(r.Lp, 0)} mm</p>
      ${kv([[tx('Poulies d/D', 'Pulleys d/D'), `${n(r.dp, 0)} / ${n(r.Dp, 0)} mm`], [tx('Entraxe a', 'Centre dist. a'), `${n(r.a, 0)} mm`], [tx('Vitesse V', 'Speed V'), `${nf(r.V, 1)} m/s`],
        [tx('Enroulement θ', 'Wrap θ'), `${n(r.theta, 0)}°`], [tx('Pₐ / courroie', 'Pₐ / belt'), `${nf(r.Pa, 2)} kW`], [tx('N sortie', 'Output N'), `${n(r.NDreal, 0)} (${pct(r.err)})`]])}
      ${meter(tx('Charge : <i>P</i><sub>s</sub> / (<i>n</i><sub>c</sub> · <i>P</i><sub>a</sub>)', 'Load: <i>P</i><sub>s</sub> / (<i>n</i><sub>c</sub> · <i>P</i><sub>a</sub>)'))}`;
  } else {
    big = r.desig;
    body = `<p class="res-sub">${tx('Courroie crantée', 'Timing belt')} ${r.type}, ${r.Zc} ${tx('dents', 'teeth')}, ${tx('largeur', 'width')} ${n(r.b, 1)} mm, <i>L</i><sub>p</sub> = ${n(r.Lp, 1)} mm</p>
      ${kv([[tx('Dents Z<sub>d</sub>/Z<sub>D</sub>', 'Teeth Z<sub>d</sub>/Z<sub>D</sub>'), `${r.Zd} / ${r.ZD}`], [tx('Entraxe a', 'Centre dist. a'), `${n(r.a, 0)} mm`], [tx('Vitesse V', 'Speed V'), `${nf(r.V, 1)} m/s`],
        [tx('Dents en prise', 'Teeth in mesh'), `${nf(r.Zpr, 1)}`], ['Pₐ / Pₛ', `${nf(r.Pa, 2)} / ${n(r.Ps, 2)}`], [tx('N sortie', 'Output N'), `${n(r.NDreal, 0)} (${pct(r.err)})`]])}
      ${meter(tx('Charge : <i>P</i><sub>s</sub> / <i>P</i><sub>a</sub>', 'Load: <i>P</i><sub>s</sub> / <i>P</i><sub>a</sub>'))}`;
  }
  el.innerHTML = `<div class="res-h"><span class="res-big">${big}</span>${pill}</div>${body}${UI.issues(r)}`;
  if (lastBig && lastBig !== big) el.querySelector('.res-big').classList.add('rise');
  el.querySelectorAll('[data-kv]').forEach((d, i) => { if (prevKv[i] != null && prevKv[i] !== d.textContent) d.classList.add('flash'); });
  lastBig = big;
  const bar = el.querySelector('.meter span');
  void bar.offsetWidth; // commit the old width so the transition runs
  bar.style.width = (Math.min(100, load * 100)).toFixed(1) + '%';
  lastMeter = load;
};
})(window);
