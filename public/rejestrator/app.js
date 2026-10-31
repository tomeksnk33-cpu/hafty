// Rejestrator czasu pracy: część wspólnej aplikacji (hafty, pralnia, rejestrator). Dane są w tej samej
// bazie PostgreSQL, wspólne dla wszystkich urządzeń; każde urządzenie co kilka sekund sprawdza, czy coś
// się zmieniło. Urządzenie jest zalogowane kontem z dostępem do rejestratora (ciasteczko sesji).
import {
  TYPES, typeLabel, stateFromLast, ALLOWED, AUTO_NEXT, EARLY_LEAVE_PCT, localDay, addDays, dayOf, byTs,
  fmtTime, fmtHM, fmtDur, fmtNum, fmtPct, esc, isApproved, entryPct, normFor as normForIn, normVerdict, missingText,
  computeDay as computeDayIn, buildReport as buildReportIn,
} from './core.js';

const MATCH_THRESHOLD = 0.5;      // max. odległość deskryptorów, żeby uznać twarz za znaną
const STABLE_FRAMES = 4;          // tyle kolejnych klatek musi wskazać tę samą osobę
const AUTO_COOLDOWN_MS = 60_000;  // minimalny odstęp między automatycznymi rejestracjami tej samej osoby
const SAMPLES_TARGET = 5;
const REC_INTERVAL_MS = 60_000;   // ta sama osoba trafia do historii rozpoznań najwyżej raz na minutę
const POLL_MS = 8_000;            // co tyle sprawdzamy, czy inne urządzenia coś zmieniły
const WINDOW_DAYS = 7;            // dziennik i historia rozpoznań na stronie: ostatnie 7 dni

const $ = id => document.getElementById(id);
const video = $('video'), overlay = $('overlay');

// --- dane (kopie z serwera)
let people = [], tasks = [], last = {}, settings = null, mail = null, adminSet = false;
const days = {};                  // dzień -> { log, work, rec }
let ver = {}, dayVer = {};
const all = kind => Object.values(days).flatMap(d => d[kind] ?? []).sort(byTs);
const data = () => ({ people, log: all('log'), work: all('work') });
const normFor = (personId, day) => normForIn(all('work'), personId, day);
const computeDay = (day, until) => computeDayIn(day, data(), until);

let matcher = null;
let samples = [];
let current = null, streakId = null, streak = 0;
const lastAuto = {}, lastRec = {}, busy = new Set();
let opts = null;

// --- połączenie z serwerem
// `token` mówi tylko, czy sesja jest ważna; samo logowanie trzyma ciasteczko przeglądarki
let token = true;
let adminToken = null, unlockedUntil = 0;
const UNLOCK_MS = 5 * 60_000;

class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
async function api(path, body, { admin = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (admin && adminToken) headers['X-Admin-Token'] = adminToken;
  let res;
  try {
    res = await fetch('/api/rejestrator/' + path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Brak połączenia z internetem. Spróbuj ponownie.');
  }
  // bez ważnej sesji bramka logowania odsyła na stronę logowania
  if (res.status === 401 || (res.redirected && new URL(res.url).pathname === '/login')) { goToLogin(); throw new ApiError(401, 'Sesja wygasła. Zaloguj się ponownie.'); }
  const out = await res.json().catch(() => ({ ok: false, error: `błąd serwera (${res.status})` }));
  if (out.adminToken) { adminToken = out.adminToken; unlockedUntil = Date.now() + UNLOCK_MS; }
  if (!out.ok) throw new ApiError(res.status, out.error);
  return out;
}

// czynność kierownika: pyta o hasło, jeśli tryb kierownika jest wyłączony albo wygasł
async function adminAction(op, args, reason) {
  if (!(await requireAdmin(reason))) return null;
  try {
    return await api('action', { op, ...args }, { admin: true });
  } catch (e) {
    if (e.status !== 403) throw e;
    adminToken = null; unlockedUntil = 0; renderAdminBar();
    if (!(await requireAdmin(e.message))) return null;
    return api('action', { op, ...args }, { admin: true });
  }
}
const deviceAction = (op, args) => api('action', { op, ...args });

const windowDays = () => { const t = localDay(); return Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(t, -i)); };
const trackedDays = () => [...new Set([...windowDays(), $('reportDate').value].filter(Boolean))];

let syncing = null, lastSyncOk = 0;
function sync() { return syncing ??= doSync().finally(() => { syncing = null; }); }
async function doSync() {
  try {
    const want = trackedDays();
    for (const d of Object.keys(days)) if (!want.includes(d)) { delete days[d]; delete dayVer[d]; }
    const v = await api('state?versions=1&days=' + want.join(','));
    const what = ['people', 'tasks', 'settings', 'last'].filter(k => !(k in ver) || String(v.ver[k] ?? 0) !== String(ver[k]));
    const changedDays = want.filter(d => !(d in dayVer) || v.dayVer[d] !== dayVer[d]);
    if (what.length || changedDays.length) {
      const out = await api(`state?get=${what.join(',')}&days=${changedDays.join(',')}`);
      if (out.people) { people = out.people.sort((a, b) => a.name.localeCompare(b.name, 'pl')); rebuildMatcher(); }
      if (out.tasks) tasks = out.tasks.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
      if (out.last) last = Object.fromEntries(out.last.map(e => [e.personId, e]));
      if (out.settings) { settings = out.settings; mail = out.mail; adminSet = out.adminSet; renderMail(); }
      Object.assign(days, out.days);
      for (const k of what) ver[k] = String(v.ver[k] ?? 0);
      for (const d of changedDays) dayVer[d] = v.dayVer[d];
      for (const r of all('rec')) lastRec[r.personId] = Math.max(lastRec[r.personId] || 0, r.ts);
      renderAll();
    }
    lastSyncOk = Date.now();
  } catch (e) {
    $('syncInfo').innerHTML = `<span class="err">${esc(e.message)}</span>`;
    return;
  }
  renderSync();
}
function renderSync() {
  $('syncInfo').textContent = lastSyncOk ? `Dane zsynchronizowane ${new Date(lastSyncOk).toLocaleTimeString('pl-PL')}` : '';
}
function renderAll() {
  renderPeople(); renderLog(); renderRecLog(); renderSummary();
  if (!$('tab-tasks').classList.contains('hidden')) renderTasks();
  if ($('workDlg').open) renderWork();
  buttonsKey = '';
}
setInterval(() => { if (!document.hidden && token) sync(); }, POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden && token) sync(); });

function rebuildMatcher() {
  if (!window.faceapi) return;
  const labeled = people.filter(p => p.descriptors.length)
    .map(p => new faceapi.LabeledFaceDescriptors(p.id, p.descriptors.map(d => new Float32Array(d))));
  matcher = labeled.length ? new faceapi.FaceMatcher(labeled, MATCH_THRESHOLD) : null;
}

const personById = id => people.find(p => p.id === id);
const lastEntry = id => last[id] ?? null;
const stateOf = id => stateFromLast(lastEntry(id));

// --- zakładki
const ADMIN_TABS = ['people', 'tasks'];   // zakładki tylko dla kierownika
document.querySelectorAll('nav button').forEach(b => b.onclick = async () => {
  if (ADMIN_TABS.includes(b.dataset.tab) && !(await requireAdmin('Zakładka „' + b.textContent + '” jest dostępna tylko dla kierownika.'))) return;
  showTab(b.dataset.tab);
});
function showTab(tab) {
  const b = document.querySelector(`nav button[data-tab="${tab}"]`);
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('active', x === b));
  ['clock', 'people', 'tasks', 'report'].forEach(t => $('tab-' + t).classList.toggle('hidden', t !== tab));
  // tabele prac i raportu potrzebują całej szerokości, więc kamera chowa się na ten czas
  $('mainGrid').classList.toggle('wide', ['tasks', 'report'].includes(tab));
  if (tab === 'report') renderSummary();
  if (tab === 'tasks') renderTasks();
}

// --- okno hasła (hasło dostępu do aplikacji i hasło kierownika)
// submit(hasło) zwraca obietnicę; błąd jest pokazywany w okienku, a okno zostaje otwarte
function askPassword({ title, text, confirm = false, cancel = true, submit }) {
  return new Promise(resolve => {
    const dlg = $('passDlg');
    $('passTitle').textContent = title;
    $('passText').textContent = text;
    $('pass2Row').classList.toggle('hidden', !confirm);
    $('passCancel').classList.toggle('hidden', !cancel);
    $('passInput').value = ''; $('passInput2').value = ''; $('passErr').textContent = '';
    const done = ok => { dlg.close(); $('passForm').onsubmit = $('passCancel').onclick = dlg.oncancel = null; resolve(ok); };
    $('passCancel').onclick = () => done(false);
    dlg.oncancel = e => { e.preventDefault(); if (cancel) done(false); };
    $('passForm').onsubmit = async e => {
      e.preventDefault();
      const pw = $('passInput').value;
      if (confirm) {
        if (pw.length < 4) { $('passErr').textContent = 'Hasło musi mieć co najmniej 4 znaki.'; return; }
        if (pw !== $('passInput2').value) { $('passErr').textContent = 'Hasła się różnią.'; return; }
      }
      $('passOk').disabled = true;
      try { await submit(pw); done(true); }
      catch (err) { $('passErr').textContent = err.message; $('passInput').select(); }
      finally { $('passOk').disabled = false; }
    };
    if (!dlg.open) dlg.showModal();
    $('passInput').focus();
  });
}

// sesja wygasła (albo konto wyłączono): na stronę logowania, która potem wróci tutaj
function goToLogin() {
  if (!token) return;
  token = false;
  location.href = '/login?powrot=/rejestrator';
}

// --- hasło kierownika: chroni pracowników, prace i normy oraz zatwierdzanie wykonanej pracy
const isUnlocked = () => !!adminToken && Date.now() < unlockedUntil;
async function requireAdmin(reason = 'Ta czynność wymaga hasła kierownika.') {
  if (isUnlocked()) return true;
  const ok = !adminSet
    ? await askPassword({
        title: 'Ustaw hasło kierownika', confirm: true,
        text: 'Hasło nie jest jeszcze ustawione. Wymyśl hasło, którego będzie używał kierownik (co najmniej 4 znaki). Będzie działać na wszystkich urządzeniach.',
        submit: async pw => { await api('admin', { action: 'setup', password: pw }); adminSet = true; },
      })
    : await askPassword({ title: 'Hasło kierownika', text: reason, submit: pw => api('admin', { action: 'login', password: pw }) });
  renderAdminBar();
  return ok;
}
function lockAdmin() {
  adminToken = null; unlockedUntil = 0;
  renderAdminBar();
  if (ADMIN_TABS.some(t => !$('tab-' + t).classList.contains('hidden'))) showTab('clock');
}
let adminShown = null;
function renderAdminBar() {
  const on = isUnlocked();
  if (on === adminShown) return;
  adminShown = on;
  $('adminBar').innerHTML = on
    ? '<span class="admin-on">Tryb kierownika</span><button id="lockBtn">Zablokuj</button><button id="changePassBtn">Zmień hasło</button>'
    : '<button id="unlockBtn">Kierownik</button>';
  $('lockBtn')?.addEventListener('click', lockAdmin);
  $('unlockBtn')?.addEventListener('click', () => requireAdmin('Podaj hasło, aby przejść w tryb kierownika.'));
  $('changePassBtn')?.addEventListener('click', async () => {
    const ok = await askPassword({
      title: 'Zmień hasło kierownika', confirm: true, text: 'Nowe hasło będzie obowiązywać na wszystkich urządzeniach.',
      submit: async pw => {
        try { await api('admin', { action: 'change', password: pw }, { admin: true }); }
        catch (e) { if (e.status === 403) lockAdmin(); throw e; }
      },
    });
    if (ok) alert('Hasło zostało zmienione.');
  });
  if ($('workDlg').open) renderWork();
}
setInterval(() => { if (adminShown && !isUnlocked()) lockAdmin(); }, 5000);

// --- kamera i pętla rozpoznawania
async function startCamera() {
  try {
    // WebGL jest najszybszy; bez niego (np. stary komputer) liczymy na procesorze
    if (!(await faceapi.tf.setBackend('webgl').catch(() => false))) await faceapi.tf.setBackend('cpu');
    await faceapi.tf.ready();
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri('/rejestrator/model'),
      faceapi.nets.faceLandmark68Net.loadFromUri('/rejestrator/model'),
      faceapi.nets.faceRecognitionNet.loadFromUri('/rejestrator/model'),
    ]);
    opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  } catch (e) {
    $('camStatus').innerHTML = '<span class="err">Nie udało się wczytać modeli rozpoznawania twarzy. Odśwież stronę.</span>';
    return;
  }
  rebuildMatcher();
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    await video.play();
    $('camStatus').textContent = 'Kamera aktywna';
    loop();
  } catch (e) {
    $('camStatus').innerHTML = `<span class="err">Brak dostępu do kamery: ${esc(e.message)}</span>`;
  }
}

async function detect() {
  if (!opts || video.readyState < 2) return [];
  return faceapi.detectAllFaces(video, opts).withFaceLandmarks().withFaceDescriptors();
}

async function loop() {
  try {
    if (video.readyState >= 2) {
      const dims = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(overlay, dims);
      const results = faceapi.resizeResults(await detect(), dims);
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      let best = null;
      for (const r of results) {
        const m = matcher ? matcher.findBestMatch(r.descriptor) : null;
        const known = m && m.label !== 'unknown';
        const name = known ? personById(m.label)?.name : 'Nieznana osoba';
        const b = r.detection.box;
        ctx.lineWidth = 3;
        ctx.strokeStyle = known ? '#22c55e' : '#f59e0b';
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        // podpis rysowany w lustrzanym odbiciu, bo canvas jest odwrócony przez CSS
        ctx.save(); ctx.scale(-1, 1);
        ctx.font = '18px system-ui'; ctx.fillStyle = ctx.strokeStyle;
        ctx.fillText(`${name}${known ? ` (${(1 - m.distance).toFixed(2)})` : ''}`, -(b.x + b.width), b.y - 6);
        ctx.restore();
        if (known && (!best || m.distance < best.distance)) best = { id: m.label, distance: m.distance };
      }
      onRecognized(best?.id ?? null, results.length, best?.distance);
    }
  } catch (e) { console.error(e); }
  setTimeout(loop, 150);
}

function onRecognized(id, faceCount, distance) {
  if (id === streakId) streak++; else { streakId = id; streak = 1; }
  const stable = streak >= STABLE_FRAMES ? id : null;
  if (streak >= STABLE_FRAMES || !id) current = stable;

  const p = current && personById(current);
  if (p && Date.now() - (lastRec[p.id] || 0) >= REC_INTERVAL_MS) recordRecognition(p, distance);
  $('who').textContent = p ? p.name : (faceCount ? 'Nieznana osoba' : '—');
  if (p) {
    const state = stateOf(p.id), le = lastEntry(p.id);
    $('whoState').textContent = le ? `Ostatnio: ${typeLabel(le.type)} ${fmtTime(le.ts)}` : 'Brak wcześniejszych wpisów';
    renderPunchButtons(p.id, state);
    if ($('autoPunch').checked && !busy.has(p.id) && Date.now() - (lastAuto[p.id] || 0) > AUTO_COOLDOWN_MS) {
      lastAuto[p.id] = Date.now();
      punch(p.id, AUTO_NEXT[state]);
    }
  } else {
    $('whoState').innerHTML = faceCount && !people.length ? 'Najpierw dodaj pracowników w zakładce „Pracownicy”.' : '&nbsp;';
    renderPunchButtons(null);
  }
}

// przyciski przerysowujemy tylko przy zmianie osoby lub stanu, żeby kliknięcia nie ginęły między klatkami
let buttonsKey = '';
function renderPunchButtons(id, state) {
  const key = id ? id + ':' + state + (busy.has(id) ? ':busy' : '') : '';
  if (key === buttonsKey) return;
  buttonsKey = key;
  const box = $('punchBtns');
  if (!id) { box.innerHTML = '<button class="primary big" disabled>Zarejestruj</button>'; return; }
  box.innerHTML = ALLOWED[state].map((t, i) =>
    `<button class="big${i === 0 ? ' primary' : ''}" data-type="${t}"${busy.has(id) ? ' disabled' : ''}>${TYPES[t].btn}</button>`).join('');
  if (state !== 'out') box.insertAdjacentHTML('beforeend', '<button class="big" data-work="1">Wpisz wykonaną pracę</button>');
  box.querySelectorAll('button[data-type]').forEach(b => b.onclick = () => punch(id, b.dataset.type));
  box.querySelector('[data-work]')?.addEventListener('click', () => openWork(id));
}

async function punch(id, type) {
  const p = personById(id); if (!p || busy.has(id)) return;
  if (!ALLOWED[stateOf(id)].includes(type)) return;
  busy.add(id); buttonsKey = '';
  lastAuto[id] = Date.now();
  try {
    const { entry } = await deviceAction('punch', { personId: id, type });
    last[id] = entry;
    (days[dayOf(entry.ts)] ??= { log: [], work: [], rec: [] }).log.push(entry);
    const label = typeLabel(type);
    let extra = '';
    if (type === 'out') {
      const n = normFor(id, localDay());
      if (n.entries.length) extra = n.pct >= EARLY_LEAVE_PCT ? ` · norma ${fmtPct(n.pct)}, zaliczono 7 godzin` : ` · norma ${fmtPct(n.pct)}`;
      if (n.pending) extra += ` · ${n.pending} wpis(y) pracy czeka na zatwierdzenie`;
    }
    $('punchStatus').innerHTML = `<span class="${TYPES[type].cls}">${label[0].toUpperCase() + label.slice(1)}: ${esc(p.name)}, ${fmtHM(entry.ts)}${esc(extra)}</span>`;
  } catch (e) {
    $('punchStatus').innerHTML = `<span class="err">Nie zapisano: ${esc(e.message)}</span>`;
  } finally {
    busy.delete(id); buttonsKey = '';
    renderPunchButtons(id, stateOf(id));
    renderLog(); renderSummary();
    sync();
  }
}

// --- pracownicy
$('captureBtn').onclick = async () => {
  if (!opts) { $('peopleStatus').innerHTML = '<span class="warn">Kamera albo modele rozpoznawania nie są jeszcze gotowe.</span>'; return; }
  const res = await detect();
  if (res.length !== 1) {
    $('peopleStatus').innerHTML = `<span class="warn">${res.length ? 'W kadrze jest więcej niż jedna osoba.' : 'Nie wykryto twarzy. Stań bliżej kamery.'}</span>`;
    return;
  }
  const d = res[0].descriptor;
  if (matcher) {
    const m = matcher.findBestMatch(d);
    if (m.label !== 'unknown') {
      $('peopleStatus').innerHTML = `<span class="warn">Ta twarz jest podobna do: ${esc(personById(m.label)?.name)}. Jeśli to ta sama osoba, nie dodawaj jej ponownie.</span>`;
    } else $('peopleStatus').textContent = '';
  }
  samples.push(Array.from(d));
  updateSamples();
};
$('resetSamples').onclick = () => { samples = []; updateSamples(); $('peopleStatus').textContent = ''; };
function updateSamples() {
  $('sampleCount').textContent = `${samples.length} / ${SAMPLES_TARGET} zdjęć`;
  $('saveBtn').disabled = !samples.length;
  $('captureBtn').disabled = samples.length >= SAMPLES_TARGET;
}
const fail = (el, e) => { $(el).innerHTML = `<span class="err">${esc(e.message)}</span>`; };
$('saveBtn').onclick = async () => {
  const name = $('newName').value.trim();
  if (!name) { $('peopleStatus').innerHTML = '<span class="warn">Wpisz imię i nazwisko.</span>'; return; }
  try {
    if (!(await adminAction('addPerson', { name, descriptors: samples }))) return;
    samples = []; $('newName').value = ''; updateSamples();
    $('peopleStatus').innerHTML = `<span class="ok">Dodano: ${esc(name)}</span>`;
    await sync();
  } catch (e) { fail('peopleStatus', e); }
};
function renderPeople() {
  renderAttendance();
  if (!people.length) { $('peopleList').textContent = 'Brak pracowników.'; return; }
  $('peopleList').innerHTML = '<table>' + people.map(p =>
    `<tr><td>${esc(p.name)}</td><td class="muted">${p.descriptors.length} zdj.</td>
     <td style="text-align:right"><button data-del="${p.id}">Usuń</button></td></tr>`).join('') + '</table>';
  $('peopleList').querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    const p = personById(b.dataset.del);
    if (!confirm(`Usunąć pracownika ${p.name}? Wpisy w dzienniku zostaną.`)) return;
    try { if (await adminAction('delPerson', { id: p.id })) await sync(); } catch (e) { fail('peopleStatus', e); }
  });
}

// --- historia rozpoznań
function recordRecognition(p, distance) {
  lastRec[p.id] = Date.now();
  deviceAction('recognition', { personId: p.id, similarity: distance == null ? null : +(1 - distance).toFixed(2) })
    .then(() => sync()).catch(e => console.warn('Nie zapisano rozpoznania:', e.message));
}
function renderRecLog() {
  const rows = all('rec').slice(-50).reverse();
  $('recLog').innerHTML = '<tr><th>Pracownik</th><th>Data i godzina rozpoznania</th><th>Podobieństwo</th></tr>' + (rows.length ? rows.map(r =>
    `<tr><td>${esc(r.name)}</td><td>${fmtTime(r.ts)}</td><td>${r.similarity ?? '—'}</td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">Brak rozpoznań.</td></tr>');
}

// wpisy z całego miesiąca wybranego w zakładce Raport (do eksportu CSV)
async function monthData() {
  const day = $('reportDate').value || localDay();
  const first = day.slice(0, 8) + '01', list = [];
  for (let d = first; d.slice(0, 7) === day.slice(0, 7); d = addDays(d, 1)) list.push(d);
  const out = await api(`state?get=&days=${list.join(',')}`);
  const flat = kind => Object.values(out.days).flatMap(x => x[kind]).sort(byTs);
  return { month: day.slice(0, 7), log: flat('log'), rec: flat('rec') };
}
$('exportRecCsv').onclick = async () => {
  try {
    const { month, rec } = await monthData();
    downloadCsv(`rozpoznania-${month}.csv`, ['pracownik;data;godzina;podobieństwo'].concat(rec.map(r => {
      const d = new Date(r.ts);
      return [`"${r.name.replace(/"/g, '""')}"`, d.toLocaleDateString('pl-PL'), d.toLocaleTimeString('pl-PL'),
              r.similarity == null ? '' : String(r.similarity).replace('.', ',')].join(';');
    })));
  } catch (e) { alert(e.message); }
};
$('clearRec').onclick = async () => {
  if (!(await requireAdmin('Czyszczenie historii rozpoznań wymaga hasła kierownika.'))) return;
  if (!confirm('Usunąć całą historię rozpoznań (na wszystkich urządzeniach)? Tego nie da się cofnąć.')) return;
  try { await adminAction('clearRec', {}); await sync(); } catch (e) { alert(e.message); }
};

// --- lista obecności
const ATT = {
  in:    { cls: 'att-in',    label: 'w pracy',     color: 'var(--att-in)' },
  break: { cls: 'att-break', label: 'na przerwie', color: 'var(--att-break)' },
  out:   { cls: 'att-out',   label: 'nieobecni',   color: 'var(--att-out)' },
};
const ATT_ORDER = { in: 0, break: 1, out: 2 };
function renderAttendance() {
  if (!people.length) {
    $('attCounts').innerHTML = '';
    $('attList').innerHTML = '<li class="muted" style="border:0;padding:0">Brak pracowników. Dodaj ich w zakładce „Pracownicy”.</li>';
    return;
  }
  const list = people.map(p => ({ p, state: stateOf(p.id), le: lastEntry(p.id) }))
    .sort((a, b) => ATT_ORDER[a.state] - ATT_ORDER[b.state] || a.p.name.localeCompare(b.p.name, 'pl'));
  const counts = { in: 0, break: 0, out: 0 };
  list.forEach(x => counts[x.state]++);
  $('attCounts').innerHTML = Object.keys(ATT).map(k =>
    `<span><span class="dot" style="background:${ATT[k].color}"></span>${ATT[k].label}: <b>${counts[k]}</b></span>`).join('');
  const day = localDay();
  $('attList').innerHTML = list.map(({ p, state, le }) => {
    const since = le && state !== 'out' ? `od ${fmtHM(le.ts)}` : '';
    const n = normFor(p.id, day);
    const norm = n.all.entries.length ? `<span class="norm">norma ${fmtPct(n.all.pct)}${n.pct >= EARLY_LEAVE_PCT ? ' ✓' : ''}${n.pending ? ' · do zatwierdzenia' : ''}</span>` : '';
    const atWork = state !== 'out';
    return `<li class="${ATT[state].cls}${atWork ? ' clickable' : ''}" data-id="${p.id}" title="${esc(p.name)}: ${state === 'in' ? 'w pracy' : state === 'break' ? 'na przerwie' : 'nieobecny'}${atWork ? ' (kliknij, aby wpisać wykonaną pracę)' : ''}">
      <span class="name">${esc(p.name)}${norm}</span><span class="since">${since}</span></li>`;
  }).join('');
  $('attList').querySelectorAll('li.clickable').forEach(li => li.onclick = () => openWork(li.dataset.id));
}

// --- prace i normy
function renderTasks() {
  $('taskTable').innerHTML = '<tr><th>Praca</th><th>Jednostka</th><th>Norma / dzień</th><th></th></tr>' + (tasks.length ? tasks.map(t =>
    `<tr><td><input type="text" data-edit="name" data-id="${t.id}" value="${esc(t.name)}" style="width:100%; min-width:140px"></td>
     <td><input type="text" data-edit="unit" data-id="${t.id}" value="${esc(t.unit)}" style="width:80px"></td>
     <td><input type="number" data-edit="norm" data-id="${t.id}" value="${t.norm}" min="0" step="any"></td>
     <td style="text-align:right"><button data-del-task="${t.id}">Usuń</button></td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">Brak prac. Dodaj pierwszą powyżej.</td></tr>');
  $('taskTable').querySelectorAll('[data-edit]').forEach(inp => inp.onchange = async () => {
    try {
      const out = await adminAction('updTask', { id: inp.dataset.id, field: inp.dataset.edit, value: inp.value });
      if (out) $('taskStatus').innerHTML = `<span class="ok">Zapisano: ${esc(out.task.name)}</span>`;
    } catch (e) { fail('taskStatus', e); }
    await sync(); renderTasks();
  });
  $('taskTable').querySelectorAll('[data-del-task]').forEach(b => b.onclick = async () => {
    const t = tasks.find(x => x.id === b.dataset.delTask);
    if (!confirm(`Usunąć pracę „${t.name}”? Już zapisane wpisy zostaną.`)) return;
    try { if (await adminAction('delTask', { id: t.id })) { await sync(); renderTasks(); } } catch (e) { fail('taskStatus', e); }
  });
}
$('addTaskBtn').onclick = async () => {
  const name = $('taskName').value.trim(), unit = $('taskUnit').value.trim() || 'szt.', norm = parseFloat($('taskNorm').value);
  if (!name || !(norm > 0)) { $('taskStatus').innerHTML = '<span class="warn">Wpisz nazwę pracy i normę większą od zera.</span>'; return; }
  try {
    if (!(await adminAction('addTask', { name, unit, norm }))) return;
    $('taskName').value = ''; $('taskNorm').value = '';
    $('taskStatus').innerHTML = `<span class="ok">Dodano: ${esc(name)}</span>`;
    await sync(); renderTasks();
  } catch (e) { fail('taskStatus', e); }
};

// --- wykonana praca
let workPerson = null;
function openWork(id) {
  const p = personById(id); if (!p) return;
  workPerson = id;
  $('workTitle').textContent = `Wykonana praca: ${p.name}`;
  $('workStatus').textContent = '';
  $('workQty').value = '';
  $('workTask').innerHTML = tasks.map(t => `<option value="${t.id}">${esc(t.name)} (norma ${fmtNum(t.norm)} ${esc(t.unit)})</option>`).join('');
  $('workForm').classList.toggle('hidden', !tasks.length);
  updateWorkUnit();
  renderWork();
  if (!$('workDlg').open) $('workDlg').showModal();
  if (tasks.length) $('workQty').focus();
}
function updateWorkUnit() { $('workUnit').textContent = tasks.find(t => t.id === $('workTask').value)?.unit ?? ''; }
$('workTask').onchange = updateWorkUnit;

function renderWork() {
  if (!personById(workPerson)) { $('workDlg').close(); return; }
  const day = localDay();
  const n = normFor(workPerson, day);
  $('workSub').textContent = tasks.length ? `Dzisiaj, ${new Date().toLocaleDateString('pl-PL')}` : 'Najpierw dodaj prace i normy w zakładce „Prace”.';
  const entries = n.all.entries;
  $('workTable').innerHTML = entries.length ? '<tr><th>Godzina</th><th>Praca</th><th>Ilość</th><th>% normy</th><th>Status</th><th></th></tr>' + entries.map(w =>
    `<tr><td>${fmtHM(w.ts)}</td><td>${esc(w.taskName)}</td><td>${fmtNum(w.qty)} ${esc(w.unit)}</td><td>${fmtPct(entryPct(w))}</td>
     <td>${isApproved(w) ? '<span class="ok">zatwierdzone</span>' : `<button data-approve="${w.id}" title="Wymaga hasła kierownika">Zatwierdź</button>`}</td>
     <td style="text-align:right"><button class="x-btn" data-del-work="${w.id}" title="Usuń wpis">×</button></td></tr>`).join('')
    + (n.pending > 1 ? `<tr><td colspan="6" style="text-align:right"><button class="primary" id="approveAllBtn">Zatwierdź wszystkie (${n.pending})</button></td></tr>` : '')
    : (tasks.length ? '<tr><td class="muted">Dzisiaj nic jeszcze nie wpisano.</td></tr>' : '');
  $('workTable').querySelectorAll('[data-del-work]').forEach(b => b.onclick = async () => {
    const w = entries.find(x => x.id === b.dataset.delWork); if (!w) return;
    try {
      // niezatwierdzony wpis pracownik może poprawić sam, zatwierdzony usuwa tylko kierownik
      if (isApproved(w)) {
        if (!(await requireAdmin('Usunięcie zatwierdzonego wpisu wymaga hasła kierownika.'))) return;
        if (!confirm('Usunąć ten wpis?')) return;
        if (!(await adminAction('delWork', { id: w.id, day: dayOf(w.ts) }))) return;
      } else {
        if (!confirm('Usunąć ten wpis?')) return;
        await deviceAction('delWork', { id: w.id, day: dayOf(w.ts) });
      }
      await sync();
    } catch (e) { fail('workStatus', e); }
  });
  const approve = async ids => {
    try {
      const out = await adminAction('approveWork', { ids, day }, 'Zatwierdzenie wykonanej pracy wymaga hasła kierownika.');
      if (!out) return;
      $('workStatus').innerHTML = `<span class="ok">Zatwierdzono ${out.approved === 1 ? 'wpis' : 'wpisy: ' + out.approved}.</span>`;
      await sync();
    } catch (e) { fail('workStatus', e); }
  };
  $('workTable').querySelectorAll('[data-approve]').forEach(b => b.onclick = () => approve([b.dataset.approve]));
  $('approveAllBtn')?.addEventListener('click', () => approve(entries.filter(w => !isApproved(w)).map(w => w.id)));
  const v = normVerdict(n.all);
  const pendingNote = n.pending
    ? `<div class="pending" style="margin-top:8px">Niezatwierdzone wpisy: ${n.pending}. Do rozliczenia, wcześniejszego wyjścia i zaliczenia 7 godzin liczy się tylko praca zatwierdzona przez kierownika (zatwierdzone teraz: ${fmtPct(n.pct)} normy).</div>` : '';
  $('workVerdict').innerHTML = (v ? `<div class="verdict ${v.cls}">${esc(v.text)}</div>` : '') + pendingNote;
}

$('addWorkBtn').onclick = async () => {
  const t = tasks.find(x => x.id === $('workTask').value), qty = parseFloat(String($('workQty').value).replace(',', '.'));
  const p = personById(workPerson);
  if (!t || !p || !(qty > 0)) { $('workStatus').innerHTML = '<span class="warn">Wybierz pracę i wpisz ilość większą od zera.</span>'; return; }
  $('addWorkBtn').disabled = true;
  try {
    await deviceAction('addWork', { personId: p.id, taskId: t.id, qty });
    $('workQty').value = '';
    $('workStatus').innerHTML = `<span class="ok">Dodano: ${esc(t.name)}, ${fmtNum(qty)} ${esc(t.unit)} (czeka na zatwierdzenie kierownika)</span>`;
    await sync();
  } catch (e) { fail('workStatus', e); }
  finally { $('addWorkBtn').disabled = false; }
};
$('workQty').onkeydown = e => { if (e.key === 'Enter') $('addWorkBtn').click(); };
$('closeWorkBtn').onclick = () => $('workDlg').close();

// --- dziennik i raport
function renderLog() {
  renderAttendance();
  const rows = all('log').slice(-50).reverse();
  $('log').innerHTML = '<tr><th>Pracownik</th><th>Zdarzenie</th><th>Czas</th></tr>' + (rows.length ? rows.map(e =>
    `<tr><td>${esc(e.name)}</td><td><span class="badge ${TYPES[e.type]?.cls ?? ''}">${typeLabel(e.type)}</span></td><td>${fmtTime(e.ts)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="muted">Brak wpisów.</td></tr>');
}

function renderSummary() {
  const day = $('reportDate').value; if (!day) return;
  if (!days[day]) { $('summary').innerHTML = '<tr><td class="muted">Wczytywanie…</td></tr>'; sync(); return; }
  const rows = computeDay(day).rows.map(r => {
    const status = r.status === 'in' ? '<span class="ok">w pracy</span>' : r.status === 'break' ? '<span class="brk">na przerwie</span>'
      : r.lastOut ? new Date(r.lastOut).toLocaleTimeString('pl-PL') : '—';
    const v = normVerdict(r.norm);
    const norm = v ? `<span class="${v.cls}" title="${esc(v.text)}">${fmtPct(r.norm.pct)}</span>` : '<span class="muted">—</span>';
    const credited = r.credited > r.total ? `<b>${fmtDur(r.credited)}</b> <span class="muted">(norma)</span>` : fmtDur(r.credited);
    const missing = (v && r.norm.pct < 100 ? `<div class="err" style="font-size:12px">brakuje ${esc(missingText(r.norm, 100))}</div>` : '')
      + (r.pending ? `<div class="pending" style="font-size:12px">${r.pending} wpis(y) do zatwierdzenia</div>` : '');
    return `<tr><td>${esc(r.name)}</td><td>${r.first ? new Date(r.first).toLocaleTimeString('pl-PL') : '—'}</td>
      <td>${status}</td><td>${fmtDur(r.breaks)}</td><td>${fmtDur(r.total)}</td><td>${norm}${missing}</td><td>${credited}</td></tr>`;
  });
  $('summary').innerHTML = '<tr><th>Pracownik</th><th>Wejście</th><th>Wyjście</th><th>Przerwy</th><th>Czas pracy</th><th>Norma</th><th>Zaliczono</th></tr>' +
    (rows.join('') || '<tr><td colspan="7" class="muted">Brak wpisów w tym dniu.</td></tr>');
}

// --- raport mailem: wysyła serwer; pierwsze urządzenie otwarte po ustawionej godzinie zleca wysyłkę,
// a gdyby żadne nie było otwarte, Vercel uruchamia ją sam raz dziennie (zadanie cron)
let lastAttempt = 0, sentDay = null;
function renderMail() {
  if (!mail) return;
  $('sendReportBtn').disabled = !mail.configured;
  if (!mail.smtp) $('mailInfo').textContent = 'Poczta nie jest skonfigurowana: w ustawieniach projektu w Vercel trzeba dodać dane skrzynki (instrukcja w pliku CZYTAJ.md).';
  else if (!mail.recipients.length) $('mailInfo').textContent = 'Brak odbiorców raportu. Kierownik może ich wpisać poniżej w „Ustawieniach raportu”.';
  else if (!mail.enabled) $('mailInfo').textContent = 'Automatyczny raport jest wyłączony. Możesz go wysłać ręcznie.';
  else $('mailInfo').textContent = `Codziennie o ${mail.time} raport z dnia trafia do: ${mail.recipients.join(', ')}.`;
  if (document.activeElement?.closest?.('#mailSettings')) return;   // nie nadpisujemy tego, co ktoś właśnie wpisuje
  $('mailTo').value = settings.recipients.join(', ');
  $('mailTime').value = settings.time;
  $('mailEnabled').checked = settings.enabled;
}
$('saveMailBtn').onclick = async () => {
  try {
    const out = await adminAction('saveSettings', { recipients: $('mailTo').value, time: $('mailTime').value, enabled: $('mailEnabled').checked },
      'Zmiana ustawień raportu wymaga hasła kierownika.');
    if (!out) return;
    $('mailSetStatus').innerHTML = '<span class="ok">Zapisano.</span>';
    document.activeElement?.blur();
    await sync();
  } catch (e) { fail('mailSetStatus', e); }
};
async function sendReport(day) {
  $('mailStatus').innerHTML = '<span class="muted">Wysyłanie raportu…</span>';
  try {
    const out = await api('report', { day });
    $('mailStatus').innerHTML = `<span class="ok">Raport z ${esc(day)}: ${esc(out.message)} (${new Date().toLocaleTimeString('pl-PL')})</span>`;
  } catch (e) { fail('mailStatus', { message: 'Nie udało się wysłać raportu: ' + e.message }); }
}
async function checkSchedule() {
  if (!token || !mail?.configured || !mail.enabled) return;
  const [h, m] = mail.time.split(':').map(Number);
  const due = new Date(); due.setHours(h, m || 0, 0, 0);
  const day = localDay();
  if (Date.now() < due.getTime() || sentDay === day || Date.now() - lastAttempt < 5 * 60_000) return;
  lastAttempt = Date.now();
  try {
    const out = await api('report', { auto: true });
    if (out.sent || /już wysłany/.test(out.reason)) sentDay = day;
    if (out.sent) $('mailStatus').innerHTML = `<span class="ok">Raport z dzisiaj: ${esc(out.message)}</span>`;
  } catch (e) { fail('mailStatus', { message: 'Nie udało się wysłać raportu: ' + e.message + ' Ponowna próba za 5 minut.' }); }
}
setInterval(checkSchedule, 30_000);
$('sendReportBtn').onclick = () => sendReport($('reportDate').value);
$('reportCsvBtn').onclick = () => {
  const day = $('reportDate').value; if (!days[day]) return;
  const r = buildReportIn(day, data());
  downloadCsv(r.filename, [r.csv]);
};

$('reportDate').value = localDay();
$('reportDate').onchange = () => { renderSummary(); sync(); };

$('exportCsv').onclick = async () => {
  try {
    const { month, log } = await monthData();
    downloadCsv(`rejestr-czasu-${month}.csv`, ['pracownik;zdarzenie;data;godzina'].concat(log.map(e => {
      const d = new Date(e.ts);
      return [`"${e.name.replace(/"/g, '""')}"`, typeLabel(e.type), d.toLocaleDateString('pl-PL'), d.toLocaleTimeString('pl-PL')].join(';');
    })));
  } catch (e) { alert(e.message); }
};
function downloadCsv(filename, lines) {
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}
$('clearLog').onclick = async () => {
  if (!(await requireAdmin('Czyszczenie dziennika wymaga hasła kierownika.'))) return;
  if (!confirm('Usunąć wszystkie wpisy z dziennika (na wszystkich urządzeniach)? Tego nie da się cofnąć.')) return;
  try { await adminAction('clearLog', {}); await sync(); } catch (e) { alert(e.message); }
};

// --- start
updateSamples();
renderAdminBar();
(async () => {
  $('loadingText').textContent = 'Wczytywanie danych…';
  await sync();
  $('loading').classList.toggle('hidden', !!lastSyncOk);
  if (!lastSyncOk) $('loadingText').innerHTML = `<span class="err">Nie udało się wczytać danych. ${$('syncInfo').textContent} Odśwież stronę.</span>`;
  checkSchedule();
  startCamera();
})();
