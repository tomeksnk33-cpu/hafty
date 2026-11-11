"use strict";
// Przycisk „Wyłącz komputer” na stanowisku z monitorem dotykowym.
// Strona w przeglądarce nie może sama wyłączyć komputera, więc prosi o to mały
// program działający na tym komputerze (wylacz-komputer.ps1 / .py, port 47800,
// tylko 127.0.0.1). Przycisk pokazuje się tylko w przeglądarce, w której
// włączono tryb stanowiska: strona /kiosk albo adres z ?kiosk=1 (?kiosk=0 wyłącza).
(function () {
  var KEY = "gtm-kiosk";
  var HELPER = "http://127.0.0.1:47800";
  try {
    var q = new URLSearchParams(location.search).get("kiosk");
    if (q === "1") localStorage.setItem(KEY, "1");
    if (q === "0") localStorage.removeItem(KEY);
    if (localStorage.getItem(KEY) !== "1") return;
  } catch (e) { return; }
  if (document.getElementById("gtm-power")) return;

  var css = document.createElement("style");
  css.textContent =
    "#gtm-power{position:fixed;left:14px;bottom:14px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;background:#b42318;color:#fff;font:700 28px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;touch-action:manipulation}" +
    "#gtm-power:active{transform:scale(.95)}" +
    "#gtm-power-dlg{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif}" +
    "#gtm-power-dlg .b{background:#fff;color:#1c1917;border-radius:18px;padding:28px;max-width:520px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.35)}" +
    "#gtm-power-dlg h2{margin:0 0 8px;font-size:28px}#gtm-power-dlg p{margin:0 0 20px;font-size:17px;color:#57534e}" +
    "#gtm-power-dlg .r{display:grid;grid-template-columns:1fr 1fr;gap:12px}" +
    "#gtm-power-dlg button{font:600 22px system-ui,sans-serif;padding:18px;border-radius:14px;border:1px solid #d6d3d1;background:#fafaf9;color:#1c1917;cursor:pointer}" +
    "#gtm-power-dlg button.go{background:#b42318;border-color:#b42318;color:#fff}";
  document.head.appendChild(css);

  var btn = document.createElement("button");
  btn.id = "gtm-power";
  btn.type = "button";
  btn.title = "Wyłącz komputer";
  btn.setAttribute("aria-label", "Wyłącz komputer");
  btn.textContent = "⏻";
  btn.onclick = ask;
  document.body.appendChild(btn);

  function dialog(html) {
    close();
    var d = document.createElement("div");
    d.id = "gtm-power-dlg";
    d.innerHTML = '<div class="b" role="dialog" aria-modal="true">' + html + "</div>";
    d.onclick = function (e) { if (e.target === d) close(); };
    document.body.appendChild(d);
    return d;
  }
  function close() { var d = document.getElementById("gtm-power-dlg"); if (d) d.remove(); }

  function ask() {
    var d = dialog("<h2>Wyłączyć komputer?</h2><p>Komputer wyłączy się po kilku sekundach. Niewysłana trasa zostaje zapisana w tym komputerze.</p>" +
      '<div class="r"><button type="button" data-no>Anuluj</button><button type="button" class="go" data-yes>⏻ Wyłącz</button></div>');
    d.querySelector("[data-no]").onclick = close;
    d.querySelector("[data-yes]").onclick = shutdown;
  }

  function shutdown() {
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 5000);
    fetch(HELPER + "/wylacz", { method: "POST", mode: "cors", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error("HTTP " + r.status);
        dialog("<h2>Komputer się wyłącza…</h2><p>Można odejść od stanowiska.</p>");
      })
      .catch(function () {
        clearTimeout(timer);
        var d = dialog("<h2>Nie udało się wyłączyć</h2><p>Na tym komputerze nie działa program do wyłączania albo przeglądarka nie dała mu zgody. Instrukcja: <b>" + location.origin + "/kiosk</b></p>" +
          '<div class="r"><button type="button" data-no>Zamknij</button><button type="button" data-help>Instrukcja</button></div>');
        d.querySelector("[data-no]").onclick = close;
        d.querySelector("[data-help]").onclick = function () { location.href = "/kiosk"; };
      });
  }
})();
