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

export function CountdownWidget() {
  const upcoming = DEADLINES.map((d) => ({ ...d, days: daysUntil(d.date) }))
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days);

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Countdown
      </h2>
      {upcoming.length === 0 && (
        <p className="text-sm text-zinc-400">Keine anstehenden Termine.</p>
      )}
      <ul className="flex flex-col gap-2">
        {upcoming.map((d) => (
          <li
            key={d.label}
            className="flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm"
          >
            <span className="text-zinc-700 dark:text-zinc-300">{d.label}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                d.days <= 14
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : d.days <= 60
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {d.days === 0 ? "heute" : `${d.days} Tage`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
