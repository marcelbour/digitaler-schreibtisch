// Named Import, kein Default: Der ESM-Build (js-yaml.mjs) exportiert nur
// benannte Funktionen. Ein `import yaml from "js-yaml"` typecheckt zwar
// (die .d.ts behauptet einen Default), scheitert aber zur Laufzeit mit
// "Export default doesn't exist in target module". Fundstelle 26.10.2026.
import { load as yamlLoad } from "js-yaml";

// Datenquelle: "02 Projekte/Führerschein - Budget (Daten).md" im Vault.
// Alle Zahlen stehen dort im YAML-Frontmatter, bewusst nicht im Fließtext –
// die Prosa-Einordnung lebt in "02 Projekte/Führerschein.md".
//
// Lehre vom 13.10.2026 (To-Dos-Widget): Ein Parser, der still eine leere
// Struktur zurückgibt, sieht aus wie "nichts zu tun" bzw. hier wie "alles
// bezahlt". Deshalb wirft dieses Modul bei fehlenden/kaputten Daten einen
// Fehler, statt 0,00 € zu liefern.

export class FahrschuleDataError extends Error {}

export type Zahlung = {
  posten: string;
  betrag: number;
  zahler: string;
  datum: string | null;
  hinweis?: string;
};

export type OffenerPosten = { posten: string; betrag: number };

export type Sonderfahrt = { art: string; pflicht: number; gefahren: number };

export type Fahrstunde = {
  nr: number;
  datum: string;
  dauer_min: number;
  // "abgesagt" seit 29.10.2026: Die Fahrstunde vom 30.10. wurde abgesagt und
  // muss nachgebucht werden. Vorher fiel alles ausser "gefahren" auf "geplant"
  // zurueck - eine Absage haette also wie ein fester Termin ausgesehen.
  status: "gefahren" | "geplant" | "abgesagt";
  inhalt: string[];
  hinweis?: string;
};

export type BalkenSegment = {
  key: "eltern_bezahlt" | "eltern_offen" | "du_bezahlt" | "du_offen";
  label: string;
  betrag: number;
  /** Anteil an der Gesamtsumme in Prozent (0–100). */
  anteil: number;
  bezahlt: boolean;
  wer: "eltern" | "marcel";
};

export type FahrschuleBudget = {
  budgetGesamt: number;
  preisFahrstunde: number;
  bezahlt: number;
  bezahltAusBudget: number;
  bezahltVonMarcel: number;
  budgetRest: number;
  offenFixSumme: number;
  offenFix: OffenerPosten[];
  sonderfahrtenOffen: number;
  sonderfahrtenKosten: number;
  uebungsstundenGefahren: number;
  uebungsstundenGeplant: number;
  uebungsstunden: number;
  gutscheinFahrstunden: number;
  gutscheinWert: number;
  uebungKosten: number;
  gesamtMinimum: number;
  eigenanteil: number;
  /** Position des Elternbudget-Markers in Prozent der Balkenbreite. */
  markerAnteil: number;
  segmente: BalkenSegment[];
  zahlungen: Zahlung[];
  sonderfahrten: Sonderfahrt[];
  fahrstunden: Fahrstunde[];
  nichtBezifferbar: string[];
};

type Frontmatter = {
  budget_gesamt?: unknown;
  preise?: Record<string, unknown>;
  zahlungen?: unknown;
  offen_fix?: unknown;
  sonderfahrten?: unknown;
  fahrstunden?: unknown;
  nicht_bezifferbar?: unknown;
  uebungsstunden_geplant?: unknown;
  gutschein_fahrstunden?: unknown;
};

function extractFrontmatter(content: string): Frontmatter {
  // readNote() hat BOM und CRLF bereits normalisiert.
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    throw new FahrschuleDataError(
      "Kein YAML-Frontmatter in der Budget-Datei gefunden.",
    );
  }
  let parsed: unknown;
  try {
    parsed = yamlLoad(match[1]);
  } catch (err) {
    throw new FahrschuleDataError(
      `Frontmatter ist kein gültiges YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new FahrschuleDataError("Frontmatter ist leer.");
  }
  return parsed as Frontmatter;
}

function requireNumber(value: unknown, feld: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new FahrschuleDataError(`Feld "${feld}" fehlt oder ist keine Zahl.`);
  }
  return n;
}

function requireArray(value: unknown, feld: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new FahrschuleDataError(`Feld "${feld}" fehlt oder ist keine Liste.`);
  }
  return value;
}

/** Auf zwei Nachkommastellen runden – vermeidet 0.1+0.2-Artefakte in den Summen. */
function cent(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseFahrschuleBudget(content: string): FahrschuleBudget {
  const fm = extractFrontmatter(content);

  const budgetGesamt = requireNumber(fm.budget_gesamt, "budget_gesamt");
  const preisFahrstunde = requireNumber(
    fm.preise?.fahrstunde_45min,
    "preise.fahrstunde_45min",
  );

  const zahlungen = requireArray(fm.zahlungen, "zahlungen").map((z, i) => {
    const row = z as Record<string, unknown>;
    return {
      posten: String(row.posten ?? `Zahlung ${i + 1}`),
      betrag: requireNumber(row.betrag, `zahlungen[${i}].betrag`),
      zahler: String(row.zahler ?? "unbekannt"),
      datum: row.datum ? String(row.datum).slice(0, 10) : null,
      hinweis: row.hinweis ? String(row.hinweis) : undefined,
    } satisfies Zahlung;
  });

  const offenFix = requireArray(fm.offen_fix, "offen_fix").map((o, i) => {
    const row = o as Record<string, unknown>;
    return {
      posten: String(row.posten ?? `Posten ${i + 1}`),
      betrag: requireNumber(row.betrag, `offen_fix[${i}].betrag`),
    } satisfies OffenerPosten;
  });

  const sonderfahrten = requireArray(fm.sonderfahrten, "sonderfahrten").map(
    (s, i) => {
      const row = s as Record<string, unknown>;
      return {
        art: String(row.art ?? `Art ${i + 1}`),
        pflicht: requireNumber(row.pflicht, `sonderfahrten[${i}].pflicht`),
        gefahren: requireNumber(row.gefahren, `sonderfahrten[${i}].gefahren`),
      } satisfies Sonderfahrt;
    },
  );

  const fahrstunden = requireArray(fm.fahrstunden, "fahrstunden").map((f, i) => {
    const row = f as Record<string, unknown>;
    const inhalt = Array.isArray(row.inhalt) ? row.inhalt.map(String) : [];
    return {
      nr: requireNumber(row.nr, `fahrstunden[${i}].nr`),
      datum: String(row.datum ?? "").slice(0, 10),
      dauer_min: requireNumber(row.dauer_min, `fahrstunden[${i}].dauer_min`),
      status:
        row.status === "gefahren"
          ? "gefahren"
          : row.status === "abgesagt"
            ? "abgesagt"
            : "geplant",
      inhalt,
      hinweis: row.hinweis ? String(row.hinweis) : undefined,
    } satisfies Fahrstunde;
  });

  const nichtBezifferbar = Array.isArray(fm.nicht_bezifferbar)
    ? fm.nicht_bezifferbar.map(String)
    : [];

  // ---- Rechnung (Formeln siehe Budget-Datei im Vault) ----
  const bezahlt = cent(zahlungen.reduce((s, z) => s + z.betrag, 0));
  const bezahltVonMarcel = cent(
    zahlungen.filter((z) => z.zahler === "Marcel").reduce((s, z) => s + z.betrag, 0),
  );
  const bezahltAusBudget = cent(bezahlt - bezahltVonMarcel);
  const budgetRest = cent(Math.max(0, budgetGesamt - bezahltAusBudget));

  const offenFixSumme = cent(offenFix.reduce((s, o) => s + o.betrag, 0));

  // ⚠️ WICHTIG: "gefahren" heißt NICHT "bezahlt".
  // Die Fahrstunden werden laut §5 des Ausbildungsvertrags erst nach
  // Rechnungsstellung fällig. Unter `zahlungen` stehen bisher nur der
  // Theorieblock, das Schaltpaket (Pauschale) und der TÜV-Vorschuss –
  // keine einzige Sonderfahrt. Deshalb zählen hier ALLE 12 Pflicht-
  // Sonderfahrten in die Kosten, nicht nur die noch offenen.
  // `sonderfahrtenOffen` ist reine Fortschrittsanzeige.
  const sonderfahrtenPflicht = sonderfahrten.reduce((s, f) => s + f.pflicht, 0);
  const sonderfahrtenOffen = sonderfahrten.reduce(
    (s, f) => s + Math.max(0, f.pflicht - f.gefahren),
    0,
  );
  const sonderfahrtenKosten = cent(sonderfahrtenPflicht * preisFahrstunde);

  // Übungsstunden kommen zusätzlich zu den Pflicht-Sonderfahrten dazu –
  // jede Übungsstunde wird separat berechnet.
  //  - gefahren: aus der Fahrstundenliste gezählt, NUR aus Terminen mit
  //    status "gefahren". Sonst würde eine geplante Übungsstunde als
  //    bereits gefahren gezählt und still in die Kosten wandern.
  //  - geplant:  Schätzwert aus `uebungsstunden_geplant`; steht seit dem
  //    29.10.2026 auf 0, weil Marcel nur Gefahrenes gerechnet haben will.
  //  - Gutschein: eine Doppelstunde gratis, mindert die berechneten Stunden
  const uebungsstundenGefahren = fahrstunden.reduce(
    (s, f) =>
      f.status === "gefahren"
        ? s + f.inhalt.filter((x) => x.toLowerCase().startsWith("übung")).length
        : s,
    0,
  );
  const uebungsstundenGeplant = Math.max(
    0,
    Number(fm.uebungsstunden_geplant ?? 0) || 0,
  );
  const uebungsstunden = uebungsstundenGefahren + uebungsstundenGeplant;
  const gutscheinFahrstunden = Math.max(
    0,
    Number(fm.gutschein_fahrstunden ?? 0) || 0,
  );
  // Der Gutschein kann nie mehr abziehen, als an Übungsstunden anfällt.
  const gutscheinGenutzt = Math.min(gutscheinFahrstunden, uebungsstunden);
  const gutscheinWert = cent(gutscheinGenutzt * preisFahrstunde);
  const uebungKosten = cent((uebungsstunden - gutscheinGenutzt) * preisFahrstunde);

  const gesamtMinimum = cent(
    bezahlt + offenFixSumme + sonderfahrtenKosten + uebungKosten,
  );
  const eigenanteil = cent(Math.max(0, gesamtMinimum - budgetGesamt));

  // ---- Balken: vier Segmente, Marker beim Elternbudget ----
  // Reihenfolge ist bewusst so, dass Segment 1 + 2 exakt budget_gesamt ergeben.
  // Dadurch liegt der Marker immer genau auf der Grenze zu Segment 3:
  // links davon Elterngeld, rechts davon Marcels Geld.
  const elternOffen = cent(Math.max(0, Math.min(budgetGesamt, gesamtMinimum) - bezahltAusBudget));
  const duOffen = cent(Math.max(0, gesamtMinimum - budgetGesamt - bezahltVonMarcel));

  const basis = gesamtMinimum > 0 ? gesamtMinimum : 1;
  const mk = (
    key: BalkenSegment["key"],
    label: string,
    betrag: number,
    bezahltFlag: boolean,
    wer: BalkenSegment["wer"],
  ): BalkenSegment => ({
    key,
    label,
    betrag,
    anteil: (betrag / basis) * 100,
    bezahlt: bezahltFlag,
    wer,
  });

  const segmente: BalkenSegment[] = [
    mk("eltern_bezahlt", "Eltern bezahlt", bezahltAusBudget, true, "eltern"),
    mk("eltern_offen", "Eltern offen", elternOffen, false, "eltern"),
    mk("du_bezahlt", "du bezahlt", bezahltVonMarcel, true, "marcel"),
    mk("du_offen", "du offen", duOffen, false, "marcel"),
  ];

  // Marker nie über das rechte Ende hinaus (Fall: Budget reicht doch).
  const markerAnteil = Math.min(100, (budgetGesamt / basis) * 100);

  return {
    budgetGesamt,
    preisFahrstunde,
    bezahlt,
    bezahltAusBudget,
    bezahltVonMarcel,
    budgetRest,
    offenFixSumme,
    offenFix,
    sonderfahrtenOffen,
    sonderfahrtenKosten,
    uebungsstundenGefahren,
    uebungsstundenGeplant,
    uebungsstunden,
    gutscheinFahrstunden,
    gutscheinWert,
    uebungKosten,
    gesamtMinimum,
    eigenanteil,
    markerAnteil,
    segmente,
    zahlungen,
    sonderfahrten,
    fahrstunden,
    nichtBezifferbar,
  };
}
