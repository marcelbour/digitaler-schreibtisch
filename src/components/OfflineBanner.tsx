"use client";

import { useEffect, useState } from "react";

/**
 * Ein Band über der ganzen Seite, sobald die Daten aus dem Offline-
 * Schnappschuss kommen statt live aus Obsidian.
 *
 * Warum sichtbar und nicht still: Alte Zahlen, die wie aktuelle aussehen,
 * sind schlimmer als gar keine. Beim Noten- und beim Habit-Widget steht
 * derselbe Gedanke schon im Code ("lieber sichtbar scheitern als leer
 * rendern"). Der Schnappschuss nimmt den Widgets die Leere – dieses Band
 * sorgt dafür, dass er trotzdem nicht für den Live-Stand gehalten wird.
 */
export default function OfflineBanner() {
  const [state, setState] = useState<{ live: boolean; snapshotAt: string | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      fetch("/api/snapshot-status")
        .then((r) => r.json())
        .then((json) => {
          if (!cancelled) setState(json);
        })
        .catch(() => {
          // Wenn selbst der Status-Endpunkt nicht erreichbar ist, läuft die
          // App gar nicht – dann gibt es auch kein Band anzuzeigen.
        });

    check();
    // Alle zwei Minuten nachsehen: Sobald Obsidian wieder läuft, soll das
    // Band von selbst verschwinden, ohne dass neu geladen werden muss.
    const timer = setInterval(check, 120_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!state || state.live) return null;

  const stand = state.snapshotAt
    ? new Date(state.snapshotAt).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
    >
      <span aria-hidden="true">⚠️</span>
      <span className="font-medium">Offline-Modus</span>
      <span className="text-amber-200/80">
        {stand
          ? `Obsidian ist nicht erreichbar – angezeigt wird der Stand vom ${stand}.`
          : "Obsidian ist nicht erreichbar, und es liegt noch kein Schnappschuss vor."}
      </span>
    </div>
  );
}
