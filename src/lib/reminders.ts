// Parser für 00 Kontext/Erinnerungen.md.
//
// Hintergrund (24.10.2026, von Marcel bestellt): Die Einträge in der Vault-Datei sind
// absichtlich ausführlich – sie tragen den Kontext, den Claude beim Morgen-/Abend-Check
// braucht. Im Dashboard waren sie dadurch unlesbar: "die sind ja richtig lang, wirklich".
//
// Lösung: Jeder Eintrag wird in ÜBERSCHRIFT + DETAILS zerlegt, das Widget zeigt nur die
// Überschrift und klappt die Details auf Klick aus.
//
// Die Trennung nutzt die Konvention, die in der Vault-Datei ohnehin schon gilt:
// Das Wichtigste steht am Zeilenanfang fett. Beispiel:
//
//   - `[HEUTE]` 📕 **Kafka – Lesestand erfragen.** Frist Mo 26.10., es bleiben zwei Tage …
//                  └─ Überschrift ──────────────┘ └─ Details ───────────────────────────┘
//
// Deshalb ist KEINE Migration der 26 bestehenden Einträge nötig. Wer einen neuen Eintrag
// schreibt, steuert die Überschrift einfach über den ersten Fett-Block.

export type Reminder = {
  /** Führende Emojis der Zeile, z. B. "📕". Leer, wenn keine da sind. */
  icon: string;
  /** Eine bis zwei Zeilen – das, was im Widget immer sichtbar ist. */
  title: string;
  /** Der Rest. Leerstring = es gibt nichts aufzuklappen, kein Pfeil. */
  details: string;
};

export type RemindersResponse = { heute: Reminder[]; woche: Reminder[] };

/**
 * Emoji-Zeichen, wie sie in den Erinnerungen vorkommen (Icons am Zeilenanfang,
 * Warnmarker wie ⚠️ 🔴 ⬆️ mitten im Text). Bewusst ein expliziter Bereich statt
 * \p{Extended_Pictographic}: tsconfig steht auf target ES2017, Unicode-Property-
 * Escapes sind erst ES2018.
 */
const EMOJI = "\\u200D\\uFE0F\\u2190-\\u21FF\\u231A-\\u23FF\\u25A0-\\u27BF\\u2B00-\\u2BFF\\u{1F000}-\\u{1FAFF}";

/** Trennzeichen, die am Ende einer Überschrift nichts verloren haben. */
const SEPARATORS = "\\s\\u2013\\u2014\\-\\u00B7:,;";

const LEADING_ICON = new RegExp(`^(?:[${EMOJI}]+\\s*)+`, "u");
const TRAILING_JUNK = new RegExp(`(?:[${SEPARATORS}]|[${EMOJI}])+$`, "u");
const LEADING_SEPARATOR = new RegExp(`^[${SEPARATORS}]+`, "u");

/** Ab hier gilt eine Zeile als zu lang, um komplett als Überschrift durchzugehen. */
const MAX_TITLE_LENGTH = 110;
/** Ein Split so weit vorne ergäbe keine sinnvolle Überschrift. */
const MIN_TITLE_LENGTH = 15;

/**
 * Teilt bei `index` und räumt die Nahtstelle auf: Trennstriche am Ende der Überschrift
 * fallen weg, Warn-Emojis (⚠️, 🔴 …) wandern in die Details, wo sie hingehören.
 */
function splitAt(text: string, index: number): { title: string; details: string } {
  let head = text.slice(0, index);
  let tail = text.slice(index);

  const junk = head.match(TRAILING_JUNK);
  if (junk) {
    head = head.slice(0, head.length - junk[0].length);
    // Emojis aus der Naht retten, reine Trennzeichen verwerfen.
    const rescued = junk[0].replace(LEADING_SEPARATOR, "").trim();
    if (rescued) tail = `${rescued} ${tail}`;
  }

  return {
    title: head.trim(),
    details: tail.replace(LEADING_SEPARATOR, "").trim(),
  };
}

/**
 * Sucht die Position des ersten **Fett**-Blocks. Gibt -1 zurück, wenn es keinen gibt.
 */
function findBoldStart(text: string): number {
  // [\s\S] statt . mit s-Flag: das dotAll-Flag ist ES2018, das Projekt steht auf ES2017.
  const match = text.match(/\*\*([\s\S]+?)\*\*/);
  return match?.index ?? -1;
}

/**
 * Entfernt genau einen Schlusspunkt. "Kafka lesen." → "Kafka lesen", aber "usw…" und
 * "Wirklich?" bleiben, und bei "…" wird nicht einzeln abgeknabbert.
 * (Kein Lookbehind – auch das ist erst ES2018.)
 */
function stripFinalPeriod(text: string): string {
  if (!text.endsWith(".") || text.endsWith("..")) return text;
  return text.slice(0, -1);
}

/** Erstes Satzende (". ", "! ", "? ") innerhalb eines brauchbaren Fensters. */
function findSentenceEnd(text: string): number {
  const match = text.match(/[.!?](?=\s)/);
  if (!match || match.index === undefined) return -1;
  const end = match.index + 1;
  return end >= MIN_TITLE_LENGTH && end <= MAX_TITLE_LENGTH + 30 ? end : -1;
}

/**
 * Zerlegt den Text eines Eintrags (ohne das `[HEUTE]`/`[WOCHE]`-Präfix) in Icon,
 * Überschrift und Details.
 *
 * Reihenfolge der Regeln – die erste, die greift, gewinnt:
 *  1. Text beginnt mit **Fett** → genau dieser Block ist die Überschrift.
 *  2. **Fett** steht weiter hinten → alles davor ist die Überschrift.
 *     (Trifft z. B. "Abrechnung Sorrent … ⚠️ **NICHT verwechseln mit …**".)
 *  3. Zeile länger als 110 Zeichen → am ersten Satzende trennen.
 *  4. Sonst: kurze Zeile, alles ist Überschrift, nichts zum Aufklappen.
 */
export function splitReminder(raw: string): Reminder {
  const text = raw.trim();

  const iconMatch = text.match(LEADING_ICON);
  const icon = iconMatch ? iconMatch[0].trim() : "";
  const body = iconMatch ? text.slice(iconMatch[0].length) : text;

  const boldStart = findBoldStart(body);

  // Regel 1: Überschrift ist der erste Fett-Block.
  if (boldStart === 0) {
    const bold = body.match(/^\*\*([\s\S]+?)\*\*/);
    if (bold) {
      // Einen einzelnen Schlusspunkt der Überschrift schlucken – "Kafka lesen." liest
      // sich als Zeilentitel schlechter als "Kafka lesen". "…" und "!"/"?" bleiben.
      const title = stripFinalPeriod(bold[1].trim());
      const details = body.slice(bold[0].length).replace(LEADING_SEPARATOR, "").trim();
      return { icon, title: title.trim(), details };
    }
  }

  // Regel 2: Fett weiter hinten – davor steht die Überschrift.
  if (boldStart >= MIN_TITLE_LENGTH) {
    const { title, details } = splitAt(body, boldStart);
    if (title) return { icon, title, details };
  }

  // Regel 3: lange Zeile ohne Fett – am Satzende trennen.
  if (body.length > MAX_TITLE_LENGTH) {
    const sentenceEnd = findSentenceEnd(body);
    if (sentenceEnd > 0) {
      const { title, details } = splitAt(body, sentenceEnd);
      if (title) return { icon, title, details };
    }
  }

  // Regel 4: kurz genug – alles ist Überschrift.
  return { icon, title: body.trim(), details: "" };
}

/**
 * Liest den Abschnitt `## Aktiv` und gibt die Einträge nach `[HEUTE]`/`[WOCHE]` getrennt
 * zurück. HTML-Kommentare unter den Bullets sind Claude-Kontext und bleiben bewusst
 * draußen – so ist es im Regelkopf der Vault-Datei festgelegt.
 */
export function parseReminders(content: string): RemindersResponse {
  const heute: Reminder[] = [];
  const woche: Reminder[] = [];

  const activeMatch = content.match(/## Aktiv\n([\s\S]*?)(?=\n## |$)/);
  if (!activeMatch) return { heute, woche };

  const lines = activeMatch[1].split("\n").filter((l) => l.trim().startsWith("- "));
  for (const line of lines) {
    const match = line.trim().match(/^- `\[(HEUTE|WOCHE)\]`\s*(.+)$/);
    if (!match) continue;
    const target = match[1] === "HEUTE" ? heute : woche;
    target.push(splitReminder(match[2]));
  }

  return { heute, woche };
}
