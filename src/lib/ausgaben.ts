// Named Import, kein Default – siehe Fundstelle 26.10.2026 in fahrschule.ts.
import { load as yamlLoad } from "js-yaml";

// Datenquelle: "03 Bereiche/Finanzen/Ausgaben KI & Tools (Daten).md" im Vault.
// Gleiches Prinzip wie beim Fahrschul-Budget: Zahlen nur im YAML-Frontmatter,
// bei fehlenden/kaputten Daten sichtbar scheitern statt 0,00 € anzeigen.
//
// Die NÄCHSTE Abbuchung wird bewusst NICHT hier berechnet, sondern im Widget
// mit dem echten heutigen Datum. Sonst würde der Offline-Schnappschuss ein
// "in 9 Tagen" einfrieren, das am nächsten Tag schon falsch ist.

export class AusgabenDataError extends Error {}

export type Kategorie = "werkzeug" | "business";

export type Abo = {
  id: string;
  name: string;
  anbieter: string;
  kategorie: Kategorie;
  betrag: number;
  geschaetzt: boolean;
  status: "aktiv" | "gekuendigt";
  hinweis?: string;
  /** Datum der letzten eingetragenen Zahlung (YYYY-MM-DD) oder null. */
  letzteZahlung: string | null;
};

export type Zahlung = {
  datum: string;
  abo: string | null;
  posten: string;
  kategorie: Kategorie;
  betrag: number;
  beleg?: string;
};

export type Ausgaben = {
  stand: string | null;
  abos: Abo[];
  zahlungen: Zahlung[];
  bezahltGesamt: number;
  bezahltWerkzeug: number;
  bezahltBusiness: number;
  monatlichLaufend: number;
  monatlichGeschaetzt: boolean;
};

type Frontmatter = { stand?: unknown; abos?: unknown; zahlungen?: unknown };

function extractFrontmatter(content: string): Frontmatter {
  // readNote() hat BOM und CRLF bereits normalisiert.
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new AusgabenDataError("Kein YAML-Frontmatter gefunden.");
  let parsed: unknown;
  try {
    parsed = yamlLoad(match[1]);
  } catch (err) {
    throw new AusgabenDataError(
      `Frontmatter ist kein gültiges YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new AusgabenDataError("Frontmatter ist leer.");
  }
  return parsed as Frontmatter;
}

function requireNumber(value: unknown, feld: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new AusgabenDataError(`Feld "${feld}" fehlt oder ist keine Zahl.`);
  }
  return n;
}

function requireArray(value: unknown, feld: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new AusgabenDataError(`Feld "${feld}" fehlt oder ist keine Liste.`);
  }
  return value;
}

/**
 * js-yaml macht aus einem unquotierten 2026-09-12 ein Date-Objekt.
 * String(date) ergäbe "Sat Sep 12 2026 …" – deshalb beide Fälle abfangen.
 */
function isoDatum(value: unknown, feld: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value ?? "");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  throw new AusgabenDataError(`Feld "${feld}" ist kein Datum (YYYY-MM-DD).`);
}

function requireKategorie(value: unknown, feld: string): Kategorie {
  if (value === "werkzeug" || value === "business") return value;
  // Unbekannter Wert: sichtbar scheitern, nicht still einer Kategorie zuschlagen
  // (Regel aus dem Status-Fallback-Fund vom 29.10.2026).
  throw new AusgabenDataError(
    `Feld "${feld}" muss "werkzeug" oder "business" sein, ist aber "${String(value)}".`,
  );
}

function cent(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseAusgaben(content: string): Ausgaben {
  const fm = extractFrontmatter(content);

  const zahlungen = requireArray(fm.zahlungen, "zahlungen")
    .map((z, i) => {
      const row = z as Record<string, unknown>;
      return {
        datum: isoDatum(row.datum, `zahlungen[${i}].datum`),
        abo: row.abo ? String(row.abo) : null,
        posten: String(row.posten ?? `Zahlung ${i + 1}`),
        kategorie: requireKategorie(row.kategorie, `zahlungen[${i}].kategorie`),
        betrag: requireNumber(row.betrag, `zahlungen[${i}].betrag`),
        beleg: row.beleg ? String(row.beleg) : undefined,
      } satisfies Zahlung;
    })
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const abos = requireArray(fm.abos, "abos").map((a, i) => {
    const row = a as Record<string, unknown>;
    const id = String(row.id ?? "");
    if (!id) throw new AusgabenDataError(`abos[${i}].id fehlt.`);
    const status = row.status ?? "aktiv";
    if (status !== "aktiv" && status !== "gekuendigt") {
      throw new AusgabenDataError(
        `abos[${i}].status muss "aktiv" oder "gekuendigt" sein, ist "${String(status)}".`,
      );
    }
    const eigene = zahlungen.filter((z) => z.abo === id);
    return {
      id,
      name: String(row.name ?? id),
      anbieter: String(row.anbieter ?? ""),
      kategorie: requireKategorie(row.kategorie, `abos[${i}].kategorie`),
      betrag: requireNumber(row.betrag, `abos[${i}].betrag`),
      geschaetzt: row.geschaetzt === true,
      status,
      hinweis: row.hinweis ? String(row.hinweis) : undefined,
      letzteZahlung: eigene.length ? eigene[eigene.length - 1].datum : null,
    } satisfies Abo;
  });

  // Zahlung mit unbekannter Abo-id: sichtbar scheitern, sonst verschwindet sie
  // still aus der "nächste Abbuchung"-Rechnung.
  for (const z of zahlungen) {
    if (z.abo && !abos.some((a) => a.id === z.abo)) {
      throw new AusgabenDataError(
        `Zahlung vom ${z.datum} verweist auf unbekanntes Abo "${z.abo}".`,
      );
    }
  }

  const summe = (list: Zahlung[]) => cent(list.reduce((s, z) => s + z.betrag, 0));
  const aktiv = abos.filter((a) => a.status === "aktiv");

  return {
    stand: fm.stand ? isoDatum(fm.stand, "stand") : null,
    abos,
    zahlungen,
    bezahltGesamt: summe(zahlungen),
    bezahltWerkzeug: summe(zahlungen.filter((z) => z.kategorie === "werkzeug")),
    bezahltBusiness: summe(zahlungen.filter((z) => z.kategorie === "business")),
    monatlichLaufend: cent(aktiv.reduce((s, a) => s + a.betrag, 0)),
    monatlichGeschaetzt: aktiv.some((a) => a.geschaetzt),
  };
}
