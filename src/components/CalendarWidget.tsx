"use client";

import { useEffect, useState } from "react";
import { CARD, HEADING, iconBadge } from "@/lib/ui";

type CalendarEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

type CalendarResponse = { events: CalendarEvent[] };
type CalendarError = { error: string };

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const DAY_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
const TIME_FORMAT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

/**
 * Fasst alle Schulfach-Termine (Präfix "📚", siehe [[02 Projekte/Abitur.md]])
 * eines Tages zu einer einzigen Zeitspanne zusammen, statt jedes einzelne Fach
 * aufzulisten - auf Marcels Wunsch (21.09.): für die Wochenübersicht reicht
 * "von-bis Schule", die einzelnen Fächer machen die Spalten nur unnötig eng.
 * Alle anderen Termine (Fahrstunde, Training, Arzttermine, ...) bleiben einzeln.
 */
function splitSchoolBlock(dayEvents: CalendarEvent[]): {
  schoolRange: { start: string; end: string } | null;
  rest: CalendarEvent[];
} {
  const school = dayEvents.filter(
    (e) => e.title.startsWith("📚") && !e.allDay && e.start && e.end,
  );
  const rest = dayEvents.filter(
    (e) => !(e.title.startsWith("📚") && !e.allDay && e.start && e.end),
  );
  if (school.length === 0) return { schoolRange: null, rest };
  const start = school.reduce((min, e) => (e.start! < min ? e.start! : min), school[0].start!);
  const end = school.reduce((max, e) => (e.end! > max ? e.end! : max), school[0].end!);
  return { schoolRange: { start, end }, rest };
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Die kommenden 7 Tage, rollierend ab heute (heute = erste Spalte) statt
 * starr Mo-So - sonst zeigt die Ansicht an einem Freitag kaum noch was.
 */
function nextSevenDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
}

export function CalendarWidget() {
  const [data, setData] = useState<CalendarEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calendar")
      .then(async (res) => {
        const json = (await res.json()) as CalendarResponse | CalendarError;
        if (!res.ok) throw new Error(("error" in json && json.error) || "Unbekannter Fehler");
        setData((json as CalendarResponse).events);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const days = nextSevenDays();

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={iconBadge("blue")}>📅</span>
        <h2 className={HEADING}>Kalender – nächste 7 Tage</h2>
      </div>
      {error && (
        <div className="text-sm text-rose-400">
          <p>{error}</p>
          {error.includes("GOOGLE_REFRESH_TOKEN") && (
            <p className="mt-1">
              <a href="/api/auth/google" className="underline">
                Einmalig autorisieren
              </a>
            </p>
          )}
        </div>
      )}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}
      {data && (
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayEvents = data
              .filter((e) => e.start && sameDay(new Date(e.start), day))
              .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
            const { schoolRange, rest } = splitSchoolBlock(dayEvents);
            const today = sameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                className={`flex min-h-32 flex-col gap-1.5 rounded-xl border p-2 ${
                  today
                    ? "border-violet-500/40 bg-violet-500/10"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div
                  className={`text-xs font-medium ${
                    today ? "text-violet-300" : "text-zinc-500"
                  }`}
                >
                  {WEEKDAY_FORMAT.format(day)}
                  <span className="ml-1 font-normal">{DAY_FORMAT.format(day)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {schoolRange && (
                    <div className="rounded-lg bg-white/[0.04] px-1.5 py-1 text-xs leading-tight text-zinc-400">
                      <div className="text-[10px] text-zinc-500">
                        {TIME_FORMAT.format(new Date(schoolRange.start))}–
                        {TIME_FORMAT.format(new Date(schoolRange.end))}
                      </div>
                      <div>🏫 Schule</div>
                    </div>
                  )}
                  {rest.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg bg-white/5 px-1.5 py-1 text-xs leading-tight text-zinc-300"
                    >
                      {!event.allDay && event.start && (
                        <div className="text-[10px] text-zinc-500">
                          {TIME_FORMAT.format(new Date(event.start))}
                        </div>
                      )}
                      <div>{event.title}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
