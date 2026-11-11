"use strict";
// ---------- local state (per phone) ----------
// The client/assortment catalog lives in the shared database (same as the embroidery app); the route
// in progress and unsent routes stay on the phone so nothing is lost without signal.
// The worker is identified by their login session, the same account as in the embroidery app.
const KEY = "pralnia-trasa-v3";
const local = (() => {
  const d = { worker: "", repeat: true, catalog: { clients: [], items: [] }, route: [], routeId: null, pending: [] };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return d; }
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(local)); } catch (e) {} };
const cat = () => local.catalog;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- server ----------
let loggedOut = false; // session expired or account disabled: the route waits on the phone until the worker logs in again
let noAccess = false;  // logged in, but the account has no access to the laundry app
async function api(path, opts = {}) {
  const r = await fetch("/api/pralnia/" + path, {
    ...opts,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = {};
  try { data = await r.json(); } catch (e) {}
  // the login gate answers an expired session with a redirect to the login page
  const authFailed = r.status === 401 || (r.redirected && new URL(r.url).pathname === "/login");
  if (authFailed !== loggedOut) { loggedOut = authFailed; renderBanner(); }
  if (authFailed) { const err = new Error("Zaloguj się ponownie."); err.status = 401; throw err; }
  if (r.status === 403 && !noAccess) { noAccess = true; renderBanner(); }
  if (!r.ok) { const err = new Error(data.error || "Błąd serwera " + r.status); err.status = r.status; err.data = data; throw err; }
  return data;
}
async function loadCatalog() {
  try {
    const d = await api("katalog");
    local.catalog = { clients: d.clients, items: d.items };
    if (d.user) { local.worker = d.user.name; local.isAdmin = !!d.user.isAdmin; local.canManage = !!(d.user.canManage ?? d.user.isAdmin); showAdmin(); }
    save(); ui();
    $("#cSync").textContent = "Baza wspólna dla wszystkich pracowników. Zsynchronizowano " + new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) + ".";
    return true;
  } catch (e) {
    $("#cSync").textContent = e.status === 401 ? "Sesja wygasła. Zaloguj się ponownie." : "Brak połączenia. Używam ostatnio pobranej bazy.";
    return false;
  } finally { renderList("c"); renderList("a"); }
}
// one change to the shared catalog (add / edit / delete a single row), then refresh the lists
async function changeCatalog(opts) {
  try { await api("katalog" + (opts.query || ""), opts); }
  catch (e) { alert((e.status === 404 ? "" : "Nie zapisano: ") + e.message); }
  await loadCatalog();
}

// ---------- text matching ----------
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
const namesOf = x => [x.name, ...(x.aliases || [])].map(norm).filter(Boolean);

// best client for a whole phrase
function findClient(text) {
  const t = norm(text); if (!t) return null;
  let best = null, score = 0;
  for (const c of cat().clients) for (const n of namesOf(c)) {
    let s = sim(t, n);
    if (t.includes(n) || n.includes(t)) s = Math.max(s, 0.9 * Math.min(t.length, n.length) / Math.max(t.length, n.length) + 0.1);
    if (s > score) { score = s; best = c; }
  }
  return score >= 0.72 ? best : null;
}
// match one word/phrase to an assortment item (handles Polish endings via shared stem)
function findItem(words) {
  const t = norm(words); if (!t) return null;
  let best = null, score = 0;
  for (const it of cat().items) for (const n of namesOf(it)) {
    let s = sim(t, n);
    const k = Math.min(5, n.length, t.length);
    if (k >= 4 && t.slice(0, k) === n.slice(0, k)) s = Math.max(s, 0.8);
    if (s > score) { score = s; best = it; }
  }
  return score >= 0.72 ? best : null;
}

// Polish number words -> value
const NUM = { zero: 0, jeden: 1, jedna: 1, jedno: 1, raz: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, piec: 5, szesc: 6, siedem: 7, osiem: 8, dziewiec: 9, dziesiec: 10,
  jedenascie: 11, dwanascie: 12, trzynascie: 13, czternascie: 14, pietnascie: 15, szesnascie: 16, siedemnascie: 17, osiemnascie: 18, dziewietnascie: 19,
  dwadziescia: 20, trzydziesci: 30, czterdziesci: 40, piecdziesiat: 50, szescdziesiat: 60, siedemdziesiat: 70, osiemdziesiat: 80, dziewiecdziesiat: 90,
  sto: 100, dwiescie: 200, trzysta: 300, czterysta: 400, piecset: 500, szescset: 600, siedemset: 700, osiemset: 800, dziewiecset: 900, tysiac: 1000 };
// turn "dwadziescia piec" into "25" so the parser only sees digits
function wordsToDigits(t) {
  const out = []; let acc = null;
  for (const w of t.split(" ")) {
    if (w in NUM) { const v = NUM[w]; acc = acc === null ? v : (v === 1000 ? (acc || 1) * 1000 : acc + v); }
    else { if (acc !== null) { out.push(String(acc)); acc = null; } out.push(w); }
  }
  if (acc !== null) out.push(String(acc));
  return out.join(" ");
}
// "przescieradla 20 reczniki 15" / "20 przescieradel i 15 recznikow" /
// "reczniki 20 sztuk 12,5 kilo" -> [{ item, qtys: [{ n, unit }] }], plus unknown pieces.
// unit przy liczbie: "kg", "szt" albo null, gdy pracownik nie powiedział jednostki.
function parseItems(text) {
  // "12,5" / "12.5" -> "12 przecinek 5", żeby przecinek przetrwał norm()
  const marked = String(text).replace(/(\d)\s*[,.]\s*(\d)/g, "$1 przecinek $2");
  const t = wordsToDigits(norm(marked))
    .replace(/\b(\d+) przecinek (\d+)\b/g, "$1.$2")
    .replace(/\b(\d+(?:\.\d+)?) i pol\b/g, (m, a) => String(+a + 0.5))
    .replace(/\bpoltora\b/g, "1.5").replace(/\bpol\b/g, "0.5")
    .replace(/\b(kilogramow|kilogramy|kilogram|kilogramach|kilograma|kilo|kg|kile)\b/g, " #kg ")
    .replace(/\b(sztuk|sztuki|sztuka|szt)\b/g, " #szt ")
    .replace(/\b(i|oraz|razy|po|a|na|wagi|waga)\b/g, " ");
  const toks = t.split(" ").filter(Boolean);
  const res = [], unknown = [];
  let cur = null, pending = [];
  const isNum = x => /^\d+(\.\d+)?$/.test(x);
  // druga liczba przy tej samej pozycji tylko wtedy, gdy jednostki są różne
  const canTake = (c, q) => c.qtys.length === 0 || (c.qtys.length === 1 && (q.unit || c.qtys[0].unit) && q.unit !== c.qtys[0].unit);
  const finish = () => {
    if (!cur) return;
    const phrase = cur.words.join(" ");
    let it = findItem(phrase);
    if (!it && cur.words.length > 1) { for (const w of cur.words) { it = findItem(w); if (it) break; } }
    if (it) res.push({ item: it, qtys: cur.qtys }); else unknown.push(phrase);
    cur = null;
  };
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (tok === "#kg" || tok === "#szt") continue; // jednostka bez liczby
    if (isNum(tok)) {
      const next = toks[i + 1];
      const unit = next === "#kg" ? "kg" : next === "#szt" ? "szt" : null;
      if (unit) i++;
      const q = { n: +tok, unit };
      if (cur && cur.style === "word" && canTake(cur, q)) cur.qtys.push(q);          // "reczniki 15 (sztuk 12 kg)"
      else if (cur && cur.style === "num" && unit && !pending.length && canTake(cur, q)) cur.qtys.push(q); // "20 recznikow 12 kilo"
      else { finish(); pending.push(q); }                                              // "15 recznikow"
      continue;
    }
    if (cur && cur.style === "word" && !cur.qtys.length) { cur.words.push(tok); continue; } // nazwa z kilku słów
    finish();
    cur = { words: [tok], qtys: pending, style: pending.length ? "num" : "word" };
    pending = [];
  }
  finish();
  return { res, unknown };
}

// ---------- speech ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, running = false, speaking = false;
let mode = "client"; // client | items
let currentClient = null;

function plVoice() { return "speechSynthesis" in window ? speechSynthesis.getVoices().find(v => /^pl/i.test(v.lang)) : null; }
function say(text, { thenListen = true } = {}) {
  return new Promise(res => {
    if (!("speechSynthesis" in window)) { res(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "pl-PL"; const v = plVoice(); if (v) u.voice = v; u.rate = 1.05;
    speaking = true; try { rec && rec.abort(); } catch (e) {}
    let finished = false;
    const done = () => { if (finished) return; finished = true; speaking = false; res(); if (thenListen) listen(); };
    u.onend = done; u.onerror = done; speechSynthesis.speak(u);
    setTimeout(done, 6000);
  });
}
function listen() {
  if (!running || speaking || !rec) return;
  try { rec.start(); } catch (e) {}
}
function setupRec() {
  if (!SR) return null;
  const r = new SR(); r.lang = "pl-PL"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 3;
  r.onresult = e => {
    const res = e.results[e.results.length - 1];
    $("#heard").textContent = "„" + res[0].transcript + "”";
    if (res.isFinal) handle([...res].map(a => a.transcript));
  };
  r.onend = () => { if (running && !speaking) setTimeout(listen, 250); };
  r.onerror = e => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { stop(); log("Brak dostępu do mikrofonu. Zezwól w ustawieniach przeglądarki.", "bad"); } };
  return r;
}

// ---------- dialogue ----------
function log(msg, cls = "") { const d = document.createElement("div"); d.className = cls; d.textContent = new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) + "  " + msg; $("#log").prepend(d); }
function ui() {
  $("#mic").textContent = running ? "⏹ Zatrzymaj słuchanie" : "🎤 Rozpocznij trasę głosem";
  $("#mic").classList.toggle("stop", running);
  $("#mic").classList.toggle("pulse", running);
  $("#state").innerHTML = mode === "client" ? "Czekam na <b>nazwę klienta</b>" : "Klient: podaj <b>asortyment i ilość</b>";
  $("#current").textContent = currentClient ? currentClient.name : "";
  renderClientGeo(); renderTouch();
  $("#who").textContent = local.worker || "";
  $("#sWorker").textContent = local.worker || "…";
  renderSummary(); renderBanner();
}
async function handle(alts) {
  if (typeof alts === "string") alts = [alts];
  const text = alts[0]; const t = norm(text);
  if (!t) return;
  $("#heard").textContent = "„" + text + "”";
  if (/koniec trasy|koniec tras|zakoncz trase/.test(t)) { log("Koniec trasy", "ok"); await finishRoute(true); return; }
  if (/^(cofnij|usun ostatni)/.test(t)) {
    const last = local.route.pop(); save(); ui();
    if (last) { log("Cofnięto: " + last.client + " – " + last.item + " " + fmtEntry(last), "warn"); await say("Cofnięto"); } else await say("Nie ma czego cofnąć");
    return;
  }
  if (/nastepny klient|kolejny klient|zmiana klienta|koniec klienta|inny klient/.test(t)) {
    mode = "client"; currentClient = null; ui(); log("Następny klient"); await say("Podaj klienta"); return;
  }
  if (mode === "client") {
    let c = null; for (const a of alts) { c = findClient(a); if (c) break; }
    if (c) { currentClient = c; mode = "items"; ui(); log("Klient: " + c.name, "ok"); await say("OK"); }
    else { log("Brak klienta: „" + text + "”", "bad"); await say("Brak klienta"); }
    return;
  }
  // items mode
  let parsed = null;
  for (const a of alts) { const p = parseItems(a); if (p.res.length && (!parsed || p.res.length > parsed.res.length)) parsed = p; }
  if (!parsed) parsed = parseItems(text);
  if (!parsed.res.length) {
    // maybe the worker just said another client's name
    const c = findClient(text);
    if (c && !findItem(text)) { currentClient = c; ui(); log("Klient: " + c.name, "ok"); await say("OK"); return; }
    log("Nie rozpoznano asortymentu: „" + text + "”", "bad"); await say("Brak asortymentu"); return;
  }
  const said = [];
  if (!local.routeId) local.routeId = newId();
  for (const { item, qtys } of parsed.res) {
    const e = resolveQty(item, qtys);
    if (e.missing) { log(item.name + ": " + e.missing, "warn"); said.push(item.name + ", " + e.missing); continue; }
    const entry = { client: currentClient.name, item: item.name, ...e, t: Date.now() };
    local.route.push(entry);
    log(currentClient.name + ": " + item.name + " × " + fmtEntry(entry), "ok"); said.push(item.name + " " + sayEntry(entry));
  }
  for (const u of parsed.unknown) log("Nieznany asortyment: „" + u + "”", "bad");
  save(); ui();
  let speech = local.repeat ? said.join(", ") : "OK";
  if (parsed.unknown.length) speech += ". Brak asortymentu: " + parsed.unknown.join(", ");
  await say(speech);
}

// ---------- jednostki ----------
// "szt" (sztuki), "kg" (kilogramy) albo "szt_kg" (sztuki i kilogramy naraz).
// Wpis trasy: { unit, qty, kg } — qty to sztuki albo (dla "kg") kilogramy, kg tylko przy "szt_kg".
const unitOfItem = it => (it && (it.unit === "kg" || it.unit === "szt_kg")) ? it.unit : "szt";
const unitLabel = u => u === "kg" ? "kilogramach" : u === "szt_kg" ? "sztukach i kilogramach" : "sztukach";
const unitShort = u => u === "kg" ? "kg" : u === "szt_kg" ? "szt.+kg" : "szt.";
const fmtNum = q => Number(q).toLocaleString("pl-PL", { maximumFractionDigits: 2 });
const fmtQty = (q, unit) => fmtNum(q) + (unit === "kg" ? " kg" : " szt.");
const fmtEntry = v => v.unit === "szt_kg" ? fmtQty(v.qty, "szt") + " · " + fmtQty(v.kg, "kg") : fmtQty(v.qty, v.unit);
const sayEntry = v => v.unit === "szt_kg" ? fmtNum(v.qty) + " sztuk, " + fmtNum(v.kg) + " kilogramów" : fmtNum(v.qty) + (v.unit === "kg" ? " kilogramów" : "");
const r2 = x => Math.round(x * 100) / 100;
// liczby z wypowiedzi -> wpis; sztuki w całości, kilogramy z dokładnością do 0,01
function resolveQty(item, qtys) {
  const unit = unitOfItem(item);
  if (!qtys.length) return { missing: unit === "szt_kg" ? "podaj sztuki i kilogramy" : "podaj ilość" };
  if (unit === "szt_kg") {
    let pcs = qtys.find(q => q.unit === "szt"), kg = qtys.find(q => q.unit === "kg");
    const bare = qtys.filter(q => !q.unit);
    if (!pcs && bare.length) pcs = bare.shift();
    if (!kg && bare.length) kg = bare.shift();
    if (!pcs || !kg) return { missing: !pcs ? "podaj też liczbę sztuk" : "podaj też kilogramy" };
    const p = Math.round(pcs.n), k = r2(kg.n);
    if (!p || !k) return { missing: "podaj ilość" };
    return { unit, qty: p, kg: k };
  }
  const q = qtys.find(x => x.unit === unit) || qtys[0];
  const n = unit === "kg" ? r2(q.n) : Math.round(q.n);
  if (!n) return { missing: "podaj ilość" };
  return { unit, qty: n };
}

// ---------- summary & sending ----------
// dodaje wpis do sumy { unit, qty, kg } pod kluczem asortyment+jednostka
function addTo(map, label, r) {
  const unit = r.unit || "szt", key = label + "\u0000" + unit;
  const cur = map.get(key) || { label, unit, qty: 0, kg: 0, days: new Set() };
  cur.qty = r2(cur.qty + r.qty); cur.kg = r2(cur.kg + (r.kg || 0));
  if ("val" in r) { cur.val = r2((cur.val || 0) + (r.val ?? 0)); if (r.val == null) cur.miss = true; }
  if (r.date) cur.days.add(dk(r.date));
  map.set(key, cur);
}
// klient -> (asortyment+jednostka) -> { label, unit, qty, kg }
function grouped(route) {
  const m = new Map();
  for (const r of route) {
    if (!m.has(r.client)) m.set(r.client, new Map());
    addTo(m.get(r.client), r.item, r);
  }
  return m;
}
function summaryText(route) {
  let s = "";
  for (const [c, items] of grouped(route)) { s += c + "\n"; for (const v of items.values()) s += "  - " + v.label + ": " + fmtEntry(v) + "\n"; }
  return s;
}
// lista wpisów bieżącej trasy (panel po prawej): klient, a pod nim wpisy z przyciskiem usunięcia
function renderSummary() {
  if (!local.route.length) { $("#summary").innerHTML = "Brak wpisów."; return; }
  const byClient = new Map();
  local.route.forEach((r, i) => { if (!byClient.has(r.client)) byClient.set(r.client, []); byClient.get(r.client).push(i); });
  let h = "";
  for (const [c, idx] of byClient) {
    h += `<div class='rClient'>${esc(c)}</div>`;
    for (const i of idx) { const r = local.route[i]; h += `<div class='rRow'><span class='nm'>${esc(r.item)}</span><span class='q'>${fmtEntry(r)}</span><button data-del='${i}' aria-label='Usuń wpis' title='Usuń wpis'>✕</button></div>`; }
  }
  const pcs = local.route.reduce((a, r) => a + (r.unit === "kg" ? 0 : r.qty), 0);
  const kg = local.route.reduce((a, r) => a + (r.unit === "kg" ? r.qty : r.unit === "szt_kg" ? r.kg || 0 : 0), 0);
  h += `<div class='rTotal'>Klientów: <b>${byClient.size}</b> · wpisów: <b>${local.route.length}</b>${pcs ? " · " + fmtQty(r2(pcs), "szt") : ""}${kg ? " · " + fmtQty(r2(kg), "kg") : ""}</div>`;
  $("#summary").innerHTML = h;
  $("#summary").querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const r = local.route[+b.dataset.del]; if (!r) return;
    if (!confirm(`Usunąć z trasy: ${r.client} – ${r.item} ${fmtEntry(r)}?`)) return;
    local.route.splice(+b.dataset.del, 1); if (!local.route.length) local.routeId = null;
    save(); log("Usunięto: " + r.client + " – " + r.item + " " + fmtEntry(r), "warn"); ui();
  });
}
function renderBanner() {
  const b = $("#banner");
  if (noAccess) {
    b.innerHTML = `<div class="banner err">Twoje konto nie ma dostępu do trasy pralni. Poproś administratora o uprawnienie albo <a href="/">wróć do wyboru aplikacji</a>.</div>`;
    return;
  }
  if (loggedOut) {
    const waiting = local.pending.length ? " Niewysłane trasy czekają w telefonie i wyślą się po zalogowaniu." : "";
    b.innerHTML = `<div class="banner err">Sesja wygasła. <a href="/login?powrot=/pralnia">Zaloguj się ponownie</a>.${waiting}</div>`;
    return;
  }
  if (local.pending.length) {
    b.innerHTML = `<div class="banner err">${local.pending.length === 1 ? "1 trasa czeka" : local.pending.length + " trasy czekają"} na wysłanie (brak zasięgu lub błąd poczty). <button class="btn" id="retry">Wyślij teraz</button></div>`;
    $("#retry").onclick = () => flushPending(true);
    return;
  }
  b.innerHTML = "";
}
// send queued routes; returns true if everything went out
async function flushPending(verbose) {
  let ok = true;
  for (const p of [...local.pending]) {
    try {
      await api("trasy", { method: "POST", body: p });
      local.pending = local.pending.filter(x => x.id !== p.id); save();
      log("Wysłano podsumowanie trasy", "ok");
    } catch (e) {
      ok = false;
      if (e.status === 400) { local.pending = local.pending.filter(x => x.id !== p.id); save(); }
      if (verbose) log("Nie wysłano: " + e.message, "bad");
    }
  }
  renderBanner(); loadHistory();
  return ok;
}
// model telefonu (Chrome na Androidzie podaje go tylko przez userAgentData)
async function deviceHints() {
  try {
    const d = navigator.userAgentData;
    if (!d || !d.getHighEntropyValues) return undefined;
    const v = await d.getHighEntropyValues(["model", "platformVersion"]);
    return { model: v.model || undefined, platform: v.platform || undefined, platformVersion: v.platformVersion || undefined };
  } catch (e) { return undefined; }
}
async function finishRoute(spoken) {
  if (!local.route.length) { if (spoken) await say("Trasa jest pusta"); else alert("Trasa jest pusta."); return; }
  if (!spoken && !confirm("Zakończyć trasę i wysłać podsumowanie?")) return;
  stop();
  const device = await deviceHints();
  local.pending.push({ id: local.routeId || newId(), worker: local.worker, date: new Date().toISOString(), device, route: local.route.map(({ client, item, qty, unit, kg }) => ({ client, item, qty, unit: unit || "szt", ...(unit === "szt_kg" ? { kg } : {}) })) });
  local.route = []; local.routeId = null; mode = "client"; currentClient = null; save(); ui();
  const ok = await flushPending(true);
  const msg = ok ? "Koniec trasy. Podsumowanie wysłane." : "Koniec trasy. Nie udało się wysłać, spróbuję ponownie.";
  if (spoken) await say(msg, { thenListen: false }); else log(msg, ok ? "ok" : "bad");
}
// usunięcie całej trasy (np. testowej) — tylko administrator
async function deleteRoute(id, label) {
  const pass = prompt(`Usunąć całą trasę ${label}? Tego nie da się cofnąć.\nPodaj hasło usuwania:`);
  if (pass === null) return false;
  try { await api("trasy?id=" + encodeURIComponent(id), { method: "DELETE", headers: { "X-Haslo-Usuniecia": pass.trim() } }); }
  catch (e) { alert("Nie usunięto: " + e.message); return false; }
  loadHistory();
  if (document.querySelector("#grafik.on")) loadGrafik();
  return true;
}
async function loadHistory() {
  if (!local.canManage) return;
  const ul = $("#history");
  let list;
  try { list = await api("trasy"); } catch (e) { ul.innerHTML = `<li class='small'>Nie można pobrać: ${esc(e.message)}</li>`; return; }
  ul.innerHTML = list.length ? "" : "<li class='small'>Brak.</li>";
  for (const h of list) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${new Date(h.date).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })} · <b>${esc(h.worker || "—")}</b><br><span class='small'>${h.clients} klientów${h.total ? ", " + fmtQty(h.total, "szt") : ""}${h.totalKg ? ", " + fmtQty(h.totalKg, "kg") : ""} ${h.mailedAt ? "· mail wysłany" : "· <span class='bad'>mail niewysłany</span>"}</span></span><span class='row'><button class='btn' data-r>Wyślij ponownie</button>${local.isAdmin ? "<button class='btn del' data-x>Usuń</button>" : ""}</span>`;
    if (local.isAdmin) li.querySelector("[data-x]").onclick = () => deleteRoute(h.id, new Date(h.date).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" }) + " · " + (h.worker || "—"));
    li.querySelector("[data-r]").onclick = async () => {
      try { await api("trasy", { method: "POST", body: { id: h.id, resend: true } }); alert("Wysłano ponownie."); }
      catch (e) { alert(e.message); }
      loadHistory();
    };
    ul.append(li);
  }
}

// ---------- controls ----------
function start() {
  if (!SR) { alert("Ta przeglądarka nie obsługuje rozpoznawania mowy. Użyj Chrome na Androidzie lub Safari na iPhonie. Możesz też wpisywać tekst ręcznie."); return; }
  if (!rec) rec = setupRec();
  running = true; ui();
  say(mode === "client" ? "Podaj klienta" : "Podaj asortyment");
}
function stop() { running = false; try { rec && rec.abort(); } catch (e) {} ui(); }
$("#mic").onclick = () => running ? stop() : start();
$("#typedGo").onclick = () => { const v = $("#typed").value.trim(); if (v) { $("#typed").value = ""; handle(v); } };
$("#typed").onkeydown = e => { if (e.key === "Enter") $("#typedGo").click(); };
$("#sendNow").onclick = () => finishRoute(false);
$("#copySum").onclick = () => { navigator.clipboard?.writeText(summaryText(local.route)); log("Skopiowano podsumowanie"); };
$("#clearRoute").onclick = () => { if (confirm("Usunąć wszystkie wpisy bieżącej trasy?")) { local.route = []; local.routeId = null; mode = "client"; currentClient = null; save(); ui(); } };
$("#histRefresh").onclick = loadHistory;

document.querySelectorAll("nav button").forEach(b => b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("section").forEach(s => s.classList.toggle("on", s.id === b.dataset.tab));
  if (b.dataset.tab === "klienci" || b.dataset.tab === "asort") loadCatalog();
  if (b.dataset.tab === "grafik") loadGrafik();
  if (b.dataset.tab === "cennik") loadCennik();
});

// ---------- geolokalizacja klientów ----------
// Pracownik stojący u klienta zapisuje GPS telefonu jako miejsce dostawy (do planowania trasy kierowcy).
// Zapisać może każdy pracownik pralni; usunąć zapisaną lokalizację – tylko administrator.
const mapUrl = l => "https://www.google.com/maps/search/?api=1&query=" + l.lat + "," + l.lng;
const navUrl = l => "https://www.google.com/maps/dir/?api=1&destination=" + l.lat + "," + l.lng;
const geoBusy = new Set();
function locText(l) {
  const when = l.at ? new Date(l.at).toLocaleDateString("pl-PL") : "";
  return `📍 ${l.lat.toFixed(6)}, ${l.lng.toFixed(6)}${l.accuracy != null ? " · ±" + Math.round(l.accuracy) + " m" : ""}` +
    `<br>zapisano ${esc(when)}${l.by ? " · " + esc(l.by) : ""} · <a href="${mapUrl(l)}" target="_blank" rel="noopener">Mapa</a> · <a href="${navUrl(l)}" target="_blank" rel="noopener">Nawiguj</a>`;
}
function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Ten telefon albo przeglądarka nie udostępnia lokalizacji."));
    navigator.geolocation.getCurrentPosition(resolve, err => reject(new Error(
      err.code === 1 ? "Brak zgody na lokalizację. Zezwól tej stronie na dostęp do lokalizacji w ustawieniach przeglądarki i spróbuj ponownie." :
      err.code === 3 ? "Telefon nie ustalił położenia na czas. Wyjdź na zewnątrz albo włącz GPS i spróbuj ponownie." :
      "Nie udało się ustalić położenia. Sprawdź, czy lokalizacja (GPS) jest włączona.")),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
  });
}
async function captureLocation(clientId) {
  const c = cat().clients.find(x => x.id === clientId);
  if (!c || geoBusy.has(clientId)) return;
  if (c.location && !confirm(`„${c.name}” ma już zapisaną lokalizację. Zastąpić ją miejscem, w którym teraz jesteś?`)) return;
  geoBusy.add(clientId); renderClientGeo(); renderList("c");
  try {
    const pos = await currentPosition();
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    if (accuracy > 150 && !confirm(`Telefon podaje położenie z dokładnością tylko ±${Math.round(accuracy)} m. Zapisać mimo to?\n\nLepiej wyjść na zewnątrz, włączyć GPS i spróbować ponownie.`)) return;
    const d = await api("lokalizacja", { method: "PUT", body: { clientId, lat, lng, accuracy } });
    c.location = d.location; save();
    log("Zapisano lokalizację: " + c.name + (accuracy ? " (±" + Math.round(accuracy) + " m)" : ""), "ok");
  } catch (e) {
    alert("Nie zapisano lokalizacji: " + e.message);
    if (e.status === 404) await loadCatalog();
  } finally { geoBusy.delete(clientId); renderClientGeo(); renderList("c"); }
}
async function clearLocation(clientId) {
  const c = cat().clients.find(x => x.id === clientId);
  if (!c || !confirm(`Usunąć zapisaną lokalizację klienta „${c.name}”?`)) return;
  try { await api("lokalizacja?clientId=" + encodeURIComponent(clientId), { method: "DELETE" }); c.location = null; save(); }
  catch (e) { alert("Nie usunięto: " + e.message); }
  renderClientGeo(); renderList("c");
}
const geoButton = (id, has) => `<button class='btn' data-g ${geoBusy.has(id) ? "disabled" : ""}>${geoBusy.has(id) ? "⏳ Ustalam położenie…" : has ? "📍 Pobierz ponownie" : "📍 Pobierz dane geolokalizacji"}</button>`;
// w zakładce Trasa: lokalizacja klienta, którego właśnie podano
function renderClientGeo() {
  const box = $("#clientGeo");
  const c = currentClient && cat().clients.find(x => x.id === currentClient.id);
  box.hidden = !c;
  if (!c) { box.innerHTML = ""; return; }
  box.innerHTML = geoButton(c.id, !!c.location) + `<span class='small'>${c.location ? locText(c.location) : "Brak zapisanej lokalizacji."}</span>`;
  box.querySelector("[data-g]").onclick = () => captureLocation(c.id);
}

// shared catalog lists
const listKey = kind => kind === "c" ? "clients" : "items";
function renderList(kind) {
  const arr = cat()[listKey(kind)];
  const ul = $("#" + kind + "List"); ul.innerHTML = "";
  $("#" + kind + "Count").textContent = arr.length;
  [...arr].sort((a, b) => a.name.localeCompare(b.name, "pl")).forEach(x => {
    const li = document.createElement("li");
    const unitBtn = kind === "a" ? `<button class='btn' data-u title='Zmień jednostkę'>${unitShort(unitOfItem(x))}</button>` : "";
    const geo = kind === "c" ? `<br><span class='small'>📞 ${x.phones?.length ? x.phones.map(fmtPhone).map(esc).join(", ") : "brak telefonu"}</span><br><span class='small'>${x.location ? locText(x.location) : "📍 brak lokalizacji"}</span>` : "";
    const geoBtns = kind === "c" ? geoButton(x.id, !!x.location) + (x.location ? "<button class='btn del' data-gx>Usuń lokalizację</button>" : "") : "";
    li.innerHTML = `<span><b>${esc(x.name)}</b>${kind === "a" ? ` <span class='small'>· liczone w ${unitLabel(unitOfItem(x))}</span>` : ""}${x.aliases?.length ? `<br><span class='small'>${esc(x.aliases.join(", "))}</span>` : ""}${geo}</span><span class='row' style='justify-content:flex-end'>${geoBtns}${unitBtn}<button class='btn' data-e>Edytuj</button><button class='btn del' data-d>Usuń</button></span>`;
    const gb = li.querySelector("[data-g]"); if (gb) gb.onclick = () => captureLocation(x.id);
    const gx = li.querySelector("[data-gx]"); if (gx) gx.onclick = () => clearLocation(x.id);
    const ub = li.querySelector("[data-u]");
    if (ub) ub.onclick = () => {
      // szt. -> kg -> szt.+kg -> szt.
      const order = ["szt", "kg", "szt_kg"];
      const next = order[(order.indexOf(unitOfItem(x)) + 1) % order.length];
      if (confirm(`Liczyć „${x.name}” w ${unitLabel(next)}? Zapisane wcześniej trasy się nie zmienią.`))
        changeCatalog({ method: "PUT", body: { id: x.id, name: x.name, aliases: x.aliases || [], unit: next } });
    };
    li.querySelector("[data-d]").onclick = () => {
      if (confirm("Usunąć „" + x.name + "”?")) changeCatalog({ method: "DELETE", query: "?id=" + encodeURIComponent(x.id) });
    };
    li.querySelector("[data-e]").onclick = () => {
      const n = prompt("Nazwa:", x.name); if (n === null) return;
      const a = prompt("Inne nazwy (po przecinku):", (x.aliases || []).join(", ")); if (a === null) return;
      const body = { id: x.id, name: n.trim() || x.name, aliases: a.split(",").map(s => s.trim()).filter(Boolean) };
      if (kind === "c") {
        const ph = prompt("Telefony (po przecinku) – z nich klient wysyła SMS o odbiór prania:", (x.phones || []).map(fmtPhone).join(", ")); if (ph === null) return;
        body.phones = splitList(ph);
      }
      changeCatalog({ method: "PUT", body });
    };
    ul.append(li);
  });
}
function addFrom(kind) {
  const n = $("#" + kind + "Name").value.trim(); if (!n) return;
  const aliases = $("#" + kind + "Alias").value.split(",").map(s => s.trim()).filter(Boolean);
  const body = { kind: listKey(kind), name: n, aliases };
  if (kind === "a") body.unit = $("#aUnit").value;
  if (kind === "c") { body.phones = splitList($("#cPhone").value); $("#cPhone").value = ""; }
  changeCatalog({ method: "POST", body });
  $("#" + kind + "Name").value = ""; $("#" + kind + "Alias").value = "";
}
$("#cAdd").onclick = () => addFrom("c"); $("#aAdd").onclick = () => addFrom("a");

// settings
$("#sRepeat").checked = local.repeat !== false;
$("#sRepeat").onchange = e => { local.repeat = e.target.checked; save(); };

// ---------- grafik klientów (administrator) ----------
// Zwykły pracownik tylko zapisuje trasę. Kierownik pralni dodatkowo prowadzi klientów,
// asortyment, historię i grafik (bez cen). Cennik i wartości widzi tylko administrator.
function showAdmin() {
  $("#navGrafik").style.display = local.canManage ? "" : "none";
  document.querySelectorAll(".managerOnly").forEach(el => { el.style.display = local.canManage ? "" : "none"; });
  document.querySelectorAll(".adminOnly").forEach(el => { el.style.display = local.isAdmin ? "" : "none"; });
  const on = document.querySelector("nav button.on");
  if (on && on.style.display === "none") document.querySelector("nav button[data-tab=trasa]").click();
}
const dk = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const g = { year: new Date().getFullYear(), month: new Date().getMonth(), rows: [], client: "", selected: dk(new Date()) };

async function loadGrafik() {
  const from = new Date(g.year, g.month, 1), to = new Date(g.year, g.month + 1, 1);
  try { g.rows = await api(`grafik?od=${from.toISOString()}&do=${to.toISOString()}`); }
  catch (e) { $("#gNote").textContent = "Nie można pobrać grafiku: " + e.message; g.rows = []; }
  // ceny pobiera tylko administrator; kierownik pralni widzi same ilości
  if (local.isAdmin) { try { setPrices(await api("cennik")); } catch (e) { setPrices([]); } } else setPrices([]);
  for (const r of g.rows) r.val = rowValue(r);
  const names = new Set([...cat().clients.map(c => c.name), ...g.rows.map(r => r.client)]);
  const list = [...names].sort((a, b) => a.localeCompare(b, "pl"));
  // "*" = wszyscy klienci razem
  if (!g.client || (g.client !== "*" && !names.has(g.client))) g.client = list.find(n => g.rows.some(r => r.client === n)) || list[0] || "*";
  $("#gClient").innerHTML = `<option value="*">— Wszyscy klienci —</option>` + list.map(n => {
    const has = g.rows.some(r => r.client === n);
    return `<option value="${esc(n)}">${esc(n)}${has ? "" : " (brak dostaw w tym miesiącu)"}</option>`;
  }).join("");
  $("#gClient").value = g.client;
  renderGrafik();
}
// asortyment -> { label, unit, qty, kg, days }, z rozróżnieniem jednostek
function sumItems(rows) {
  const m = new Map();
  for (const r of rows) addTo(m, r.item, r);
  return [...m.values()];
}
function renderGrafik() {
  $("#gMonth").textContent = new Date(g.year, g.month, 1).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  const rows = g.client === "*" ? g.rows : g.rows.filter(r => r.client === g.client);
  const byDay = {};
  for (const r of rows) (byDay[dk(r.date)] ||= []).push(r);
  const lead = (new Date(g.year, g.month, 1).getDay() + 6) % 7;
  const days = new Date(g.year, g.month + 1, 0).getDate();
  const today = dk(new Date());
  let html = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"].map(d => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < lead; i++) html += `<div class="day out"></div>`;
  for (let d = 1; d <= days; d++) {
    const key = dk(new Date(g.year, g.month, d));
    const items = sumItems(byDay[key] || []);
    const shown = items.slice(0, 3).map(i => `<span class="it">${esc(i.label)} ${fmtEntry(i)}</span>`).join("");
    html += `<button class="day${items.length ? " has" : ""}${key === today ? " today" : ""}${key === g.selected ? " sel" : ""}" data-day="${key}">
      <span class="d">${d}</span>${shown}${items.length > 3 ? `<span class="more">+${items.length - 3} więcej</span>` : ""}${items.length ? `<span class="dot">●</span>` : ""}</button>`;
  }
  $("#gCal").innerHTML = html;
  $("#gCal").querySelectorAll("[data-day]").forEach(b => b.onclick = () => {
    g.selected = b.dataset.day;
    $("#gCal").querySelectorAll(".day.sel").forEach(x => x.classList.remove("sel")); b.classList.add("sel");
    renderGDay(byDay); openDay();
  });
  g.byDay = byDay;
  renderGClientSum(rows); renderGAll();
}
function renderGDay(byDay) {
  const [y, m, d] = g.selected.split("-").map(Number);
  const inMonth = y === g.year && m - 1 === g.month;
  $("#gDayTitle").textContent = (g.client === "*" ? "Wszyscy klienci" : g.client) + " · " + new Date(y, m - 1, d).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  const rows = inMonth ? (byDay[g.selected] || []) : [];
  if (!rows.length) { $("#gDay").innerHTML = "<p class='small'>Tego dnia nic nie zawieziono" + (g.client === "*" ? "." : " do tego klienta.") + "</p>"; return; }
  if (g.client === "*") {
    // wszyscy klienci: według asortymentu, pod spodem klienci
    // lista tras tego dnia (do usunięcia testowych)
    const seen = new Map();
    for (const r of rows) if (!seen.has(r.routeId)) seen.set(r.routeId, r);
    let t = "<h2 style='margin-top:16px'>Trasy tego dnia</h2><table>";
    for (const r of seen.values()) {
      const when = new Date(r.date).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      t += `<tr><td class='small'>Trasa ${when} · ${esc(r.worker || "—")}</td><td class='n'><button class='btn del' data-route="${esc(r.routeId)}" data-label="${esc(dk(r.date) + " " + when + " · " + (r.worker || "—"))}">Usuń trasę</button></td></tr>`;
    }
    $("#gDay").innerHTML = itemTable(rows, "Asortyment / klient") + t + "</table>"; wireDayDelete(); return;
  }
  // kolejne trasy tego dnia osobno (godzina i pracownik), potem suma dnia
  const routes = new Map();
  for (const r of rows) { if (!routes.has(r.routeId)) routes.set(r.routeId, { id: r.routeId, date: r.date, worker: r.worker, rows: [] }); routes.get(r.routeId).rows.push(r); }
  let h = "<table><tr><th>Asortyment</th><th class='n'>Ilość</th></tr>";
  for (const rt of routes.values()) {
    const when = new Date(rt.date).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    h += `<tr><td class='small'>Trasa ${when} · ${esc(rt.worker || "—")}</td><td class='n'><button class='btn del' data-route="${esc(rt.id)}" data-label="${esc(dk(rt.date) + " " + when + " · " + (rt.worker || "—"))}" title='Usuwa całą trasę, także u innych klientów'>Usuń trasę</button></td></tr>`;
    for (const i of sumItems(rt.rows)) h += `<tr><td>${esc(i.label)}</td><td class='n'>${fmtEntry(i)}</td></tr>`;
  }
  if (routes.size > 1) {
    h += "<tr><th colspan=2>Razem w dniu</th></tr>";
    for (const i of sumItems(rows)) h += `<tr><td>${esc(i.label)}</td><td class='n'><b>${fmtEntry(i)}</b></td></tr>`;
  }
  $("#gDay").innerHTML = h + "</table>";
  wireDayDelete();
}
// przyciski „Usuń trasę” w oknie dnia
function wireDayDelete() {
  // usuwanie tras tylko dla administratora
  if (!local.isAdmin) { $("#gDay").querySelectorAll("[data-route]").forEach(b => b.remove()); return; }
  $("#gDay").querySelectorAll("[data-route]").forEach(b => b.onclick = async () => {
    if (await deleteRoute(b.dataset.route, b.dataset.label)) $("#gDialog").close?.();
  });
}
function renderGClientSum(rows) {
  $("#gClientSumTitle").textContent = "Razem w miesiącu" + (g.client === "*" ? " – wszyscy klienci" : ": " + g.client);
  const items = sumItems(rows).sort((a, b) => a.label.localeCompare(b.label, "pl"));
  if (!items.length) { $("#gClientSum").innerHTML = "<p class='small'>Brak dostaw w tym miesiącu.</p>"; return; }
  const deliveryDays = new Set(rows.map(r => dk(r.date))).size;
  const head = `<p class='small' style='margin:0 0 6px'>Dni z dostawą: <b>${deliveryDays}</b></p><table><tr><th>Asortyment</th><th class='n'>Dni</th><th class='n'>Razem</th>`;
  if (!local.isAdmin) {
    $("#gClientSum").innerHTML = head + "</tr>" +
      items.map(i => `<tr><td>${esc(i.label)}</td><td class='n'>${i.days.size}</td><td class='n'><b>${fmtEntry(i)}</b></td></tr>`).join("") + "</table>";
    return;
  }
  const total = valueSum(rows);
  $("#gClientSum").innerHTML = head + "<th class='n'>Wartość</th></tr>" +
    items.map(i => `<tr><td>${esc(i.label)}</td><td class='n'>${i.days.size}</td><td class='n'><b>${fmtEntry(i)}</b></td><td class='n'>${fmtVal(i)}</td></tr>`).join("") +
    `<tr><th colspan=3>Do zapłaty w miesiącu</th><th class='n'>${fmtVal(total)}</th></tr></table>` + missNote(total);
}
// asortyment -> razem + rozbicie na klientów (posortowane po nazwie)
function itemRows(rows) {
  const byItem = new Map();
  for (const r of rows) { if (!byItem.has(r.item)) byItem.set(r.item, []); byItem.get(r.item).push(r); }
  return [...byItem.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl")).map(([item, list]) => {
    const byClient = new Map();
    for (const r of list) { if (!byClient.has(r.client)) byClient.set(r.client, []); byClient.get(r.client).push(r); }
    return {
      item, total: sumItems(list),
      clients: [...byClient.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl")).map(([client, cr]) => ({ client, entries: sumItems(cr) })),
    };
  });
}
const fmtAll = list => list.map(fmtEntry).join(" + ");
const sumVal = list => ({ val: r2(list.reduce((a, i) => a + (i.val || 0), 0)), miss: list.some(i => i.miss) });
// tabela: asortyment (pogrubiona suma), pod spodem klienci
function itemTable(rows, head) {
  if (!local.isAdmin) {
    let h = `<table><tr><th>${head}</th><th class='n'>Razem</th></tr>`;
    for (const it of itemRows(rows)) {
      h += `<tr><td><b>${esc(it.item)}</b></td><td class='n'><b>${fmtAll(it.total)}</b></td></tr>`;
      for (const c of it.clients) h += `<tr><td class='small'>&nbsp;&nbsp;${esc(c.client)}</td><td class='n small'>${fmtAll(c.entries)}</td></tr>`;
    }
    return h + "</table>";
  }
  let h = `<table><tr><th>${head}</th><th class='n'>Razem</th><th class='n'>Wartość</th></tr>`;
  for (const it of itemRows(rows)) {
    h += `<tr><td><b>${esc(it.item)}</b></td><td class='n'><b>${fmtAll(it.total)}</b></td><td class='n'><b>${fmtVal(sumVal(it.total))}</b></td></tr>`;
    for (const c of it.clients) h += `<tr><td class='small'>&nbsp;&nbsp;${esc(c.client)}</td><td class='n small'>${fmtAll(c.entries)}</td><td class='n small'>${fmtVal(sumVal(c.entries))}</td></tr>`;
  }
  const total = valueSum(rows);
  return h + `<tr><th colspan=2>Razem wartość</th><th class='n'>${fmtVal(total)}</th></tr></table>` + missNote(total);
}
function renderGAll() {
  if (!g.rows.length) { $("#gAll").innerHTML = "<p class='small'>Brak tras w tym miesiącu.</p>"; return; }
  // wartość prania każdego klienta w miesiącu (do faktury)
  if (!local.isAdmin) { $("#gAll").innerHTML = itemTable(g.rows, "Asortyment / klient"); return; }
  const byClient = new Map();
  for (const r of g.rows) { if (!byClient.has(r.client)) byClient.set(r.client, []); byClient.get(r.client).push(r); }
  let h = "<h2 style='margin-top:18px'>Do zapłaty według klientów</h2><table><tr><th>Klient</th><th class='n'>Wartość</th></tr>";
  for (const [c, list] of [...byClient.entries()].sort((a, b) => a[0].localeCompare(b[0], "pl"))) {
    const v = valueSum(list);
    h += `<tr><td>${esc(c)}${v.miss ? " <span class='warn small'>(brak części cen)</span>" : ""}</td><td class='n'><b>${fmtVal(v)}</b></td></tr>`;
  }
  $("#gAll").innerHTML = itemTable(g.rows, "Asortyment / klient") + h + "</table>";
}
$("#gCsv").onclick = () => {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const num = v => v === "" ? "" : String(v).replace(".", ",");
  // bez cen dla kierownika pralni
  const money = local.isAdmin;
  const lines = [["Asortyment", "Klient", "Sztuki", "Kilogramy", "Dni z dostawą", ...(money ? ["Cena zł/szt", "Cena zł/kg", "Wartość zł"] : [])].map(q).join(";")];
  const row = (item, client, i) => {
    const pcs = i.unit === "kg" ? "" : i.qty, kg = i.unit === "kg" ? i.qty : i.unit === "szt_kg" ? i.kg : "";
    const p = client === "RAZEM" ? {} : priceOf(client, item);
    const cell = v => v == null ? "" : num(v);
    lines.push([item, client, num(pcs), num(kg), i.days.size, ...(money ? [cell(i.unit !== "kg" ? p.szt : null), cell(i.unit !== "szt" ? p.kg : null), i.miss ? "" : num(i.val ?? "")] : [])].map(q).join(";"));
  };
  for (const it of itemRows(g.rows)) {
    for (const c of it.clients) for (const i of c.entries) row(it.item, c.client, i);
    for (const i of it.total) row(it.item, "RAZEM", i);
  }
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `pralnia-${g.year}-${String(g.month + 1).padStart(2, "0")}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$("#gClient").onchange = e => { g.client = e.target.value; renderGrafik(); };
function openDay() {
  const dlg = $("#gDialog");
  if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
}
$("#gDialogClose").onclick = () => { const dlg = $("#gDialog"); dlg.close ? dlg.close() : dlg.removeAttribute("open"); };
// kliknięcie w tło zamyka okno
$("#gDialog").addEventListener("click", e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
// ---------- cennik (administrator) ----------
// cena = klient + asortyment -> { szt: zł/szt, kg: zł/kg }; liczone według aktualnych cen
let prices = new Map(), priceList = [];
const pk = (client, item) => client + "\u0000" + item;
function setPrices(list) { priceList = list || []; prices = new Map(priceList.map(p => [pk(p.client, p.item), p])); }
const priceOf = (client, item) => prices.get(pk(client, item)) || {};
// wartość jednego wiersza trasy albo null, gdy brak potrzebnej ceny
function rowValue(r) {
  const p = priceOf(r.client, r.item);
  if (r.unit === "kg") return p.kg == null ? null : r2(r.qty * p.kg);
  if (r.unit === "szt_kg") {
    if (p.szt == null && p.kg == null) return null;
    return r2(r.qty * (p.szt || 0) + (r.kg || 0) * (p.kg || 0));
  }
  return p.szt == null ? null : r2(r.qty * p.szt);
}
const valueSum = rows => ({ val: r2(rows.reduce((a, r) => a + (r.val ?? 0), 0)), miss: rows.some(r => r.val == null) });
const zl = v => v.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
const fmtVal = x => x.miss && !x.val ? "<span class='warn'>brak ceny</span>" : zl(x.val || 0) + (x.miss ? " <span class='warn'>*</span>" : "");
const missNote = t => t.miss ? "<p class='small warn' style='margin:6px 0 0'>* Części asortymentu nie ma w cenniku, więc nie jest wliczona. Uzupełnij ją w zakładce Cennik.</p>" : "";

const pc = { client: "" };
async function loadCennik() {
  await loadCatalog();
  try { setPrices(await api("cennik")); }
  catch (e) { $("#pNote").textContent = "Nie można pobrać cennika: " + e.message; }
  const clients = [...cat().clients].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  if (!clients.some(c => c.id === pc.client)) pc.client = clients[0]?.id || "";
  const opts = clients.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  $("#pClient").innerHTML = opts || "<option value=''>— najpierw dodaj klientów —</option>";
  $("#pClient").value = pc.client;
  $("#pCopyFrom").innerHTML = "<option value=''>Skopiuj ceny od klienta…</option>" + clients.filter(c => c.id !== pc.client).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  renderCennik();
}
function renderCennik() {
  const items = [...cat().items].sort((a, b) => a.name.localeCompare(b.name, "pl"));
  if (!pc.client || !items.length) { $("#pList").innerHTML = "<p class='small'>Dodaj klientów i asortyment, żeby ustalić ceny.</p>"; return; }
  const byId = new Map(priceList.filter(p => p.clientId === pc.client).map(p => [p.itemId, p]));
  const inp = (it, f, v) => `<input type="text" inputmode="decimal" data-item="${esc(it.id)}" data-f="${f}" value="${v == null ? "" : String(v).replace(".", ",")}" placeholder="—" style="width:96px;text-align:right">`;
  let h = "<table><tr><th>Asortyment</th><th class='n'>zł / szt.</th><th class='n'>zł / kg</th></tr>";
  for (const it of items) {
    const u = unitOfItem(it), p = byId.get(it.id) || {};
    h += `<tr><td>${esc(it.name)} <span class='small'>· ${unitShort(u)}</span></td>` +
      `<td class='n'>${u !== "kg" ? inp(it, "szt", p.szt) : ""}</td><td class='n'>${u !== "szt" ? inp(it, "kg", p.kg) : ""}</td></tr>`;
  }
  $("#pList").innerHTML = h + "</table>";
  $("#pList").querySelectorAll("input").forEach(el => el.onchange = () => savePrice(el.dataset.item));
}
const parsePrice = v => { v = v.trim().replace(/\s|zł/g, "").replace(",", "."); if (!v) return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : NaN; };
async function savePrice(itemId) {
  const get = f => { const el = $("#pList").querySelector(`input[data-item="${CSS.escape(itemId)}"][data-f="${f}"]`); return el ? parsePrice(el.value) : null; };
  const body = { clientId: pc.client, itemId, szt: get("szt"), kg: get("kg") };
  if (Number.isNaN(body.szt) || Number.isNaN(body.kg)) { $("#pNote").textContent = "Wpisz cenę jako liczbę, np. 3,50."; return; }
  try {
    await api("cennik", { method: "PUT", body });
    setPrices([...priceList.filter(p => !(p.clientId === pc.client && p.itemId === itemId)),
      ...(body.szt == null && body.kg == null ? [] : [{ ...body, client: cat().clients.find(c => c.id === pc.client)?.name, item: cat().items.find(i => i.id === itemId)?.name }])]);
    $("#pNote").textContent = "Zapisano.";
  } catch (e) { $("#pNote").textContent = "Nie zapisano: " + e.message; }
}
$("#pClient").onchange = e => { pc.client = e.target.value; loadCennik(); };
$("#pCopyFrom").onchange = async e => {
  const from = e.target.value; e.target.value = ""; if (!from) return;
  const src = priceList.filter(p => p.clientId === from);
  const fromName = cat().clients.find(c => c.id === from)?.name;
  if (!src.length) { $("#pNote").textContent = `„${fromName}” nie ma jeszcze cen.`; return; }
  if (!confirm(`Skopiować ${src.length} cen od „${fromName}”? Ceny tego klienta dla tych pozycji zostaną zastąpione.`)) return;
  let ok = 0;
  for (const p of src) { try { await api("cennik", { method: "PUT", body: { clientId: pc.client, itemId: p.itemId, szt: p.szt, kg: p.kg } }); ok++; } catch (err) {} }
  $("#pNote").textContent = `Skopiowano ${ok} z ${src.length} cen.`;
  loadCennik();
};

$("#gPrev").onclick = () => { g.month--; if (g.month < 0) { g.month = 11; g.year--; } g.selected = dk(new Date(g.year, g.month, 1)); loadGrafik(); };
$("#gNext").onclick = () => { g.month++; if (g.month > 11) { g.month = 0; g.year++; } g.selected = dk(new Date(g.year, g.month, 1)); loadGrafik(); };
showAdmin();

// ---------- do odebrania (zgłoszenia odbioru prania) ----------
// SMS od klienta trafia przez bramkę SMS na serwer; zgłoszenie można też dodać ręcznie (np. po telefonie).
// Kierowca jedzie, odbiera pranie i odhacza „Odebrane”. Lista odświeża się co minutę.
const splitList = v => String(v).split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
const fmtPhone = p => { const m = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(p || ""); return m ? `+48 ${m[1]} ${m[2]} ${m[3]}` : (p || ""); };
const pick = { list: [], seen: null };
function whenText(iso) {
  const d = new Date(iso), now = new Date();
  const t = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  if (dk(d) === dk(now)) return "dziś " + t;
  if (dk(d) === dk(new Date(now - 864e5))) return "wczoraj " + t;
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" }) + " " + t;
}
async function loadPickups() {
  try { pick.list = await api("odbiory"); } catch (e) { return; }
  const open = new Set(pick.list.filter(p => !p.doneAt).map(p => p.id));
  const fresh = pick.seen ? [...open].filter(id => !pick.seen.has(id)) : [];
  pick.seen = open;
  renderPickups(new Set(fresh));
  if (fresh.length) log("Nowe zgłoszenie odbioru prania (" + fresh.length + ")", "warn");
}
function renderPickups(fresh = new Set()) {
  const open = pick.list.filter(p => !p.doneAt), done = pick.list.filter(p => p.doneAt).reverse();
  $("#pkCount").textContent = open.length ? "(" + open.length + ")" : "";
  const row = p => {
    const c = p.clientId && cat().clients.find(x => x.id === p.clientId);
    const phone = p.phone || c?.phones?.[0];
    const who = p.client || (p.phone ? "Nieznany numer " + fmtPhone(p.phone) : "—");
    const meta = whenText(p.createdAt) + (p.source === "sms" ? " · SMS" + (p.phone && p.client ? " z " + fmtPhone(p.phone) : "") : p.createdBy ? " · dodał(a) " + p.createdBy : "") +
      (p.doneAt ? " · odebrane " + whenText(p.doneAt) + (p.doneBy ? " (" + p.doneBy + ")" : "") : "");
    const acts = p.doneAt
      ? `<button class='btn' data-undo>Cofnij</button>`
      : (c?.location ? `<a class='btn' href='${navUrl(c.location)}' target='_blank' rel='noopener'>🧭 Nawiguj</a>` : "") +
        (phone ? `<a class='btn' href='tel:${esc(phone)}'>📞 Zadzwoń</a>` : "") +
        (c ? `<button class='btn' data-pick>Wpisz pranie</button>` : `<select data-assign><option value=''>Przypisz do klienta…</option>${[...cat().clients].sort((a, b) => a.name.localeCompare(b.name, "pl")).map(x => `<option value='${esc(x.id)}'>${esc(x.name)}</option>`).join("")}</select>`) +
        `<button class='btn ok' data-done>✓ Odebrane</button>`;
    return `<div class='pk${p.doneAt ? " done" : ""}${fresh.has(p.id) ? " new" : ""}' data-id='${esc(p.id)}'><div class='who'><b>${esc(who)}</b><div class='small'>${esc(meta)}</div>${p.message ? `<div class='msg'>„${esc(p.message)}”</div>` : ""}</div><div class='acts'>${acts}${local.isAdmin ? "<button class='btn del' data-x title='Usuń zgłoszenie'>✕</button>" : ""}</div></div>`;
  };
  $("#pkList").innerHTML = open.length ? open.map(row).join("") : "<div class='pkEmpty'>Brak zgłoszeń do odebrania.</div>";
  $("#pkDoneBox").hidden = !done.length; $("#pkDoneCount").textContent = done.length;
  $("#pkDone").innerHTML = done.map(row).join("");
  document.querySelectorAll("#pickups .pk").forEach(el => {
    const p = pick.list.find(x => x.id === el.dataset.id); if (!p) return;
    const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.onclick = fn; };
    on("[data-done]", () => patchPickup(p, { done: true }));
    on("[data-undo]", () => patchPickup(p, { done: false }));
    on("[data-pick]", () => { const c = cat().clients.find(x => x.id === p.clientId); if (c) pickClient(c); });
    on("[data-x]", async () => { if (!confirm("Usunąć to zgłoszenie?")) return; try { await api("odbiory?id=" + encodeURIComponent(p.id), { method: "DELETE" }); } catch (e) { alert(e.message); } loadPickups(); });
    const sel = el.querySelector("[data-assign]");
    if (sel) sel.onchange = async () => {
      const c = cat().clients.find(x => x.id === sel.value); if (!c) return;
      await patchPickup(p, { done: false, clientId: c.id });
      // administrator może od razu zapamiętać numer u klienta, żeby kolejne SMS-y rozpoznawały się same
      if (local.canManage && p.phone && !(c.phones || []).includes(p.phone) && confirm(`Zapisać numer ${fmtPhone(p.phone)} u klienta „${c.name}”?`))
        await changeCatalog({ method: "PUT", body: { id: c.id, name: c.name, aliases: c.aliases || [], phones: [...(c.phones || []), p.phone] } });
    };
  });
}
async function patchPickup(p, body) {
  try { await api("odbiory", { method: "PATCH", body: { id: p.id, ...body } }); }
  catch (e) { alert("Nie zapisano: " + e.message); }
  await loadPickups();
}
function fillPickupClients() {
  $("#pkClient").innerHTML = "<option value=''>Wybierz klienta…</option>" + [...cat().clients].sort((a, b) => a.name.localeCompare(b.name, "pl")).map(c => `<option value='${esc(c.id)}'>${esc(c.name)}</option>`).join("");
}
$("#pkAddOpen").onclick = () => { fillPickupClients(); $("#pkAdd").hidden = false; };
$("#pkAddCancel").onclick = () => { $("#pkAdd").hidden = true; };
$("#pkAddGo").onclick = async () => {
  const clientId = $("#pkClient").value; if (!clientId) { alert("Wybierz klienta."); return; }
  try { await api("odbiory", { method: "POST", body: { clientId, message: $("#pkMsg").value.trim() || undefined } }); }
  catch (e) { alert("Nie dodano: " + e.message); return; }
  $("#pkMsg").value = ""; $("#pkAdd").hidden = true; loadPickups();
};
setInterval(() => { if (document.visibilityState === "visible") loadPickups(); }, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadPickups(); });

// ---------- wybór dotykiem ----------
// Klient (przyciski od najczęściej obsługiwanych, filtr literą) -> asortyment klienta -> ilość / kg.
// Działa razem z głosem: oba sposoby zmieniają tego samego bieżącego klienta i tę samą trasę.
const ABC = "A B C Ć D E F G H I J K L Ł M N O Ó P R S Ś T U V W Z Ź Ż".split(" ");
const touch = { letter: "", allItems: false };
const firstLetter = name => { const ch = String(name).trim().charAt(0).toLocaleUpperCase("pl"); return /\p{L}/u.test(ch) ? ch : "#"; };
const byUse = (a, b, k) => (b[k] || 0) - (a[k] || 0) || a.name.localeCompare(b.name, "pl");
function pickClient(c) {
  currentClient = c; mode = "items"; touch.allItems = false;
  log("Klient: " + c.name, "ok"); ui(); window.scrollTo({ top: 0, behavior: "smooth" });
}
function renderTouch() {
  const c = currentClient && cat().clients.find(x => x.id === currentClient.id || x.name === currentClient.name);
  $("#tClientStep").hidden = !!c; $("#tItemStep").hidden = !c;
  if (c) renderTouchItems(c); else renderTouchClients();
}
function renderTouchClients() {
  const clients = [...cat().clients].sort((a, b) => byUse(a, b, "visits"));
  const letters = new Set(clients.map(c => firstLetter(c.name)));
  if (touch.letter && !letters.has(touch.letter)) touch.letter = "";
  const keys = [...ABC, ...[...letters].filter(l => !ABC.includes(l)).sort((a, b) => a.localeCompare(b, "pl"))];
  $("#tAbc").innerHTML = `<button data-l="" class="${touch.letter ? "" : "on"}" style="padding:0 16px">Wszyscy</button>` +
    keys.map(l => `<button data-l="${esc(l)}" class="${touch.letter === l ? "on" : ""}" ${letters.has(l) ? "" : "disabled"}>${esc(l)}</button>`).join("");
  $("#tAbc").querySelectorAll("button").forEach(b => b.onclick = () => { touch.letter = b.dataset.l; renderTouchClients(); });
  const list = touch.letter ? clients.filter(c => firstLetter(c.name) === touch.letter) : clients;
  const box = $("#tClients"); box.innerHTML = "";
  if (!list.length) { box.innerHTML = `<div class='empty'>${cat().clients.length ? "Brak klientów na tę literę." : "Brak klientów. Administrator dodaje ich w zakładce Klienci."}</div>`; return; }
  const inRoute = new Set(local.route.map(r => r.client));
  for (const c of list) {
    const b = document.createElement("button");
    b.className = "tile" + (inRoute.has(c.name) ? " done" : "");
    b.innerHTML = `<span>${esc(c.name)}</span>` + (inRoute.has(c.name) ? `<span class='got'>✓ już w tej trasie</span>` : c.visits ? `<span class='sub'>${c.visits} ${c.visits === 1 ? "trasa" : c.visits % 10 >= 2 && c.visits % 10 <= 4 && (c.visits % 100 < 12 || c.visits % 100 > 14) ? "trasy" : "tras"}</span>` : "");
    b.onclick = () => pickClient(c);
    box.append(b);
  }
}
function renderTouchItems(c) {
  $("#tClientName").textContent = c.name;
  const all = [...cat().items].sort((a, b) => byUse(a, b, "uses"));
  const own = (c.items || []).map(id => cat().items.find(i => i.id === id)).filter(Boolean);
  const showAll = touch.allItems || !own.length;
  const list = showAll ? [...own, ...all.filter(i => !own.includes(i))] : own;
  const more = all.length - own.length;
  $("#tAllItems").hidden = !own.length || !more;
  $("#tAllItems").textContent = touch.allItems ? "Pokaż tylko asortyment tego klienta" : `Pokaż cały asortyment (+${more})`;
  // co już jest w trasie u tego klienta
  const got = new Map();
  for (const r of local.route) if (r.client === c.name) addTo(got, r.item, r);
  const box = $("#tItems"); box.innerHTML = "";
  if (!list.length) { box.innerHTML = "<div class='empty'>Brak asortymentu. Administrator dodaje go w zakładce Asortyment.</div>"; return; }
  for (const it of list) {
    const u = unitOfItem(it);
    const done = [...got.values()].find(v => v.label === it.name);
    const b = document.createElement("button");
    b.className = "tile" + (done ? " done" : "");
    b.innerHTML = `<span>${esc(it.name)}</span><span class='sub'>${u === "kg" ? "kilogramy" : u === "szt_kg" ? "sztuki + kilogramy" : "sztuki"}</span>` + (done ? `<span class='got'>✓ ${fmtEntry(done)}</span>` : "");
    b.onclick = () => openQty(c, it);
    box.append(b);
  }
}
$("#tBack").onclick = () => { mode = "client"; currentClient = null; log("Następny klient"); ui(); };
$("#tAllItems").onclick = () => { touch.allItems = !touch.allItems; renderTouch(); };

// okno ilości: duża klawiatura numeryczna; dla „szt.+kg” dwa pola
const q = { client: null, item: null, fields: [], active: "" };
const FIELD = { szt: "Sztuki", kg: "Kilogramy" };
function openQty(c, it) {
  const u = unitOfItem(it);
  Object.assign(q, { client: c, item: it, fields: u === "szt_kg" ? ["szt", "kg"] : [u], active: u === "kg" ? "kg" : "szt" });
  $("#qClient").textContent = c.name;
  $("#qTitle").textContent = it.name;
  $("#qErr").textContent = "";
  $("#qFields").innerHTML = q.fields.map(f => `<div class='qField' data-f='${f}'><label for='q_${f}'>${FIELD[f]}</label><input id='q_${f}' inputmode='none' autocomplete='off' placeholder='0'></div>`).join("");
  $("#qFields").querySelectorAll(".qField").forEach(el => {
    const f = el.dataset.f, inp = el.querySelector("input");
    el.onclick = () => { q.active = f; markQ(); };
    inp.onfocus = () => { q.active = f; markQ(); };
    inp.oninput = () => { inp.value = cleanNum(inp.value, f); $("#qErr").textContent = ""; };
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); qNextOrAdd(); } };
  });
  markQ();
  $("#qDialog").showModal();
  qInput(q.active).focus(); // inputmode=none: bez klawiatury ekranowej systemu, ale działa zwykła klawiatura
}
// sztuki tylko całe, kilogramy z przecinkiem (najwyżej 2 miejsca)
function cleanNum(v, f) {
  v = String(v).replace(/\./g, ",").replace(f === "kg" ? /[^0-9,]/g : /[^0-9]/g, "");
  const i = v.indexOf(",");
  if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/,/g, "").slice(0, 2);
  return v.replace(/^0+(?=\d)/, "").slice(0, 8);
}
function markQ() {
  $("#qFields").querySelectorAll(".qField").forEach(el => el.classList.toggle("on", el.dataset.f === q.active));
  $("#qPad").querySelector("[data-k=',']").disabled = q.active !== "kg";
}
const qInput = f => $("#q_" + f);
$("#qPad").innerHTML = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", "⌫"].map(k => `<button type='button' data-k='${k}'>${k}</button>`).join("");
$("#qPad").querySelectorAll("button").forEach(b => b.onclick = () => {
  const inp = qInput(q.active); if (!inp) return;
  inp.value = b.dataset.k === "⌫" ? inp.value.slice(0, -1) : cleanNum(inp.value + b.dataset.k, q.active);
  $("#qErr").textContent = "";
});
function qNextOrAdd() {
  const i = q.fields.indexOf(q.active);
  if (i < q.fields.length - 1 && !qInput(q.fields[i + 1]).value) { q.active = q.fields[i + 1]; markQ(); qInput(q.active).focus(); return; }
  addFromQty();
}
function addFromQty() {
  const val = f => { const v = qInput(f)?.value || ""; return v ? Number(v.replace(",", ".")) : 0; };
  const u = unitOfItem(q.item);
  const pcs = Math.round(val("szt")), kg = r2(val("kg"));
  let e;
  if (u === "szt_kg") {
    if (!pcs || !kg) { $("#qErr").textContent = !pcs ? "Podaj liczbę sztuk." : "Podaj kilogramy."; q.active = !pcs ? "szt" : "kg"; markQ(); return; }
    e = { unit: u, qty: pcs, kg };
  } else {
    const n = u === "kg" ? kg : pcs;
    if (!n) { $("#qErr").textContent = u === "kg" ? "Podaj kilogramy." : "Podaj liczbę sztuk."; return; }
    e = { unit: u, qty: n };
  }
  if (!local.routeId) local.routeId = newId();
  const entry = { client: q.client.name, item: q.item.name, ...e, t: Date.now() };
  local.route.push(entry); save();
  log(q.client.name + ": " + q.item.name + " × " + fmtEntry(entry), "ok");
  $("#qDialog").close(); ui();
}
$("#qOk").onclick = addFromQty;
$("#qCancel").onclick = $("#qClose").onclick = () => $("#qDialog").close();

window.addEventListener("online", () => flushPending(false));
renderList("c"); renderList("a"); ui();
loadCatalog().then(ok => { if (ok) flushPending(false); loadHistory(); loadPickups(); });
window.__pralnia = { handle, parseItems, findClient, local };
