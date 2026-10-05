"use client";

// Feste Termine aus den Projektnotizen (02 Projekte/W-Seminararbeit.md, Abitur.md).
// Bei Terminänderungen hier anpassen.
const DEADLINES = [
  { label: "W-Seminararbeit Abgabe", date: "2026-11-10" },
  { label: "Abitur: Deutsch (schriftlich)", date: "2027-04-27" },
  { label: "Abitur: Mathe (schriftlich)", date: "2027-05-05" },
  { label: "Abitur: Wirtschaft (schriftlich)", date: "2027-05-07" },
  { label: "Sport-Praxisprüfung (frühestens)", date: "2027-01-25" },
];

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function badgeStyle(days: number): string {
  if (days <= 14) return "bg-rose-400 text-rose-950";
  if (days <= 60) return "bg-amber-300 text-amber-950";
  return "bg-white/15 text-white";
}

export function CountdownWidget() {
  const upcoming = DEADLINES.map((d) => ({ ...d, days: daysUntil(d.date) }))
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days);

  return (
    <div className="flex h-full w-full flex-col rounded-2xl bg-gradient-to-br from-violet-600 via-violet-600 to-indigo-700 p-5 text-white shadow-lg shadow-violet-950/40">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-sm">
          ⏳
        </span>
        <h2 className="text-sm font-semibold text-white">Countdown</h2>
      </div>
      {upcoming.length === 0 && (
        <p className="text-sm text-white/60">Keine anstehenden Termine.</p>
      )}
      <ul className="flex flex-col gap-2">
        {upcoming.map((d) => (
          <li
            key={d.label}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2 text-sm backdrop-blur-sm"
          >
            <span className="text-white/90">{d.label}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyle(d.days)}`}>
              {d.days === 0 ? "heute" : `${d.days} Tage`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
