// Datenquelle: "03 Bereiche/Routinen & Gewohnheiten/Habit-Log.md" im Vault.
//
// Der Log ist eine Markdown-Tabelle, eine Zeile pro Tag. Seit dem 26.10.2026
// stehen dort Zahlen statt Haken – Marcels Begründung: „dass du dann so sehen
// kannst, ob ich Fortschritt mache, ob ich eher schlechter werde." Ein ✓ sagt
// das nicht, eine Minutenzahl schon.
//
// Spalten: Datum | Tag | Auf | Schlaf | Morgen | App | 10F | Engl | Lesen |
//          Schwimmen | Training | W-Sem
//
// Zeichen (aus der Legende der Datei):
//   ✓  erledigt          ✗  war fällig, ausgefallen
//   –  heute nicht fällig   ?  unbekannt, NICHT als erledigt werten
//
// ⚠️ Zwei Fallen aus diesem Repo, beide hier beachtet:
//   1. CRLF/BOM – wird von readNote() in lib/obsidian.ts normalisiert.
//   2. Der Parser muss SICHTBAR scheitern statt leer zu rendern. Ein leerer
//      Habit-Tracker sieht aus wie „nichts getan", nicht wie „kaputt".

export class HabitDataError extends Error {}

/** Status einer einzelnen Zelle. */
export type Status = "ok" | "fehlt" | "nichtFaellig" | "unbekannt";

export type Wert = {
  status: Status;
  /** Rohtext aus der Tabelle, z.B. "06:30", "45", "1200 m Brust". */
  roh: string;
  /** Numerischer Wert, wo sinnvoll (Minuten, Stunden, Meter). */
  zahl: number | null;
};

export type Tag = {
  datum: string; // YYYY-MM-DD
  wochentag: string; // Mo, Di, ...
  werte: Record<string, Wert>;
};

export type HabitDef = {
  key: string;
  /** Spaltenname in der Tabelle. */
  spalte: string;
  label: string;
  icon: string;
  /** Zielwert, falls es einen gibt. */
  ziel: number | null;
  einheit: string;
  /** An welchen Wochentagen fällig; leer = täglich. */
  tage: string[];
  /** Zahl oder nur ja/nein? */
  numerisch: boolean;
};

export type HabitAuswertung = {
  def: HabitDef;
  /** Letzte 14 Tage, älteste zuerst. */
  verlauf: Wert[];
  /** Erledigt von fällig, über den gesamten Zeitraum. */
  erledigt: number;
  faellig: number;
  quote: number | null;
  /** Aktuelle Serie erledigter Tage (nur fällige zählen). */
  streak: number;
  /** Serie ausgefallener Tage – die interessantere Zahl. */
  ausfallStreak: number;
  /** Durchschnitt der Zahlenwerte, wo numerisch. */
  schnitt: number | null;
  /** Schnitt der ersten vs. zweiten Hälfte – wird es besser oder schlechter? */
  trend: "besser" | "schlechter" | "gleich" | null;
};

export type HabitStand = {
  tage: Tag[];
  habits: HabitAuswertung[];
  /** Tage mit mindestens einem ✓ geteilt durch Tage gesamt. */
  tageGesamt: number;
  /** Datum der letzten Zeile – wenn das alt ist, fehlen Abend-Checks. */
  letzterEintrag: string | null;
  /** Wie viele Tage liegen zwischen letztem Eintrag und heute. */
  tageSeitLetztem: number | null;
};

/**
 * Die Habit-Definitionen.
 *
 * Bewusst HIER und nicht in der Vault-Datei: Der Log ist ein Protokoll, keine
 * Konfiguration. Ändert Marcel seine Habits, ändert sich die Tabellenspalte –
 * und dann muss hier ohnehin jemand hinschauen.
 *
 * Quelle: "03 Bereiche/Routinen & Gewohnheiten/Routinen & Gewohnheiten.md",
 * Abschnitt „DAS NEUE SYSTEM" (von Marcel am 26.10.2026 selbst diktiert).
 */
export const HABITS: HabitDef[] = [
  {
    key: "auf",
    spalte: "Auf",
    label: "Aufstehen",
    icon: "🕕",
    ziel: null,
    einheit: "",
    tage: [],
    numerisch: false,
  },
  {
    key: "schlaf",
    spalte: "Schlaf",
    label: "Schlaf",
    icon: "😴",
    ziel: 7.5,
    einheit: "h",
    tage: [],
    numerisch: true,
  },
  {
    key: "morgen",
    spalte: "Morgen",
    label: "Morgenroutine",
    icon: "🌅",
    ziel: null,
    einheit: "",
    tage: [],
    numerisch: false,
  },
  {
    key: "app",
    spalte: "App",
    label: "Fahrschul-App",
    icon: "🚗",
    ziel: 60,
    einheit: "Min",
    tage: [],
    numerisch: true,
  },
  {
    key: "zehnfinger",
    spalte: "10F",
    label: "10-Finger",
    icon: "⌨️",
    ziel: null,
    einheit: "",
    tage: [],
    numerisch: false,
  },
  {
    key: "englisch",
    spalte: "Engl",
    label: "Englisch",
    icon: "🇬🇧",
    ziel: null,
    einheit: "",
    tage: [],
    numerisch: false,
  },
  {
    key: "lesen",
    spalte: "Lesen",
    label: "Lesen",
    icon: "📕",
    ziel: 30,
    einheit: "Min",
    tage: [],
    numerisch: true,
  },
  {
    key: "schwimmen",
    spalte: "Schwimmen",
    label: "Schwimmen",
    icon: "🏊",
    ziel: null,
    einheit: "m",
    tage: ["Mi", "Sa"],
    numerisch: true,
  },
  {
    key: "training",
    spalte: "Training",
    label: "Training",
    icon: "⚽",
    ziel: null,
    einheit: "",
    tage: ["Di", "Do"],
    numerisch: false,
  },
  {
    key: "wsem",
    spalte: "W-Sem",
    label: "W-Seminar",
    icon: "📝",
    ziel: null,
    einheit: "",
    tage: [],
    numerisch: false,
  },
];

/** Erste Zahl aus einem Text ziehen – "1200 m Brust" → 1200, "45" → 45. */
function ersteZahl(text: string): number | null {
  const m = text.replace(",", ".").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Uhrzeit "06:30" → 6.5 (Stunden als Dezimalzahl). */
function uhrzeitAlsZahl(text: string): number | null {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

function zelleLesen(roh: string, def: HabitDef): Wert {
  const t = roh.trim();

  if (t === "" || t === "?") return { status: "unbekannt", roh: t, zahl: null };
  if (t === "–" || t === "-" || t === "—")
    return { status: "nichtFaellig", roh: t, zahl: null };
  if (t === "✗" || t === "x" || t === "✘")
    return { status: "fehlt", roh: t, zahl: null };
  if (t === "✓" || t === "✔")
    return { status: "ok", roh: t, zahl: null };

  // Alles andere ist ein Wert: Uhrzeit, Minuten, Meter, "3/4" …
  const uhr = uhrzeitAlsZahl(t);
  if (uhr !== null) return { status: "ok", roh: t, zahl: uhr };

  const bruch = t.match(/^(\d+)\s*\/\s*(\d+)/);
  if (bruch) {
    const erledigt = Number(bruch[1]);
    const gesamt = Number(bruch[2]);
    // Morgenroutine "2/4": nur vollständig zählt als erledigt.
    return {
      status: erledigt >= gesamt ? "ok" : "fehlt",
      roh: t,
      zahl: gesamt > 0 ? (erledigt / gesamt) * 100 : null,
    };
  }

  const zahl = ersteZahl(t);
  if (zahl !== null) {
    // Mit Ziel: erreicht oder nicht. Ohne Ziel: vorhanden = erledigt.
    const ok = def.ziel === null ? zahl > 0 : zahl >= def.ziel;
    return { status: ok ? "ok" : "fehlt", roh: t, zahl };
  }

  return { status: "ok", roh: t, zahl: null };
}

/**
 * Die Tabelle unter der Überschrift mit `marker` einlesen.
 *
 * ⚠️ Der Abschnitt endet an der NÄCHSTEN Überschrift gleicher oder höherer
 * Ebene. Ohne diese Grenze liest der Parser die Archivtabelle („Log
 * 12.–25.10.2026 – altes System") mit – die hat andere Spalten, und ihre
 * Zeilen werden dann gegen die Spaltenköpfe der neuen Tabelle gemappt.
 * Das Ergebnis sind falsche Zahlen ohne jede Fehlermeldung. Genau so ist
 * es beim ersten Lauf am 27.10.2026 passiert.
 */
function tabelleLesen(content: string, marker: string): string[][] {
  const start = content.indexOf(marker);
  if (start === -1) {
    throw new HabitDataError(
      `Überschrift "${marker}" nicht gefunden – hat sich der Aufbau des Habit-Logs geändert?`,
    );
  }
  // Ab der Zeile NACH dem Marker bis zur nächsten ##-Überschrift.
  const nachMarker = content.slice(start + marker.length);
  const naechste = nachMarker.search(/\n#{1,2} /);
  const rest = naechste === -1 ? nachMarker : nachMarker.slice(0, naechste);

  const zeilen = rest
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z.startsWith("|") && z.endsWith("|"));

  if (zeilen.length < 3) {
    throw new HabitDataError(
      "Unter der Überschrift steht keine vollständige Tabelle (Kopf, Trenner, mindestens eine Zeile).",
    );
  }

  return zeilen.map((z) =>
    z
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim()),
  );
}

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function parseHabitStand(content: string, heute = new Date()): HabitStand {
  // Die Tabelle des NEUEN Systems. Die Archivtabelle darunter hat andere
  // Spalten und wird bewusst nicht gelesen.
  const marker = "## 📊 Log ab 26.10.2026";
  const rows = tabelleLesen(content, marker);

  const kopf = rows[0];
  const trennerIdx = rows.findIndex((r) => r.every((c) => /^-+$/.test(c)));
  if (trennerIdx !== 1) {
    throw new HabitDataError(
      "Zweite Tabellenzeile ist kein Trenner – die Tabelle sieht anders aus als erwartet.",
    );
  }

  const spaltenIdx = new Map(kopf.map((name, i) => [name, i]));
  for (const def of HABITS) {
    if (!spaltenIdx.has(def.spalte)) {
      throw new HabitDataError(
        `Spalte "${def.spalte}" fehlt im Habit-Log. Vorhanden: ${kopf.join(", ")}`,
      );
    }
  }
  const datumIdx = spaltenIdx.get("Datum");
  if (datumIdx === undefined) {
    throw new HabitDataError('Spalte "Datum" fehlt im Habit-Log.');
  }

  const tage: Tag[] = [];
  for (const row of rows.slice(trennerIdx + 1)) {
    const datum = row[datumIdx] ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) continue; // Fußnoten o.ä. überspringen

    const d = new Date(`${datum}T12:00:00`);
    const werte: Record<string, Wert> = {};
    for (const def of HABITS) {
      const i = spaltenIdx.get(def.spalte) as number;
      werte[def.key] = zelleLesen(row[i] ?? "", def);
    }
    tage.push({
      datum,
      wochentag: WOCHENTAGE[d.getDay()],
      werte,
    });
  }

  if (!tage.length) {
    throw new HabitDataError(
      "Die Tabelle enthält keine Datenzeile mit gültigem Datum (Format YYYY-MM-DD).",
    );
  }

  tage.sort((a, b) => a.datum.localeCompare(b.datum));
  const letzten = tage.slice(-14);

  const habits: HabitAuswertung[] = HABITS.map((def) => {
    const verlauf = letzten.map((t) => t.werte[def.key]);

    const faelligeWerte = verlauf.filter(
      (w) => w.status === "ok" || w.status === "fehlt",
    );
    const erledigt = faelligeWerte.filter((w) => w.status === "ok").length;
    const faellig = faelligeWerte.length;

    // Streaks von hinten, ? unterbricht nicht – es ist keine Information.
    let streak = 0;
    let ausfallStreak = 0;
    for (let i = verlauf.length - 1; i >= 0; i--) {
      const s = verlauf[i].status;
      if (s === "nichtFaellig" || s === "unbekannt") continue;
      if (s === "ok") break;
      ausfallStreak++;
    }
    for (let i = verlauf.length - 1; i >= 0; i--) {
      const s = verlauf[i].status;
      if (s === "nichtFaellig" || s === "unbekannt") continue;
      if (s === "fehlt") break;
      streak++;
    }

    const zahlen = verlauf
      .map((w) => w.zahl)
      .filter((z): z is number => z !== null);
    const schnitt = zahlen.length
      ? zahlen.reduce((a, b) => a + b, 0) / zahlen.length
      : null;

    // Trend nur, wenn in beiden Hälften genug Daten liegen.
    let trend: HabitAuswertung["trend"] = null;
    const mitte = Math.floor(verlauf.length / 2);
    const bewerten = (teil: Wert[]) => {
      const rel = teil.filter((w) => w.status === "ok" || w.status === "fehlt");
      if (rel.length < 2) return null;
      return rel.filter((w) => w.status === "ok").length / rel.length;
    };
    const a = bewerten(verlauf.slice(0, mitte));
    const b = bewerten(verlauf.slice(mitte));
    if (a !== null && b !== null) {
      if (b > a + 0.15) trend = "besser";
      else if (b < a - 0.15) trend = "schlechter";
      else trend = "gleich";
    }

    return {
      def,
      verlauf,
      erledigt,
      faellig,
      quote: faellig > 0 ? erledigt / faellig : null,
      streak,
      ausfallStreak,
      schnitt,
      trend,
    };
  });

  const letzterEintrag = tage[tage.length - 1].datum;
  const msProTag = 24 * 60 * 60 * 1000;
  const heuteMitternacht = new Date(
    heute.getFullYear(),
    heute.getMonth(),
    heute.getDate(),
  ).getTime();
  const letzterMitternacht = new Date(`${letzterEintrag}T00:00:00`).getTime();
  const tageSeitLetztem = Math.round((heuteMitternacht - letzterMitternacht) / msProTag);

  return {
    tage: letzten,
    habits,
    tageGesamt: tage.length,
    letzterEintrag,
    tageSeitLetztem,
  };
}
