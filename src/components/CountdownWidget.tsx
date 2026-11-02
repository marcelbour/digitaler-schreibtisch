"use client";

import { useSyncExternalStore } from "react";

// Feste Termine aus den Projektnotizen (02 Projekte/W-Seminararbeit.md, Abitur.md).
// Bei Terminänderungen hier anpassen.
const DEADLINES = [
  { label: "W-Seminararbeit Abgabe", date: "2026-11-10" },
  { label: "Abitur: Deutsch (schriftlich)", date: "2027-04-27" },
  { label: "Abitur: Mathe (schriftlich)", date: "2027-05-05" },
  { label: "Abitur: Wirtschaft (schriftlich)", date: "2027-05-07" },
  { label: "Sport-Praxisprüfung (frühestens)", date: "2027-01-25" },
];

type Countdown = { label: string; date: string; days: number };

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function computeUpcoming(): Countdown[] {
  return DEADLINES.map((d) => ({ ...d, days: daysUntil(d.date) }))
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days);
}

/*
 * Die Tageszahl haengt vom aktuellen Datum ab und darf deshalb NICHT
 * serverseitig gerendert werden.
 *
 * Vorher stand "const today = new Date()" direkt im Render. Die Seite wird
 * aber vorgerendert und zwischengespeichert, also fror das HTML auf dem Tag
 * des Vorrenderns ein: am 01.11. stand "12 Tage" im Server-HTML (gerendert
 * am 29.10.), waehrend der Browser korrekt "9 Tage" berechnete. React hat
 * das als Hydration-Mismatch gemeldet -> das "1 issue" im Dev-Overlay. Fuer
 * einen Moment war die falsche Zahl sichtbar.
 *
 * useSyncExternalStore ist der dafuer vorgesehene Weg: Der Server (und der
 * erste Hydrations-Durchgang) nehmen getServerSnapshot -> null -> Platzhalter.
 * Danach rechnet der Browser. Das Intervall sorgt dafuer, dass die Zahl ueber
 * Mitternacht nicht stehen bleibt, wenn der Tab offen liegt.
 */
let cache: { day: string; value: Countdown[] } | null = null;

function getSnapshot(): Countdown[] {
  const day = new Date().toDateString();
  // Gleiche Referenz solange derselbe Tag laeuft - sonst rendert React endlos.
  if (!cache || cache.day !== day) cache = { day, value: computeUpcoming() };
  return cache.value;
}

function getServerSnapshot(): Countdown[] | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

function badgeStyle(days: number): string {
  if (days <= 14) return "bg-rose-400 text-rose-950";
  if (days <= 60) return "bg-amber-300 text-amber-950";
  return "bg-white/15 text-white";
}

export function CountdownWidget() {
  const upcoming = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex h-full w-full flex-col rounded-2xl bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-700 p-5 text-white shadow-lg shadow-violet-950/40">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm">
          ⏳
        </span>
        <h2 className="text-sm font-semibold text-white">Countdown</h2>
      </div>
      {upcoming?.length === 0 && (
        <p className="text-sm text-white/60">Keine anstehenden Termine.</p>
      )}
      <ul className="flex flex-col gap-2">
        {(upcoming ?? DEADLINES.map((d) => ({ ...d, days: null }))).map((d) => (
          <li
            key={d.label}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm backdrop-blur-sm"
          >
            <span className="text-white/90">{d.label}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                d.days === null ? "bg-white/15 text-white/50" : badgeStyle(d.days)
              }`}
            >
              {d.days === null ? "…" : d.days === 0 ? "heute" : `${d.days} Tage`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
