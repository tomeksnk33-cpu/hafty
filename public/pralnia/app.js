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
  if (!r.ok) { const err = new Error(data.error || "Błąd serwera " + r.status); err.status = r.status; err.data = data; throw err; }
  return data;
}
async function loadCatalog() {
  try {
    const d = await api("katalog");
    local.catalog = { clients: d.clients, items: d.items };
    if (d.user) local.worker = d.user.name;
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
// "przescieradla 20 reczniki 15" / "20 przescieradel i 15 recznikow" -> [{item,qty}], plus unknown pieces
function parseItems(text) {
  const t = wordsToDigits(norm(text)).replace(/\b(i|oraz|sztuk|sztuki|sztuka|szt|razy|po)\b/g, " ").replace(/(\d)\s+(?=\d)/g, "$1 , ");
  const tokens = t.split(" ").filter(Boolean);
  const res = [], unknown = []; let words = [], pendingNum = null;
  const flush = qty => {
    if (!words.length) return;
    const phrase = words.join(" ");
    let it = findItem(phrase);
    if (!it && words.length > 1) { for (const w of words) { it = findItem(w); if (it) break; } }
    if (it) res.push({ item: it, qty }); else unknown.push(phrase);
    words = [];
  };
  for (const tok of tokens) {
    if (tok === ",") continue;
    if (/^\d+$/.test(tok)) {
      const n = +tok;
      if (words.length) flush(n);          // "reczniki 15"
      else pendingNum = n;                 // "15 recznikow"
    } else {
      if (pendingNum !== null) { words.push(tok); flush(pendingNum); pendingNum = null; }
      else words.push(tok);
    }
  }
  if (words.length) flush(null);
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
  $("#mic").textContent = running ? "⏹ Zatrzymaj słuchanie" : "🎤 Rozpocznij trasę";
  $("#mic").classList.toggle("stop", running);
  $("#mic").classList.toggle("pulse", running);
  $("#state").innerHTML = mode === "client" ? "Czekam na <b>nazwę klienta</b>" : "Klient: podaj <b>asortyment i ilość</b>";
  $("#current").textContent = currentClient ? currentClient.name : "";
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
    if (last) { log("Cofnięto: " + last.client + " – " + last.item + " " + last.qty, "warn"); await say("Cofnięto"); } else await say("Nie ma czego cofnąć");
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
  for (const { item, qty } of parsed.res) {
    if (qty === null || qty === undefined) { log("Brak ilości dla: " + item.name, "warn"); said.push(item.name + ", podaj ilość"); continue; }
    local.route.push({ client: currentClient.name, item: item.name, qty, t: Date.now() });
    log(currentClient.name + ": " + item.name + " × " + qty, "ok"); said.push(item.name + " " + qty);
  }
  for (const u of parsed.unknown) log("Nieznany asortyment: „" + u + "”", "bad");
  save(); ui();
  let speech = local.repeat ? said.join(", ") : "OK";
  if (parsed.unknown.length) speech += ". Brak asortymentu: " + parsed.unknown.join(", ");
  await say(speech);
}

// ---------- summary & sending ----------
function grouped(route) {
  const m = new Map();
  for (const r of route) {
    if (!m.has(r.client)) m.set(r.client, new Map());
    const g = m.get(r.client); g.set(r.item, (g.get(r.item) || 0) + r.qty);
  }
  return m;
}
function summaryText(route) {
  let s = "";
  for (const [c, items] of grouped(route)) { s += c + "\n"; for (const [i, q] of items) s += "  - " + i + ": " + q + " szt.\n"; }
  return s;
}
function renderSummary() {
  if (!local.route.length) { $("#summary").innerHTML = "Brak wpisów."; return; }
  let h = "<table><tr><th>Klient / asortyment</th><th class='n'>Ilość</th></tr>";
  for (const [c, items] of grouped(local.route)) {
    h += `<tr><td colspan=2><b>${esc(c)}</b></td></tr>`;
    for (const [i, q] of items) h += `<tr><td>&nbsp;&nbsp;${esc(i)}</td><td class='n'>${q}</td></tr>`;
  }
  $("#summary").innerHTML = h + "</table>";
}
function renderBanner() {
  const b = $("#banner");
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
async function finishRoute(spoken) {
  if (!local.route.length) { if (spoken) await say("Trasa jest pusta"); else alert("Trasa jest pusta."); return; }
  if (!spoken && !confirm("Zakończyć trasę i wysłać podsumowanie?")) return;
  stop();
  local.pending.push({ id: local.routeId || newId(), worker: local.worker, date: new Date().toISOString(), route: local.route.map(({ client, item, qty }) => ({ client, item, qty })) });
  local.route = []; local.routeId = null; mode = "client"; currentClient = null; save(); ui();
  const ok = await flushPending(true);
  const msg = ok ? "Koniec trasy. Podsumowanie wysłane." : "Koniec trasy. Nie udało się wysłać, spróbuję ponownie.";
  if (spoken) await say(msg, { thenListen: false }); else log(msg, ok ? "ok" : "bad");
}
async function loadHistory() {
  const ul = $("#history");
  let list;
  try { list = await api("trasy"); } catch (e) { ul.innerHTML = `<li class='small'>Nie można pobrać: ${esc(e.message)}</li>`; return; }
  ul.innerHTML = list.length ? "" : "<li class='small'>Brak.</li>";
  for (const h of list) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${new Date(h.date).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })} · <b>${esc(h.worker || "—")}</b><br><span class='small'>${h.clients} klientów, ${h.total} szt. ${h.mailedAt ? "· mail wysłany" : "· <span class='bad'>mail niewysłany</span>"}</span></span><span class='row'><button class='btn'>Wyślij ponownie</button></span>`;
    li.querySelector("button").onclick = async () => {
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
});

// shared catalog lists
const listKey = kind => kind === "c" ? "clients" : "items";
function renderList(kind) {
  const arr = cat()[listKey(kind)];
  const ul = $("#" + kind + "List"); ul.innerHTML = "";
  $("#" + kind + "Count").textContent = arr.length;
  [...arr].sort((a, b) => a.name.localeCompare(b.name, "pl")).forEach(x => {
    const li = document.createElement("li");
    li.innerHTML = `<span><b>${esc(x.name)}</b>${x.aliases?.length ? `<br><span class='small'>${esc(x.aliases.join(", "))}</span>` : ""}</span><span class='row'><button class='btn' data-e>Edytuj</button><button class='btn del' data-d>Usuń</button></span>`;
    li.querySelector("[data-d]").onclick = () => {
      if (confirm("Usunąć „" + x.name + "”?")) changeCatalog({ method: "DELETE", query: "?id=" + encodeURIComponent(x.id) });
    };
    li.querySelector("[data-e]").onclick = () => {
      const n = prompt("Nazwa:", x.name); if (n === null) return;
      const a = prompt("Inne nazwy (po przecinku):", (x.aliases || []).join(", ")); if (a === null) return;
      changeCatalog({ method: "PUT", body: { id: x.id, name: n.trim() || x.name, aliases: a.split(",").map(s => s.trim()).filter(Boolean) } });
    };
    ul.append(li);
  });
}
function addFrom(kind) {
  const n = $("#" + kind + "Name").value.trim(); if (!n) return;
  const aliases = $("#" + kind + "Alias").value.split(",").map(s => s.trim()).filter(Boolean);
  changeCatalog({ method: "POST", body: { kind: listKey(kind), name: n, aliases } });
  $("#" + kind + "Name").value = ""; $("#" + kind + "Alias").value = "";
}
$("#cAdd").onclick = () => addFrom("c"); $("#aAdd").onclick = () => addFrom("a");

// settings
$("#sRepeat").checked = local.repeat !== false;
$("#sRepeat").onchange = e => { local.repeat = e.target.checked; save(); };

window.addEventListener("online", () => flushPending(false));
renderList("c"); renderList("a"); ui();
loadCatalog().then(ok => { if (ok) flushPending(false); loadHistory(); });
window.__pralnia = { handle, parseItems, findClient, local };
