import "server-only";
import "./tz";

import { prisma } from "@/lib/db";

// Wspólna logika z przeglądarką: stany obecności, dni, raport.
import { ALLOWED, dayOf, localDay, stateFromLast } from "../../../public/rejestrator/core.js";

import { HttpError } from "./errors";
import { bump, dayKey, getValue, setValue, versions } from "./store";

export const DEFAULT_SETTINGS = { recipients: [] as string[], time: "16:00", enabled: true };
export type Settings = typeof DEFAULT_SETTINGS;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const checkDay = (d: unknown) => {
  if (!DAY_RE.test(String(d))) throw new HttpError(400, "Nieprawidłowa data.");
  return String(d);
};
const newId = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const text = (s: unknown, max = 200) => String(s ?? "").trim().slice(0, max);
const ms = (d: Date) => d.getTime();

export async function getSettings(): Promise<Settings> {
  const raw = await getValue("settings");
  return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
}

export async function getVersions(days: string[]) {
  const v = await versions(["people", "tasks", "settings", "last", ...days.map(dayKey)]);
  const ver: Record<string, string> = {};
  for (const k of ["people", "tasks", "settings", "last"]) if (k in v) ver[k] = String(v[k]);
  const dayVer: Record<string, number> = {};
  for (const d of days) dayVer[d] = v[dayKey(d)] ?? 0;
  return { ver, dayVer, storage: "database" };
}

// --- zamiana wierszy bazy na obiekty, których oczekuje przeglądarka (ts w milisekundach)
type Punch = { id: string; personId: string; name: string; type: string; ts: Date; day: string };
const punchOut = (e: Punch) => ({ id: e.id, personId: e.personId, name: e.name, type: e.type, ts: ms(e.ts) });

type Work = {
  id: string; personId: string; name: string; taskId: string; taskName: string; unit: string;
  norm: number; qty: number; ts: Date; approved: boolean; approvedAt: Date | null;
};
const workOut = (w: Work) => ({
  id: w.id, personId: w.personId, name: w.name, taskId: w.taskId, taskName: w.taskName, unit: w.unit,
  norm: w.norm, qty: w.qty, ts: ms(w.ts), approved: w.approved,
  ...(w.approvedAt ? { approvedAt: ms(w.approvedAt) } : {}),
});

type Rec = { id: string; personId: string; name: string; similarity: number | null; ts: Date };
const recOut = (r: Rec) => ({ id: r.id, personId: r.personId, name: r.name, similarity: r.similarity, ts: ms(r.ts) });

/** Ostatni wpis każdej osoby (stan obecności). Osoby usunięte pomijamy. */
async function lastPunches() {
  const rows = await prisma.$queryRaw<Punch[]>`
    SELECT DISTINCT ON (p."personId") p.*
    FROM "RcpPunch" p JOIN "RcpPerson" r ON r."id" = p."personId"
    ORDER BY p."personId", p."ts" DESC`;
  return rows.map(punchOut);
}

async function lastPunchOf(personId: string) {
  const row = await prisma.rcpPunch.findFirst({ where: { personId }, orderBy: { ts: "desc" } });
  return row ? punchOut(row) : null;
}

// what: lista z 'people', 'tasks', 'settings', 'last'; days: dni, z których potrzebne są wpisy
export async function getData(what: string[], days: string[]) {
  const out: Record<string, unknown> & { days: Record<string, object> } = { days: {} };

  if (what.includes("people")) {
    const people = await prisma.rcpPerson.findMany({ orderBy: { createdAt: "asc" } });
    out.people = people.map((p) => ({ id: p.id, name: p.name, descriptors: p.descriptors }));
  }
  if (what.includes("tasks")) out.tasks = await prisma.rcpTask.findMany();
  if (what.includes("settings")) out.settings = await getSettings();
  if (what.includes("last")) out.last = await lastPunches();

  if (days.length) {
    const where = { day: { in: days } };
    const [log, work, rec] = await Promise.all([
      prisma.rcpPunch.findMany({ where }),
      prisma.rcpWork.findMany({ where }),
      prisma.rcpRecognition.findMany({ where }),
    ]);
    for (const d of days) {
      out.days[d] = {
        log: log.filter((x) => x.day === d).map(punchOut),
        work: work.filter((x) => x.day === d).map(workOut),
        rec: rec.filter((x) => x.day === d).map(recOut),
      };
    }
  }

  return out;
}

async function person(id: unknown) {
  const p = await prisma.rcpPerson.findUnique({ where: { id: String(id ?? "") } });
  if (!p) throw new HttpError(404, "Nie ma takiego pracownika (mógł zostać usunięty na innym urządzeniu).");
  return p;
}

async function findWork(id: unknown, day: unknown) {
  const w = await prisma.rcpWork.findFirst({ where: { id: String(id ?? ""), day: checkDay(day) } });
  if (!w) throw new HttpError(404, "Nie ma takiego wpisu (mógł zostać usunięty na innym urządzeniu).");
  return w;
}

type Args = Record<string, unknown>;

// --- czynności dostępne dla każdego urządzenia zalogowanego do rejestratora
export const deviceOps: Record<string, (args: Args, admin?: boolean) => Promise<object>> = {
  async punch({ personId, type }) {
    const p = await person(personId);
    const state = stateFromLast(await lastPunchOf(p.id)) as keyof typeof ALLOWED;
    if (!(ALLOWED[state] as string[] | undefined)?.includes(String(type))) {
      throw new HttpError(409, "Ten wpis nie pasuje do obecnego stanu pracownika (może został już zarejestrowany na innym urządzeniu).");
    }
    const now = Date.now();
    const e = await prisma.rcpPunch.create({
      data: { id: newId("e"), personId: p.id, name: p.name, type: String(type), ts: new Date(now), day: dayOf(now) },
    });
    await bump(dayKey(e.day), "last");
    return { entry: punchOut(e) };
  },

  async recognition({ personId, similarity }) {
    const p = await person(personId);
    const now = Date.now();
    const r = await prisma.rcpRecognition.create({
      data: {
        id: newId("r"), personId: p.id, name: p.name,
        similarity: similarity == null ? null : Number(similarity), ts: new Date(now), day: dayOf(now),
      },
    });
    await bump(dayKey(r.day));
    return {};
  },

  async addWork({ personId, taskId, qty }) {
    const p = await person(personId);
    const t = await prisma.rcpTask.findUnique({ where: { id: String(taskId ?? "") } });
    const amount = Number(qty);
    if (!t) throw new HttpError(404, "Nie ma takiej pracy (mogła zostać usunięta).");
    if (!(amount > 0) || amount > 1e9) throw new HttpError(400, "Wpisz ilość większą od zera.");
    const now = Date.now();
    const w = await prisma.rcpWork.create({
      data: {
        id: newId("w"), personId: p.id, name: p.name, taskId: t.id, taskName: t.name, unit: t.unit,
        norm: t.norm, qty: amount, ts: new Date(now), day: dayOf(now), approved: false,
      },
    });
    await bump(dayKey(w.day));
    return { entry: workOut(w) };
  },

  // niezatwierdzony wpis pracownik może usunąć sam; zatwierdzony tylko kierownik (adminOps.delWork)
  async delWork({ id, day }, admin) {
    const w = await findWork(id, day);
    if (w.approved && !admin) throw new HttpError(403, "Usunięcie zatwierdzonego wpisu wymaga hasła kierownika.");
    await prisma.rcpWork.delete({ where: { id: w.id } });
    await bump(dayKey(w.day));
    return {};
  },
};

// --- czynności kierownika
export const adminOps: Record<string, (args: Args) => Promise<object>> = {
  async addPerson({ name, descriptors }) {
    const n = text(name, 100);
    if (!n) throw new HttpError(400, "Wpisz imię i nazwisko.");
    if (
      !Array.isArray(descriptors) || !descriptors.length || descriptors.length > 10 ||
      descriptors.some((d) => !Array.isArray(d) || d.length !== 128)
    ) {
      throw new HttpError(400, "Nieprawidłowe zdjęcia twarzy.");
    }
    const desc = (descriptors as unknown[][]).map((d) => d.map((x) => Math.round(Number(x) * 1e5) / 1e5));
    const p = await prisma.rcpPerson.create({ data: { id: newId("p"), name: n, descriptors: desc } });
    await bump("people");
    return { person: { id: p.id, name: p.name, descriptors: desc } };
  },

  async delPerson({ id }) {
    await prisma.rcpPerson.deleteMany({ where: { id: String(id ?? "") } });
    await bump("people", "last");
    return {};
  },

  async addTask({ name, unit, norm }) {
    const n = text(name);
    const u = text(unit, 20) || "szt.";
    const v = Number(norm);
    if (!n || !(v > 0)) throw new HttpError(400, "Wpisz nazwę pracy i normę większą od zera.");
    const t = await prisma.rcpTask.create({ data: { id: newId("t"), name: n, unit: u, norm: v } });
    await bump("tasks");
    return { task: t };
  },

  async updTask({ id, field, value }) {
    const t = await prisma.rcpTask.findUnique({ where: { id: String(id ?? "") } });
    if (!t) throw new HttpError(404, "Nie ma takiej pracy.");
    if (field !== "name" && field !== "unit" && field !== "norm") throw new HttpError(400, "Nieprawidłowe pole.");
    const v = field === "norm" ? Number(value) : text(value, field === "unit" ? 20 : 200);
    if (field === "norm" ? !((v as number) > 0) : !v) throw new HttpError(400, "Nieprawidłowa wartość, nie zapisano.");
    const updated = await prisma.rcpTask.update({ where: { id: t.id }, data: { [field]: v } });
    await bump("tasks");
    return { task: updated };
  },

  async delTask({ id }) {
    await prisma.rcpTask.deleteMany({ where: { id: String(id ?? "") } });
    await bump("tasks");
    return {};
  },

  async approveWork({ ids, day }) {
    const d = checkDay(day);
    const list = Array.isArray(ids) ? ids.map(String) : [];
    const { count } = await prisma.rcpWork.updateMany({
      where: { day: d, id: { in: list } },
      data: { approved: true, approvedAt: new Date() },
    });
    if (!count) throw new HttpError(404, "Nie ma takich wpisów (mogły zostać usunięte).");
    await bump(dayKey(d));
    return { approved: count };
  },

  delWork: (args) => deviceOps.delWork(args, true),

  async clearLog() {
    const days = await prisma.rcpPunch.findMany({ distinct: ["day"], select: { day: true } });
    await prisma.rcpPunch.deleteMany({});
    await bump("last", ...days.map((d) => dayKey(d.day)));
    return {};
  },

  async clearRec() {
    const days = await prisma.rcpRecognition.findMany({ distinct: ["day"], select: { day: true } });
    await prisma.rcpRecognition.deleteMany({});
    await bump(...days.map((d) => dayKey(d.day)));
    return {};
  },

  async saveSettings({ recipients, time, enabled }) {
    const list = (Array.isArray(recipients) ? recipients : String(recipients ?? "").split(/[,;\s]+/))
      .map((s) => text(s, 200))
      .filter(Boolean);
    const bad = list.find((a) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a));
    if (bad) throw new HttpError(400, `Nieprawidłowy adres e-mail: ${bad}`);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) {
      throw new HttpError(400, "Godzina musi mieć postać GG:MM, np. 16:00.");
    }
    const s = { recipients: list.slice(0, 20), time: String(time), enabled: !!enabled };
    await setValue("settings", JSON.stringify(s));
    await bump("settings");
    return { settings: s };
  },
};

// wszystkie wpisy potrzebne do raportu z jednego dnia
export async function reportData(day: string) {
  const d = await getData(["people"], [checkDay(day)]);
  const forDay = d.days[day] as { log: unknown[]; work: unknown[] };
  return { people: d.people, log: forDay.log, work: forDay.work };
}

export { localDay };
