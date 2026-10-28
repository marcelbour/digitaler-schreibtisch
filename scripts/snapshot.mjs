#!/usr/bin/env node
/**
 * Erzeugt den Offline-Schnappschuss der Vault-Daten.
 *
 * Ablauf: ruft die laufende lokale App auf (die ihrerseits Obsidian liest) und
 * schreibt die Antworten nach src/data/snapshot.json. Dadurch wird dieselbe
 * Parser-Logik benutzt wie im Normalbetrieb – kein zweiter, auseinander-
 * laufender Lesepfad.
 *
 * Voraussetzung: `npm run dev` läuft und Obsidian ist offen.
 * Danach: Datei committen und pushen, damit Vercel sie bekommt.
 */
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const KEYS = [
  "fahrschule",
  "graph",
  "habits",
  "noten",
  "projects",
  "reminders",
  "today",
  "vault",
];

const BASE = process.env.SNAPSHOT_BASE_URL ?? "http://localhost:3000";
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "snapshot.json",
);

// Bestehenden Schnappschuss laden: Eine Route, die heute scheitert, soll ihren
// alten Stand BEHALTEN statt gelöscht zu werden. Sonst macht ein einzelner
// Fehlschlag den Offline-Modus für dieses Widget kaputt.
let previous = { generatedAt: null, entries: {} };
try {
  previous = JSON.parse(await readFile(OUT, "utf8"));
} catch {
  // Erster Lauf – kein Vorgänger vorhanden, das ist in Ordnung.
}

const entries = { ...(previous.entries ?? {}) };
const ok = [];
const failed = [];

for (const key of KEYS) {
  try {
    const res = await fetch(`${BASE}/api/${key}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Eine Antwort, die selbst aus dem Schnappschuss kam, darf NICHT
    // zurückgeschrieben werden – sonst friert ein alter Stand sich selbst ein
    // und sieht für immer frisch aus.
    if (res.headers.get("X-Snapshot-Stale") === "1") {
      throw new Error("Antwort kam aus dem Schnappschuss (Obsidian offline?)");
    }
    entries[key] = {
      capturedAt: new Date().toISOString(),
      data: await res.json(),
    };
    ok.push(key);
  } catch (err) {
    failed.push(`${key}: ${err.message}`);
  }
}

if (ok.length === 0) {
  console.error("\n[FEHLER] Keine einzige Route konnte gelesen werden.");
  console.error("  Laeuft `npm run dev` und ist Obsidian mit Local REST API offen?");
  for (const f of failed) console.error(`  - ${f}`);
  process.exit(1);
}

await writeFile(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2) + "\n",
  "utf8",
);

console.log(`[OK] Schnappschuss geschrieben: ${ok.length}/${KEYS.length} Routen`);
console.log(`     ${ok.join(", ")}`);
if (failed.length) {
  console.log("\n[WARNUNG] Nicht erneuert, alter Stand bleibt erhalten:");
  for (const f of failed) console.log(`  - ${f}`);
}
console.log(`\n  -> ${path.relative(process.cwd(), OUT)}`);
console.log("  Nicht vergessen: committen und pushen, sonst sieht Vercel es nicht.");
