import { load as yamlLoad } from "js-yaml";

// Datenquelle: "04 Ressourcen/Schule/Noten (Daten).md" im Vault.
//
// ── Notenbildung im bayerischen G9 ────────────────────────────────────────
// Von Marcel erklärt, am eigenen Notenbogen Q12 gegengeprüft (5/5 Stichproben)
// und am 27.10.2026 zusätzlich durch die OSK-Unterlage bestätigt
// („Wertung 1:1 schr. (große LST) : mdl. (kleine LST)"):
//   schnitt_klein  = Mittelwert aller kleinen LN (ungerundet!)
//   halbjahresnote = (grosser_LN + schnitt_klein) / 2
//   zeugnispunkte  = round(halbjahresnote), ab 0,5 aufwärts
//
// Fehlende Leistungen zählen NICHT als 0 Punkte – sie fallen aus der Rechnung
// heraus. Eine noch nicht geschriebene Klausur darf den Schnitt nicht drücken.
//
// ── Einbringung ───────────────────────────────────────────────────────────
// 40 Halbjahresleistungen: 36 aus Fächern (12/1–13/2) + 2 W-Seminar
// + 2 Seminararbeit. Block I max 600 Punkte, Block II (5 Abiturprüfungen,
// vierfach) max 300 → gesamt max 900, mindestens 300 zum Bestehen.
// Quelle: Marcels OSK-Unterlagen, abgeschrieben in
// "04 Ressourcen/Schule/Einbringung & Abiturberechnung (OSK-Unterlagen).md".
//
// ── Abiturnote ────────────────────────────────────────────────────────────
// N = 17/3 − P/180, ABGESCHNITTEN auf eine Nachkommastelle (nicht gerundet!),
// nach unten begrenzt auf 1,0. Verifiziert an GSO Anlage 13, 9/9 Stützstellen:
// https://www.gesetze-bayern.de/Content/Document/BayGSO-ANL_23
// ⚠️ Abschneiden ist der Knackpunkt: 823 P → 1,0944 → 1,0 (gerundet wäre 1,1).

export class NotenDataError extends Error {}

export type Einzelnote = {
  art: string;
  datum: string | null;
  punkte: number;
  thema?: string;
};

/** Eine einzelne Halbjahresleistung – ein Fach in einem Halbjahr. */
export type Slot = {
  id: string; // "12/1|Deutsch"
  halbjahr: string;
  fach: string;
  kuerzel: string;
  /** Großer LN (Klausur); null = noch nicht geschrieben. */
  gross: number | null;
  /** Schnitt der kleinen LN; null = noch keine. */
  klein: number | null;
  /** Ungerundete Halbjahresnote; null = gar keine Leistung. */
  roh: number | null;
  /** Gerundete Zeugnispunkte; null = noch offen. */
  zeugnis: number | null;
  kleinNoten: Einzelnote[];
  grossNoten: Einzelnote[];
  hinweis?: string;
  /** Vorauswahl nach den Einbringungsregeln. */
  eingebracht: boolean;
  /** true = muss eingebracht werden, nicht abwählbar. */
  pflicht: boolean;
};

export type Halbjahr = {
  id: string;
  abgeschlossen: boolean;
  /** Hat dieses Halbjahr überhaupt schon eine Note? */
  begonnen: boolean;
  slots: Slot[];
  /** Schnitt über alle Fächer mit Note. */
  schnittAlle: number | null;
  /** Schnitt nur über die eingebrachten Fächer mit Note (Vorauswahl). */
  schnittEingebracht: number | null;
  anzahlMitNote: number;
};

export type FachRegel = {
  fach: string;
  kuerzel: string;
  /** Wie viele Halbjahre das Fach überhaupt belegt ist. */
  belegt: number;
  /** Wie viele davon in der Vorauswahl eingebracht werden. */
  eingebracht: number;
  /** true = Pflichtfach, jedes Halbjahr zählt und ist nicht abwählbar. */
  pflicht: boolean;
  grund: string;
};

export type Pruefung = {
  fach: string;
  art: string;
  /** Einfache Punktzahl 0–15; null = noch nicht geschrieben. */
  punkte: number | null;
};

export type NotenStand = {
  halbjahre: Halbjahr[];
  regeln: FachRegel[];
  /** Schnitt über alle abgeschlossenen Halbjahre. */
  schnittAbgeschlossen: number | null;
  schnittAktuell: number | null;
  aktuellesHalbjahr: string | null;
  wSeminar: {
    thema: string;
    punkte: Record<string, number>;
    schriftlich: number | null;
    praesentation: number | null;
    /** Gerundete Seminararbeitsnote (zählt doppelt); null = offen. */
    arbeitNote: number | null;
  } | null;
  pruefungen: Pruefung[];
  /** Der frei verteilbare Topf aus Informatik, Ethik, Kunst, Geschichte, PuG. */
  pool: {
    faecher: string[];
    /** Wie viele Halbjahresleistungen dort insgesamt zur Verfügung stehen. */
    verfuegbar: number;
    /** Wie viele davon eingebracht werden müssen, damit 40 voll sind. */
    soll: number;
    /** verfuegbar − soll */
    streichungen: number;
    /** Summe der Mindesteinbringungen je Fach (höchstens eine Streichung). */
    mindest: number;
  };
  /** Soll-Zahlen aus der OSK-Unterlage. */
  soll: {
    gesamt: number;
    ausFaechern: number;
    ausSeminar: number;
    maxBlockI: number;
    maxBlockII: number;
    maxGesamt: number;
    bestehen: number;
    fuenfPunkteHuerde: number;
  };
};

type Frontmatter = Record<string, unknown>;

function extractFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new NotenDataError("Kein YAML-Frontmatter in der Notendatei.");
  let parsed: unknown;
  try {
    parsed = yamlLoad(match[1]);
  } catch (err) {
    throw new NotenDataError(
      `Frontmatter ist kein gültiges YAML: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!parsed || typeof parsed !== "object")
    throw new NotenDataError("Frontmatter ist leer.");
  return parsed as Frontmatter;
}

/** Kaufmännisch runden: ab 0,5 aufwärts. */
function rundeNote(n: number): number {
  return Math.round(n);
}

function mittel(werte: number[]): number | null {
  if (!werte.length) return null;
  return werte.reduce((a, b) => a + b, 0) / werte.length;
}

function zwei(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseNoten(raw: unknown): Einzelnote[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((n) => {
    const row = n as Record<string, unknown>;
    return {
      art: String(row.art ?? "Leistungsnachweis"),
      datum: row.datum ? String(row.datum).slice(0, 10) : null,
      punkte: Number(row.punkte),
      thema: row.thema ? String(row.thema) : undefined,
    };
  });
}

export const slotId = (halbjahr: string, fach: string) => `${halbjahr}|${fach}`;

/**
 * Abiturdurchschnittsnote aus der Gesamtpunktzahl.
 * N = 17/3 − P/180, ABGESCHNITTEN auf eine Nachkommastelle, min 1,0.
 * Verifiziert an GSO Anlage 13 (9 von 9 Stützstellen).
 */
export function abiNote(punkte: number): number | null {
  if (punkte < 300) return null; // unter 300 Punkten: nicht bestanden
  const roh = 17 / 3 - punkte / 180;
  // Math.floor, NICHT Math.round – 823 P ergibt 1,0944 und muss 1,0 werden.
  return Math.max(1.0, Math.floor(roh * 10) / 10);
}

export function parseNotenStand(content: string): NotenStand {
  const fm = extractFrontmatter(content);

  const einbringung = (fm.einbringung ?? {}) as Record<string, unknown>;

  const leseGruppe = (raw: unknown, name: string) => {
    if (!Array.isArray(raw) || !raw.length) {
      throw new NotenDataError(
        `Feld "einbringung.${name}" fehlt oder ist leer – ohne die Fächergruppen kann das Widget nichts rechnen.`,
      );
    }
    return raw.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        fach: String(row.fach),
        grund: String(row.grund ?? ""),
        // Wie viele Leistungen dieses Fach höchstens verlieren darf.
        // Default 1 – „in der Regel eine der Halbjahresleistungen streichen".
        streichbar:
          row.streichbar === undefined ? 1 : Math.max(0, Number(row.streichbar) || 0),
      };
    });
  };

  const pflichtGruppe = leseGruppe(einbringung.pflicht, "pflicht");
  const poolGruppe = leseGruppe(einbringung.pool, "pool");

  const grundMap = new Map<string, string>();
  const istPflicht = new Set<string>();
  for (const g of pflichtGruppe) {
    grundMap.set(g.fach, g.grund);
    istPflicht.add(g.fach);
  }
  for (const g of poolGruppe) grundMap.set(g.fach, g.grund);

  if (!Array.isArray(fm.halbjahre)) {
    throw new NotenDataError('Feld "halbjahre" fehlt oder ist keine Liste.');
  }

  // ---- 1. Alle Slots einlesen ----
  type RohSlot = Omit<Slot, "eingebracht" | "pflicht">;
  const rohHalbjahre: { id: string; abgeschlossen: boolean; slots: RohSlot[] }[] =
    fm.halbjahre.map((h) => {
      const hj = h as Record<string, unknown>;
      const id = String(hj.id ?? "?");
      const faecherRaw = Array.isArray(hj.faecher) ? hj.faecher : [];

      const slots: RohSlot[] = faecherRaw.map((f) => {
        const row = f as Record<string, unknown>;
        const fach = String(row.fach ?? "?");

        const kleinNoten = parseNoten(row.klein_noten);
        const grossNoten = parseNoten(row.gross_noten);

        // Abgeschlossene Halbjahre liefern gr./kl. direkt vom Notenbogen,
        // laufende Halbjahre rechnen sie aus den Einzelnoten aus.
        const klein =
          row.klein !== undefined && row.klein !== null
            ? Number(row.klein)
            : mittel(kleinNoten.map((n) => n.punkte).filter(Number.isFinite));
        const gross =
          row.gross !== undefined && row.gross !== null
            ? Number(row.gross)
            : mittel(grossNoten.map((n) => n.punkte).filter(Number.isFinite));

        // ⚠️ Kein fehlender Wert zählt als 0.
        let roh: number | null = null;
        if (gross !== null && klein !== null) roh = (gross + klein) / 2;
        else if (gross !== null) roh = gross;
        else if (klein !== null) roh = klein;

        const zeugnisVorgabe =
          row.zeugnis !== undefined && row.zeugnis !== null ? Number(row.zeugnis) : null;

        return {
          id: slotId(id, fach),
          halbjahr: id,
          fach,
          kuerzel: String(row.kuerzel ?? fach.slice(0, 3)),
          gross: gross === null ? null : zwei(gross),
          klein: klein === null ? null : zwei(klein),
          roh: roh === null ? null : zwei(roh),
          zeugnis:
            zeugnisVorgabe !== null ? zeugnisVorgabe : roh === null ? null : rundeNote(roh),
          kleinNoten,
          grossNoten,
          hinweis: row.hinweis ? String(row.hinweis) : undefined,
        } satisfies RohSlot;
      });

      return { id, abgeschlossen: hj.abgeschlossen === true, slots };
    });

  // ---- 2. Einbringungs-Vorauswahl je Fach ----
  //
  // Zwei Gruppen (von Marcel am 27.10.2026 erklärt):
  //   PFLICHT – jedes Halbjahr zählt, nichts ist abwählbar.
  //   POOL    – ein gemeinsamer Topf. Daraus kommen so viele Leistungen,
  //             dass zusammen mit Pflicht und Seminar 40 erreicht werden.
  //             Wie sie sich auf die Fächer verteilen, ist frei.
  //
  // ⚠️ Der Topf wird NICHT fachweise aufgeteilt. Eine feste Quote je Fach
  // („Ethik genau 3") würde Streichungen erzwingen, die es nicht gibt, und
  // dabei bessere Noten wegwerfen als nötig. Stattdessen wird global die
  // beste Kombination aus dem gesamten Topf gewählt.
  const proFach = new Map<string, RohSlot[]>();
  for (const h of rohHalbjahre) {
    for (const s of h.slots) {
      const liste = proFach.get(s.fach) ?? [];
      liste.push(s);
      proFach.set(s.fach, liste);
    }
  }

  for (const fach of proFach.keys()) {
    if (!grundMap.has(fach)) {
      throw new NotenDataError(
        `"${fach}" steht in keiner der beiden Gruppen (einbringung.pflicht / einbringung.pool).`,
      );
    }
  }

  const eingebrachtIds = new Set<string>();
  const pflichtIds = new Set<string>();

  // Pflichtfächer: alles rein, alles gesperrt.
  let pflichtAnzahl = 0;
  for (const fach of istPflicht) {
    for (const s of proFach.get(fach) ?? []) {
      eingebrachtIds.add(s.id);
      pflichtIds.add(s.id);
      pflichtAnzahl++;
    }
  }

  // Topf: so viele, dass 40 voll werden. Die Zahl wird gerechnet, nicht
  // hartkodiert – ändert sich eine Belegung, korrigiert sie sich selbst.
  const gesamtSoll = Number(einbringung.gesamt_halbjahresleistungen ?? 40);
  const seminarSoll = Number(einbringung.aus_seminar ?? 4);
  const poolSlots = poolGruppe.flatMap((g) => proFach.get(g.fach) ?? []);
  const poolSoll = gesamtSoll - seminarSoll - pflichtAnzahl;

  if (poolSoll > poolSlots.length) {
    throw new NotenDataError(
      `Aus dem Topf werden ${poolSoll} Halbjahresleistungen gebraucht, es gibt aber nur ${poolSlots.length}. ` +
        `Stimmen die Belegungen in den Halbjahren?`,
    );
  }

  // Auswahl aus dem Topf – ZWEI STUFEN.
  //
  // Das bayerische Modell ist nicht „nimm einfach die besten 12". Laut
  // gymnasiale-oberstufe.bayern.de gilt beides gleichzeitig:
  //   1. In den übrigen Fächern darf „in der Regel JEWEILS EINE" Leistung
  //      gestrichen werden – also eine Mindesteinbringung pro Fach.
  //   2. Dazu kommen „bis zu drei weitere Ergebnisse nach freier Wahl".
  //
  // Stufe 1 sichert je Fach die Mindestzahl (die besten davon), Stufe 2
  // verteilt die übrigen Plätze global an die besten Verbliebenen.
  // ⚠️ Ohne Stufe 1 würde das Widget z.B. zwei Geschichte-Leistungen
  // streichen – das erlaubt die Regel nicht.
  //
  // Eine noch unbenotete Leistung wird mit dem bisherigen Schnitt bewertet.
  // Nicht einfach alle offenen zuerst nehmen: sonst fliegt eine echte 11
  // raus, während Unbekannte drinbleiben (von Marcel am 27.10. beanstandet).
  const alleBenoteten = rohHalbjahre.flatMap((h) =>
    h.slots.filter((s) => s.zeugnis !== null).map((s) => s.zeugnis as number),
  );
  const niveau = mittel(alleBenoteten) ?? 0;

  const rang = (s: RohSlot) => s.zeugnis ?? niveau;
  const besteZuerst = (a: RohSlot, b: RohSlot) =>
    rang(b) - rang(a) ||
    // Gleichstand: die bekannte Note schlägt die Schätzung – sie ist sicher.
    Number(b.zeugnis !== null) - Number(a.zeugnis !== null) ||
    // Unter offenen Slots die früheren behalten, das späteste Halbjahr ist
    // am wenigsten absehbar.
    a.halbjahr.localeCompare(b.halbjahr);

  // ---- Stufe 1: Mindesteinbringung je Fach ----
  const rest: RohSlot[] = [];
  for (const g of poolGruppe) {
    const slots = [...(proFach.get(g.fach) ?? [])].sort(besteZuerst);
    const mindest = Math.max(0, slots.length - g.streichbar);
    slots.forEach((s, i) => {
      if (i < mindest) eingebrachtIds.add(s.id);
      else rest.push(s);
    });
  }

  // ---- Stufe 2: freie Einbringungen global vergeben ----
  const freiePlaetze = Math.max(0, poolSoll - eingebrachtIds.size + pflichtAnzahl);
  for (const s of rest.sort(besteZuerst).slice(0, freiePlaetze)) {
    eingebrachtIds.add(s.id);
  }

  const regeln: FachRegel[] = [...proFach.entries()]
    .map(([fach, slots]) => ({
      fach,
      kuerzel: slots[0]?.kuerzel ?? fach.slice(0, 3),
      belegt: slots.length,
      eingebracht: slots.filter((s) => eingebrachtIds.has(s.id)).length,
      pflicht: istPflicht.has(fach),
      grund: grundMap.get(fach) ?? "",
    }))
    .sort(
      (a, b) =>
        Number(b.pflicht) - Number(a.pflicht) ||
        b.eingebracht - a.eingebracht ||
        a.fach.localeCompare(b.fach, "de"),
    );

  // ---- 3. Halbjahre zusammenbauen ----
  //
  // Die Fächer werden in JEDEM Halbjahr gleich sortiert – erst die
  // Pflichtfächer, dann der Topf, jeweils in der Reihenfolge der Vault-Datei.
  // Dort stehen sie pro Halbjahr unterschiedlich; nebeneinander dargestellte
  // Spalten wären dann nicht vergleichbar.
  const fachRang = new Map(
    [...pflichtGruppe, ...poolGruppe].map((g, i) => [g.fach, i] as const),
  );

  const halbjahre: Halbjahr[] = rohHalbjahre.map((h) => {
    const slots: Slot[] = h.slots
      .map((s) => ({
        ...s,
        eingebracht: eingebrachtIds.has(s.id),
        pflicht: pflichtIds.has(s.id),
      }))
      .sort(
        (a, b) =>
          (fachRang.get(a.fach) ?? 99) - (fachRang.get(b.fach) ?? 99) ||
          a.fach.localeCompare(b.fach, "de"),
      );
    const mitNote = slots.filter((s) => s.zeugnis !== null);
    const eing = mitNote.filter((s) => s.eingebracht);
    const schnittAlle = mittel(mitNote.map((s) => s.zeugnis as number));
    const schnittEingebracht = mittel(eing.map((s) => s.zeugnis as number));
    return {
      id: h.id,
      abgeschlossen: h.abgeschlossen,
      begonnen: mitNote.length > 0,
      slots,
      schnittAlle: schnittAlle === null ? null : zwei(schnittAlle),
      schnittEingebracht: schnittEingebracht === null ? null : zwei(schnittEingebracht),
      anzahlMitNote: mitNote.length,
    } satisfies Halbjahr;
  });

  const abgeschlossene = halbjahre.filter((h) => h.abgeschlossen);
  const schnittAbgeschlossen = mittel(
    abgeschlossene.flatMap((h) =>
      h.slots.filter((s) => s.zeugnis !== null).map((s) => s.zeugnis as number),
    ),
  );
  const laufend = halbjahre.find((h) => !h.abgeschlossen && h.begonnen) ?? null;

  // ---- 4. Seminar + Abiturprüfungen ----
  const w = (fm.seminare as Record<string, unknown> | undefined)?.w_seminar as
    | Record<string, unknown>
    | undefined;

  const schriftlich =
    w?.schriftlich !== undefined && w?.schriftlich !== null ? Number(w.schriftlich) : null;
  const praesentation =
    w?.praesentation !== undefined && w?.praesentation !== null
      ? Number(w.praesentation)
      : null;
  // Seminararbeitsnote = round((2 × schriftlich + 1 × Präsentation) / 3)
  // Diese gerundete Punktzahl zählt doppelt (max 30 P). OSK-Blatt 1.
  const arbeitNote =
    schriftlich !== null && praesentation !== null
      ? rundeNote((2 * schriftlich + praesentation) / 3)
      : null;

  const abitur = (fm.abitur ?? {}) as Record<string, unknown>;
  const pruefungen: Pruefung[] = Array.isArray(abitur.pruefungsfaecher)
    ? abitur.pruefungsfaecher.map((p) => {
        const row = p as Record<string, unknown>;
        return {
          fach: String(row.fach ?? "?"),
          art: String(row.art ?? ""),
          punkte: row.punkte === undefined || row.punkte === null ? null : Number(row.punkte),
        };
      })
    : [];

  const num = (v: unknown, fallback: number) =>
    v === undefined || v === null ? fallback : Number(v);

  return {
    halbjahre,
    regeln,
    schnittAbgeschlossen: schnittAbgeschlossen === null ? null : zwei(schnittAbgeschlossen),
    schnittAktuell: laufend?.schnittAlle ?? null,
    aktuellesHalbjahr: laufend?.id ?? null,
    wSeminar: w
      ? {
          thema: String(w.thema ?? ""),
          punkte: (w.halbjahre ?? {}) as Record<string, number>,
          schriftlich,
          praesentation,
          arbeitNote,
        }
      : null,
    pruefungen,
    pool: {
      faecher: poolGruppe.map((g) => g.fach),
      verfuegbar: poolSlots.length,
      soll: poolSoll,
      streichungen: poolSlots.length - poolSoll,
      mindest: poolGruppe.reduce(
        (s, g) => s + Math.max(0, (proFach.get(g.fach)?.length ?? 0) - g.streichbar),
        0,
      ),
    },
    soll: {
      gesamt: num(einbringung.gesamt_halbjahresleistungen, 40),
      ausFaechern: pflichtAnzahl + poolSoll,
      ausSeminar: num(einbringung.aus_seminar, 4),
      maxBlockI: num(einbringung.max_punkte_halbjahre, 600),
      maxBlockII: num(einbringung.max_punkte_abiturpruefungen, 300),
      maxGesamt: num(einbringung.max_punkte_gesamt, 900),
      bestehen: num(einbringung.bestehensgrenze_gesamt, 300),
      fuenfPunkteHuerde: num(einbringung.fuenf_punkte_huerde, 32),
    },
  };
}
