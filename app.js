// Nike Shoe Fit — student test prototype. Screen flow, rendering and interaction.
import { state, runtime, save, resetAll, L, esc, rng, seed, clamp, round, fmt, logEvent, stopStreams, vibrate, beep, toast, download, reducedMotion, sleep } from './util.js';
import { paceSec, fmtPace, sizeConv, sizeLabel, scanValues, archLabel, pronLabel, strikeLabel, generateActivities, simulatedRunMetrics, runMetrics, analysis, surfaceLabel, USECASES, recommendedZones, comfortScore, price, addBusinessDays, fmtDate, COLORS, colorObj, demoProfile } from './data.js';
import { shoePhoto, shoeSVG, measureSVG, pressureFoot, bodyMap, zoneLabel, barChart, soleSVG, hardnessLegend, drawLattice } from './ui.js';

const app = document.getElementById('app');
const bar = document.getElementById('appbar');
const overlayRoot = document.getElementById('overlay-root');

const PHASE = { profile: 1, video: 2, device: 3, scan: 3, analysis: 4, usecase: 4, design: 5, ar: 5, checkout: 6, review: 6, confirm: 6 };
const PHASE_NAMES = () => [L('Profile', 'Profil'), L('Run', 'Laufen'), L('Scan', 'Scan'), L('Analysis', 'Analyse'), L('Design', 'Design'), L('Order', 'Bestellung')];
const ORDER = ['consent', 'profile', 'video', 'device', 'scan', 'analysis', 'usecase', 'design', 'ar', 'checkout', 'review', 'confirm', 'survey', 'thanks'];
let local = {};            // per-screen transient UI state
let viewer = null;         // active three.js viewer

/* ===================== navigation ===================== */
function go(screen, opts = {}) {
  const from = state.screen;
  const ms = Date.now() - (state.stepEnter || Date.now());
  logEvent('step', { from, to: screen, ms });
  cleanup();
  state.screen = screen; state.stepEnter = Date.now();
  if (!opts.back) state.history.push(from);
  save(); local = {};
  render();
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}
function back() { const prev = state.history.pop() || 'profile'; go(prev, { back: true }); }
function cleanup() {
  stopStreams();
  if (viewer) { viewer.dispose(); viewer = null; }
  overlayRoot.querySelectorAll('.sheet-bg').forEach(n => n.remove());
}

/* ===================== header & shell ===================== */
function renderBar() {
  const ph = PHASE[state.screen] || 0;
  const segs = PHASE_NAMES().map((n, i) => `<span class="${i + 1 < ph ? 'on' : i + 1 === ph ? 'cur' : ''}" title="${n}"></span>`).join('');
  bar.innerHTML = `<button class="logo" data-act="logo" aria-label="Nike Shoe Fit">NS</button>
    <div class="phases" role="progressbar" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${ph}" aria-label="${L('Progress', 'Fortschritt')}">${ph ? segs : ''}</div>
    <button class="iconbtn" data-act="lang" aria-label="${L('Switch to German', 'Auf Englisch umschalten')}">${state.lang === 'de' ? 'EN' : 'DE'}</button>
    <button class="iconbtn" data-act="menu" aria-label="${L('Menu', 'Menü')}">⋯</button>`;
  document.documentElement.lang = state.lang;
  document.getElementById('disclaimer').textContent = L('Student prototype (MCI design sprint). Not affiliated with or endorsed by Nike or Strava. No real orders.', 'Studentischer Prototyp (MCI Design Sprint). Keine Verbindung zu Nike oder Strava. Keine echten Bestellungen.');
}

function head(title, sub, backBtn = true) {
  const ph = PHASE[state.screen];
  return `${backBtn ? `<button class="back" data-act="back">‹ ${L('Back', 'Zurück')}</button>` : ''}
    ${ph ? `<div class="eyebrow">${L('Step', 'Schritt')} ${ph} ${L('of', 'von')} 6 · ${PHASE_NAMES()[ph - 1]}</div>` : ''}
    <h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}`;
}

function render() {
  renderBar();
  const s = SCREENS[state.screen] || SCREENS.consent;
  app.innerHTML = `<div class="stack fade" style="gap:14px;flex:1">${s.html()}</div>`;
  if (s.mount) s.mount();
  renderTimer();
}

let timerIv = null;
function renderTimer() {
  let el = document.getElementById('steptimer');
  if (!state.facilitator.showTimer) { if (el) el.remove(); clearInterval(timerIv); return; }
  if (!el) { el = document.createElement('div'); el.id = 'steptimer'; el.className = 'timer'; document.body.appendChild(el); }
  clearInterval(timerIv);
  const tick = () => { el.textContent = Math.round((Date.now() - state.stepEnter) / 1000) + ' s'; };
  tick(); timerIv = setInterval(tick, 1000);
}

/* ===================== sheets (menu, import, facilitator) ===================== */
function openSheet(html, onClick) {
  overlayRoot.querySelectorAll('.sheet-bg').forEach(n => n.remove());
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); else onClick && onClick(e, bg); });
  overlayRoot.appendChild(bg);
  const f = bg.querySelector('button, input, select'); if (f) f.focus();
  return bg;
}

function openMenu() {
  openSheet(`<h2>${L('Menu', 'Menü')}</h2>
    <button class="btn secondary" data-m="lang">${L('Deutsch', 'English')}</button>
    <button class="btn secondary" data-m="restart">${L('Start over', 'Neu starten')}</button>
    <button class="btn secondary" data-m="delete" style="color:#ff8a70">${L('Delete my data', 'Meine Daten löschen')}</button>
    <p class="small">${L('All your data is stored only in this browser. Deleting removes your profile, scan results, video analysis and test log from this device.', 'Alle Daten liegen nur in diesem Browser. Löschen entfernt Profil, Scan-Ergebnisse, Videoanalyse und Testprotokoll von diesem Gerät.')}</p>
    <button class="btn ghost" data-m="close">${L('Close', 'Schließen')}</button>`,
    (e, bg) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const m = b.dataset.m;
      if (m === 'close') bg.remove();
      if (m === 'lang') { state.lang = state.lang === 'de' ? 'en' : 'de'; save(); bg.remove(); render(); }
      if (m === 'restart') { if (b.dataset.confirm) { cleanup(); const keepConsent = state.consent; const nick = state.nickname; resetAll(); state.consent = keepConsent; state.nickname = nick; state.screen = keepConsent ? 'profile' : 'consent'; save(); bg.remove(); render(); toast(L('Started over', 'Neu gestartet')); } else { b.dataset.confirm = 1; b.textContent = L('Tap again to start over', 'Nochmals tippen zum Neustart'); } }
      if (m === 'delete') { if (b.dataset.confirm) { cleanup(); resetAll(); bg.remove(); render(); toast(L('Your data was deleted', 'Deine Daten wurden gelöscht')); } else { b.dataset.confirm = 1; b.textContent = L('Tap again to delete everything', 'Nochmals tippen, um alles zu löschen'); } }
    });
}

let logoTaps = [];
function logoTap() {
  const now = Date.now(); logoTaps = logoTaps.filter(t => now - t < 1500); logoTaps.push(now);
  if (logoTaps.length >= 3) { logoTaps = []; openFacilitator(); }
}

function openFacilitator() {
  const o = state.overrides, sc = scanValues(), rm = runMetrics();
  const sel = (key, opts, cur) => `<select data-ov="${key}"><option value="">${L('Auto', 'Auto')} (${esc(cur)})</option>${opts.map(v => `<option ${o[key] === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  const screens = ORDER.map(s => `<option value="${s}" ${s === state.screen ? 'selected' : ''}>${s}</option>`).join('');
  openSheet(`<h2>${L('Facilitator mode', 'Testleiter-Modus')}</h2>
    <p class="small">${L('Hidden from testers. Changes apply immediately.', 'Für Testpersonen unsichtbar. Änderungen gelten sofort.')}</p>
    <div class="stack fac">
      <div class="rowsel"><span>Arch</span>${sel('arch', ['High arch', 'Normal arch', 'Flat foot'], sc.archType)}</div>
      <div class="rowsel"><span>Pronation</span>${sel('pronation', ['Neutral', 'Overpronation', 'Supination'], sc.pronation)}</div>
      <div class="rowsel"><span>Foot strike</span>${sel('strike', ['Heel strike', 'Midfoot strike', 'Forefoot strike'], rm.strike)}</div>
      <div class="rowsel"><span>Cadence</span><input data-ovn="cadence" inputmode="numeric" placeholder="${rm.cadence}" value="${o.cadence ?? ''}"></div>
      <div class="rowsel"><span>Length R / L</span><div class="grid2"><input data-ovn="lenR" inputmode="decimal" placeholder="${sc.lenR}" value="${o.lenR ?? ''}"><input data-ovn="lenL" inputmode="decimal" placeholder="${sc.lenL}" value="${o.lenL ?? ''}"></div></div>
      <div class="rowsel"><span>Scan source</span><select data-fac="scanSource"><option value="camera" ${state.facilitator.scanSource === 'camera' ? 'selected' : ''}>Camera</option><option value="fallback" ${state.facilitator.scanSource === 'fallback' ? 'selected' : ''}>Generated background</option></select></div>
      <div class="rowsel"><span>Lite mode</span><select data-fac="lite"><option value="0" ${!state.device.lite ? 'selected' : ''}>Off</option><option value="1" ${state.device.lite ? 'selected' : ''}>On</option></select></div>
      <div class="rowsel"><span>Step timer</span><select data-fac="timer"><option value="0" ${!state.facilitator.showTimer ? 'selected' : ''}>Hidden</option><option value="1" ${state.facilitator.showTimer ? 'selected' : ''}>Shown</option></select></div>
      <div class="rowsel"><span>Jump to</span><select data-fac="jump">${screens}</select></div>
      <p class="small">Video analysis: <b>${state.video.mode || 'none'}</b> · Scan done: <b>${state.scan.done ? 'yes' : 'no'}</b> · Log entries: <b>${state.log.length}</b></p>
      <div class="grid2"><button class="btn secondary small" data-f="demo">${L('Autofill demo', 'Demo ausfüllen')}</button><button class="btn secondary small" data-f="export">${L('Export JSON', 'JSON exportieren')}</button></div>
      <button class="btn secondary small" data-f="reset" style="width:100%">${L('Reset session', 'Sitzung zurücksetzen')}</button>
      <button class="btn primary" data-f="close">${L('Close', 'Schließen')}</button>
    </div>`,
    (e, bg) => {
      const b = e.target.closest('[data-f]'); if (!b) return;
      const f = b.dataset.f;
      if (f === 'close') { bg.remove(); render(); }
      if (f === 'demo') { state.profile = demoProfile(); state.nickname = state.nickname || 'Demo'; state.consent = true; save(); logEvent('override', { what: 'demo-profile' }); bg.remove(); render(); toast('Demo profile loaded'); }
      if (f === 'export') { download(new Blob([JSON.stringify({ exported: new Date().toISOString(), state }, null, 2)], { type: 'application/json' }), `nsf-session-${Date.now()}.json`); }
      if (f === 'reset') { cleanup(); resetAll(); bg.remove(); render(); toast('Session reset'); }
    });
  const sheet = overlayRoot.querySelector('.sheet');
  sheet.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ov !== undefined) { if (t.value) state.overrides[t.dataset.ov] = t.value; else delete state.overrides[t.dataset.ov]; logEvent('override', { what: t.dataset.ov, value: t.value }); }
    if (t.dataset.ovn !== undefined) { const v = parseFloat(String(t.value).replace(',', '.')); if (isFinite(v)) state.overrides[t.dataset.ovn] = v; else delete state.overrides[t.dataset.ovn]; logEvent('override', { what: t.dataset.ovn, value: t.value }); }
    if (t.dataset.fac === 'scanSource') state.facilitator.scanSource = t.value;
    if (t.dataset.fac === 'lite') state.device.lite = t.value === '1';
    if (t.dataset.fac === 'timer') { state.facilitator.showTimer = t.value === '1'; renderTimer(); }
    if (t.dataset.fac === 'jump') { save(); overlayRoot.querySelector('.sheet-bg')?.remove(); go(t.value); return; }
    save();
  });
}

/* ===================== helpers ===================== */
function bindValue(path, raw, type) {
  const parts = path.split('.'); let o = state;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = type === 'number' ? (raw === '' ? '' : Number(String(raw).replace(',', '.'))) : raw;
  save();
}
function profileStrength() {
  const p = state.profile; let s = 0, n = 0;
  const add = c => { n++; if (c) s++; };
  add(p.weight > 30); add(p.height > 100); add(p.shoeEU > 30); add(p.runsPerWeek > 0); add(p.weeklyKm > 0); add(p.longestRun > 0);
  add(/^\d{1,2}:\d{2}$/.test(p.pace)); add(!!p.goal); add(!!p.goalDate); add(!!p.currentShoe); add(p.comfort.length > 0);
  add(!!state.imported); add(!!state.imported); add(p.cushion !== 50 || p.drop !== 'auto');
  return Math.round((s / n) * 100);
}
function validPace(p) { const m = String(p).match(/^(\d{1,2}):(\d{2})$/); return !!m && +m[2] < 60 && +m[1] >= 2 && +m[1] <= 15; }
function shoeSizeShown() { const p = state.profile; return p.sizeSys === 'US' ? sizeConv.toUS(p.shoeEU) : p.sizeSys === 'UK' ? sizeConv.toUK(p.shoeEU) : p.shoeEU; }
function nick() { return state.nickname ? esc(state.nickname) : L('you', 'dich'); }
function possessive() { return state.nickname ? esc(state.nickname) + (state.lang === 'de' ? 's' : "'s") : L('your', 'deine'); }

/* ===================== SCREENS ===================== */
const SCREENS = {};

/* ---------- 0 consent ---------- */
SCREENS.consent = {
  html: () => `
    <div class="hero-logo" aria-hidden="true">NS</div>
    <h1 style="font-size:34px">Nike Shoe Fit</h1>
    <p class="sub">${L('Scan your feet, analyse your stride and design a 3D-printed running shoe built around you.', 'Scanne deine Füße, analysiere deinen Laufstil und gestalte einen 3D-gedruckten Laufschuh, der zu dir passt.')}</p>
    <div class="heroshoe"><span class="badge">${L('AI-powered fit', 'KI-basierte Passform')}</span>${shoePhoto('black')}</div>
    <div class="card stack">
      <h2>${L('Before you start', 'Bevor du startest')}</h2>
      <ul class="bullets">
        <li><span class="dot">1</span><span><b>${L('What we use:', 'Was wir nutzen:')}</b> ${L('your runner profile, demo data from a running app, a short running video and a foot scan with your camera.', 'dein Läuferprofil, Demo-Daten aus einer Lauf-App, ein kurzes Laufvideo und einen Fußscan mit deiner Kamera.')}</span></li>
        <li><span class="dot">2</span><span><b>${L('It stays on your phone:', 'Alles bleibt auf deinem Handy:')}</b> ${L('photos, videos and personal data are never uploaded. Only the anonymous feedback survey at the end is sent.', 'Fotos, Videos und persönliche Daten werden nie hochgeladen. Nur die anonyme Umfrage am Ende wird gesendet.')}</span></li>
        <li><span class="dot">3</span><span><b>${L('Camera:', 'Kamera:')}</b> ${L('your browser will ask for camera access before the video and the scan. You can say no and use a fallback.', 'Dein Browser fragt vor Video und Scan nach dem Kamerazugriff. Du kannst ablehnen und eine Alternative nutzen.')}</span></li>
        <li><span class="dot">4</span><span><b>${L('No real order:', 'Keine echte Bestellung:')}</b> ${L('nothing is bought, paid or produced. You can delete your data at any time in the menu (⋯).', 'Es wird nichts gekauft, bezahlt oder produziert. Du kannst deine Daten jederzeit im Menü (⋯) löschen.')}</span></li>
      </ul>
    </div>
    <label class="stack" style="gap:6px"><span class="label">${L('What should we call you? (optional)', 'Wie sollen wir dich nennen? (optional)')}</span>
      <input class="text" id="nick" maxlength="20" autocomplete="nickname" value="${esc(state.nickname)}" placeholder="${L('e.g. Lena', 'z. B. Lena')}"></label>
    <label class="check"><input type="checkbox" id="agree" ${state.consent ? 'checked' : ''}><span>${L('I understand this is a student prototype (MCI design sprint), not a Nike product, and I agree to take part in the test.', 'Ich verstehe, dass dies ein studentischer Prototyp (MCI Design Sprint) und kein Nike-Produkt ist, und nehme am Test teil.')}</span></label>
    <div class="grow"></div>
    <button class="btn primary" data-act="start" id="startbtn" ${state.consent ? '' : 'disabled'}>${L("Let's start", "Los geht's")}</button>`,
  mount() {
    const agree = document.getElementById('agree'), btn = document.getElementById('startbtn');
    agree.addEventListener('change', () => { btn.disabled = !agree.checked; });
    document.getElementById('nick').addEventListener('input', e => { state.nickname = e.target.value.trim().slice(0, 20); save(); });
  }
};

/* ---------- 1 profile ---------- */
SCREENS.profile = {
  html() {
    const p = state.profile, imp = state.imported;
    const seg = (key, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-seg="${key}" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
    const num = (path, label, unit, val, attrs = '') => `<label class="field"><span class="label">${label}</span><span class="in"><input type="number" data-bind="${path}" data-type="number" value="${val}" inputmode="decimal" ${attrs} aria-label="${label}"><span class="unit">${unit}</span></span></label>`;
    const sliders = Object.entries(p.surface).map(([k, v]) => `<div class="slider"><span>${surfaceLabel(k)}</span><input type="range" min="0" max="100" step="5" value="${v}" data-surf="${k}" aria-label="${surfaceLabel(k)}"><output id="surf-${k}">${v}%</output></div>`).join('');
    return `${head(L(`Hi ${nick()}, tell us how you run`, `Hallo ${nick()}, erzähl uns, wie du läufst`), L('We use this to tune cushioning, support and fit. The more you share, the better the fit.', 'Damit stimmen wir Dämpfung, Stütze und Passform ab. Je mehr du teilst, desto besser die Passform.'), false)}
    <div class="card hl stack" style="gap:8px"><div class="between"><span class="label">${L('Profile strength', 'Profilstärke')}</span><b class="volt num" id="strength">${profileStrength()}%</b></div><div class="meter"><i id="strengthbar" style="width:${profileStrength()}%"></i></div></div>

    <div class="card stack">
      <h3>${L('Import your running data', 'Laufdaten importieren')}</h3>
      ${imp ? `<div class="between"><span class="badge ${imp.source === 'GPX file' ? '' : 'dim'}">${imp.source === 'GPX file' ? L('From your file', 'Aus deiner Datei') : L('Demo data', 'Demo-Daten')} · ${esc(imp.source)}</span><button class="btn ghost small" data-act="disconnect">${L('Disconnect', 'Trennen')}</button></div>
        <div class="grid3"><div class="metric"><b>${imp.count}</b><span>${L('activities', 'Aktivitäten')}</span></div><div class="metric"><b>${imp.totalKm}</b><span>${L('km / 12 wk', 'km / 12 Wo.')}</span></div><div class="metric"><b>${imp.avgPace}</b><span>min/km</span></div></div>
        <span class="label">${L('Last 12 weeks', 'Letzte 12 Wochen')}</span>${barChart(imp.weeks)}
        <div class="runs">${imp.runs.slice(0, 4).map(r => `<div><span>${new Date(r.date).toLocaleDateString(state.lang === 'de' ? 'de-AT' : 'en-GB', { day: 'numeric', month: 'short' })} · ${surfaceLabel(r.surface)}</span><span>${fmt(r.dist)} km</span><span>${r.pace} /km</span></div>`).join('')}</div>`
      : `<p class="small" style="margin:0">${L('Connect a running app to fill in your training history automatically.', 'Verbinde eine Lauf-App, um deinen Trainingsverlauf automatisch zu übernehmen.')}</p>
        <button class="btn secondary" data-act="connect" data-src="Strava">〰 ${L('Connect Strava', 'Strava verbinden')}</button>
        <button class="btn secondary" data-act="connect" data-src="Apple Health">♡ ${L('Connect Apple Health', 'Apple Health verbinden')}</button>`}
      <label class="btn ghost" style="cursor:pointer">⇪ ${L('Import a GPX/TCX file instead', 'Stattdessen GPX/TCX-Datei importieren')}<input type="file" accept=".gpx,.tcx,application/gpx+xml,application/xml,text/xml" class="visually-hidden" id="gpx"></label>
    </div>

    <h3>${L('Body', 'Körper')}</h3>
    <div class="grid2">${num('profile.weight', L('Weight', 'Gewicht'), 'kg', p.weight, 'min="30" max="200"')}${num('profile.height', L('Height', 'Größe'), 'cm', p.height, 'min="120" max="220"')}</div>
    <label class="field"><span class="label">${L('Age', 'Alter')}</span><select data-bind="profile.ageRange" aria-label="${L('Age range', 'Altersgruppe')}">${['18-24', '25-34', '35-44', '45-54', '55+'].map(a => `<option ${p.ageRange === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <div class="stack" style="gap:6px"><span class="label">${L('Current shoe size', 'Aktuelle Schuhgröße')}</span>
      <div class="grid2"><label class="field"><span class="label">${p.sizeSys}</span><span class="in"><input type="number" step="0.5" id="shoesize" value="${shoeSizeShown()}" inputmode="decimal" aria-label="${L('Shoe size', 'Schuhgröße')}"></span></label>${seg('sizeSys', [['EU', 'EU'], ['US', 'US'], ['UK', 'UK']], p.sizeSys)}</div></div>
    <div class="stack" style="gap:6px"><span class="label">${L('Foot width', 'Fußbreite')}</span>${seg('width', [['narrow', L('Narrow', 'Schmal')], ['normal', L('Normal', 'Normal')], ['wide', L('Wide', 'Breit')]], p.width)}</div>

    <h3>${L('Running', 'Laufen')}</h3>
    <div class="grid2">${num('profile.runsPerWeek', L('Runs / week', 'Läufe / Woche'), '×', p.runsPerWeek, 'min="0" max="14"')}${num('profile.weeklyKm', L('Weekly distance', 'Wochenumfang'), 'km', p.weeklyKm, 'min="0" max="250"')}</div>
    <div class="grid2">${num('profile.longestRun', L('Longest run', 'Längster Lauf'), 'km', p.longestRun, 'min="0" max="100"')}
      <label class="field" id="pacefield"><span class="label">${L('Typical pace', 'Übliches Tempo')}</span><span class="in"><input id="pace" value="${esc(p.pace)}" inputmode="numeric" placeholder="5:45" aria-label="${L('Pace in minutes per kilometre', 'Tempo in Minuten pro Kilometer')}"><span class="unit">min/km</span></span></label></div>
    <div class="stack" style="gap:6px"><span class="label">${L('Goal', 'Ziel')}</span><div class="chips">${[['fun', L('Fitness & fun', 'Fitness & Spaß')], ['10k', '10 km'], ['half', L('Half marathon', 'Halbmarathon')], ['marathon', 'Marathon']].map(([v, l]) => `<button class="chip ${p.goal === v ? 'on' : ''}" data-seg="goal" data-v="${v}">${l}</button>`).join('')}</div>
      <label class="field"><span class="label">${L('Target date (optional)', 'Zieldatum (optional)')}</span><input type="date" data-bind="profile.goalDate" value="${esc(p.goalDate)}" style="font-size:17px"></label></div>
    <div class="card stack" style="gap:8px"><div class="between"><span class="label">${L('Surface mix', 'Untergrund')}</span><span class="small">= 100%</span></div>${sliders}</div>

    <h3>${L('Preferences', 'Vorlieben')}</h3>
    <div class="card stack" style="gap:8px">
      <div class="slider"><span>${L('Cushioning', 'Dämpfung')}</span><input type="range" min="0" max="100" step="5" value="${p.cushion}" data-bind="profile.cushion" data-type="number" aria-label="${L('Cushioning feel from soft to firm', 'Dämpfung von weich bis fest')}"><output>${p.cushion < 35 ? L('soft', 'weich') : p.cushion > 65 ? L('firm', 'fest') : L('balanced', 'mittel')}</output></div>
      <span class="label">${L('Heel-to-toe drop', 'Sprengung (Drop)')}</span>${seg('drop', [['auto', 'Auto'], ['4', '4 mm'], ['8', '8 mm'], ['10', '10 mm'], ['12', '12 mm']], p.drop)}
    </div>
    <div class="grid2"><label class="field"><span class="label">${L('Current shoe', 'Aktueller Schuh')}</span><input data-bind="profile.currentShoe" value="${esc(p.currentShoe)}" placeholder="${L('Model', 'Modell')}" style="font-size:16px;font-weight:600" maxlength="40"></label>${num('profile.currentShoeKm', L('Its mileage', 'Gelaufen'), 'km', p.currentShoeKm, 'min="0" max="3000"')}</div>

    <h3>${L('Where do shoes feel uncomfortable?', 'Wo drücken Schuhe?')}</h3>
    <p class="small" style="margin:-6px 0 0">${L('Tap all areas that apply. This is about comfort, not a medical diagnosis.', 'Tippe alle passenden Bereiche an. Es geht um Komfort, nicht um eine medizinische Diagnose.')}</p>
    ${bodyMap(p.comfort)}
    <div class="chips" id="comfortchips">${p.comfort.length ? p.comfort.map(z => `<span class="chip on">${zoneLabel(z)}</span>`).join('') : `<span class="small">${L('Nothing selected', 'Nichts ausgewählt')}</span>`}</div>
    <p class="small" id="perr" style="color:#ff8a70;margin:0" hidden></p>
    <button class="btn primary" data-act="saveprofile">${L('Continue', 'Weiter')}</button>`;
  },
  mount() {
    const pace = document.getElementById('pace');
    pace.addEventListener('input', () => { const ok = validPace(pace.value.trim()); document.getElementById('pacefield').style.borderColor = ok ? '' : '#ff8a70'; if (ok) { state.profile.pace = pace.value.trim(); save(); updateStrength(); } });
    document.getElementById('shoesize').addEventListener('input', e => {
      const v = parseFloat(String(e.target.value).replace(',', '.')); if (!isFinite(v)) return;
      const p = state.profile; p.shoeEU = p.sizeSys === 'US' ? sizeConv.fromUS(v) : p.sizeSys === 'UK' ? sizeConv.fromUK(v) : v; save(); updateStrength();
    });
    app.querySelectorAll('[data-surf]').forEach(sl => sl.addEventListener('input', () => setSurface(sl.dataset.surf, +sl.value)));
    document.getElementById('gpx').addEventListener('change', importGPX);
    app.querySelectorAll('.zone[data-zone]').forEach(z => {
      const toggle = () => { const c = state.profile.comfort; const id = z.dataset.zone; const i = c.indexOf(id); if (i >= 0) c.splice(i, 1); else c.push(id); save(); z.classList.toggle('on'); z.setAttribute('aria-pressed', c.includes(id)); vibrate(10);
        document.getElementById('comfortchips').innerHTML = c.length ? c.map(x => `<span class="chip on">${zoneLabel(x)}</span>`).join('') : `<span class="small">${L('Nothing selected', 'Nichts ausgewählt')}</span>`; updateStrength(); };
      z.addEventListener('click', toggle); z.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }
};
function updateStrength() { const s = profileStrength(); const a = document.getElementById('strength'), b = document.getElementById('strengthbar'); if (a) a.textContent = s + '%'; if (b) b.style.width = s + '%'; }
function setSurface(key, val) {
  const s = state.profile.surface; const others = Object.keys(s).filter(k => k !== key);
  val = clamp(val, 0, 100); const rest = 100 - val; const sumO = others.reduce((a, k) => a + s[k], 0);
  s[key] = val;
  if (sumO === 0) others.forEach((k, i) => { s[k] = i === 0 ? rest : 0; });
  else { let acc = 0; others.forEach((k, i) => { if (i === others.length - 1) s[k] = rest - acc; else { s[k] = Math.round((s[k] / sumO) * rest / 5) * 5; acc += s[k]; } }); }
  for (const k of Object.keys(s)) { s[k] = Math.max(0, s[k]); const sl = app.querySelector(`[data-surf="${k}"]`); if (sl && k !== key) sl.value = s[k]; const o = document.getElementById('surf-' + k); if (o) o.textContent = s[k] + '%'; }
  save();
}

function startImport(src) {
  const bg = openSheet(`<div class="row"><div class="logo" style="display:grid;place-items:center">NS</div><span style="font-size:22px;color:var(--muted)">⇄</span><div class="logo" style="display:grid;place-items:center;background:var(--surface-2);color:#fff;font-size:11px">${src === 'Strava' ? 'RUN' : '♡'}</div></div>
    <h2>${L(`Allow Nike Shoe Fit to read your ${src} activities?`, `Nike Shoe Fit erlauben, deine ${src}-Aktivitäten zu lesen?`)}</h2>
    <span class="badge dim">${L('Demo connection · no login, no real data access', 'Demo-Verbindung · kein Login, kein echter Datenzugriff')}</span>
    <div class="perm"><div>${L('Runs of the last 6 months (distance, pace, elevation)', 'Läufe der letzten 6 Monate (Distanz, Tempo, Höhenmeter)')}</div><div>${L('Surface and route type', 'Untergrund und Streckentyp')}</div><div>${L('Shoes logged with your runs', 'Bei Läufen erfasste Schuhe')}</div></div>
    <p class="small">${L('Read-only. You can disconnect at any time.', 'Nur Lesezugriff. Du kannst jederzeit trennen.')}</p>
    <div class="grid2"><button class="btn secondary" data-i="cancel">${L('Cancel', 'Abbrechen')}</button><button class="btn primary" data-i="allow">${L('Allow', 'Erlauben')}</button></div>`,
    async (e, bgEl) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      if (b.dataset.i === 'cancel') { bgEl.remove(); logEvent('import-cancel', { src }); return; }
      const acts = generateActivities(src);
      bgEl.querySelector('.sheet').innerHTML = `<div class="spinner"></div><h2 style="text-align:center">${L('Syncing', 'Synchronisiere')} ${src}…</h2><p class="small num" style="text-align:center" id="synctxt">${L('Importing', 'Importiere')} 0 / ${acts.count} ${L('activities', 'Aktivitäten')}</p><div class="meter"><i id="syncbar"></i></div>`;
      const t0 = performance.now(), dur = 2600;
      await new Promise(res => { const iv = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / dur); const el = document.getElementById('synctxt'), bb = document.getElementById('syncbar'); if (el) el.textContent = `${L('Importing', 'Importiere')} ${Math.round(u * acts.count)} / ${acts.count} ${L('activities', 'Aktivitäten')}`; if (bb) bb.style.width = (u * 100) + '%'; if (u >= 1) { clearInterval(iv); res(); } }, 60); });
      state.imported = acts;
      const p = state.profile;
      p.weeklyKm = Math.round(acts.weeks.slice(-4).reduce((a, x) => a + x, 0) / 4);
      p.pace = acts.avgPace; p.longestRun = Math.max(p.longestRun, ...acts.runs.map(r => Math.round(r.dist)));
      save(); logEvent('import', { src }); bgEl.remove(); vibrate(20); render(); toast(L(`${acts.count} activities imported`, `${acts.count} Aktivitäten importiert`));
    });
  return bg;
}

async function importGPX(e) {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const txt = await f.text(); const doc = new DOMParser().parseFromString(txt, 'application/xml');
    let pts = [...doc.getElementsByTagName('trkpt')].map(n => ({ lat: +n.getAttribute('lat'), lon: +n.getAttribute('lon'), t: n.getElementsByTagName('time')[0]?.textContent, e: +(n.getElementsByTagName('ele')[0]?.textContent || 0) }));
    if (!pts.length) pts = [...doc.getElementsByTagName('Trackpoint')].map(n => ({ lat: +(n.getElementsByTagName('LatitudeDegrees')[0]?.textContent), lon: +(n.getElementsByTagName('LongitudeDegrees')[0]?.textContent), t: n.getElementsByTagName('Time')[0]?.textContent, e: +(n.getElementsByTagName('AltitudeMeters')[0]?.textContent || 0) })).filter(p => isFinite(p.lat));
    if (pts.length < 2) throw new Error('empty');
    let d = 0, up = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], R = 6371, dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lon - a.lon) * Math.PI / 180;
      const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
      d += 2 * R * Math.asin(Math.sqrt(h)); if (b.e > a.e) up += b.e - a.e;
    }
    const secs = (new Date(pts[pts.length - 1].t) - new Date(pts[0].t)) / 1000;
    const pace = secs > 0 && d > 0 ? fmtPace(secs / d) : state.profile.pace;
    const acts = generateActivities('GPX file');
    acts.runs.unshift({ date: (pts[0].t || new Date().toISOString()).slice(0, 10), dist: round(d, 1), pace, elev: Math.round(up), surface: up / Math.max(d, 0.1) > 25 ? 'trail' : 'road' });
    acts.avgPace = pace; acts.source = 'GPX file';
    state.imported = acts; state.profile.pace = pace; save(); logEvent('import', { src: 'gpx' }); render();
    toast(L(`Imported ${fmt(d)} km from your file`, `${fmt(d)} km aus deiner Datei importiert`));
  } catch (err) { toast(L('This file could not be read. Try a GPX or TCX export.', 'Die Datei konnte nicht gelesen werden. Versuche einen GPX- oder TCX-Export.')); }
}

/* ---------- 2 running video ---------- */
SCREENS.video = {
  html() {
    const v = state.video;
    if (local.mode === 'record') return `${head(L('Record your run', 'Lauf aufnehmen'), L('Place the phone at hip height, sideways to your running path. Run past barefoot for 10 seconds.', 'Stell das Handy auf Hüfthöhe, seitlich zur Laufstrecke. Lauf 10 Sekunden barfuß vorbei.'))}
      <div class="camwrap" id="camwrap"><video id="live" playsinline muted autoplay></video>
        <svg class="guide" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true"><path d="M150 70 a18 18 0 1 0 0.1 0 M150 106 L150 210 M150 130 L118 175 M150 130 L184 168 M150 210 L124 290 L112 350 M150 210 L178 285 L196 342" fill="none" stroke="rgba(212,255,0,.5)" stroke-width="4" stroke-dasharray="8 8" stroke-linecap="round"/><line x1="10" y1="356" x2="290" y2="356" stroke="rgba(212,255,0,.6)" stroke-width="2"/><text x="150" y="380" fill="#d4ff00" font-size="12" text-anchor="middle" font-family="Inter,sans-serif">${L('ground line · full body in frame', 'Bodenlinie · ganzer Körper im Bild')}</text></svg>
        <div class="count" id="count" hidden></div><div class="rec" id="rec" hidden><i></i><span id="rect">0:10</span></div></div>
      <p class="small" id="camerr" hidden style="color:#ff8a70"></p>
      <div class="grow"></div>
      <button class="btn primary" data-act="recstart" id="recbtn">● ${L('Start recording (3-2-1)', 'Aufnahme starten (3-2-1)')}</button>
      <button class="btn secondary" data-act="vidcancel">${L('Cancel', 'Abbrechen')}</button>`;
    if (local.mode === 'analyzing') return `${head(L('Analysing your stride', 'Laufstil wird analysiert'), L('Detecting body landmarks frame by frame on your phone.', 'Körperpunkte werden Bild für Bild auf deinem Handy erkannt.'))}
      <div class="camwrap">${runtime.videoURL ? `<video src="${runtime.videoURL}" autoplay muted loop playsinline style="opacity:.55"></video>` : ''}<div class="count" style="font-size:40px" id="apct">0%</div></div>
      <div class="meter"><i id="abar"></i></div><p class="small num" id="astatus">${L('Loading pose model…', 'Lade Pose-Modell…')}</p>`;
    if (v.status === 'done') {
      const m = runMetrics();
      const card = (val, unit, label, expl) => `<div class="card metric"><span class="label">${label}</span><b>${val}<span class="small"> ${unit}</span></b><span>${expl}</span></div>`;
      return `${head(L('Your running analysis', 'Deine Laufanalyse'), L('Measured from your video. These values shape your midsole.', 'Aus deinem Video gemessen. Diese Werte formen deine Zwischensohle.'))}
        ${runtime.videoURL ? `<div class="camwrap"><video id="pb" src="${runtime.videoURL}" autoplay muted loop playsinline></video><canvas class="ov" id="skel"></canvas><span class="badge" style="position:absolute;top:12px;left:12px">${state.video.mode === 'pose' ? L('Pose tracking', 'Pose-Tracking') : L('Stride analysis', 'Schrittanalyse')}</span></div>` : `<div class="card small">${L('Video not stored after reload. Your analysis results are kept.', 'Video nach dem Neuladen nicht gespeichert. Deine Ergebnisse bleiben erhalten.')}</div>`}
        <div class="grid2">
          ${card(m.cadence, L('steps/min', 'Schritte/min'), L('Cadence', 'Schrittfrequenz'), m.cadence < 165 ? L('A bit low: longer ground contact.', 'Etwas niedrig: längerer Bodenkontakt.') : L('Efficient rhythm.', 'Effizienter Rhythmus.'))}
          ${card(strikeLabel(m.strike), '', L('Foot strike', 'Aufsatz'), L('Where your foot first touches the ground.', 'Wo dein Fuß zuerst aufsetzt.'))}
          ${card(m.knee + '°', '', L('Knee at landing', 'Knie bei Landung'), m.knee > 165 ? L('Fairly straight leg on landing.', 'Recht gestrecktes Bein bei der Landung.') : L('Good knee flexion absorbs impact.', 'Gute Kniebeugung fängt den Aufprall ab.'))}
          ${card(m.lean + '°', '', L('Trunk lean', 'Rumpfneigung'), L('Forward lean from the hips.', 'Vorneigung aus der Hüfte.'))}
        </div>
        ${card(fmt(m.osc) + ' %', L('of leg length', 'der Beinlänge'), L('Vertical oscillation', 'Vertikale Bewegung'), m.osc > 9 ? L('You bounce a little: energy goes up instead of forward.', 'Du federst etwas: Energie geht nach oben statt nach vorne.') : L('Low bounce, efficient forward motion.', 'Wenig Auf und Ab, effizient nach vorne.'))}
        <div class="grow"></div>
        <button class="btn primary" data-go="device">${L('Continue to foot scan', 'Weiter zum Fußscan')}</button>
        <button class="btn secondary" data-act="retake">${L('Record again', 'Neu aufnehmen')}</button>`;
    }
    return `${head(L('Running analysis', 'Laufanalyse'), L('A 10-second clip lets us read your foot strike, cadence and posture.', 'Ein 10-Sekunden-Clip zeigt uns Aufsatz, Schrittfrequenz und Haltung.'))}
      <div class="dropframe">
        <div class="hero-logo" style="width:70px;height:70px;border-radius:50%;background:none;border:2px solid var(--volt);color:var(--volt);font-size:26px">▶</div>
        <b style="font-size:17px">${L('10 s barefoot running video', '10 s Laufvideo, barfuß')}</b>
        <span class="small">${L('Side view · flat ground · full body in frame · good light', 'Seitenansicht · ebener Boden · ganzer Körper im Bild · gutes Licht')}</span>
      </div>
      <div class="grid3"><span class="chip" style="text-align:center">☀ ${L('Light', 'Licht')}</span><span class="chip" style="text-align:center">◎ ${L('Side', 'Seitlich')}</span><span class="chip" style="text-align:center">⌁ ${L('Full stride', 'Ganzer Schritt')}</span></div>
      <p class="small">${L('Tip: ask a friend to film you, or lean the phone against a wall.', 'Tipp: Lass dich von jemandem filmen oder lehn das Handy an eine Wand.')}</p>
      <div class="grow"></div>
      ${navigator.mediaDevices?.getUserMedia ? `<button class="btn primary" data-act="record">● ${L('Record in the app', 'In der App aufnehmen')}</button>` : ''}
      <label class="btn secondary" style="cursor:pointer">⇪ ${L('Upload from gallery', 'Aus Galerie hochladen')}<input type="file" accept="video/*" class="visually-hidden" id="vidfile"></label>
      <button class="btn ghost" data-act="skipvideo">${L('Skip: estimate from my profile', 'Überspringen: aus Profil schätzen')}</button>`;
  },
  async mount() {
    const f = document.getElementById('vidfile');
    if (f) f.addEventListener('change', e => { const file = e.target.files?.[0]; if (!file) return; setVideo(URL.createObjectURL(file)); logEvent('video', { how: 'upload' }); startAnalysis(); });
    if (local.mode === 'record') {
      try { const { openCamera } = await import('./video.js'); local.stream = await openCamera('environment'); const live = document.getElementById('live'); live.srcObject = local.stream; await live.play().catch(() => {}); }
      catch (e) { const el = document.getElementById('camerr'); el.hidden = false; el.textContent = L('Camera not available or permission denied. Use "Upload from gallery" instead.', 'Kamera nicht verfügbar oder Zugriff verweigert. Nutze stattdessen „Aus Galerie hochladen“.'); document.getElementById('recbtn').disabled = true; }
    }
    if (state.video.status === 'done' && runtime.poseFrames && document.getElementById('pb')) {
      const { drawSkeleton } = await import('./video.js');
      const v = document.getElementById('pb'), c = document.getElementById('skel'); const ctx = c.getContext('2d');
      const loop = () => { if (!document.body.contains(c)) return; const w = c.clientWidth, h = c.clientHeight; if (c.width !== w) { c.width = w; c.height = h; } if (v.videoWidth) drawSkeleton(ctx, runtime.poseFrames, v.currentTime, w, h, v.videoWidth, v.videoHeight); runtime.raf.push(requestAnimationFrame(loop)); };
      loop();
    }
  }
};
function setVideo(url) { if (runtime.videoURL) URL.revokeObjectURL(runtime.videoURL); runtime.videoURL = url; runtime.poseFrames = null; }
async function recordNow() {
  const btn = document.getElementById('recbtn'); btn.disabled = true;
  const count = document.getElementById('count'); count.hidden = false;
  for (const n of [3, 2, 1]) { count.textContent = n; beep(660, 120); vibrate(30); await sleep(900); }
  count.hidden = true; beep(1046, 160);
  const rec = document.getElementById('rec'), rect = document.getElementById('rect'); rec.hidden = false;
  try {
    const { recordClip } = await import('./video.js');
    const blob = await recordClip(local.stream, 10, t => { rect.textContent = '0:' + String(Math.ceil(10 - t)).padStart(2, '0'); });
    vibrate([40, 50, 40]); beep(1318, 120);
    stopStreams(); setVideo(URL.createObjectURL(blob)); logEvent('video', { how: 'record' }); startAnalysis();
  } catch (e) { toast(L('Recording is not supported in this browser. Please upload a video.', 'Aufnahme wird in diesem Browser nicht unterstützt. Bitte lade ein Video hoch.')); local.mode = null; render(); }
}
async function startAnalysis() {
  local.mode = 'analyzing'; render();
  const pctEl = () => document.getElementById('apct'), barEl = () => document.getElementById('abar'), st = () => document.getElementById('astatus');
  const show = (u, txt) => { if (pctEl()) pctEl().textContent = Math.round(u * 100) + '%'; if (barEl()) barEl().style.width = (u * 100) + '%'; if (txt && st()) st().textContent = txt; };
  let result = null;
  try {
    const { analyzeClip } = await import('./video.js');
    show(0.02, L('Loading pose model…', 'Lade Pose-Modell…'));
    result = await analyzeClip(runtime.videoURL, u => show(0.05 + u * 0.9, L('Detecting body landmarks…', 'Erkenne Körperpunkte…')));
  } catch (e) { result = null; }
  if (result) {
    runtime.poseFrames = result.frames;
    state.video = { status: 'done', mode: 'pose', metrics: result.metrics };
  } else {
    const steps = [L('Detecting body landmarks…', 'Erkenne Körperpunkte…'), L('Tracking ankles and knees…', 'Verfolge Knöchel und Knie…'), L('Measuring ground contact…', 'Messe Bodenkontakt…'), L('Calculating cadence…', 'Berechne Schrittfrequenz…')];
    for (let i = 0; i <= 40; i++) { show(i / 40, steps[Math.min(3, Math.floor(i / 10))]); await sleep(reducedMotion() ? 10 : 90); }
    state.video = { status: 'done', mode: 'simulated', metrics: simulatedRunMetrics() };
  }
  logEvent('video-analysis', { mode: state.video.mode });
  save(); local.mode = null; vibrate(30); render();
}

/* ---------- 3a device check ---------- */
SCREENS.device = {
  html() {
    const d = state.device;
    const row = (k, label, status, note) => `<div class="between card" style="padding:12px 14px"><div><b style="font-size:14px">${label}</b><div class="small">${note}</div></div><span class="badge ${status === true ? '' : status === false ? 'warn' : 'dim'}" id="chk-${k}">${status === true ? '✓ OK' : status === false ? L('Fallback', 'Alternative') : L('Not checked', 'Offen')}</span></div>`;
    return `${head(L('Is your phone ready?', 'Ist dein Handy bereit?'), L('We check what your phone supports. If something is missing, the scan still works with a fallback.', 'Wir prüfen, was dein Handy kann. Fehlt etwas, funktioniert der Scan trotzdem mit einer Alternative.'))}
      ${row('camera', L('Rear camera', 'Rückkamera'), d.camera, L('Needed for the live scan view', 'Für die Live-Scan-Ansicht'))}
      ${row('motion', L('Motion sensors', 'Bewegungssensoren'), d.motion, L('Tracks your phone moving around the foot', 'Erfasst die Bewegung um den Fuß'))}
      ${row('webgl', L('3D graphics', '3D-Grafik'), d.webgl, L('Builds your 3D foot model', 'Baut dein 3D-Fußmodell'))}
      <div class="card stack" style="gap:8px">
        <h3>${L('Get ready', 'Vorbereitung')}</h3>
        <svg viewBox="0 0 300 120" width="100%" aria-hidden="true"><rect x="20" y="20" width="110" height="80" fill="#ecebe6" rx="2" transform="skewX(-12) translate(18,0)"/><path d="M70 92 C64 70 66 50 72 36 C78 24 92 24 96 36 C100 52 98 76 92 92 Z" fill="#d6a98b"/><rect x="190" y="14" width="44" height="80" rx="9" fill="#202023" stroke="#d4ff00" stroke-width="2"/><path d="M188 54 C160 50 140 52 120 60" stroke="#d4ff00" stroke-dasharray="5 5" fill="none"/><text x="212" y="112" fill="#9a9aa1" font-size="11" text-anchor="middle" font-family="Inter,sans-serif">${L('knee height', 'Kniehöhe')}</text></svg>
        <ul class="bullets"><li><span class="dot">1</span><span>${L('Take off shoes and socks.', 'Schuhe und Socken ausziehen.')}</span></li><li><span class="dot">2</span><span>${L('Put an A4 sheet on the floor and stand on it.', 'Ein A4-Blatt auf den Boden legen und draufstellen.')}</span></li><li><span class="dot">3</span><span>${L('Hold the phone at knee height, good light, plain floor.', 'Handy auf Kniehöhe, gutes Licht, einfarbiger Boden.')}</span></li></ul>
      </div>
      <div class="grow"></div>
      <button class="btn secondary" data-act="runcheck">${L('Run check', 'Prüfung starten')}</button>
      <button class="btn primary" data-act="toscan">${L('Start foot scan', 'Fußscan starten')}</button>`;
  },
  mount() { if (state.device.webgl === null) runChecks(false); }
};
async function runChecks(withCamera = true) {
  const { webglOK } = await import('./foot3d.js');
  const d = state.device;
  d.webgl = webglOK();
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  d.lite = !d.webgl || (cores <= 4 && mem <= 3);
  if (withCamera) {
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); s.getTracks().forEach(t => t.stop()); d.camera = true; } catch (e) { d.camera = false; }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') d.motion = (await DeviceOrientationEvent.requestPermission()) === 'granted';
      else d.motion = await new Promise(res => { let got = false; const h = e => { if (e.alpha != null || e.beta != null) { got = true; } }; window.addEventListener('deviceorientation', h); setTimeout(() => { window.removeEventListener('deviceorientation', h); res(got); }, 800); });
    } catch (e) { d.motion = false; }
  }
  save(); logEvent('device-check', { camera: d.camera, motion: d.motion, webgl: d.webgl, lite: d.lite });
  if (state.screen === 'device') render();
}

/* ---------- 3b foot scan ---------- */
SCREENS.scan = {
  html() {
    const s = state.scan;
    if (s.done && local.view !== 'recon') return scanResultsHTML();
    if (local.view === 'recon') return `${head(L('Building your 3D feet', 'Deine 3D-Füße entstehen'), '', false)}
      <div class="viewer" id="viewer"><div class="status" id="vstatus" aria-live="polite">${L('Merging point clouds…', 'Punktwolken werden zusammengeführt…')}</div></div>
      <div class="meter"><i id="rbar"></i></div><p class="small num" id="rtxt"></p>`;
    const item = (k, label, done, optional) => `<div class="between card" style="padding:12px 14px"><div class="row"><span class="dot" style="${done ? 'background:var(--volt);color:#000' : ''}">${done ? '✓' : ''}</span><b style="font-size:14px">${label}</b></div><span class="small">${done ? L('Captured', 'Erfasst') : optional ? L('Optional', 'Optional') : ''}</span></div>`;
    const next = !s.right ? 'right' : !s.left ? 'left' : (!s.insole && !s.skippedInsole) ? 'insole' : null;
    return `${head(L('3D foot scan', '3D-Fußscan'), L('Stand barefoot on the A4 sheet. Move the phone slowly around your foot when prompted.', 'Stell dich barfuß auf das A4-Blatt. Beweg das Handy langsam um den Fuß, wenn du dazu aufgefordert wirst.'))}
      ${item('right', L('Right foot', 'Rechter Fuß'), s.right)}${item('left', L('Left foot', 'Linker Fuß'), s.left)}${item('insole', L('Insole of your current shoe', 'Einlegesohle deines aktuellen Schuhs'), s.insole, true)}
      ${next === 'insole' ? `<div class="card small">${L('Optional: scan the insole of your current running shoe. We compare it with your feet and show what it gets wrong.', 'Optional: Scanne die Einlegesohle deines aktuellen Laufschuhs. Wir vergleichen sie mit deinen Füßen und zeigen, was nicht passt.')}</div>` : ''}
      <div class="grow"></div>
      ${next ? `<button class="btn primary" data-act="scan" data-foot="${next}">◉ ${next === 'right' ? L('Scan right foot', 'Rechten Fuß scannen') : next === 'left' ? L('Scan left foot', 'Linken Fuß scannen') : L('Scan insole', 'Einlage scannen')}</button>` : `<button class="btn primary" data-act="reconstruct">${L('Build my 3D model', '3D-Modell erstellen')}</button>`}
      ${next === 'insole' ? `<button class="btn secondary" data-act="skipinsole">${L('Skip this step', 'Diesen Schritt überspringen')}</button>` : ''}`;
  },
  async mount() {
    if (local.view === 'recon') await runReconstruction();
    else if (state.scan.done) await mountScanViewer(false);
  }
};
function footSpecs() {
  const sc = scanValues();
  return [
    { side: 'left', len: sc.lenL, ballW: sc.ballWL, heelW: sc.heelWL, archMm: sc.archL, instep: sc.instepL, archType: sc.archType },
    { side: 'right', len: sc.lenR, ballW: sc.ballW, heelW: sc.heelW, archMm: sc.archR, instep: sc.instep, archType: sc.archType }
  ];
}
async function doScan(foot) {
  const steps = { right: '1 / 3', left: '2 / 3', insole: '3 / 3' };
  const res = await (await import('./scan.js')).runScan({ foot, step: steps[foot], lite: state.device.lite, source: state.facilitator.scanSource });
  logEvent('scan', { foot, ok: res.ok, camera: res.usedCamera });
  if (res.ok) { state.scan[foot] = true; save(); toast(L('Scan saved', 'Scan gespeichert')); }
  render();
}
async function runReconstruction() {
  const host = document.getElementById('viewer');
  const labels = [L('Reconstructing surface…', 'Rekonstruiere Oberfläche…'), L('Smoothing mesh…', 'Glätte Netz…'), L('Detecting landmarks…', 'Erkenne Messpunkte…')];
  const start = performance.now();
  const iv = setInterval(() => { const u = Math.min(1, (performance.now() - start) / 6800); const b = document.getElementById('rbar'), t = document.getElementById('rtxt'); if (b) b.style.width = (u * 100) + '%'; if (t) t.textContent = `${Math.round(u * 100)}% · ${Math.round(u * 1840 + 120).toLocaleString()} ${L('mesh vertices', 'Netzpunkte')}`; if (u >= 1) clearInterval(iv); }, 80);
  runtime.timers.push(iv);
  try {
    const { createViewer } = await import('./foot3d.js');
    viewer = await createViewer(host, footSpecs(), { lite: state.device.lite, labels });
    await viewer.reconstruct((txt) => { const s = document.getElementById('vstatus'); if (s) s.textContent = txt; }, reducedMotion() ? 1500 : 6500);
  } catch (e) { await sleep(2500); }
  state.scan.done = true; save(); logEvent('reconstruct', {}); vibrate([30, 40, 30]);
  if (viewer) { viewer.dispose(); viewer = null; }
  local.view = null; render();
}
function scanResultsHTML() {
  const sc = scanValues();
  const insoleNote = state.scan.insole ? (() => { const r = rng(seed('insole')); const mm = 3 + Math.floor(r() * 4); return `<div class="card hl stack" style="gap:6px"><span class="label">${L('Your current shoe', 'Dein aktueller Schuh')}</span><b>${L(`Its insole is ${mm} mm too short at the toes and gives ${sc.archType === 'High arch' ? 'almost no' : 'little'} arch support.`, `Die Einlage ist an den Zehen ${mm} mm zu kurz und stützt das Gewölbe ${sc.archType === 'High arch' ? 'fast gar nicht' : 'kaum'}.`)}</b></div>`; })() : '';
  return `${head(L('Your 3D foot scan', 'Dein 3D-Fußscan'), L('Drag to rotate, pinch to zoom.', 'Ziehen zum Drehen, mit zwei Fingern zoomen.'))}
    <div class="viewer" id="viewer">${state.device.webgl === false ? `<div class="status">${L('3D view not supported on this device.', '3D-Ansicht auf diesem Gerät nicht verfügbar.')}</div>` : ''}<div class="hint">${L('drag · pinch', 'ziehen · zoomen')}</div></div>
    <div class="seg" role="group" aria-label="${L('View mode', 'Ansicht')}"><button data-vm="mesh">${L('Mesh', 'Netz')}</button><button data-vm="solid" class="on">${L('Solid', 'Fläche')}</button><button data-vm="pressure">${L('Pressure', 'Druck')}</button></div>
    <div class="between"><span class="badge">${L('Scan quality', 'Scanqualität')} ${sc.quality}%</span><span class="small">${L('Calibrated with A4 sheet', 'Kalibriert mit A4-Blatt')}</span></div>
    <div class="card">${measureSVG(sc)}</div>
    <div class="card"><table class="mtable"><thead><tr><th></th><th>${L('Left', 'Links')}</th><th>${L('Right', 'Rechts')}</th></tr></thead><tbody>
      <tr><td>${L('Foot length', 'Fußlänge')}</td><td>${fmt(sc.lenL)} cm</td><td>${fmt(sc.lenR)} cm</td></tr>
      <tr><td>${L('Ball width', 'Ballenbreite')}</td><td>${fmt(sc.ballWL)} cm</td><td>${fmt(sc.ballW)} cm</td></tr>
      <tr><td>${L('Heel width', 'Fersenbreite')}</td><td>${fmt(sc.heelWL)} cm</td><td>${fmt(sc.heelW)} cm</td></tr>
      <tr><td>${L('Arch height', 'Gewölbehöhe')}</td><td>${sc.archL} mm</td><td>${sc.archR} mm</td></tr>
      <tr><td>${L('Instep height', 'Rist-Höhe')}</td><td>${fmt(sc.instepL)} cm</td><td>${fmt(sc.instep)} cm</td></tr></tbody></table></div>
    <div class="grid2"><div class="card"><span class="label">${L('Arch type', 'Gewölbetyp')}</span><div style="font-weight:800;margin-top:4px" class="volt">${archLabel(sc.archType)}</div></div><div class="card"><span class="label">Pronation</span><div style="font-weight:800;margin-top:4px">${pronLabel(sc.pronation)}</div></div></div>
    <div class="card"><span class="label">${L('Recommended size', 'Empfohlene Größe')}</span><div style="font-weight:800;margin-top:4px;font-size:17px">${sizeLabel(sc.eu)}</div><div class="small">${L(`Based on your longer foot (${fmt(Math.max(sc.lenR, sc.lenL))} cm) plus 1.5 cm toe room.`, `Basierend auf dem längeren Fuß (${fmt(Math.max(sc.lenR, sc.lenL))} cm) plus 1,5 cm Zehenraum.`)}</div></div>
    ${insoleNote}
    <button class="btn secondary" data-act="report">⇩ ${L('Download scan report', 'Scan-Bericht herunterladen')}</button>
    <button class="btn primary" data-go="analysis">${L('Continue to AI analysis', 'Weiter zur KI-Analyse')}</button>
    <button class="btn ghost" data-act="rescan">${L('Scan again', 'Neu scannen')}</button>`;
}
async function mountScanViewer() {
  const host = document.getElementById('viewer'); if (!host || state.device.webgl === false) return;
  try { const { createViewer } = await import('./foot3d.js'); viewer = await createViewer(host, footSpecs(), { lite: state.device.lite }); } catch (e) { /* no 3D */ }
  app.querySelectorAll('[data-vm]').forEach(b => b.addEventListener('click', () => { app.querySelectorAll('[data-vm]').forEach(x => x.classList.toggle('on', x === b)); viewer && viewer.setMode(b.dataset.vm); logEvent('viewmode', { m: b.dataset.vm }); }));
}
async function scanReport() {
  const sc = scanValues(), c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 900, 1200);
  x.fillStyle = '#d4ff00'; x.font = '900 46px Inter, sans-serif'; x.fillText('Nike Shoe Fit', 50, 90);
  x.fillStyle = '#fff'; x.font = '700 30px Inter, sans-serif'; x.fillText(L('Foot Scan Report', 'Fußscan-Bericht') + (state.nickname ? ' · ' + state.nickname : ''), 50, 140);
  x.fillStyle = '#9a9aa1'; x.font = '400 20px Inter, sans-serif'; x.fillText(new Date().toLocaleString(state.lang === 'de' ? 'de-AT' : 'en-GB') + ' · ' + L('Student prototype, simulated values', 'Studentischer Prototyp, simulierte Werte'), 50, 175);
  if (viewer) { const img = new Image(); img.src = viewer.snapshot(); await new Promise(r => { img.onload = r; img.onerror = r; }); try { x.drawImage(img, 50, 210, 800, 520); } catch (e) { /* ignore */ } }
  const rows = [[L('Foot length L / R', 'Fußlänge L / R'), `${fmt(sc.lenL)} / ${fmt(sc.lenR)} cm`], [L('Ball width L / R', 'Ballenbreite L / R'), `${fmt(sc.ballWL)} / ${fmt(sc.ballW)} cm`], [L('Heel width L / R', 'Fersenbreite L / R'), `${fmt(sc.heelWL)} / ${fmt(sc.heelW)} cm`], [L('Arch height L / R', 'Gewölbehöhe L / R'), `${sc.archL} / ${sc.archR} mm`], [L('Instep L / R', 'Rist L / R'), `${fmt(sc.instepL)} / ${fmt(sc.instep)} cm`], [L('Arch type', 'Gewölbetyp'), archLabel(sc.archType)], ['Pronation', pronLabel(sc.pronation)], [L('Recommended size', 'Empfohlene Größe'), sizeLabel(sc.eu)], [L('Scan quality', 'Scanqualität'), sc.quality + '%']];
  x.font = '600 24px Inter, sans-serif';
  rows.forEach(([k, v], i) => { const y = 780 + i * 44; x.fillStyle = '#9a9aa1'; x.fillText(k, 50, y); x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(v, 850, y); x.textAlign = 'left'; });
  download(c.toDataURL('image/png'), 'foot-scan-report.png'); logEvent('report', {});
}

/* ---------- 4a AI analysis ---------- */
SCREENS.analysis = {
  html() {
    if (!state.analysisSeen) {
      const lines = [L('Merging profile, running data and scan…', 'Profil, Laufdaten und Scan werden zusammengeführt…'), L('Matching 1.2M runner profiles…', 'Abgleich mit 1,2 Mio. Läuferprofilen…'), L('Simulating 10,000 foot strikes…', '10.000 Fußaufsätze werden simuliert…'), L('Mapping pressure zones…', 'Druckzonen werden kartiert…'), L('Optimising lattice density…', 'Gitterdichte wird optimiert…'), L('Validating fit…', 'Passform wird geprüft…')];
      return `${head(L('AI fit analysis', 'KI-Passformanalyse'), L('Your data is processed on your phone.', 'Deine Daten werden auf deinem Handy verarbeitet.'), false)}
        <div class="loader" id="loader">${lines.map((l, i) => `<div class="ln" data-i="${i}"><i></i><span>${l}</span></div>`).join('')}</div>
        <div class="meter"><i id="lbar"></i></div><div class="grow"></div><button class="btn ghost" data-act="skipload">${L('Skip animation', 'Animation überspringen')}</button>`;
    }
    const a = analysis(), sc = a.scan, rm = a.run;
    const zb = (k, label) => `<div class="zonebar"><span>${label}</span><div class="meter"><i style="width:${a.zones[k]}%"></i></div><b class="num">${a.zones[k]}</b></div>`;
    const sources = [[L('Profile', 'Profil'), true], [L('Running app', 'Lauf-App'), !!state.imported], [L('Running video', 'Laufvideo'), state.video.mode === 'pose' || state.video.mode === 'simulated'], [L('3D scan', '3D-Scan'), state.scan.done], [L('Comfort map', 'Komfortkarte'), state.profile.comfort.length > 0], [L('Insole scan', 'Einlagen-Scan'), state.scan.insole]];
    return `${head(L(`Your fit, ${nick()}`, `Deine Passform, ${nick()}`), L('Every value below comes from your own data. Tap a card to see why.', 'Jeder Wert unten stammt aus deinen Daten. Tippe auf eine Karte für die Begründung.'), false)}
      <div class="card hl stack" style="gap:8px"><div class="between"><span class="label">${L('Fit confidence', 'Passform-Sicherheit')}</span><b class="volt num" style="font-size:26px">${a.confidence}%</b></div><div class="meter"><i style="width:${a.confidence}%"></i></div>
        <div class="chips">${sources.map(([l, on]) => `<span class="chip ${on ? 'on' : ''}" style="font-size:12px;padding:5px 10px">${on ? '✓ ' : ''}${l}</span>`).join('')}</div></div>
      <div class="grid2"><div class="card"><span class="label">${L('Arch', 'Gewölbe')}</span><div style="font-weight:800">${archLabel(sc.archType)}</div></div><div class="card"><span class="label">${L('Foot strike', 'Aufsatz')}</span><div style="font-weight:800">${strikeLabel(rm.strike)}</div></div><div class="card"><span class="label">Pronation</span><div style="font-weight:800">${pronLabel(sc.pronation)}</div></div><div class="card"><span class="label">${L('Size', 'Größe')}</span><div style="font-weight:800">EU ${sc.eu}</div></div></div>
      <div class="card stack" style="gap:10px"><span class="label">${L('Cushioning per zone (0 soft · 100 firm)', 'Dämpfung je Zone (0 weich · 100 fest)')}</span>${zb('heel', L('Heel', 'Ferse'))}${zb('mid', L('Midfoot', 'Mittelfuß'))}${zb('fore', L('Forefoot', 'Vorfuß'))}${zb('toes', L('Toes', 'Zehen'))}
        <div class="divider"></div><div class="kv"><span>${L('Drop', 'Sprengung')}</span><b>${a.drop} mm</b></div><div class="kv"><span>${L('Outsole', 'Laufsohle')}</span><b>${a.outsole}</b></div></div>
      <h3>${L('Why we recommend this', 'Warum wir das empfehlen')}</h3>
      ${a.why.map((w, i) => `<details class="why" ${i === 0 ? 'open' : ''}><summary><b>${w.t}</b><span>${L('Why?', 'Warum?')}</span></summary><p>${w.d}</p></details>`).join('')}
      <h3>${L('Pressure: current shoe vs. custom shoe', 'Druck: aktueller vs. individueller Schuh')}</h3>
      <div class="card compare"><figure>${pressureFoot('before', sc.archType)}<figcaption>${state.profile.currentShoe ? esc(state.profile.currentShoe) : L('Current shoe', 'Aktueller Schuh')}<br><b style="color:#ff8a70">${L('pressure peaks', 'Druckspitzen')}</b></figcaption></figure><figure>${pressureFoot('after', sc.archType)}<figcaption>${L('Your custom shoe', 'Dein individueller Schuh')}<br><b class="volt">${L('even load', 'gleichmäßige Last')}</b></figcaption></figure></div>
      ${runtime.videoURL ? `<h3>${L('Your run, side by side', 'Dein Lauf im Vergleich')}</h3>
        <div class="split"><div><span class="badge warn lab">${L('Current shoe', 'Aktueller Schuh')}</span><video src="${runtime.videoURL}" autoplay muted loop playsinline></video><canvas data-ov="before"></canvas></div><div><span class="badge lab">${L('Custom shoe', 'Individuell')}</span><video src="${runtime.videoURL}" autoplay muted loop playsinline></video><canvas data-ov="after"></canvas></div></div>` : ''}
      <button class="btn primary" data-go="usecase">${L('Continue', 'Weiter')}</button>`;
  },
  async mount() {
    if (!state.analysisSeen) {
      const lines = app.querySelectorAll('.ln'); const total = reducedMotion() ? 600 : 7200; const t0 = performance.now();
      local.loadIv = setInterval(() => {
        const u = Math.min(1, (performance.now() - t0) / total); const k = Math.floor(u * lines.length);
        lines.forEach((l, i) => { l.classList.toggle('done', i < k); l.classList.toggle('on', i === k); });
        const b = document.getElementById('lbar'); if (b) b.style.width = (u * 100) + '%';
        if (u >= 1) { clearInterval(local.loadIv); finishLoad(); }
      }, 80);
      runtime.timers.push(local.loadIv);
      return;
    }
    app.querySelectorAll('.split canvas').forEach(c => {
      const kind = c.dataset.ov; const ctx = c.getContext('2d');
      const loop = t => { if (!document.body.contains(c)) return; const w = c.clientWidth, h = c.clientHeight; if (c.width !== w) { c.width = w; c.height = h; } ctx.clearRect(0, 0, w, h);
        const pulse = 0.5 + 0.5 * Math.sin(t / 300);
        const grd = ctx.createRadialGradient(w * 0.5, h * 0.9, 2, w * 0.5, h * 0.9, w * 0.35);
        if (kind === 'before') { grd.addColorStop(0, `rgba(255,59,31,${0.55 + 0.3 * pulse})`); grd.addColorStop(1, 'rgba(255,59,31,0)'); } else { grd.addColorStop(0, 'rgba(212,255,0,.45)'); grd.addColorStop(1, 'rgba(212,255,0,0)'); }
        ctx.fillStyle = grd; ctx.fillRect(0, h * 0.6, w, h * 0.4);
        ctx.fillStyle = kind === 'before' ? '#ff8a70' : '#d4ff00'; ctx.font = '700 11px Inter, sans-serif'; ctx.fillText(kind === 'before' ? L('impact peak', 'Aufprallspitze') : L('cushioned', 'gedämpft'), 8, h - 10);
        runtime.raf.push(requestAnimationFrame(loop)); };
      runtime.raf.push(requestAnimationFrame(loop));
    });
  }
};
function finishLoad() { if (state.analysisSeen) return; state.analysisSeen = true; save(); logEvent('analysis-shown', {}); vibrate(25); render(); }

/* ---------- 4b use case ---------- */
SCREENS.usecase = {
  html() {
    const sel = state.usecase; const a = analysis();
    const uc = USECASES.find(u => u.id === sel);
    const z = sel ? recommendedZones(uc.hard) : null;
    return `${head(L('What is this shoe for?', 'Wofür ist dieser Schuh?'), L('We tune one configuration per use case. Pick the one that matters most.', 'Wir stimmen je Einsatzzweck eine Konfiguration ab. Wähl den wichtigsten.'))}
      <div class="stack">${USECASES.map(u => `<button class="card between ${sel === u.id ? 'hl' : ''}" data-uc="${u.id}" style="text-align:left;color:inherit" aria-pressed="${sel === u.id}"><b>${state.lang === 'de' ? u.de : u.en}</b><span class="small">${{ soft: L('soft', 'weich'), medium: L('medium', 'mittel'), firm: L('firm', 'fest') }[u.hard]}</span></button>`).join('')}</div>
      ${uc ? `<div class="card hl stack" style="gap:6px"><span class="label">${L('Our recommendation', 'Unsere Empfehlung')}</span>
        <div class="kv"><span>${L('Hardness profile', 'Härteprofil')}</span><b>${{ soft: L('Soft', 'Weich'), medium: L('Medium', 'Mittel'), firm: L('Firm', 'Fest') }[uc.hard]}</b></div>
        <div class="kv"><span>${L('Heel / midfoot / forefoot', 'Ferse / Mittelfuß / Vorfuß')}</span><b class="num">${z.heel} / ${z.mid} / ${z.fore}</b></div>
        <div class="kv"><span>${L('Drop', 'Sprengung')}</span><b>${uc.id === 'race' ? Math.max(4, a.drop - 2) : a.drop} mm</b></div>
        <div class="kv"><span>${L('Outsole', 'Laufsohle')}</span><b>${uc.id === 'trail' ? L('Lugged rubber, 4 mm grip', 'Profilgummi, 4 mm Grip') : a.outsole}</b></div></div>` : ''}
      <div class="grow"></div>
      <button class="btn primary" data-act="todesign" ${uc ? '' : 'disabled'}>${L('Design my shoe', 'Meinen Schuh gestalten')}</button>`;
  }
};

/* ---------- 5a design ---------- */
SCREENS.design = {
  html() {
    const d = state.design; if (!d.zones) d.zones = recommendedZones(d.hardness);
    const a = analysis(); const c = colorObj(); const pr = price();
    const layerInfo = { Insole: L('Memory foam, 4 mm, shaped to your arch scan', 'Memory-Schaum, 4 mm, nach deinem Gewölbe-Scan geformt'), Cushioning: L(`3D-printed TPU lattice, heel ${d.zones.heel} / forefoot ${d.zones.fore}`, `3D-gedrucktes TPU-Gitter, Ferse ${d.zones.heel} / Vorfuß ${d.zones.fore}`), Midsole: L(`${a.drop} mm drop, ${a.scan.pronation === 'Overpronation' ? 'medial support' : 'neutral'} geometry`, `${a.drop} mm Sprengung, ${a.scan.pronation === 'Overpronation' ? 'mediale Stütze' : 'neutrale'} Geometrie`), Outsole: a.outsole };
    const layerName = k => ({ Insole: L('Insole', 'Einlegesohle'), Cushioning: L('Cushioning', 'Dämpfung'), Midsole: L('Midsole', 'Zwischensohle'), Outsole: L('Outsole', 'Laufsohle') }[k]);
    const sl = (k, label) => `<div class="slider"><span>${label}</span><input type="range" min="10" max="98" value="${d.zones[k]}" data-zone-sl="${k}" aria-label="${label}"><output id="z-${k}">${d.zones[k]}</output></div>`;
    return `${head(L('Design your shoe', 'Gestalte deinen Schuh'), L(`Pre-set by your analysis. Adjust anything, the comfort score updates live.`, 'Durch deine Analyse voreingestellt. Ändere, was du willst, der Komfortwert passt sich live an.'))}
      <div class="heroshoe" style="position:relative"><span class="badge dim">● ${L('Exploded view', 'Explosionsansicht')}</span>${shoePhoto(d.color)}
        <div class="layers">${Object.keys(layerInfo).map(k => `<button class="layer ${d.layer === k ? 'on' : ''}" data-layer="${k}"><span class="slab"></span><span><b>${layerName(k).toUpperCase()}</b><span>${layerInfo[k]}</span></span></button>`).join('')}</div></div>
      <div class="card hl between" style="position:sticky;top:64px;z-index:5"><div><span class="label">${L('Comfort score', 'Komfortwert')}</span><div class="score"><b id="cscore" style="font-size:38px">${comfortScore()}</b><span>/100</span></div></div><div style="text-align:right"><span class="label">${L('Price', 'Preis')}</span><div class="big num" id="price" style="font-size:30px;font-weight:900">€${pr.total}</div></div></div>
      <h3>${L('Hardness profile', 'Härteprofil')}</h3>
      <div class="seg">${['soft', 'medium', 'firm'].map(h => `<button data-hard="${h}" class="${d.hardness === h ? 'on' : ''}">${{ soft: L('Soft', 'Weich'), medium: L('Medium', 'Mittel'), firm: L('Firm', 'Fest') }[h]}</button>`).join('')}</div>
      <div class="card stack" style="gap:10px">
        <div class="grid2" style="align-items:center"><div id="sole" style="max-width:150px;margin:0 auto">${soleSVG(d.zones, d.engraving)}</div><div class="stack" style="gap:6px"><span class="label">${L('Printed hardness zones', 'Gedruckte Härtezonen')}</span>${hardnessLegend()}<span class="small">${L('Recommended by your analysis. Drag to fine-tune.', 'Von deiner Analyse empfohlen. Zum Feintunen ziehen.')}</span></div></div>
        ${sl('heel', L('Heel', 'Ferse'))}${sl('mid', L('Midfoot', 'Mittelfuß'))}${sl('fore', L('Forefoot', 'Vorfuß'))}${sl('toes', L('Toes', 'Zehen'))}
        <span class="label">${L('3D-printed lattice (live)', '3D-gedrucktes Gitter (live)')}</span><canvas class="lattice" id="lattice"></canvas>
      </div>
      <h3>${L('Upper', 'Obermaterial')}</h3>
      <div class="grid2">${['Knit', 'Mesh'].map(t => `<button class="card tex ${d.texture === t ? 'on' : ''}" data-tex="${t}" style="color:inherit"><span><b>${t}</b><span>${t === 'Knit' ? L('Sock-like, flexible', 'Sockenartig, flexibel') : L('Breathable, light', 'Atmungsaktiv, leicht')}</span></span></button>`).join('')}</div>
      <div class="between"><span class="label">${L('Color', 'Farbe')}</span><span class="small">${state.lang === 'de' ? c.de : c.en}</span></div>
      <div class="swatches">${COLORS.map(k => `<button class="sw ${d.color === k.id ? 'on' : ''}" data-color="${k.id}" aria-label="${state.lang === 'de' ? k.de : k.en}" aria-pressed="${d.color === k.id}"><i style="background:conic-gradient(${k.accent} 0 50%, #111 0 100%)"></i></button>`).join('')}</div>
      <span class="label">${L('Lacing', 'Schnürung')}</span>
      <div class="seg">${[['standard', L('Classic', 'Klassisch')], ['speed', L('Speed +€12', 'Schnell +12 €')], ['elastic', L('Elastic +€8', 'Elastisch +8 €')]].map(([v, l]) => `<button data-lace="${v}" class="${d.lacing === v ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="card stack" style="gap:8px"><span class="label">${L('Engraving on the sole (+€15)', 'Gravur auf der Sohle (+15 €)')}</span>
        <input class="text" id="engr" maxlength="8" value="${esc(d.engraving)}" placeholder="${L('up to 8 characters', 'bis zu 8 Zeichen')}" autocapitalize="characters">
        <div class="solewrap"><div class="sole3d" id="sole3d">${soleSVG(d.zones, d.engraving)}</div></div></div>
      <button class="btn secondary" data-go="ar">◎ ${L('Try it on (AR)', 'Anprobieren (AR)')}</button>
      <button class="btn primary" data-go="checkout">${L('Continue to checkout', 'Weiter zur Kasse')}</button>`;
  },
  mount() {
    const cv = document.getElementById('lattice'); drawLattice(cv, state.design.zones);
    app.querySelectorAll('[data-zone-sl]').forEach(sl => sl.addEventListener('input', () => {
      state.design.zones[sl.dataset.zoneSl] = +sl.value; state.design.touched = true; save();
      document.getElementById('z-' + sl.dataset.zoneSl).textContent = sl.value; refreshDesignLive();
    }));
    const en = document.getElementById('engr');
    en.addEventListener('input', () => { en.value = en.value.toUpperCase().replace(/[^A-Z0-9 ÄÖÜ]/g, '').slice(0, 8); state.design.engraving = en.value.trim(); save(); refreshDesignLive(); });
  }
};
function refreshDesignLive() {
  const d = state.design;
  const s = document.getElementById('sole'); if (s) s.innerHTML = soleSVG(d.zones, d.engraving);
  const s3 = document.getElementById('sole3d'); if (s3) s3.innerHTML = soleSVG(d.zones, d.engraving);
  const cv = document.getElementById('lattice'); if (cv) drawLattice(cv, d.zones);
  const cs = document.getElementById('cscore'); if (cs) cs.textContent = comfortScore();
  const p = document.getElementById('price'); if (p) p.textContent = '€' + price().total;
}

/* ---------- 5b AR ---------- */
SCREENS.ar = {
  html() {
    const a = state.ar || (state.ar = { x: 0, y: 0, s: 1, r: -8 });
    return `${head(L('Try it on', 'Anprobieren'), L('Point the camera at your foot. Drag the shoe onto it, pinch to resize, twist to rotate.', 'Richte die Kamera auf deinen Fuß. Zieh den Schuh darauf, mit zwei Fingern Größe und Drehung ändern.'))}
      <div class="arstage" id="arstage">
        ${runtime.arPhoto ? `<img class="photo" src="${runtime.arPhoto}" alt="${L('Your photo', 'Dein Foto')}">` : `<video id="arvid" playsinline muted autoplay></video><canvas class="bg" id="arbg"></canvas>`}
        <span class="badge tl">AR</span>
        <div class="arshoe" id="arshoe" style="transform:translate(calc(-50% + ${a.x}px), calc(-50% + ${a.y}px)) rotate(${a.r}deg) scale(${a.s})"><img id="arimg" src="shoe-ar.png" alt="${L('Your custom shoe', 'Dein individueller Schuh')}" draggable="false" style="filter:${colorObj().filter};transform:scaleX(${a.f || 1})"></div>
      </div>
      <p class="small" id="arerr" hidden></p>
      <div class="slider"><span>${L('Size', 'Größe')}</span><input type="range" id="ars" min="0.4" max="2" step="0.01" value="${a.s}" aria-label="${L('Shoe size on screen', 'Schuhgröße am Bildschirm')}"><output></output></div>
      <div class="slider"><span>${L('Rotate', 'Drehen')}</span><input type="range" id="arr" min="-180" max="180" step="1" value="${a.r}" aria-label="${L('Rotation', 'Drehung')}"><output></output></div>
      <div class="grid3"><button class="btn secondary small" style="width:100%" data-act="arflip">⇋ ${L('Mirror', 'Spiegeln')}</button><button class="btn secondary small" style="width:100%" data-act="arsnap">◉ ${L('Snapshot', 'Foto')}</button><label class="btn secondary small" style="cursor:pointer;width:100%">⇪ ${L('Photo', 'Bild')}<input type="file" accept="image/*" class="visually-hidden" id="arfile"></label></div>
      <button class="btn primary" data-act="back">${L('Back to design', 'Zurück zum Design')}</button>`;
  },
  async mount() {
    const stage = document.getElementById('arstage'), shoe = document.getElementById('arshoe'), a = state.ar;
    const apply = () => { shoe.style.transform = `translate(calc(-50% + ${a.x}px), calc(-50% + ${a.y}px)) rotate(${a.r}deg) scale(${a.s})`; };
    const pts = new Map(); let g0 = null;
    stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); g0 = snapshotGesture(); });
    stage.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = snapshotGesture(); if (!g || !g0) return;
      if (g.n === 1 && g0.n === 1) { a.x = g0.ax + (g.cx - g0.cx); a.y = g0.ay + (g.cy - g0.cy); }
      if (g.n === 2 && g0.n === 2) { a.s = clamp(g0.as * g.d / g0.d, 0.4, 2); a.r = g0.ar + (g.ang - g0.ang) * 180 / Math.PI; }
      apply();
    });
    const up = e => { pts.delete(e.pointerId); g0 = snapshotGesture(); save(); };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    function snapshotGesture() { const v = [...pts.values()]; if (!v.length) return null; const cx = v.reduce((s, p) => s + p.x, 0) / v.length, cy = v.reduce((s, p) => s + p.y, 0) / v.length; const d = v.length > 1 ? Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) : 1; const ang = v.length > 1 ? Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x) : 0; return { n: v.length, cx, cy, d, ang, ax: a.x, ay: a.y, as: a.s, ar: a.r }; }
    document.getElementById('ars').addEventListener('input', e => { a.s = +e.target.value; apply(); save(); });
    document.getElementById('arr').addEventListener('input', e => { a.r = +e.target.value; apply(); save(); });
    document.getElementById('arfile').addEventListener('change', e => { const f = e.target.files?.[0]; if (!f) return; runtime.arPhoto = URL.createObjectURL(f); stopStreams(); render(); });
    if (!runtime.arPhoto) {
      const bg = document.getElementById('arbg'); const ctx = bg.getContext('2d'); bg.width = 300; bg.height = 400;
      const gr = ctx.createLinearGradient(0, 0, 0, 400); gr.addColorStop(0, '#3a3836'); gr.addColorStop(1, '#1a1918'); ctx.fillStyle = gr; ctx.fillRect(0, 0, 300, 400);
      ctx.fillStyle = '#d6a98b'; ctx.beginPath(); ctx.moveTo(120, 0); ctx.lineTo(178, 0); ctx.lineTo(172, 230); ctx.bezierCurveTo(176, 300, 250, 320, 262, 350); ctx.bezierCurveTo(270, 372, 130, 375, 104, 350); ctx.bezierCurveTo(94, 320, 112, 260, 114, 230); ctx.closePath(); ctx.fill();
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        runtime.streams.push(s); const v = document.getElementById('arvid'); v.srcObject = s; await v.play().catch(() => {}); bg.style.display = 'none';
        logEvent('ar', { camera: true });
      } catch (e) { const er = document.getElementById('arerr'); er.hidden = false; er.textContent = L('Camera not available: showing a sample view. Use "Use a photo" to try it on your own foot.', 'Kamera nicht verfügbar: Beispielansicht. Mit „Foto nutzen“ kannst du deinen eigenen Fuß verwenden.'); logEvent('ar', { camera: false }); }
    }
  }
};
async function arSnapshot() {
  const stage = document.getElementById('arstage'); const r = stage.getBoundingClientRect();
  const c = document.createElement('canvas'); c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2); const x = c.getContext('2d'); x.scale(2, 2);
  const src = runtime.arPhoto ? stage.querySelector('img.photo') : (document.getElementById('arvid')?.videoWidth ? document.getElementById('arvid') : document.getElementById('arbg'));
  if (src) { const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height; const s = Math.max(r.width / sw, r.height / sh); x.drawImage(src, (r.width - sw * s) / 2, (r.height - sh * s) / 2, sw * s, sh * s); }
  const img = document.getElementById('arimg');
  if (!img.complete) await new Promise(res => { img.onload = res; img.onerror = res; });
  const a = state.ar; const w = r.width * 0.72, h = w * (img.naturalHeight || 453) / (img.naturalWidth || 651);
  x.save(); x.translate(r.width / 2 + a.x, r.height * 0.58 + a.y); x.rotate(a.r * Math.PI / 180); x.scale(a.s * (a.f || 1), a.s);
  const f = colorObj().filter; if (f !== 'none' && 'filter' in x) x.filter = f;
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 24; x.shadowOffsetY = 14;
  x.drawImage(img, -w / 2, -h / 2, w, h); x.restore();
  x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, r.height - 26, r.width, 26); x.fillStyle = '#d4ff00'; x.font = '700 12px Inter, sans-serif'; x.fillText('Nike Shoe Fit · ' + L('student prototype', 'Studentenprototyp'), 10, r.height - 9);
  const blob = await new Promise(res => c.toBlob(res, 'image/png'));
  const file = new File([blob], 'my-custom-shoe.png', { type: 'image/png' });
  logEvent('ar-snapshot', {});
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Nike Shoe Fit' }); return; } catch (e) { /* cancelled */ } }
  download(blob, 'my-custom-shoe.png');
}

/* ---------- 6a checkout ---------- */
SCREENS.checkout = {
  html() {
    const a = analysis(), sc = a.scan, d = state.design, pr = price(), c = colorObj();
    const ship = addBusinessDays(7);
    return `${head(L('Checkout', 'Kasse'), L('Review your custom order.', 'Prüfe deine individuelle Bestellung.'))}
      <div class="card stack" style="gap:6px">
        <div class="row"><div style="width:84px;flex:none">${shoePhoto(d.color, 'height:62px;object-fit:cover')}</div><div><b>Custom Runner${state.nickname ? ` · ${esc(state.nickname)}` : ''}</b><div class="small">${state.lang === 'de' ? c.de : c.en} · ${d.texture}</div></div><span class="badge dim" style="margin-left:auto">1 ${L('pair', 'Paar')}</span></div>
        <div class="divider"></div>
        <div class="kv"><span>${L('Size', 'Größe')}</span><b>${sizeLabel(sc.eu)}</b></div>
        <div class="kv"><span>${L('Fit profile', 'Passprofil')}</span><b>${archLabel(sc.archType)} · ${strikeLabel(a.run.strike)}</b></div>
        <div class="kv"><span>${L('Hardness zones', 'Härtezonen')}</span><b class="num">${d.zones.heel} / ${d.zones.mid} / ${d.zones.fore} / ${d.zones.toes}</b></div>
        <div class="kv"><span>${L('Use case', 'Einsatz')}</span><b>${(() => { const u = USECASES.find(x => x.id === state.usecase); return u ? (state.lang === 'de' ? u.de : u.en) : '–'; })()}</b></div>
        ${d.engraving ? `<div class="kv"><span>${L('Engraving', 'Gravur')}</span><b>${esc(d.engraving)}</b></div>` : ''}
      </div>
      <div class="card hl"><div class="between"><span class="label">${L('Comfort score', 'Komfortwert')}</span>${comfortScore() >= 90 ? `<span class="badge">${L('Excellent', 'Exzellent')}</span>` : ''}</div><div class="score"><b>${comfortScore()}</b><span>/100</span></div></div>
      <div class="card stack" style="gap:2px">${pr.items.map(([n, v]) => `<div class="kv"><span>${n}</span><b>€${v}</b></div>`).join('')}<div class="kv"><span>${L('Shipping', 'Versand')}</span><b>${L('Free', 'Kostenlos')}</b></div><div class="divider"></div><div class="price"><span class="label">${L('Total', 'Gesamt')}</span><span class="big">€${pr.total}</span></div></div>
      <div class="card trust">
        <div><span class="dot">✓</span><span><b>${L('Fit guarantee:', 'Passformgarantie:')}</b> ${L('free remake within 90 days', 'kostenlose Neuanfertigung innerhalb von 90 Tagen')}</span></div>
        <div><span class="dot">✓</span><span><b>${L('One free adjustment', 'Eine kostenlose Anpassung')}</b> ${L('after your first runs', 'nach deinen ersten Läufen')}</span></div>
        <div><span class="dot">✓</span><span><b>${L('Take-back & recycling', 'Rücknahme & Recycling')}</b> ${L('of your old shoes', 'deiner alten Schuhe')}</span></div>
        <div><span class="dot">✓</span><span><b>${L('Delivery:', 'Lieferung:')}</b> ${fmtDate(ship)} ${L('(5 days printing + 2 days shipping)', '(5 Tage Druck + 2 Tage Versand)')}</span></div>
        <div><span class="dot">?</span><span><b>${L('Support:', 'Support:')}</b> support@shoefit.demo <span class="badge dim">demo</span></span></div>
      </div>
      <h3>${L('Shipping', 'Versand')}</h3>
      <div class="grid2"><input class="text" id="shipname" placeholder="${L('Name', 'Name')}" autocomplete="off" value="${esc(state.shipping.name || state.nickname)}"><input class="text" id="shipcity" placeholder="${L('City', 'Stadt')}" autocomplete="off" value="${esc(state.shipping.city || 'Innsbruck')}"></div>
      <p class="small">${L('Demo checkout: no address, card or payment details are needed, and no money is charged.', 'Demo-Kasse: Keine Adresse, Karte oder Zahlungsdaten nötig, es wird nichts abgebucht.')}</p>
      <button class="btn primary" data-act="pay">${L('Demo payment · place order', 'Demo-Zahlung · bestellen')}</button>`;
  },
  mount() { ['shipname', 'shipcity'].forEach(id => document.getElementById(id).addEventListener('input', e => { state.shipping[id === 'shipname' ? 'name' : 'city'] = e.target.value.slice(0, 40); save(); })); }
};
async function pay() {
  const bg = openSheet(`<div class="spinner"></div><h2 style="text-align:center">${L('Processing demo payment…', 'Demo-Zahlung wird verarbeitet…')}</h2><p class="small" style="text-align:center">${L('No money is charged.', 'Es wird nichts abgebucht.')}</p>`);
  await sleep(2000);
  state.order = { id: 'NSF-' + Math.floor(100000 + Math.random() * 899999), at: Date.now(), total: price().total };
  save(); logEvent('order', { total: state.order.total }); bg.remove(); vibrate([20, 40, 20]); go('review');
}

/* ---------- 6b expert + AI review ---------- */
SCREENS.review = {
  html() {
    const a = analysis(), sc = a.scan;
    const slides = [
      { vis: `<div style="width:62%">${pressureFoot('before', sc.archType)}</div>`, cap: L(`We found a ${archLabel(sc.archType).toLowerCase()} (${sc.archR} mm) and a ${fmt(Math.abs(sc.lenR - sc.lenL))} cm length difference between your feet.`, `Wir haben ein ${archLabel(sc.archType).toLowerCase()} (${sc.archR} mm) und ${fmt(Math.abs(sc.lenR - sc.lenL))} cm Längenunterschied zwischen deinen Füßen gefunden.`), sub: L('Step 1 · Your feet', 'Schritt 1 · Deine Füße') },
      { vis: `<div style="font-size:64px;font-weight:900" class="volt num">${a.run.cadence}</div><div class="small">${L('steps per minute', 'Schritte pro Minute')}</div>`, cap: L(`You run with a ${strikeLabel(a.run.strike).toLowerCase()} at ${a.run.cadence} steps per minute.`, `Du läufst mit ${strikeLabel(a.run.strike)} bei ${a.run.cadence} Schritten pro Minute.`), sub: L('Step 2 · Your stride', 'Schritt 2 · Dein Laufstil') },
      { vis: `<div style="width:42%">${soleSVG(state.design.zones, state.design.engraving)}</div>`, cap: L(`Planned midsole: heel ${state.design.zones.heel}, midfoot ${state.design.zones.mid}, forefoot ${state.design.zones.fore} on our firmness scale, ${a.drop} mm drop.`, `Geplante Zwischensohle: Ferse ${state.design.zones.heel}, Mittelfuß ${state.design.zones.mid}, Vorfuß ${state.design.zones.fore} auf unserer Härteskala, ${a.drop} mm Sprengung.`), sub: L('Step 3 · Your design', 'Schritt 3 · Dein Design') },
      { vis: `<div class="stack" style="width:100%">${a.why.slice(0, 2).map(w => `<div class="card" style="font-size:13px"><b>${w.t}</b></div>`).join('')}</div>`, cap: a.why[0]?.d || '', sub: L('Step 4 · Why', 'Schritt 4 · Warum') },
      { vis: `<div class="score"><b style="font-size:80px">${comfortScore()}</b><span>/100</span></div>`, cap: L(`Expected comfort score ${comfortScore()}/100 in size EU ${sc.eu}. Ready to print.`, `Erwarteter Komfortwert ${comfortScore()}/100 in Größe EU ${sc.eu}. Bereit zum Druck.`), sub: L('Step 5 · Result', 'Schritt 5 · Ergebnis') }
    ];
    local.slides = slides.length;
    return `${head(L('Your fit review', 'Deine Passform-Prüfung'), L('Your scan was checked by our AI and a running-gait expert. Here is what we found and what we will print.', 'Dein Scan wurde von unserer KI und einer Laufanalyse-Expertin geprüft. Das haben wir gefunden und so drucken wir.'), false)}
      <div class="row"><div class="hero-logo" style="width:40px;height:40px;border-radius:50%;font-size:13px">MK</div><div><b style="font-size:14px">${L('Reviewed by M. Keller, gait specialist', 'Geprüft von M. Keller, Laufanalyse')}</b><div class="small">${L('+ AI fit engine · today', '+ KI-Passform · heute')}</div></div></div>
      <div class="slides" id="slides" aria-live="polite"><div class="sbars">${slides.map(() => '<span><i></i></span>').join('')}</div>
        ${slides.map((s, i) => `<div class="slide ${i === 0 ? 'on' : ''}" data-s="${i}"><div class="vis">${s.vis}</div><div class="cap">${s.cap}<small>${s.sub}</small></div></div>`).join('')}</div>
      <div class="grid2"><button class="btn secondary small" data-act="slideprev">‹ ${L('Back', 'Zurück')}</button><button class="btn secondary small" data-act="slidenext">${L('Next', 'Weiter')} ›</button></div>
      <div id="chat" class="chat" ${local.chat ? '' : 'hidden'}></div>
      <div id="qbtns" class="stack" ${local.chat ? '' : 'hidden'}></div>
      <div class="grow"></div>
      <button class="btn primary" data-act="approve">▶ ${L('Go: start production', 'Los: Produktion starten')}</button>
      <button class="btn secondary" data-act="question">${L('I have a question', 'Ich habe eine Frage')}</button>`;
  },
  mount() {
    local.slide = 0; local.slideT0 = performance.now();
    const step = () => {
      if (!document.getElementById('slides')) return;
      const el = performance.now() - local.slideT0, dur = 6000;
      const bars = app.querySelectorAll('.sbars i');
      bars.forEach((b, i) => { b.style.width = i < local.slide ? '100%' : i === local.slide ? Math.min(100, el / dur * 100) + '%' : '0%'; });
      if (el > dur && local.slide < local.slides - 1) showSlide(local.slide + 1);
      runtime.raf.push(requestAnimationFrame(step));
    };
    runtime.raf.push(requestAnimationFrame(step));
  }
};
function showSlide(i) { local.slide = clamp(i, 0, local.slides - 1); local.slideT0 = performance.now(); app.querySelectorAll('.slide').forEach(s => s.classList.toggle('on', +s.dataset.s === local.slide)); }
const QA = () => [
  [L('Will the shoe really fit both feet?', 'Passt der Schuh wirklich an beide Füße?'), L('Yes. Each side is printed from its own scan, so your longer foot sets the size and the shorter one gets a slightly thicker insole.', 'Ja. Jede Seite wird nach ihrem eigenen Scan gedruckt. Der längere Fuß bestimmt die Größe, der kürzere bekommt eine etwas dickere Einlage.')],
  [L('What if it does not feel right?', 'Was, wenn er sich nicht gut anfühlt?'), L('Run in it for two weeks. One adjustment is free, and within 90 days we remake the shoe at no cost.', 'Lauf zwei Wochen darin. Eine Anpassung ist kostenlos, und innerhalb von 90 Tagen fertigen wir den Schuh kostenlos neu.')],
  [L('How long does printing take?', 'Wie lange dauert der Druck?'), L('About 5 business days: the TPU lattice midsole is printed in 4 hardness zones, then assembled and checked.', 'Etwa 5 Werktage: Die TPU-Gitter-Zwischensohle wird in 4 Härtezonen gedruckt, dann montiert und geprüft.')]
];
function openChat() {
  local.chat = true; const chat = document.getElementById('chat'), q = document.getElementById('qbtns'); chat.hidden = false; q.hidden = false;
  if (!chat.children.length) chat.innerHTML = `<div class="msg them">${L(`Hi ${nick()}! I reviewed your scan. What would you like to know?`, `Hallo ${nick()}! Ich habe deinen Scan geprüft. Was möchtest du wissen?`)}</div>`;
  q.innerHTML = QA().map(([qq], i) => `<button class="btn secondary small" style="width:100%" data-qa="${i}">${qq}</button>`).join('');
  logEvent('question-open', {});
  chat.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function askQA(i) {
  const [qq, aa] = QA()[i]; const chat = document.getElementById('chat');
  chat.insertAdjacentHTML('beforeend', `<div class="msg me">${qq}</div><div class="msg them" id="typing">…</div>`);
  state.review.questions.push(i); save(); logEvent('question', { i });
  await sleep(1100); const t = document.getElementById('typing'); if (t) { t.id = ''; t.textContent = aa; }
}

/* ---------- 6c confirmation + tracker ---------- */
const TRACK = () => [
  { at: 0, t: L('Scan & order received', 'Scan & Bestellung erhalten'), d: L('Fit data locked in', 'Passformdaten übernommen') },
  { at: 4, t: L('Lattice generated', 'Gitter erzeugt'), d: L('184,000 cells in 4 hardness zones', '184.000 Zellen in 4 Härtezonen') },
  { at: 9, t: L('3D printing', '3D-Druck'), d: L('3D-printed TPU lattice midsole, printed in our micro-factory', '3D-gedruckte TPU-Gitter-Zwischensohle, gedruckt in unserer Mikrofabrik') },
  { at: 40, t: L('Quality check', 'Qualitätsprüfung'), d: L('Hardness and fit measured against your scan', 'Härte und Passform gegen deinen Scan geprüft') },
  { at: 48, t: L('Shipped', 'Versendet'), d: '' }
];
SCREENS.confirm = {
  html() {
    const o = state.order || { id: 'NSF-000000' };
    const ship = addBusinessDays(7, new Date(o.at || Date.now()));
    return `<div class="hero-logo" style="width:84px;height:84px;border-radius:50%;margin:8px auto 0;font-size:36px;box-shadow:0 0 40px rgba(212,255,0,.4)">✓</div>
      <h1 style="text-align:center">${L('Production started', 'Produktion gestartet')}</h1>
      <p class="sub" style="text-align:center;margin:0 auto">${L(`Order ${o.id}. Your shoe is being printed for ${possessive()} feet.`, `Bestellung ${o.id}. Dein Schuh wird für ${possessive()} Füße gedruckt.`)}</p>
      <div class="card"><div class="between" style="margin-bottom:10px"><span class="label">${L('Live production (time-lapse)', 'Live-Produktion (Zeitraffer)')}</span><span class="badge" id="printpct">0%</span></div><div class="tracker" id="tracker"></div></div>
      <div class="email"><div class="from">${L('Preview of your confirmation email (not sent)', 'Vorschau deiner Bestätigungs-E-Mail (nicht gesendet)')}</div><h4>${L(`Your custom shoe is on its way, ${state.nickname ? esc(state.nickname) : 'runner'}!`, `Dein individueller Schuh ist unterwegs, ${state.nickname ? esc(state.nickname) : 'Läufer:in'}!`)}</h4>
        <div>${L(`Order ${o.id} · ${sizeLabel(scanValues().eu)} · €${o.total || price().total}`, `Bestellung ${o.id} · ${sizeLabel(scanValues().eu)} · ${o.total || price().total} €`)}</div><div>${L('Expected delivery:', 'Voraussichtliche Lieferung:')} <b>${fmtDate(ship)}</b></div></div>
      <div class="grow"></div>
      <button class="btn primary" data-go="survey">${L('Give feedback (5 min)', 'Feedback geben (5 Min.)')}</button>`;
  },
  mount() {
    if (!state.tracker.start) { state.tracker.start = Date.now(); save(); }
    const tick = () => {
      const el = (Date.now() - state.tracker.start) / 1000; const steps = TRACK(); const host = document.getElementById('tracker'); if (!host) return;
      const printing = clamp((el - 9) / 31, 0, 1);
      host.innerHTML = steps.map((s, i) => { const next = steps[i + 1]; const done = next ? el >= next.at : el >= s.at; const now = !done && el >= s.at; return `<div class="tstep ${done ? 'done' : now ? 'now' : ''}"><i>${done ? '✓' : ''}</i><div><b>${s.t}${i === 2 && now ? ` · ${Math.round(printing * 100)}%` : ''}</b><span>${s.d}</span>${i === 2 && now ? `<div class="meter" style="margin-top:6px"><i style="width:${printing * 100}%"></i></div>` : ''}</div></div>`; }).join('');
      const pct = document.getElementById('printpct'); if (pct) pct.textContent = Math.round(clamp(el / 48, 0, 1) * 100) + '%';
    };
    tick(); const iv = setInterval(tick, 500); runtime.timers.push(iv);
  }
};

/* ---------- survey ---------- */
const SUS = () => [
  L('I would like to use an app like this regularly.', 'Ich würde so eine App gerne regelmäßig nutzen.'),
  L('The app felt more complicated than it needed to be.', 'Die App wirkte komplizierter als nötig.'),
  L('The app was easy to use.', 'Die App war einfach zu bedienen.'),
  L('I would need help from someone to use this app.', 'Ich bräuchte Hilfe, um diese App zu nutzen.'),
  L('The different parts of the app fit together well.', 'Die einzelnen Teile der App passen gut zusammen.'),
  L('Some parts of the app felt inconsistent.', 'Manche Teile der App wirkten uneinheitlich.'),
  L('Most people would learn this app quickly.', 'Die meisten Menschen würden diese App schnell lernen.'),
  L('The app was awkward to use.', 'Die App war umständlich zu bedienen.'),
  L('I felt confident while using the app.', 'Ich habe mich bei der Nutzung sicher gefühlt.'),
  L('I had to learn a lot before I could use the app.', 'Ich musste viel lernen, bevor ich die App nutzen konnte.')
];
const STEP_OPTIONS = () => [['profile', L('Profile & data import', 'Profil & Datenimport')], ['video', L('Running video', 'Laufvideo')], ['scan', L('Foot scan', 'Fußscan')], ['analysis', L('AI analysis', 'KI-Analyse')], ['design', L('Design', 'Design')], ['ar', L('AR try-on', 'AR-Anprobe')], ['review', L('Expert review', 'Experten-Prüfung')], ['checkout', L('Checkout', 'Kasse')]];
SCREENS.survey = {
  html() {
    const s = state.survey;
    const lik = (k, lo, hi) => `<div class="likert" role="group">${[1, 2, 3, 4, 5].map(n => `<button data-sv="${k}" data-v="${n}" class="${s[k] === n ? 'on' : ''}" aria-pressed="${s[k] === n}">${n}</button>`).join('')}</div><div class="ends"><span>${lo}</span><span>${hi}</span></div>`;
    const opts = STEP_OPTIONS().map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    return `${head(L('Your feedback', 'Dein Feedback'), L('Anonymous, about 5 minutes. This helps our design sprint.', 'Anonym, etwa 5 Minuten. Das hilft unserem Design Sprint.'), false)}
      <div class="q"><p>${L('How much do you trust that this shoe would fit you?', 'Wie sehr vertraust du darauf, dass dieser Schuh dir passt?')}</p>${lik('trust', L('not at all', 'gar nicht'), L('completely', 'völlig'))}</div>
      <div class="q"><p>${L('Did the foot scan feel real?', 'Wirkte der Fußscan echt?')}</p>${lik('scan_real', L('not at all', 'gar nicht'), L('very real', 'sehr echt'))}</div>
      <div class="q"><p>${L('Would you share your running data with such an app?', 'Würdest du deine Laufdaten mit so einer App teilen?')}</p><div class="seg">${[['yes', L('Yes', 'Ja')], ['depends', L('Depends', 'Kommt drauf an')], ['no', L('No', 'Nein')]].map(([v, l]) => `<button data-sv="share_data" data-v="${v}" class="${s.share_data === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="q"><p>${L('How much would you pay for this custom shoe?', 'Wie viel würdest du für diesen Schuh zahlen?')}</p><div class="slider" style="grid-template-columns:1fr 70px"><input type="range" min="0" max="400" step="10" id="wtp" value="${s.wtp_eur ?? 150}"><output id="wtpo" class="num">€${s.wtp_eur ?? 150}</output></div></div>
      <div class="q"><p>${L('Which step was most convincing?', 'Welcher Schritt hat dich am meisten überzeugt?')}</p><select class="text" id="conv"><option value="">–</option>${opts}</select></div>
      <div class="q"><p>${L('Which step was most confusing?', 'Welcher Schritt war am verwirrendsten?')}</p><select class="text" id="conf"><option value="">–</option>${opts}</select></div>
      <div class="q"><p>${L('Anything else? (optional)', 'Sonst noch etwas? (optional)')}</p><textarea class="text" id="comment" maxlength="800"></textarea></div>
      <h3 style="margin-top:8px">${L('Usability (10 statements)', 'Bedienbarkeit (10 Aussagen)')}</h3>
      ${SUS().map((q, i) => `<div class="q"><p>${i + 1}. ${q}</p>${lik('sus_' + (i + 1), L('strongly disagree', 'stimme gar nicht zu'), L('strongly agree', 'stimme voll zu'))}</div>`).join('')}
      <p class="small" id="serr" style="color:#ff8a70" hidden>${L('Please answer the rating questions marked 1–5.', 'Bitte beantworte die Bewertungsfragen 1–5.')}</p>
      <button class="btn primary" data-act="submit">${L('Send feedback', 'Feedback senden')}</button>`;
  },
  mount() {
    const s = state.survey;
    const w = document.getElementById('wtp'); w.addEventListener('input', () => { s.wtp_eur = +w.value; document.getElementById('wtpo').textContent = '€' + w.value; save(); });
    const conv = document.getElementById('conv'), conf = document.getElementById('conf'), com = document.getElementById('comment');
    conv.value = s.most_convincing || ''; conf.value = s.most_confusing || ''; com.value = s.comment || '';
    conv.addEventListener('change', () => { s.most_convincing = conv.value; save(); }); conf.addEventListener('change', () => { s.most_confusing = conf.value; save(); }); com.addEventListener('input', () => { s.comment = com.value; save(); });
  }
};
async function submitSurvey() {
  const s = state.survey;
  const need = ['trust', 'scan_real', ...Array.from({ length: 10 }, (_, i) => 'sus_' + (i + 1))];
  if (need.some(k => !s[k])) { document.getElementById('serr').hidden = false; document.getElementById('serr').scrollIntoView({ block: 'center' }); return; }
  let sus = 0; for (let i = 1; i <= 10; i++) sus += i % 2 ? s['sus_' + i] - 1 : 5 - s['sus_' + i];
  sus = sus * 2.5;
  const log = state.log.map(e => ({ t: e.t - (state.log[0]?.t || 0), type: e.type, ...(e.from ? { from: e.from, to: e.to, ms: e.ms } : {}), ...(e.what ? { what: e.what } : {}), ...(e.mode ? { mode: e.mode } : {}) }));
  const body = new URLSearchParams({ 'form-name': 'survey', lang: state.lang, trust: s.trust, scan_real: s.scan_real, share_data: s.share_data || '', wtp_eur: s.wtp_eur ?? 150, most_convincing: s.most_convincing || '', most_confusing: s.most_confusing || '', comment: s.comment || '', sus_score: sus, usecase: state.usecase || '', video_mode: state.video.mode || 'none', scan_source: state.facilitator.scanSource, event_log: JSON.stringify(log).slice(0, 9000) });
  for (let i = 1; i <= 10; i++) body.set('sus_' + i, s['sus_' + i]);
  let ok = false;
  try { const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }); ok = r.ok; } catch (e) { ok = false; }
  s.submitted = true; s.sent = ok; s.sus = sus; save(); logEvent('survey', { ok });
  go('thanks');
}

/* ---------- thanks + debrief ---------- */
SCREENS.thanks = {
  html() {
    const s = state.survey;
    return `<div class="hero-logo" style="margin:8px auto 0">♥</div>
      <h1 style="text-align:center">${L(`Thank you${state.nickname ? ', ' + esc(state.nickname) : ''}!`, `Danke${state.nickname ? ', ' + esc(state.nickname) : ''}!`)}</h1>
      <p class="sub" style="text-align:center;margin:0 auto">${s.sent ? L('Your anonymous feedback was sent.', 'Dein anonymes Feedback wurde gesendet.') : L('Your feedback is saved on this device. (The online form is only active on the Netlify site.)', 'Dein Feedback ist auf diesem Gerät gespeichert. (Das Online-Formular ist nur auf der Netlify-Seite aktiv.)')}</p>
      <div class="card stack">
        <h2>${L('Full transparency', 'Volle Transparenz')}</h2>
        <p class="small" style="color:#dcdce0;margin:0">${L('This was a student prototype for a design sprint at MCI Innsbruck. To test the idea, some parts were simulated:', 'Das war ein studentischer Prototyp für einen Design Sprint am MCI Innsbruck. Um die Idee zu testen, wurden manche Teile simuliert:')}</p>
        <ul class="bullets">
          <li><span class="dot">1</span><span>${L('The foot scan did not measure your feet. The 3D model and values were generated from your profile.', 'Der Fußscan hat deine Füße nicht vermessen. 3D-Modell und Werte wurden aus deinem Profil erzeugt.')}</span></li>
          <li><span class="dot">2</span><span>${state.video.mode === 'pose' ? L('The running video was really analysed on your phone with pose detection.', 'Das Laufvideo wurde wirklich auf deinem Handy per Pose-Erkennung analysiert.') : L('The running analysis was estimated from your profile.', 'Die Laufanalyse wurde aus deinem Profil geschätzt.')}</span></li>
          <li><span class="dot">3</span><span>${L('The running-app connection, the expert review and the production tracker were simulated. No order was placed and no money was charged.', 'Lauf-App-Verbindung, Experten-Prüfung und Produktions-Tracker waren simuliert. Es wurde nichts bestellt und nichts abgebucht.')}</span></li>
        </ul>
        <p class="small" style="margin:0">${L('Not affiliated with or endorsed by Nike or Strava.', 'Keine Verbindung zu Nike oder Strava.')}</p>
      </div>
      <div class="grow"></div>
      <button class="btn secondary" data-act="deleteall">${L('Delete my data from this device', 'Meine Daten von diesem Gerät löschen')}</button>
      <button class="btn ghost" data-act="restartall">${L('Start over', 'Neu starten')}</button>`;
  }
};

/* ===================== global events ===================== */
document.addEventListener('click', async e => {
  const t = e.target.closest('button, [data-go]');
  if (!t || overlayRoot.contains(t) && !t.closest('.sheet-bg') ) { /* noop */ }
  if (!t) return;
  if (t.closest('.scanfs')) return;
  if (t.closest('.sheet-bg')) return;
  if (t.dataset.go) { if (t.dataset.go === 'checkout' && !state.design.zones) state.design.zones = recommendedZones(state.design.hardness); go(t.dataset.go); return; }
  if (t.dataset.seg) {
    const k = t.dataset.seg, v = t.dataset.v; const p = state.profile;
    if (k === 'sizeSys') p.sizeSys = v; else if (k === 'width') p.width = v; else if (k === 'goal') p.goal = v; else if (k === 'drop') p.drop = v;
    save(); const y = window.scrollY; render(); window.scrollTo(0, y); return;
  }
  if (t.dataset.uc) { state.usecase = t.dataset.uc; save(); logEvent('usecase', { uc: t.dataset.uc }); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (t.dataset.layer) { state.design.layer = t.dataset.layer; save(); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (t.dataset.hard) { state.design.hardness = t.dataset.hard; state.design.zones = recommendedZones(t.dataset.hard); save(); logEvent('hardness', { h: t.dataset.hard }); const y = window.scrollY; render(); window.scrollTo(0, y); toast(L('Zones reset to the recommendation for this profile', 'Zonen auf die Empfehlung für dieses Profil gesetzt')); return; }
  if (t.dataset.tex) { state.design.texture = t.dataset.tex; save(); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (t.dataset.color) { state.design.color = t.dataset.color; save(); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (t.dataset.lace) { state.design.lacing = t.dataset.lace; save(); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (t.dataset.sv) { const v = isNaN(+t.dataset.v) ? t.dataset.v : +t.dataset.v; state.survey[t.dataset.sv] = v; save(); t.parentElement.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-pressed', b === t); }); return; }
  if (t.dataset.qa) { askQA(+t.dataset.qa); return; }
  const act = t.dataset.act; if (!act) return;
  switch (act) {
    case 'logo': logoTap(); break;
    case 'lang': state.lang = state.lang === 'de' ? 'en' : 'de'; save(); render(); break;
    case 'menu': openMenu(); break;
    case 'back': back(); break;
    case 'start': state.consent = true; save(); logEvent('consent', {}); go('profile'); break;
    case 'connect': startImport(t.dataset.src); break;
    case 'disconnect': state.imported = null; save(); render(); break;
    case 'saveprofile': {
      const p = state.profile, err = document.getElementById('perr'); const msgs = [];
      if (!(p.weight >= 30 && p.weight <= 200)) msgs.push(L('weight (30–200 kg)', 'Gewicht (30–200 kg)'));
      if (!(p.height >= 120 && p.height <= 220)) msgs.push(L('height (120–220 cm)', 'Größe (120–220 cm)'));
      if (!(p.shoeEU >= 33 && p.shoeEU <= 52)) msgs.push(L('shoe size', 'Schuhgröße'));
      if (!validPace(p.pace)) msgs.push(L('pace as min:sec, e.g. 5:45', 'Tempo als min:sek, z. B. 5:45'));
      if (msgs.length) { err.hidden = false; err.textContent = L('Please check: ', 'Bitte prüfen: ') + msgs.join(', '); err.scrollIntoView({ block: 'center' }); return; }
      go('video'); break;
    }
    case 'record': local.mode = 'record'; render(); break;
    case 'recstart': recordNow(); break;
    case 'vidcancel': stopStreams(); local.mode = null; render(); break;
    case 'skipvideo': logEvent('skip', { what: 'video' }); state.video = { status: 'done', mode: 'simulated', metrics: simulatedRunMetrics() }; save(); go('device'); break;
    case 'retake': logEvent('retake', { what: 'video' }); state.video = { status: 'none', mode: null, metrics: null }; setVideo(null); save(); render(); break;
    case 'runcheck': t.disabled = true; t.textContent = L('Checking…', 'Prüfe…'); await runChecks(true); break;
    case 'toscan': if (state.device.webgl === null) await runChecks(false); go('scan'); break;
    case 'scan': doScan(t.dataset.foot); break;
    case 'skipinsole': state.scan.skippedInsole = true; save(); logEvent('skip', { what: 'insole' }); render(); break;
    case 'reconstruct': local.view = 'recon'; render(); break;
    case 'rescan': logEvent('retake', { what: 'scan' }); state.scan = { right: false, left: false, insole: false, done: false, skippedInsole: false }; state.analysisSeen = false; save(); render(); break;
    case 'report': scanReport(); break;
    case 'skipload': clearInterval(local.loadIv); logEvent('skip', { what: 'analysis-animation' }); finishLoad(); break;
    case 'todesign': { const uc = USECASES.find(u => u.id === state.usecase); state.design.hardness = uc.hard; state.design.zones = recommendedZones(uc.hard); save(); go('design'); break; }
    case 'arsnap': arSnapshot(); break;
    case 'arflip': { state.ar.f = (state.ar.f || 1) * -1; save(); const im = document.getElementById('arimg'); if (im) im.style.transform = `scaleX(${state.ar.f})`; logEvent('ar-flip', {}); break; }
    case 'pay': pay(); break;
    case 'slidenext': showSlide(local.slide + 1); break;
    case 'slideprev': showSlide(local.slide - 1); break;
    case 'question': openChat(); break;
    case 'approve': state.review.approved = true; state.tracker.start = 0; save(); logEvent('approve', {}); vibrate([30, 50, 30]); go('confirm'); break;
    case 'submit': submitSurvey(); break;
    case 'deleteall': if (t.dataset.confirm) { cleanup(); resetAll(); render(); toast(L('Your data was deleted', 'Deine Daten wurden gelöscht')); } else { t.dataset.confirm = 1; t.textContent = L('Tap again to delete', 'Nochmals tippen zum Löschen'); } break;
    case 'restartall': cleanup(); { const lang = state.lang; resetAll(); state.lang = lang; save(); } render(); break;
  }
});

// generic two-way binding for simple inputs
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.bind) return;
  bindValue(el.dataset.bind, el.value, el.dataset.type);
  if (el.dataset.bind === 'profile.cushion') { const o = el.parentElement.querySelector('output'); if (o) o.textContent = +el.value < 35 ? L('soft', 'weich') : +el.value > 65 ? L('firm', 'fest') : L('balanced', 'mittel'); }
  updateStrength();
});
document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.bind && el.tagName === 'SELECT') { bindValue(el.dataset.bind, el.value); } });

/* ===================== boot ===================== */
if (!state.consent) state.screen = 'consent';
if (!SCREENS[state.screen]) state.screen = state.consent ? 'profile' : 'consent';
if (state.screen === 'video' && state.video.status !== 'done') state.video.status = 'none';
state.stepEnter = Date.now();
render();
if (state.consent && state.screen !== 'profile' && state.screen !== 'consent') toast(L('Welcome back – you can continue where you left off', 'Willkommen zurück – du kannst dort weitermachen, wo du warst'));
