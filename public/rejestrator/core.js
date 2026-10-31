// Logika wspólna dla przeglądarki i serwera (raport mailowy wysyłany przez Vercel):
// stany pracownika, normy, podsumowanie dnia i treść raportu. Bez odwołań do strony.

export const EARLY_LEAVE_PCT = 110;            // od tylu procent normy można wyjść wcześniej
export const CREDIT_MS = 7 * 3_600_000;        // i zalicza się 7 godzin pracy

// rodzaje wpisów w dzienniku
export const TYPES = {
  in:          { label: 'wejście',          btn: 'WEJŚCIE',        cls: 'ok' },
  break_start: { label: 'początek przerwy', btn: 'PRZERWA',        cls: 'brk' },
  break_end:   { label: 'koniec przerwy',   btn: 'KONIEC PRZERWY', cls: 'ok' },
  out:         { label: 'wyjście',          btn: 'WYJŚCIE',        cls: 'warn' },
};
export const typeLabel = t => TYPES[t]?.label ?? t;
// stan pracownika z ostatniego wpisu: 'out' (poza pracą), 'in' (w pracy) albo 'break' (na przerwie)
export const stateFromLast = last => ({ in: 'in', break_end: 'in', break_start: 'break' }[last?.type] ?? 'out');
export const ALLOWED = { out: ['in'], in: ['break_start', 'out'], break: ['break_end', 'out'] };
export const AUTO_NEXT = { out: 'in', in: 'out', break: 'break_end' };  // tryb automatyczny: przerwę zaczyna się ręcznie

export const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const dayOf = ts => localDay(new Date(ts));
export const addDays = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return localDay(d); };
export const fmtTime = ts => new Date(ts).toLocaleString('pl-PL');
export const fmtHM = ts => ts == null ? '—' : new Date(ts).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
export const fmtDur = ms => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
export const fmtNum = x => (Math.round(x * 100) / 100).toLocaleString('pl-PL');
export const fmtPct = x => `${(Math.floor(x * 10) / 10).toLocaleString('pl-PL')}%`;  // w dół, żeby 109,96% nie udawało 110%
export const plDate = day => new Date(day + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const byTs = (a, b) => a.ts - b.ts;

const pctOf = w => w.norm > 0 ? w.qty / w.norm * 100 : 0;
export const entryPct = w => tidy(pctOf(w));
const tidy = x => Math.round(x * 1e6) / 1e6;  // 0,29 · 100 = 28,999999… w liczbach zmiennoprzecinkowych

// procent normy w danym dniu: suma udziałów każdej pracy (np. 60% pakowania + 50% etykiet = 110%)
// Do rozliczenia (czas zaliczony, raport) liczy się tylko praca zatwierdzona przez kierownika;
// pole "all" obejmuje też niezatwierdzone wpisy, żeby pracownik widział, ile już zrobił.
export const isApproved = w => w.approved !== false;
function normView(entries) {
  const pct = tidy(entries.reduce((sum, w) => sum + pctOf(w), 0));
  const byTask = {};
  for (const w of entries) (byTask[w.taskId] ??= { taskName: w.taskName, unit: w.unit, norm: w.norm, qty: 0 }).qty += w.qty;
  return { entries, pct, byTask: Object.values(byTask), lastTask: entries.at(-1) };
}
export function normFor(work, personId, day) {
  const entries = work.filter(w => w.personId === personId && dayOf(w.ts) === day).sort(byTs);
  const approved = entries.filter(isApproved);
  return { ...normView(approved), all: normView(entries), pending: entries.length - approved.length };
}

// ile jeszcze brakuje do celu (w %), przeliczone na ilość ostatnio wykonywanej pracy
export function missingText(n, targetPct) {
  const miss = tidy(targetPct - n.pct);
  const t = n.lastTask;
  const qty = Math.ceil(miss / 100 * t.norm * 10) / 10;
  const other = n.byTask.length > 1 ? ' (albo odpowiednio innych prac)' : '';
  return `${fmtPct(miss)} normy, czyli ${fmtNum(qty)} ${t.unit} „${t.taskName}”${other}`;
}

export function normVerdict(n) {
  if (!n.entries.length) return null;
  if (n.pct >= EARLY_LEAVE_PCT) return { cls: 'ok', text: `Norma wykonana w ${fmtPct(n.pct)}. Może wyjść wcześniej, zaliczone będzie 7 godzin pracy.` };
  if (n.pct >= 100) return { cls: 'warn', text: `Norma wykonana w ${fmtPct(n.pct)}. Do wcześniejszego wyjścia brakuje ${missingText(n, EARLY_LEAVE_PCT)}.` };
  return { cls: 'err', text: `Norma wykonana w ${fmtPct(n.pct)}. Brakuje ${missingText(n, 100)}.` };
}

// podsumowanie jednego dnia; osoby wciąż w pracy liczone do chwili "until"
// data = { log, work, people } (log i work mogą zawierać też inne dni)
export function computeDay(day, data, until = Date.now()) {
  const start = new Date(day + 'T00:00:00').getTime(), end = new Date(addDays(day, 1) + 'T00:00:00').getTime();
  const byPerson = {};
  for (const e of [...data.log].sort(byTs)) {
    if (e.ts < start || e.ts >= end) continue;
    (byPerson[e.personId] ??= { name: e.name, events: [] }).events.push(e);
  }
  const stop = Math.min(until, end);
  const rows = Object.entries(byPerson).map(([personId, { name, events }]) => {
    // czas pracy liczy się od wejścia do wyjścia, bez przerw
    let total = 0, breaks = 0, workFrom = null, breakFrom = null;
    for (const e of events) {
      if (e.ts > stop) break;
      if (workFrom != null && e.type !== 'in') { total += e.ts - workFrom; workFrom = null; }
      if (breakFrom != null && e.type !== 'break_start') { breaks += e.ts - breakFrom; breakFrom = null; }
      if (e.type === 'in' || e.type === 'break_end') workFrom ??= e.ts;
      else if (e.type === 'break_start') breakFrom ??= e.ts;
    }
    if (workFrom != null) total += stop - workFrom;
    if (breakFrom != null) breaks += stop - breakFrom;
    const first = events.find(e => e.type === 'in'), last = [...events].reverse().find(e => e.type === 'out' && e.ts <= stop);
    const status = workFrom != null ? 'in' : breakFrom != null ? 'break' : 'out';
    const norm = normFor(data.work, personId, day);
    // 110% normy: wcześniejsze wyjście, zaliczone co najmniej 7 godzin
    const credited = norm.entries.length && norm.pct >= EARLY_LEAVE_PCT ? Math.max(total, CREDIT_MS) : total;
    return { personId, name, first: first?.ts ?? null, lastOut: last?.ts ?? null, breaks, total, status, norm, credited, pending: norm.pending };
  }).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  const present = new Set(rows.map(r => r.personId));
  const absent = data.people.filter(p => !present.has(p.id)).map(p => p.name).sort((a, b) => a.localeCompare(b, 'pl'));
  return { rows, absent };
}

export const workList = r => r.norm.byTask.map(t => `${t.taskName} ${fmtNum(t.qty)} ${t.unit}`).join(', ');

// treść maila z raportem dnia: temat, tekst, HTML i załącznik CSV
export function buildReport(day, data, now = Date.now()) {
  const { rows, absent } = computeDay(day, data, now);
  const isToday = day === localDay(new Date(now));
  const stateTxt = r => r.status === 'in' ? 'nadal w pracy' : r.status === 'break' ? 'na przerwie' : fmtHM(r.lastOut);
  const asOf = isToday ? ` (stan na ${fmtHM(now)})` : '';
  const subject = `Raport czasu pracy – ${new Date(day + 'T12:00:00').toLocaleDateString('pl-PL')}`;

  const pendingTotal = rows.reduce((sum, r) => sum + r.pending, 0);
  const pendingMsg = pendingTotal ? `Uwaga: ${pendingTotal} wpis(y) wykonanej pracy nie zostały zatwierdzone przez kierownika i nie są wliczone do normy.` : '';
  const text = [`Raport czasu pracy: ${plDate(day)}${asOf}`, '']
    .concat(rows.length ? rows.map(r => `${r.name}: ${fmtDur(r.total)} pracy (wejście ${fmtHM(r.first)}, ${r.status === 'out' ? 'wyjście ' : ''}${stateTxt(r)}, przerwy ${fmtDur(r.breaks)})`
      + (r.norm.entries.length ? `\n  ${normVerdict(r.norm).text} Zaliczono: ${fmtDur(r.credited)}.\n  Wykonano: ${workList(r)}` : '')) : ['Nikt nie zarejestrował wejścia.'])
    .concat(pendingMsg ? ['', pendingMsg] : [])
    .concat(absent.length ? ['', 'Nieobecni: ' + absent.join(', ')] : [])
    .join('\n');

  const td = 'padding:6px 10px;border-bottom:1px solid #ddd;text-align:left';
  const vColor = { ok: '#15803d', warn: '#c2410c', err: '#b91c1c' };
  const normCell = r => { const v = normVerdict(r.norm); return v ? `<span style="color:${vColor[v.cls]};font-weight:bold">${fmtPct(r.norm.pct)}</span>` : '—'; };
  const withNorm = rows.filter(r => r.norm.entries.length);
  const color = { in: '#15803d', break: '#c2410c', out: '#1c1f24' };
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1c1f24">
    <h2 style="margin:0 0 4px">Raport czasu pracy</h2>
    <div style="color:#6b7280;margin-bottom:12px">${esc(plDate(day))}${esc(asOf)}</div>
    <table style="border-collapse:collapse">
      <tr>${['Pracownik', 'Wejście', 'Wyjście', 'Przerwy', 'Czas pracy', 'Norma', 'Zaliczono'].map(h => `<th style="${td};color:#6b7280">${h}</th>`).join('')}</tr>
      ${rows.map(r => `<tr><td style="${td}">${esc(r.name)}</td><td style="${td}">${fmtHM(r.first)}</td>
        <td style="${td};color:${color[r.status]}">${esc(stateTxt(r))}</td><td style="${td}">${fmtDur(r.breaks)}</td>
        <td style="${td}">${fmtDur(r.total)}</td><td style="${td}">${normCell(r)}</td>
        <td style="${td};font-weight:bold">${fmtDur(r.credited)}</td></tr>`).join('') || `<tr><td style="${td}" colspan="7">Nikt nie zarejestrował wejścia.</td></tr>`}
    </table>
    ${withNorm.length ? `<h3 style="margin:16px 0 4px">Wykonane prace</h3>${withNorm.map(r => { const v = normVerdict(r.norm); return `<p style="margin:6px 0"><b>${esc(r.name)}</b>: ${esc(workList(r))}<br><span style="color:${vColor[v.cls]}">${esc(v.text)}</span></p>`; }).join('')}` : ''}
    ${pendingMsg ? `<p style="color:#c2410c">${esc(pendingMsg)}</p>` : ''}
    ${absent.length ? `<p style="color:#b91c1c"><b>Nieobecni:</b> ${absent.map(esc).join(', ')}</p>` : ''}
    <p style="color:#6b7280;font-size:12px">Wysłano automatycznie z aplikacji Rejestrator czasu pracy.</p></div>`;

  const q = x => `"${String(x).replace(/"/g, '""')}"`;
  const csv = ['pracownik;wejście;wyjście;przerwy (min);czas pracy (min);norma (%);zaliczony czas (min);wykonane prace;uwagi'].concat(
    rows.map(r => [q(r.name), fmtHM(r.first), stateTxt(r), Math.round(r.breaks / 60000), Math.round(r.total / 60000),
      r.norm.entries.length ? (Math.floor(r.norm.pct * 10) / 10).toString().replace('.', ',') : '', Math.round(r.credited / 60000),
      q(r.norm.entries.length ? workList(r) : ''), q(normVerdict(r.norm)?.text ?? '')].join(';')),
    absent.map(n => `${q(n)};—;nieobecny;0;0;;0;;`)).join('\r\n');
  return { subject, text, html, csv, filename: `raport-${day}.csv` };
}
