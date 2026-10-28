import { NextResponse } from "next/server";
import snapshotFile from "@/data/snapshot.json";

/**
 * Offline-Schnappschuss der Vault-Daten.
 *
 * WARUM ES DAS GIBT (28.10.2026):
 * Alle Vault-Widgets holen ihre Daten über `readNote()` aus Obsidians Local
 * REST API auf 127.0.0.1. Das funktioniert nur, solange Obsidian UND
 * `npm run dev` auf genau diesem PC laufen. Auf der Vercel-URL gibt es kein
 * Obsidian – dort liefen bisher alle Widgets ins Leere, und auch lokal war
 * die Seite leer, sobald der Dev-Server nicht lief.
 *
 * Marcel am 28.10.: "wenn ich jetzt zum Beispiel woanders auf die Website
 * zugreife und es da nicht läuft, [dass es] dann einfach den letzten Stand
 * zeigt und nicht einfach gar nichts".
 *
 * LÖSUNG: `npm run snapshot` ruft lokal alle Routen auf und schreibt das
 * Ergebnis nach src/data/snapshot.json. Die Datei wird mitcommittet und ist
 * damit auch auf Vercel verfügbar. Schlägt der Live-Zugriff fehl, liefert die
 * Route den Schnappschuss statt eines Fehlers.
 *
 * WICHTIG – kein stilles Veralten:
 * Jede Schnappschuss-Antwort trägt die Header `X-Snapshot-Stale: 1` und
 * `X-Snapshot-At: <ISO-Datum>`. Die Oberfläche zeigt daraufhin ein sichtbares
 * Offline-Band mit dem Stand. Alte Daten, die wie aktuelle aussehen, wären
 * schlimmer als gar keine Daten – das ist dieselbe Lehre wie beim
 * Noten-Widget ("lieber sichtbar scheitern als leer rendern").
 */

export type SnapshotKey =
  | "fahrschule"
  | "graph"
  | "habits"
  | "noten"
  | "projects"
  | "reminders"
  | "today"
  | "vault";

export const SNAPSHOT_KEYS: SnapshotKey[] = [
  "fahrschule",
  "graph",
  "habits",
  "noten",
  "projects",
  "reminders",
  "today",
  "vault",
];

type SnapshotEntry = { capturedAt: string; data: unknown };
type SnapshotFile = {
  generatedAt: string | null;
  entries: Partial<Record<SnapshotKey, SnapshotEntry>>;
};

const snapshot = snapshotFile as SnapshotFile;

export function getSnapshotGeneratedAt(): string | null {
  return snapshot.generatedAt ?? null;
}

export function readSnapshot(key: SnapshotKey): SnapshotEntry | null {
  const entry = snapshot.entries?.[key];
  // Ein Eintrag ohne Daten ist kein Eintrag. `null` ist hier ein gültiger
  // Wert (z. B. leere Inbox), `undefined` nicht.
  if (!entry || entry.data === undefined) return null;
  return entry;
}

/**
 * Liefert eine Antwort aus dem Schnappschuss – oder `null`, wenn für diesen
 * Schlüssel nichts gespeichert ist. Dann muss die Route ihren normalen
 * Fehlerpfad gehen.
 */
export function snapshotResponse(key: SnapshotKey): NextResponse | null {
  const entry = readSnapshot(key);
  if (!entry) return null;
  return NextResponse.json(entry.data, {
    headers: {
      "X-Snapshot-Stale": "1",
      "X-Snapshot-At": entry.capturedAt,
      // Nicht zwischenspeichern: Sobald Obsidian wieder läuft, soll sofort
      // der Live-Stand kommen und nicht ein gecachter Schnappschuss.
      "Cache-Control": "no-store",
    },
  });
}
