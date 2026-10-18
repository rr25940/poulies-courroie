/* State, server calls, events and page-level animations. */
(function (root) {
'use strict';
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // served from the site root so its scope covers the whole app
    navigator.serviceWorker.register('sw.js').catch(error => {
      console.error('Service worker registration failed', error);
    });
  });
}
const UI = root.BeltUI, $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const DEF = JSON.parse(document.getElementById('belt-defaults').textContent);
const KEY = 'poulies-courroies-flask-v1';
const reduced = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- formatting & language ---------- */
let LNG = 'fr';
UI.tx = (fr, en) => LNG === 'en' ? en : fr;
const loc = () => LNG === 'en' ? 'en-GB' : 'fr-FR';
UI.n = (x, d = 2) => (x == null || !isFinite(x)) ? '—' : (+x).toLocaleString(loc(), { maximumFractionDigits: d });
UI.nf = (x, d) => (x == null || !isFinite(x)) ? '—' : (+x).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });

/* ---------- state ---------- */
const clone = o => JSON.parse(JSON.stringify(o));
let st = clone(DEF);
try {
  const o = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (o && o.v && o.t) st = { mode: o.mode === 't' ? 't' : 'v', lang: o.lang === 'en' ? 'en' : 'fr', v: Object.assign(clone(DEF.v), o.v), t: Object.assign(clone(DEF.t), o.t) };
} catch (e) { /* storage unavailable */ }
const qp = new URLSearchParams(location.search);  // ?mode=t&lang=en for direct links
if (qp.get('mode') === 'v' || qp.get('mode') === 't') st.mode = qp.get('mode');
if (qp.get('lang') === 'fr' || qp.get('lang') === 'en') st.lang = qp.get('lang');
// The Google Play app opens the site with ?source=twa. There, the donation letter is hidden:
// Google Play's payments policy restricts asking for money outside Play billing.
let inApp = qp.get('source') === 'twa' || document.referrer.startsWith('android-app://');
try { if (inApp) sessionStorage.setItem('pc-twa', '1'); else inApp = sessionStorage.getItem('pc-twa') === '1'; } catch (e) { /* storage blocked */ }
if (inApp) document.documentElement.classList.add('in-app');
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignored */ } };
const clr = (m, keys) => keys.forEach(k => { st[m][k] = null; });

/* ---------- server calls: one request in flight, the latest state always wins ---------- */
let inflight = false, dirty = false, quiet = true, lastResult = null;
async function compute() {
  if (inflight) { dirty = true; return; }
  inflight = true; dirty = false;
  const mode = st.mode, busy = $('#busy'), timer = setTimeout(() => busy.classList.add('on'), 160);
  try {
    const resp = await fetch(`api/compute/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(st[mode]) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const r = await resp.json();
    if (mode === st.mode) paint(r);
  } catch (e) {
    if (splash) splash.fail();
    $('#result').innerHTML = `<p class="offline">${UI.tx('Le serveur ne répond pas. Vérifiez que le conteneur tourne, puis modifiez une valeur pour réessayer.', 'The server is not responding. Check that the container is running, then change a value to retry.')}</p>`;
  } finally {
    clearTimeout(timer); busy.classList.remove('on'); inflight = false;
    if (dirty) compute();
  }
}
function update() { save(); compute(); }

/* ---------- loading screen: warm 10-second intro when the app opens ----------
   Plays in full on the first load of a session (each time the app is launched); a reload in the
   same session gets a short one. It never hides before the first result, so on a free server that
   is still waking up it stays on screen and says so. */
const INTRO_MS = 10000;
let splash = null;

/* Inchworm gait along the progress line: each step the body arches (tail catches up),
   then stretches (head reaches forward). The step length is chosen so the head reaches
   the end of the line when the intro ends; the green trail behind it is the progress. */
function startWorm(intro) {
  const svg = $('#worm');
  if (!svg) return { stop() {} };
  const body = ['#worm-o', '#worm-b'].map(s => $(s)), shine = $('#worm-s'), face = $('#worm-face'), trail = $('#worm-trail'), shadow = $('#worm-shadow');
  const X0 = 12, X1 = 248, BASE = 47.5, L = 62, CYCLE = 0.9, span = X1 - X0 - L;
  const D = Math.min(18, Math.max(8, span / Math.max(1, intro / 1000 / CYCLE)));
  const ease = t => t * t * (3 - 2 * t), r1 = v => v.toFixed(1);
  const t0 = performance.now();
  let raf = 0;
  const draw = now => {
    const cyc = (now - t0) / 1000 / CYCLE, n = Math.floor(cyc), f = cyc - n;
    const T = X0 + ((n * D) % span);  // tail position at the start of this step (wraps if the server is slow)
    const xt = f < 0.5 ? T + D * ease(f / 0.5) : T + D;
    const xh = f < 0.5 ? T + L : T + L + D * ease((f - 0.5) / 0.5);
    const c = xh - xt, A = Math.sqrt(Math.max(0, (L / 2) ** 2 - (c / 2) ** 2)) * 1.33;
    const curve = (y0) => `M${r1(xt)} ${y0} C${r1(xt + c * 0.2)} ${r1(y0 - A)} ${r1(xh - c * 0.2)} ${r1(y0 - A)} ${r1(xh)} ${y0}`;
    body.forEach(p => p.setAttribute('d', curve(BASE)));
    shine.setAttribute('d', curve(BASE - 3));
    face.setAttribute('transform', `translate(${r1(xh)} ${BASE})`);
    trail.setAttribute('x2', r1(xt));
    shadow.setAttribute('cx', r1((xt + xh) / 2)); shadow.setAttribute('rx', r1(c / 2));
  };
  if (reduced()) { draw(t0 + CYCLE * 250); return { stop() {} }; }  // one still, arched pose
  const loop = now => { draw(now); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  return { stop() { cancelAnimationFrame(raf); } };
}
function startSplash() {
  const el = $('#splash');
  if (!el) return null;
  let intro = INTRO_MS;
  try { if (sessionStorage.getItem('pc-intro')) intro = 900; sessionStorage.setItem('pc-intro', '1'); } catch (e) { /* storage blocked: full intro */ }
  if (reduced()) intro = 0;
  const t0 = performance.now(), msg = $('#splash-msg'), worm = startWorm(intro);
  const lines = () => UI.tx(
    ['Lecture du tableau des facteurs de service…', 'Tracé du graphe 1…', 'Choix des diamètres primitifs…', 'Calcul de l’entraxe…', 'Interpolation dans le tableau 4…', 'Lecture de Kθ et de KL…', 'Mise en tension des brins…'],
    ['Reading the service factor table…', 'Plotting chart 1…', 'Choosing the pitch diameters…', 'Working out the centre distance…', 'Interpolating in table 4…', 'Reading Kθ and KL…', 'Tensioning the belt…']);
  let ready = false, done = false, k = 0;
  const say = () => {
    if (!ready && performance.now() - t0 > intro) msg.textContent = UI.tx('Le serveur se réveille, encore quelques secondes…', 'The server is waking up, a few more seconds…');
    else { const l = lines(); msg.textContent = l[k++ % l.length]; }
  };
  say();
  const timer = setInterval(say, 1400);
  const hide = () => {
    if (done) return;
    done = true; clearInterval(timer); worm.stop();
    el.classList.add('out');
    document.body.classList.remove('splashing');
    setTimeout(() => el.remove(), 800);
    if (!reduced()) $$(`#steps-${st.mode} .step, .bench`).forEach(s => { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); });
  };
  const check = () => { const left = intro - (performance.now() - t0); if (left <= 0) hide(); else setTimeout(check, left); };
  $('#splash-skip').addEventListener('click', hide);
  return { ready() { if (!ready) { ready = true; check(); } }, fail: hide };
}

/* ---------- painting ---------- */
function snapshot() {
  const map = new Map();
  $$(`#steps-${st.mode} .out`).forEach(o => map.set(o.id, [...o.querySelectorAll('.res')].map(x => x.textContent)));
  return map;
}
let prevStatus = {}, firstPaint = true;
function paint(r) {
  lastResult = r;
  const before = quiet ? null : snapshot();
  if (r.mode === 'v') UI.renderV(r, st.v); else UI.renderT(r, st.t);
  UI.drawDrive(r);
  UI.renderResult(r);
  if (before && !reduced()) {
    $$(`#steps-${r.mode} .out`).forEach(o => {
      const old = before.get(o.id); if (!old) return;
      o.querySelectorAll('.res').forEach((x, i) => { if (old[i] != null && old[i] !== x.textContent) x.classList.add('flash'); });
    });
  }
  const status = UI.stepStatus(r);
  for (const [i, s] of Object.entries(status)) {
    const badge = $(`#${r.mode}-n${i}`), link = $(`#rail-${r.mode} [data-rail="${i}"]`), key = r.mode + i;
    const cls = s === 'idle' ? '' : s === 'info' ? 'ok' : s;
    badge.className = 'step-n' + (cls ? ' ' + cls : '');
    link.className = cls;
    if (!quiet && prevStatus[key] && prevStatus[key] !== cls && cls !== 'ok' && !reduced()) { void badge.offsetWidth; badge.classList.add('pulse'); }
    prevStatus[key] = cls;
  }
  // a link to a step (…/#v-s3) lands there once the content has loaded and the layout settled
  if (firstPaint && location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView());
  }
  firstPaint = false;
  quiet = false;
  if (splash) splash.ready();
}

/* ---------- inputs ---------- */
function syncInputs() {
  for (const m of ['v', 't']) for (const k of ['P', 'Nd', 'ND']) $(`#${m}-${k}`).value = st[m][k];
  $('#v-f').value = st.v.f; $('#v-beta').value = st.v.beta; $('#v-k').value = st.v.k; $('#v-m').value = st.v.m ?? '';
}
function applyLang() {
  LNG = st.lang; document.documentElement.lang = LNG;
  $$('[data-fr]').forEach(el => { el.innerHTML = el.dataset[LNG] ?? el.dataset.fr; });
  $$('[data-act="lang"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === LNG)));
  setPlay();
}
function applyMode(animate) {
  const v = st.mode === 'v';
  $('#steps-v').hidden = !v; $('#steps-t').hidden = v;
  $('#rail-v').hidden = !v; $('#rail-t').hidden = v;
  $('#tab-v').setAttribute('aria-selected', String(v)); $('#tab-t').setAttribute('aria-selected', String(!v));
  if (animate && !reduced()) $$(`#steps-${st.mode} .step`).forEach(s => { s.classList.remove('enter'); void s.offsetWidth; s.classList.add('enter'); });
  observeSteps();
}
function setPlay() {
  const b = $('#play');
  b.textContent = UI.anim.on ? UI.tx('❚❚ Pause', '❚❚ Pause') : UI.tx('▶ Lecture', '▶ Play');
  b.setAttribute('aria-pressed', String(UI.anim.on));
  $$('#speed button').forEach(x => x.setAttribute('aria-pressed', String(+x.dataset.val === UI.anim.mult)));
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, val = b.dataset.val, m = st.mode;
  switch (act) {
    case 'mode': if (val === st.mode) return; st.mode = val; quiet = true; applyMode(true); break;
    case 'lang': st.lang = val; applyLang(); quiet = true; save(); if (lastResult) paint(lastResult); return;
    case 'reset': st[m] = clone(DEF[m]); syncInputs(); break;
    case 'play': UI.anim.on = !UI.anim.on; setPlay(); return;
    case 'copy-email': copyEmail(b); return;
    case 'speed': UI.anim.mult = +val; if (!UI.anim.on) UI.anim.on = true; setPlay(); return;
    case 'driver': st[m].driver = val; break;
    case 'ks': st[m].ks = val.split(',').map(Number); break;
    case 'aauto': st[m].a = null; clr(m, m === 'v' ? ['Lp'] : ['Zc']); break;
    case 'sec': st.v.sec = val || null; clr('v', ['dp', 'Dp', 'a', 'Lp']); break;
    case 'dp': st.v.dp = val ? +val : null; clr('v', ['Dp', 'a', 'Lp']); break;
    case 'Dp': st.v.Dp = val ? +val : null; clr('v', ['a', 'Lp']); break;
    case 'type': st.t.type = val || null; clr('t', ['Zd', 'ZD', 'a', 'Zc', 'b']); break;
    case 'b': st.t.b = val ? +val : null; break;
    default: return;
  }
  update();
});
function copyEmail(btn) {
  const done = () => {
    btn.textContent = UI.tx('Adresse copiée ✓', 'Address copied ✓');
    setTimeout(() => { btn.innerHTML = btn.dataset[LNG] ?? btn.dataset.fr; }, 1800);
  };
  const select = () => {  // fallback: select the address so it can be copied by hand
    const r = document.createRange(); r.selectNodeContents($('#mail-addr'));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(btn.dataset.addr).then(done, select);
  else select();
}
function bindNum(id, m, key, after) {
  $('#' + id).addEventListener('input', e => {
    const raw = e.target.value;
    if (raw === '') { if (key === 'm') { st.v.m = null; update(); } return; }
    const v = parseFloat(raw); if (!isFinite(v)) return;
    st[m][key] = v; if (after) after(); update();
  });
}
for (const m of ['v', 't']) {
  const geo = m === 'v' ? ['Dp', 'a', 'Lp'] : ['ZD', 'a', 'Zc'], lenKey = m === 'v' ? 'Lp' : 'Zc';
  bindNum(`${m}-P`, m, 'P');
  bindNum(`${m}-Nd`, m, 'Nd', () => clr(m, geo));
  bindNum(`${m}-ND`, m, 'ND', () => clr(m, geo));
  $(`#${m}-a`).addEventListener('input', e => { st[m].a = +e.target.value; st[m][lenKey] = null; update(); });
  $(`#${m}-an`).addEventListener('change', e => { const v = parseFloat(e.target.value); if (isFinite(v)) { st[m].a = v; st[m][lenKey] = null; update(); } });
}
bindNum('v-f', 'v', 'f'); bindNum('v-beta', 'v', 'beta'); bindNum('v-k', 'v', 'k'); bindNum('v-m', 'v', 'm');
$('#v-Lp').addEventListener('change', e => { st.v.Lp = e.target.value ? +e.target.value : null; update(); });
$('#t-Zd').addEventListener('change', e => { st.t.Zd = e.target.value ? +e.target.value : null; clr('t', ['ZD', 'a', 'Zc', 'b']); update(); });
$('#t-ZD').addEventListener('change', e => { st.t.ZD = e.target.value ? +e.target.value : null; clr('t', ['a', 'Zc', 'b']); update(); });
$('#t-Zc').addEventListener('change', e => { st.t.Zc = e.target.value ? +e.target.value : null; update(); });

/* ---------- step rail: follows the step in view ---------- */
let io = null;
function observeSteps() {
  if (io) io.disconnect();
  if (!('IntersectionObserver' in root)) return;
  const m = st.mode;
  io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) {
      $$(`#rail-${m} a`).forEach(a => a.removeAttribute('aria-current'));
      const a = $(`#rail-${m} [data-rail="${en.target.dataset.step}"]`); if (a) a.setAttribute('aria-current', 'step');
    }
  }, { rootMargin: '-35% 0px -60% 0px' });
  $$(`#steps-${m} .step`).forEach(s => io.observe(s));
}

let rz = 0;
root.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (lastResult) { quiet = true; paint(lastResult); } }, 150); });
if (reduced()) UI.anim.on = false;
syncInputs(); applyLang(); applyMode(false); splash = startSplash(); compute();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (lastResult) { quiet = true; paint(lastResult); } });
})(window);
