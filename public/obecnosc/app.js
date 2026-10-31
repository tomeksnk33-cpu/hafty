"use strict";
// Lista Obecności Brzozów: jedno urządzenie w zakładzie słucha zdań
// „nazywam się … rozpoczynam / kończę pracę”, rozpoznaje osobę z listy
// i zapisuje godzinę na serwerze, który wysyła mail.
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hm = d => new Date(d).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
const dayKey = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
function dur(ms) { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; }
const hours = ms => (ms / 3600000).toLocaleString("pl-PL", { maximumFractionDigits: 1 }) + " h";

const state = { user: null, people: [], open: {} };

// ---------- serwer ----------
let bannerMsg = "";
function renderBanner() { $("#banner").innerHTML = bannerMsg; }
async function api(path, opts = {}) {
  const r = await fetch("/api/obecnosc/" + path, {
    ...opts,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = {};
  try { data = await r.json(); } catch (e) {}
  if (r.status === 401 || (r.redirected && new URL(r.url).pathname === "/login")) {
    bannerMsg = `<div class="banner err">Sesja wygasła. <a href="/login?powrot=/obecnosc">Zaloguj się ponownie</a>.</div>`; renderBanner();
    const e = new Error("Zaloguj się ponownie."); e.status = 401; throw e;
  }
  if (r.status === 403 && path === "stan") {
    bannerMsg = `<div class="banner err">Twoje konto nie ma dostępu do listy obecności. Poproś administratora o uprawnienie albo <a href="/">wróć do wyboru aplikacji</a>.</div>`; renderBanner();
  }
  if (!r.ok) { const e = new Error(data.error || "Błąd serwera " + r.status); e.status = r.status; throw e; }
  return data;
}
async function loadState() {
  try {
    const d = await api("stan");
    state.user = d.user; state.people = d.people; state.open = d.open;
    if (bannerMsg.includes("Brak połączenia")) { bannerMsg = ""; renderBanner(); }
    $("#who").textContent = d.user.name;
    $("#nav").classList.toggle("hidden", !d.user.isAdmin);
    renderPresent();
    if (!d.people.length) {
      bannerMsg = d.user.isAdmin
        ? `<div class="banner">Lista pracowników jest pusta. Dodaj ich w zakładce <b>Pracownicy</b>.</div>`
        : `<div class="banner">Lista pracowników jest pusta. Poproś administratora o jej uzupełnienie.</div>`;
      renderBanner();
    }
    return true;
  } catch (e) {
    if (e.status !== 401 && e.status !== 403) { bannerMsg = `<div class="banner err">Brak połączenia z serwerem. Zgłoszenia nie zostaną zapisane, dopóki połączenie nie wróci.</div>`; renderBanner(); }
    return false;
  }
}
function renderPresent() {
  const el = $("#present");
  const ids = Object.keys(state.open);
  const byId = Object.fromEntries(state.people.map(p => [p.id, p]));
  const today = dayKey(new Date());
  const rows = ids.filter(id => byId[id] && dayKey(state.open[id]) === today)
    .sort((a, b) => new Date(state.open[a]) - new Date(state.open[b]));
  el.innerHTML = rows.length
    ? rows.map(id => `<span class="chip">${esc(byId[id].name)} · od ${hm(state.open[id])}</span>`).join("")
    : `<span class="small">Nikt nie rozpoczął jeszcze dziś pracy.</span>`;
}

// ---------- rozpoznawanie osoby ----------
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);

const START = /\b(rozpoczynam|zaczynam|rozpoczecie|poczatek|przychodze|przyszedlem|przyszlam|start)\b/;
const END = /\b(koncze|zakonczam|zakonczylem|zakonczylam|skonczylem|skonczylam|koniec|zakonczenie|wychodze|ide do domu)\b/;
const FILLER = /\b(nazywam sie|nazywam|mam na imie|jestem|to ja|tu|z tej strony|dzien dobry|czesc|witam|do widzenia|rozpoczynam|zaczynam|rozpoczecie|poczatek|przychodze|przyszedlem|przyszlam|start|koncze|zakonczam|zakonczylem|zakonczylam|skonczylem|skonczylam|koniec|zakonczenie|wychodze|ide do domu|prace|pracy|praca|i|oraz|a|no|wiec|prosze)\b/g;

function parseType(t) { if (END.test(t)) return "end"; if (START.test(t)) return "start"; return null; }

// Dopasowanie słów do imienia i nazwiska, w dowolnej kolejności, z tolerancją na
// polską odmianę i drobne przekłamania rozpoznawania mowy.
function scoreName(words, name) {
  const parts = norm(name).split(" ").filter(Boolean);
  if (!parts.length || !words.length) return { cov: 0, spoken: 0, avg: 0 };
  const used = new Set(); let total = 0, hit = 0;
  for (const part of parts) {
    let best = 0, bi = -1;
    words.forEach((w, i) => {
      if (used.has(i)) return;
      let s = sim(w, part);
      const k = Math.min(4, w.length, part.length);
      if (k >= 4 && w.slice(0, k) === part.slice(0, k)) s = Math.max(s, 0.85);
      if (s > best) { best = s; bi = i; }
    });
    if (best >= 0.72) { used.add(bi); hit++; total += best; }
  }
  return { cov: hit / parts.length, spoken: used.size / words.length, avg: hit ? total / hit : 0 };
}
function findPerson(t) {
  const words = t.replace(FILLER, " ").split(" ").filter(w => w.length > 1);
  if (!words.length) return { person: null, words };
  const scored = [];
  for (const p of state.people) {
    let best = { cov: 0, spoken: 0, avg: 0 };
    for (const n of [p.name, ...(p.aliases || [])]) {
      const s = scoreName(words, n);
      if (s.cov + s.avg > best.cov + best.avg) best = s;
    }
    scored.push({ p, ...best, score: best.cov * 0.7 + best.avg * 0.3 });
  }
  scored.sort((a, b) => b.score - a.score);
  const full = scored.filter(s => s.cov === 1);
  if (full.length === 1) return { person: full[0].p, words };
  if (full.length > 1) {
    // dwie osoby pasują w pełni (np. ta sama osoba ma imię jak cudze nazwisko): wybierz wyraźnie lepszą
    if (full[0].avg - full[1].avg >= 0.08) return { person: full[0].p, words };
    return { person: null, ambiguous: full.slice(0, 3).map(s => s.p), words };
  }
  // padło tylko imię albo tylko nazwisko: wystarczy, jeśli pasuje do jednej osoby
  const partial = scored.filter(s => s.cov > 0 && s.spoken === 1);
  if (partial.length === 1) return { person: partial[0].p, words };
  if (partial.length > 1) return { person: null, ambiguous: partial.slice(0, 3).map(s => s.p), words };
  return { person: null, words };
}

// ---------- mowa ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, running = false, speaking = false, busy = false;
let pending = null; // { person, until }: osoba rozpoznana, czeka na „rozpoczynam / kończę”

function plVoice() { return "speechSynthesis" in window ? speechSynthesis.getVoices().find(v => /^pl/i.test(v.lang)) : null; }
function say(text) {
  return new Promise(res => {
    if (!("speechSynthesis" in window)) { res(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "pl-PL"; const v = plVoice(); if (v) u.voice = v; u.rate = 1.05;
    speaking = true; try { rec && rec.abort(); } catch (e) {}
    let finished = false;
    const done = () => { if (finished) return; finished = true; speaking = false; res(); listen(); };
    u.onend = done; u.onerror = done; speechSynthesis.speak(u);
    setTimeout(done, 8000);
  });
}
function listen() { if (!running || speaking || busy || !rec) return; try { rec.start(); } catch (e) {} }
function setupRec() {
  if (!SR) return null;
  const r = new SR(); r.lang = "pl-PL"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 3;
  r.onresult = e => {
    const res = e.results[e.results.length - 1];
    $("#heard").textContent = "„" + res[0].transcript + "”";
    if (res.isFinal) handle([...res].map(a => a.transcript));
  };
  r.onend = () => { if (running && !speaking) setTimeout(listen, 250); };
  r.onerror = e => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") { stop(); showResult("bad", "", "Brak dostępu do mikrofonu. Zezwól w ustawieniach przeglądarki."); }
  };
  return r;
}
function micUi() {
  $("#mic").textContent = running ? "⏹ Wyłącz nasłuch" : "🎤 Włącz nasłuch";
  $("#mic").classList.toggle("stop", running);
  $("#mic").classList.toggle("pulse", running);
}
function start() {
  if (!SR) { alert("Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome na Androidzie lub Safari na iPhonie. Możesz też wpisywać zdanie ręcznie."); return; }
  if (!rec) rec = setupRec();
  running = true; micUi();
  say("Słucham");
}
function stop() { running = false; try { rec && rec.abort(); } catch (e) {} micUi(); }

// ---------- obsługa zdania ----------
function log(msg, cls = "") { const d = document.createElement("div"); d.className = cls; d.textContent = hm(new Date()) + "  " + msg; $("#log").prepend(d); }
let resultTimer = null;
function showResult(kind, who, what) {
  const el = $("#result"); el.className = "result " + kind;
  el.innerHTML = (who ? `<div class="who">${esc(who)}</div>` : "") + `<div class="what">${esc(what)}</div>`;
  clearTimeout(resultTimer);
  resultTimer = setTimeout(() => { el.className = "result wait"; el.innerHTML = `<div class="what small">Czekam na pracownika…</div>`; }, 20000);
}
async function deviceHints() {
  try {
    const d = navigator.userAgentData;
    if (!d || !d.getHighEntropyValues) return undefined;
    const v = await d.getHighEntropyValues(["model", "platformVersion"]);
    return { model: v.model || undefined, platform: v.platform || undefined, platformVersion: v.platformVersion || undefined };
  } catch (e) { return undefined; }
}

async function handle(alts) {
  if (typeof alts === "string") alts = [alts];
  if (busy) return;
  if (pending && pending.until < Date.now()) pending = null;

  // pierwsza wersja usłyszanego zdania, w której rozpoznano osobę
  let type = null, found = null, firstAmbiguous = null;
  for (const a of alts) {
    const t = norm(a); if (!t) continue;
    type = type || parseType(t);
    const f = findPerson(t);
    if (f.person) { found = f.person; type = parseType(t) || type; break; }
    if (f.ambiguous && !firstAmbiguous) firstAmbiguous = f.ambiguous;
  }
  if (!found && pending && type) found = pending.person;

  if (!found) {
    if (firstAmbiguous) {
      const names = firstAmbiguous.map(p => p.name).join(" albo ");
      showResult("bad", "", "Nie wiem, kto to: " + names + ". Podaj imię i nazwisko.");
      log("Niejednoznaczne: " + names, "warn");
      await say("Nie jestem pewna, kto to. Podaj pełne imię i nazwisko."); return;
    }
    if (!type && !norm(alts[0] || "").match(/nazywam|jestem/)) return; // rozmowa w tle, nie do aplikacji
    showResult("bad", "", "Nie rozpoznano osoby z listy. Powtórz imię i nazwisko.");
    log("Nie rozpoznano: „" + (alts[0] || "") + "”", "bad");
    await say("Nie rozpoznałam. Powtórz imię i nazwisko."); return;
  }
  if (!type) {
    pending = { person: found, until: Date.now() + 15000 };
    showResult("wait", found.name, "Rozpoczynasz czy kończysz pracę?");
    await say(found.name + ". Rozpoczynasz czy kończysz pracę?"); return;
  }
  pending = null;
  await send(found, type);
}

async function send(person, type) {
  busy = true; try { rec && rec.abort(); } catch (e) {}
  showResult("wait", person.name, type === "start" ? "Zapisuję rozpoczęcie pracy…" : "Zapisuję zakończenie pracy…");
  let msg;
  try {
    const r = await api("zdarzenie", { method: "POST", body: { personId: person.id, type, device: await deviceHints() } });
    if (r.status === "already") {
      showResult("ok", r.name, "Praca rozpoczęta już dziś o " + hm(r.startedAt));
      log(r.name + ": już rozpoczęte o " + hm(r.startedAt), "warn");
      msg = r.name + ". Pracę rozpoczęto już dziś o " + hm(r.startedAt) + ".";
    } else if (r.status === "notStarted") {
      showResult("bad", r.name, "Nie ma rozpoczętej pracy do zakończenia.");
      log(r.name + ": brak rozpoczętej pracy", "bad");
      msg = r.name + ". Nie masz rozpoczętej pracy. Najpierw powiedz: rozpoczynam pracę.";
    } else if (type === "start") {
      showResult("ok", r.name, "Rozpoczęcie pracy: " + hm(r.startedAt));
      log(r.name + ": rozpoczęcie " + hm(r.startedAt) + (r.mailError ? " (mail nie wysłany)" : ""), r.mailError ? "warn" : "ok");
      msg = "Rozpoznano: " + r.name + ". Rozpoczęcie pracy o " + hm(r.startedAt) + ". Miłej pracy.";
    } else {
      const worked = dur(new Date(r.endedAt) - new Date(r.startedAt));
      showResult("ok", r.name, "Zakończenie pracy: " + hm(r.endedAt) + " · " + worked);
      log(r.name + ": zakończenie " + hm(r.endedAt) + ", " + worked + (r.mailError ? " (mail nie wysłany)" : ""), r.mailError ? "warn" : "ok");
      msg = "Rozpoznano: " + r.name + ". Koniec pracy o " + hm(r.endedAt) + ". Przepracowano " + worked.replace("h", "godzin").replace("min", "minut") + ". Do widzenia.";
    }
    if (r.mailError) console.warn(r.mailError);
  } catch (e) {
    showResult("bad", person.name, "Nie zapisano: " + e.message);
    log(person.name + ": nie zapisano (" + e.message + ")", "bad");
    msg = "Nie udało się zapisać. Spróbuj ponownie.";
  }
  busy = false;
  loadState();
  await say(msg);
}

$("#mic").onclick = () => running ? stop() : start();
$("#typedGo").onclick = () => { const v = $("#typed").value.trim(); if (v) { $("#typed").value = ""; handle(v); } };
$("#typed").onkeydown = e => { if (e.key === "Enter") $("#typedGo").click(); };

// ---------- zakładki ----------
document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("section").forEach(s => s.classList.toggle("on", s.id === b.dataset.tab));
  if (b.dataset.tab === "grafik") loadMonth();
  if (b.dataset.tab === "osoby") loadPeople();
});

// ---------- grafik (administrator) ----------
const cal = { year: new Date().getFullYear(), month: new Date().getMonth(), shifts: [], people: [], selected: dayKey(new Date()), filter: "" };
const shiftMs = s => s.endedAt ? new Date(s.endedAt) - new Date(s.startedAt) : (dayKey(s.startedAt) === dayKey(new Date()) ? Date.now() - new Date(s.startedAt) : 0);

async function loadMonth() {
  const from = new Date(cal.year, cal.month, 1), to = new Date(cal.year, cal.month + 1, 1);
  try {
    const [shifts, people] = await Promise.all([
      api(`grafik?od=${from.toISOString()}&do=${to.toISOString()}`),
      api("osoby")
    ]);
    cal.shifts = shifts; cal.people = people;
  } catch (e) { $("#calNote").textContent = "Nie można pobrać grafiku: " + e.message; return; }
  renderFilter(); renderCal(); renderDay(); renderMonthSum();
}
function visibleShifts() { return cal.filter ? cal.shifts.filter(s => s.personId === cal.filter) : cal.shifts; }
function renderFilter() {
  const sel = $("#personFilter");
  sel.innerHTML = `<option value="">Wszyscy pracownicy</option>` + cal.people.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${p.active ? "" : " (wyłączony)"}</option>`).join("");
  sel.value = cal.filter;
}
function renderCal() {
  $("#month").textContent = new Date(cal.year, cal.month, 1).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  const byDay = {};
  for (const s of visibleShifts()) (byDay[dayKey(s.startedAt)] ||= []).push(s);
  const first = new Date(cal.year, cal.month, 1);
  const lead = (first.getDay() + 6) % 7; // poniedziałek = 0
  const days = new Date(cal.year, cal.month + 1, 0).getDate();
  const today = dayKey(new Date());
  let html = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"].map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < lead; i++) html += `<div class="day out"></div>`;
  for (let d = 1; d <= days; d++) {
    const key = dayKey(new Date(cal.year, cal.month, d));
    const list = byDay[key] || [];
    const ms = list.reduce((a, s) => a + shiftMs(s), 0);
    const ppl = new Set(list.map(s => s.personId)).size;
    const missing = list.some(s => !s.endedAt && key !== today);
    html += `<button class="day${list.length ? " has" : ""}${key === today ? " today" : ""}${key === cal.selected ? " sel" : ""}" data-day="${key}">
      <span class="d">${d}</span>
      ${list.length ? `<span class="h">${hours(ms)}</span><span class="p">${cal.filter ? "" : ppl + " os."}</span>` : ""}
      ${missing ? `<span class="w">brak końca</span>` : ""}
    </button>`;
  }
  $("#cal").innerHTML = html;
  $("#cal").querySelectorAll("[data-day]").forEach(b => b.onclick = () => { cal.selected = b.dataset.day; renderCal(); renderDay(); $("#dayCard").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#calNote").textContent = "Godziny dnia to suma okresów pracy rozpoczętych tego dnia. Dzisiejsza niezakończona praca liczy się do teraz.";
}
function timeInput(d) { return d ? hm(d) : ""; }
// "07:30" w dniu `key` -> ISO; koniec przed początkiem oznacza następny dzień
function toIso(key, time, after) {
  const [y, m, d] = key.split("-").map(Number); const [hh, mm] = time.split(":").map(Number);
  let x = new Date(y, m - 1, d, hh, mm);
  if (after && x <= new Date(after)) x = new Date(x.getTime() + 86400000);
  return x.toISOString();
}
function renderDay() {
  const key = cal.selected;
  const [y, m, d] = key.split("-").map(Number);
  $("#dayTitle").textContent = new Date(y, m - 1, d).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const list = visibleShifts().filter(s => dayKey(s.startedAt) === key);
  const today = dayKey(new Date());
  const total = list.reduce((a, s) => a + shiftMs(s), 0);
  let html = list.length ? `<div class="scroll"><table><thead><tr><th>Pracownik</th><th>Początek</th><th>Koniec</th><th class="n">Czas</th><th></th></tr></thead><tbody>` : `<p class="small">Brak wpisów tego dnia.</p>`;
  for (const s of list) {
    const end = s.endedAt ? hm(s.endedAt) : (key === today ? `<span class="ok">w pracy</span>` : `<span class="warn">brak</span>`);
    html += `<tr data-id="${s.id}"><td>${esc(s.name)}${s.edited ? `<span class="tag" title="Poprawione ręcznie">popr.</span>` : ""}</td><td>${hm(s.startedAt)}</td><td>${end}</td><td class="n">${s.endedAt || key === today ? dur(shiftMs(s)) : "—"}</td>
      <td class="n"><button class="btn" data-e title="Popraw">✎<span class="lbl"> Popraw</span></button> <button class="btn del" data-d title="Usuń">✕<span class="lbl"> Usuń</span></button></td></tr>`;
  }
  if (list.length) html += `</tbody><tfoot><tr><th colspan="3">Razem</th><th class="n">${dur(total)}</th><th></th></tr></tfoot></table></div>`;
  html += `<div style="margin-top:14px"><h2 style="font-size:15px">Dopisz godziny ręcznie</h2><div class="row">
    <select id="addPerson">${cal.people.filter(p => p.active).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>
    <label style="margin:0">od <input type="time" id="addFrom" value="07:00"></label>
    <label style="margin:0">do <input type="time" id="addTo" value="15:00"></label>
    <button class="btn pri" id="addShift">Dodaj</button></div></div>`;
  $("#dayBody").innerHTML = html;
  if (cal.filter) { const ap = $("#addPerson"); if (ap) ap.value = cal.filter; }

  $("#dayBody").querySelectorAll("tr[data-id]").forEach(tr => {
    const s = list.find(x => x.id === tr.dataset.id);
    tr.querySelector("[data-d]").onclick = async () => {
      if (!confirm(`Usunąć wpis ${s.name} z ${hm(s.startedAt)}?`)) return;
      try { await api("wpisy?id=" + encodeURIComponent(s.id), { method: "DELETE" }); } catch (e) { alert(e.message); }
      loadMonth();
    };
    tr.querySelector("[data-e]").onclick = () => {
      tr.innerHTML = `<td>${esc(s.name)}</td><td><input type="time" data-f value="${timeInput(s.startedAt)}"></td><td><input type="time" data-t value="${timeInput(s.endedAt)}"></td>
        <td colspan="2" class="n"><button class="btn pri" data-s>Zapisz</button> <button class="btn" data-c>Anuluj</button></td>`;
      tr.querySelector("[data-c]").onclick = renderDay;
      tr.querySelector("[data-s]").onclick = async () => {
        const f = tr.querySelector("[data-f]").value, t = tr.querySelector("[data-t]").value;
        if (!f) { alert("Podaj godzinę rozpoczęcia."); return; }
        const startedAt = toIso(key, f);
        try { await api("wpisy", { method: "PUT", body: { id: s.id, startedAt, endedAt: t ? toIso(key, t, startedAt) : null } }); }
        catch (e) { alert("Nie zapisano: " + e.message); return; }
        loadMonth();
      };
    };
  });
  const add = $("#addShift");
  if (add) add.onclick = async () => {
    const personId = $("#addPerson").value, f = $("#addFrom").value, t = $("#addTo").value;
    if (!personId) { alert("Najpierw dodaj pracownika w zakładce Pracownicy."); return; }
    if (!f) { alert("Podaj godzinę rozpoczęcia."); return; }
    const startedAt = toIso(key, f);
    try { await api("wpisy", { method: "POST", body: { personId, startedAt, endedAt: t ? toIso(key, t, startedAt) : null } }); }
    catch (e) { alert("Nie zapisano: " + e.message); return; }
    loadMonth();
  };
}
function renderMonthSum() {
  const per = {};
  for (const s of visibleShifts()) {
    const p = (per[s.personId] ||= { name: s.name, ms: 0, days: new Set(), missing: 0 });
    p.ms += shiftMs(s); p.days.add(dayKey(s.startedAt));
    if (!s.endedAt && dayKey(s.startedAt) !== dayKey(new Date())) p.missing++;
  }
  const rows = Object.values(per).sort((a, b) => a.name.localeCompare(b.name, "pl"));
  if (!rows.length) { $("#monthSum").innerHTML = `<p class="small">Brak wpisów w tym miesiącu.</p>`; return; }
  const total = rows.reduce((a, r) => a + r.ms, 0);
  $("#monthSum").innerHTML = `<table><thead><tr><th>Pracownik</th><th class="n">Dni</th><th class="n">Godziny</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${esc(r.name)}${r.missing ? ` <span class="warn small">(${r.missing} bez zakończenia)</span>` : ""}</td><td class="n">${r.days.size}</td><td class="n">${dur(r.ms)}</td></tr>`).join("") +
    `</tbody><tfoot><tr><th>Razem</th><th></th><th class="n">${dur(total)}</th></tr></tfoot></table>`;
}
$("#prev").onclick = () => { cal.month--; if (cal.month < 0) { cal.month = 11; cal.year--; } cal.selected = dayKey(new Date(cal.year, cal.month, 1)); loadMonth(); };
$("#next").onclick = () => { cal.month++; if (cal.month > 11) { cal.month = 0; cal.year++; } cal.selected = dayKey(new Date(cal.year, cal.month, 1)); loadMonth(); };
$("#personFilter").onchange = e => { cal.filter = e.target.value; renderCal(); renderDay(); renderMonthSum(); };

// ---------- pracownicy (administrator) ----------
async function loadPeople() {
  let list;
  try { list = await api("osoby"); } catch (e) { $("#pList").innerHTML = `<li class="small">Nie można pobrać: ${esc(e.message)}</li>`; return; }
  $("#pCount").textContent = list.filter(p => p.active).length;
  const ul = $("#pList"); ul.innerHTML = "";
  for (const p of list) {
    const li = document.createElement("li");
    li.innerHTML = `<span><b>${esc(p.name)}</b>${p.active ? "" : ` <span class="small">(wyłączony)</span>`}${p.aliases.length ? `<br><span class="small">${esc(p.aliases.join(", "))}</span>` : ""}</span>
      <span class="row"><button class="btn" data-e>Edytuj</button>${p.active ? `<button class="btn del" data-d>Usuń</button>` : `<button class="btn" data-a>Przywróć</button>`}</span>`;
    li.querySelector("[data-e]").onclick = async () => {
      const n = prompt("Imię i nazwisko:", p.name); if (n === null) return;
      const a = prompt("Inne formy (po przecinku):", p.aliases.join(", ")); if (a === null) return;
      try { await api("osoby", { method: "PUT", body: { id: p.id, name: n.trim() || p.name, aliases: a.split(",").map(s => s.trim()).filter(Boolean) } }); } catch (e) { alert(e.message); }
      loadPeople(); loadState();
    };
    const d = li.querySelector("[data-d]");
    if (d) d.onclick = async () => {
      if (!confirm(`Usunąć ${p.name} z listy?` + (p.shifts ? " Zapisane godziny zostaną w grafiku." : ""))) return;
      try { await api("osoby?id=" + encodeURIComponent(p.id), { method: "DELETE" }); } catch (e) { alert(e.message); }
      loadPeople(); loadState();
    };
    const r = li.querySelector("[data-a]");
    if (r) r.onclick = async () => {
      try { await api("osoby", { method: "PUT", body: { id: p.id, name: p.name, aliases: p.aliases, active: true } }); } catch (e) { alert(e.message); }
      loadPeople(); loadState();
    };
    ul.append(li);
  }
}
$("#pAdd").onclick = async () => {
  const name = $("#pName").value.trim(); if (!name) return;
  const aliases = $("#pAlias").value.split(",").map(s => s.trim()).filter(Boolean);
  try { await api("osoby", { method: "POST", body: { name, aliases } }); } catch (e) { alert(e.message); return; }
  $("#pName").value = ""; $("#pAlias").value = "";
  if (bannerMsg.includes("pusta")) { bannerMsg = ""; renderBanner(); }
  loadPeople(); loadState();
};

loadState();
setInterval(() => { if (!busy) loadState(); }, 60000);
window.__obecnosc = { handle, findPerson, norm, state };
