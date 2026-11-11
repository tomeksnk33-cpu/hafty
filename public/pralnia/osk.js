"use strict";
// Klawiatura ekranowa pralni (monitor dotykowy bez fizycznej klawiatury).
// Przycisk ⌨ na górnej belce ją pokazuje i chowa; pisze do pola, które ostatnio miało fokus.
// Wybór jest wspólny z klawiaturą na stronie logowania (zapamiętany na tym urządzeniu).
(() => {
  const PREF = "hafty-klawiatura-ekranowa";
  const ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m", ",", "."],
  ];
  const POLISH = ["ą", "ć", "ę", "ł", "ń", "ó", "ś", "ź", "ż"];
  const SYMBOLS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["-", "+", "/", "(", ")", "@", "&", "%", "#", "*"],
    ["'", '"', ":", ";", "!", "?", "=", "_", "„", "”"],
    [",", ".", "€", "zł"],
  ];
  const st = { shift: false, caps: false, sym: false, open: false, target: null };

  const css = document.createElement("style");
  css.textContent = `
#osk{position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--card,#fff);border-top:1px solid var(--line,#ddd);box-shadow:0 -4px 18px rgba(0,0,0,.12);padding:8px clamp(6px,1vw,16px) 10px}
#osk[hidden]{display:none}
#osk .in{max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:6px}
#osk .r{display:flex;gap:6px}
#osk button{flex:1;min-width:0;height:clamp(48px,4.6vw,66px);border:1px solid var(--line,#ddd);border-radius:10px;background:var(--bg,#f6f7f9);color:var(--ink,#111);font:inherit;font-size:clamp(18px,1.6vw,26px);font-weight:600;touch-action:manipulation;user-select:none;-webkit-user-select:none}
#osk button:active{background:var(--line,#ddd)}
#osk button.on{border-color:var(--accent,#1f5fa8);color:var(--accent,#1f5fa8)}
#osk button.w2{flex:2}#osk button.w5{flex:6}
#osk button.ent{background:var(--accent,#1f5fa8);border-color:var(--accent,#1f5fa8);color:#fff}
#osk .who{font-size:13px;color:var(--muted,#667);min-height:16px;text-align:center}
body.oskOn{padding-bottom:var(--osk-h,320px)}
nav button.oskBtn{flex:0 0 auto;padding:12px 16px;font-size:18px}
nav button.oskBtn.on2{color:var(--accent,#1f5fa8)}`;
  document.head.append(css);

  const panel = document.createElement("div");
  panel.id = "osk"; panel.hidden = true;
  panel.setAttribute("role", "group"); panel.setAttribute("aria-label", "Klawiatura ekranowa");
  document.body.append(panel);

  // pola, do których da się pisać (pola z własną klawiaturą liczbową mają inputmode=none)
  const typable = el => el && ((el.tagName === "INPUT" && /^(text|search|tel|password|email|number|url|)$/.test(el.type || "") && el.inputMode !== "none") || el.tagName === "TEXTAREA") && !el.readOnly && !el.disabled;
  document.addEventListener("focusin", e => {
    if (!typable(e.target)) return;
    st.target = e.target;
    placePanel();
    label();
  });
  // w otwartym oknie (dialog) klawiatura musi być w środku, inaczej jest nieklikalna
  function placePanel() {
    const dlg = st.target && st.target.closest("dialog[open]");
    const host = dlg || document.body;
    if (panel.parentElement !== host) host.append(panel);
    if (dlg && !dlg.__osk) { dlg.__osk = true; dlg.addEventListener("close", () => { if (panel.parentElement === dlg) document.body.append(panel); }); }
  }
  const target = () => (st.target && st.target.isConnected && !st.target.disabled ? st.target : null);
  function label() {
    const el = target(), w = panel.querySelector(".who");
    if (!w) return;
    const name = el && (el.labels?.[0]?.textContent || el.placeholder || el.getAttribute("aria-label") || "");
    w.textContent = el ? "Piszesz w: " + String(name).trim().slice(0, 60) : "Dotknij pola, w którym chcesz pisać.";
  }

  function fire(el) { el.dispatchEvent(new Event("input", { bubbles: true })); }
  function type(text) {
    const el = target(); if (!el) { label(); return; }
    let s = el.value.length, e = s;
    try { s = el.selectionStart ?? s; e = el.selectionEnd ?? e; } catch (x) {}
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    try { el.setSelectionRange(s + text.length, s + text.length); } catch (x) {}
    fire(el);
    if (st.shift) { st.shift = false; render(); }
  }
  function back() {
    const el = target(); if (!el) return;
    let s = el.value.length, e = s;
    try { s = el.selectionStart ?? s; e = el.selectionEnd ?? e; } catch (x) {}
    const from = s === e ? Math.max(0, s - 1) : s;
    el.value = el.value.slice(0, from) + el.value.slice(e);
    try { el.setSelectionRange(from, from); } catch (x) {}
    fire(el);
  }
  function enter() {
    const el = target(); if (!el) return;
    const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    // pole w okienku z przyciskiem OK: Enter zatwierdza
    if (!ev.defaultPrevented) el.closest("dialog[open]")?.querySelector("[data-ok]")?.click();
  }

  function render() {
    const up = st.shift !== st.caps;
    const L = k => (up && k.length === 1 ? k.toLocaleUpperCase("pl") : k);
    const rows = st.sym ? SYMBOLS : ROWS;
    let h = "<div class='in'><div class='who'></div>";
    if (!st.sym) h += "<div class='r'>" + POLISH.map(k => `<button type='button' data-k='${k}'>${L(k)}</button>`).join("") + "</div>";
    rows.forEach((r, i) => {
      h += "<div class='r'>";
      if (i === rows.length - 1 && !st.sym) h += `<button type='button' class='w2${st.shift ? " on" : ""}' data-a='shift'>⇧</button>`;
      h += r.map(k => `<button type='button' data-k='${k.replace(/'/g, "&#39;")}'>${L(k).replace(/</g, "&lt;")}</button>`).join("");
      if (i === rows.length - 1) h += "<button type='button' class='w2' data-a='back' aria-label='Usuń znak'>⌫</button>";
      h += "</div>";
    });
    h += `<div class='r'><button type='button' class='w2${st.caps ? " on" : ""}' data-a='caps'>Caps</button><button type='button' class='w2${st.sym ? " on" : ""}' data-a='sym'>${st.sym ? "abc" : "123?"}</button><button type='button' class='w5' data-a='space' aria-label='Spacja'>spacja</button><button type='button' class='w2 ent' data-a='enter'>Enter ↵</button><button type='button' class='w2' data-a='close' aria-label='Schowaj klawiaturę'>✕</button></div></div>`;
    panel.innerHTML = h;
    label();
    document.body.style.setProperty("--osk-h", (panel.offsetHeight || 320) + 12 + "px");
  }
  // przyciski nie zabierają fokusu polu
  panel.addEventListener("pointerdown", e => e.preventDefault());
  panel.addEventListener("mousedown", e => e.preventDefault());
  panel.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.k) { const up = st.shift !== st.caps; type(up && b.dataset.k.length === 1 ? b.dataset.k.toLocaleUpperCase("pl") : b.dataset.k); return; }
    const a = b.dataset.a;
    if (a === "shift") { st.shift = !st.shift; render(); }
    else if (a === "caps") { st.caps = !st.caps; st.shift = false; render(); }
    else if (a === "sym") { st.sym = !st.sym; render(); }
    else if (a === "space") type(" ");
    else if (a === "back") back();
    else if (a === "enter") enter();
    else if (a === "close") show(false);
  });

  let btn = null;
  function show(on) {
    st.open = on; panel.hidden = !on;
    document.body.classList.toggle("oskOn", on);
    if (btn) { btn.classList.toggle("on2", on); btn.setAttribute("aria-pressed", on ? "true" : "false"); }
    try { localStorage.setItem(PREF, on ? "1" : "0"); } catch (e) {}
    if (on) { placePanel(); render(); }
  }
  // przycisk na górnej belce (obok zakładek)
  const nav = document.querySelector("nav");
  if (nav) {
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "oskBtn"; btn.title = "Klawiatura ekranowa"; btn.setAttribute("aria-label", "Klawiatura ekranowa");
    btn.textContent = "⌨";
    btn.addEventListener("pointerdown", e => e.preventDefault()); // nie zabiera fokusu polu
    btn.addEventListener("click", e => { e.stopPropagation(); show(!st.open); });
    nav.append(btn);
  }
  let pref = false;
  try { pref = localStorage.getItem(PREF) === "1"; } catch (e) {}
  if (pref) show(true);
  window.__osk = { show };
})();
