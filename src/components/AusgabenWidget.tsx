"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD, HEADING, iconBadge, pill, ROW } from "@/lib/ui";
import type { Abo, Ausgaben, Zahlung } from "@/lib/ausgaben";

// Ausgaben-Widget (15.11.2026, von Marcel bestellt): „wo ich die Ausgaben
// insgesamt sehe und auch, wann die nächste Abbuchung von jeder Sache ist".
// Datenquelle: "03 Bereiche/Finanzen/Ausgaben KI & Tools (Daten).md".

const EUR = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const euro = (n: number) => EUR.format(n);

const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// Eine Farbe pro Abo. Etsy/Business läuft über die Kategorie, nicht über ein Abo.
const FARBEN: Record<string, string> = {
  claude: "#d97757",
  wispr: "#8b5cf6",
  elevenlabs: "#22d3ee",
};
const FARBE_BUSINESS = "#fb7185";
const FARBE_SONST = "#a1a1aa";

function farbe(z: { abo: string | null; kategorie: string }) {
  if (z.abo && FARBEN[z.abo]) return FARBEN[z.abo];
  return z.kategorie === "business" ? FARBE_BUSINESS : FARBE_SONST;
}

// ---- Datumsrechnung in lokaler Zeit (kein UTC-Versatz um Mitternacht) ----
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** Gleicher Tag im Folgemonat; am Monatsende geklemmt (31.01. -> 28./29.02.). */
function plusMonat(d: Date, n = 1): Date {
  const ziel = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const letzter = new Date(ziel.getFullYear(), ziel.getMonth() + 1, 0).getDate();
  ziel.setDate(Math.min(d.getDate(), letzter));
  return ziel;
}
function tageBis(von: Date, bis: Date): number {
  return Math.round((bis.getTime() - von.getTime()) / 86_400_000);
}
function kurz(d: Date) {
  return `${WOCHENTAGE[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

type Naechste = {
  abo: Abo;
  datum: Date | null;
  tage: number | null;
  /** Erwartete Abbuchung liegt in der Vergangenheit, aber kein Beleg ist eingetragen. */
  belegFehlt: boolean;
};

function naechsteAbbuchung(abo: Abo, heute: Date): Naechste {
  if (!abo.letzteZahlung) return { abo, datum: null, tage: null, belegFehlt: false };
  const datum = plusMonat(parseIso(abo.letzteZahlung));
  const tage = tageBis(heute, datum);
  return { abo, datum, tage, belegFehlt: tage < 0 };
}

// ---- Monatsbalken: Vergangenes deckend, Erwartetes schraffiert ----
type Stueck = { key: string; farbe: string; betrag: number; erwartet: boolean; label: string };
type Monat = { key: string; label: string; stuecke: Stueck[]; summe: number; aktuell: boolean };

function monatsKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function baueMonate(data: Ausgaben, heute: Date, naechste: Naechste[]): Monat[] {
  const erster = data.zahlungen.length ? parseIso(data.zahlungen[0].datum) : heute;
  const start = new Date(erster.getFullYear(), erster.getMonth(), 1);
  // Zwei Monate in die Zukunft, damit man sieht, wie es weitergeht.
  const ende = new Date(heute.getFullYear(), heute.getMonth() + 2, 1);

  const monate: Monat[] = [];
  for (let d = new Date(start); d <= ende; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    monate.push({
      key: monatsKey(d),
      label: MONATE[d.getMonth()],
      stuecke: [],
      summe: 0,
      aktuell: monatsKey(d) === monatsKey(heute),
    });
  }
  const finde = (d: Date) => monate.find((m) => m.key === monatsKey(d));

  const add = (m: Monat | undefined, s: Stueck) => {
    if (!m) return;
    const gleich = m.stuecke.find((x) => x.key === s.key && x.erwartet === s.erwartet);
    if (gleich) gleich.betrag += s.betrag;
    else m.stuecke.push({ ...s });
    m.summe += s.betrag;
  };

  for (const z of data.zahlungen) {
    add(finde(parseIso(z.datum)), {
      key: z.abo ?? z.kategorie,
      farbe: farbe(z),
      betrag: z.betrag,
      erwartet: false,
      label: z.abo ? (data.abos.find((a) => a.id === z.abo)?.name ?? z.posten) : "Etsy",
    });
  }

  // Erwartete Abbuchungen ab heute bis Ende des Zeitraums. Ein fehlender Beleg
  // wird NICHT als erwartet eingeplant – der steht rot in der Liste.
  for (const n of naechste) {
    if (!n.datum || n.belegFehlt || n.abo.status !== "aktiv") continue;
    for (let d = n.datum, i = 0; d < new Date(ende.getFullYear(), ende.getMonth() + 1, 1); d = plusMonat(n.datum, ++i)) {
      add(finde(d), {
        key: n.abo.id,
        farbe: farbe({ abo: n.abo.id, kategorie: n.abo.kategorie }),
        betrag: n.abo.betrag,
        erwartet: true,
        label: n.abo.name,
      });
    }
  }

  // Bezahltes unten, Erwartetes obendrauf.
  for (const m of monate) m.stuecke.sort((a, b) => Number(a.erwartet) - Number(b.erwartet));
  return monate;
}

function stueckStyle(s: Stueck): React.CSSProperties {
  if (!s.erwartet) return { background: s.farbe };
  return {
    background: `repeating-linear-gradient(45deg, ${s.farbe}55 0 4px, transparent 4px 8px)`,
    boxShadow: `inset 0 0 0 1px ${s.farbe}66`,
  };
}

function MonatsChart({ monate }: { monate: Monat[] }) {
  const max = Math.max(1, ...monate.map((m) => m.summe));
  const HOEHE = 120;
  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: HOEHE + 18 }}>
        {monate.map((m) => (
          <div key={m.key} className="flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] tabular-nums text-zinc-400">
              {m.summe > 0 ? `${Math.round(m.summe)} €` : ""}
            </span>
            <div
              className="flex w-full max-w-[38px] flex-col-reverse overflow-hidden rounded-md"
              style={{ height: (m.summe / max) * HOEHE }}
            >
              {m.stuecke.map((s, i) => (
                <div
                  key={`${s.key}-${s.erwartet}-${i}`}
                  style={{ height: `${(s.betrag / m.summe) * 100}%`, ...stueckStyle(s) }}
                  title={`${s.label}${s.erwartet ? " (erwartet)" : ""}: ${euro(s.betrag)}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {monate.map((m) => (
          <span
            key={m.key}
            className={`flex-1 text-center text-[11px] ${m.aktuell ? "font-semibold text-zinc-100" : "text-zinc-500"}`}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Kachel({ label, wert, sub, akzent }: { label: string; wert: string; sub?: string; akzent?: boolean }) {
  return (
    <div className={`${ROW} flex flex-col gap-0.5 py-2.5`}>
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${akzent ? "text-zinc-50" : "text-zinc-200"}`}>{wert}</span>
      {sub && <span className="text-[11px] text-zinc-500">{sub}</span>}
    </div>
  );
}

function AbbuchungZeile({ n }: { n: Naechste }) {
  const c = farbe({ abo: n.abo.id, kategorie: n.abo.kategorie });
  let badge: React.ReactNode;
  if (n.abo.status !== "aktiv") badge = <span className={pill("neutral")}>gekündigt</span>;
  else if (!n.datum) badge = <span className={pill("neutral")}>kein Beleg</span>;
  else if (n.belegFehlt) badge = <span className={pill("red")}>Beleg fehlt</span>;
  else if (n.tage === 0) badge = <span className={pill("amber")}>heute</span>;
  else if (n.tage === 1) badge = <span className={pill("amber")}>morgen</span>;
  else badge = <span className={pill(n.tage! <= 10 ? "amber" : "neutral")}>in {n.tage} Tagen</span>;

  return (
    <div className={`${ROW} flex items-center gap-2.5`}>
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: c }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-zinc-100">{n.abo.name}</div>
        <div className="text-[11px] text-zinc-500">
          {n.datum ? (n.belegFehlt ? `fällig war ${kurz(n.datum)}` : kurz(n.datum)) : "–"}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm tabular-nums text-zinc-200" title={n.abo.hinweis}>
          {n.abo.geschaetzt ? "≈ " : ""}
          {euro(n.abo.betrag)}
        </span>
        {badge}
      </div>
    </div>
  );
}

function Belege({ zahlungen }: { zahlungen: Zahlung[] }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="mt-3 border-t border-white/5 pt-2">
      <button
        onClick={() => setOffen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <span className="text-[9px]">{offen ? "▾" : "▸"}</span>
        <span>Alle {zahlungen.length} Abbuchungen anzeigen</span>
      </button>
      {offen && (
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
          {[...zahlungen].reverse().map((z, i) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: farbe(z) }} />
              <span className="w-12 shrink-0 tabular-nums text-zinc-500">
                {z.datum.slice(8, 10)}.{z.datum.slice(5, 7)}.
              </span>
              <span className="truncate text-zinc-300" title={z.beleg}>
                {z.posten}
              </span>
              <span className="ml-auto tabular-nums text-zinc-200">{euro(z.betrag)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AusgabenWidget() {
  const [data, setData] = useState<Ausgaben | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ausgaben")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.details ? `${json.error}: ${json.details}` : (json.error ?? "Unbekannter Fehler"));
        }
        setData(json as Ausgaben);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // Heute bewusst im Browser bestimmen – nie aus dem Schnappschuss.
  const heute = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const naechste = useMemo(() => {
    if (!data) return [];
    return data.abos
      .map((a) => naechsteAbbuchung(a, heute))
      .sort((a, b) => {
        // Aktive zuerst, fehlende Belege ganz oben, dann nach Datum.
        if (a.abo.status !== b.abo.status) return a.abo.status === "aktiv" ? -1 : 1;
        if (a.belegFehlt !== b.belegFehlt) return a.belegFehlt ? -1 : 1;
        return (a.datum?.getTime() ?? Infinity) - (b.datum?.getTime() ?? Infinity);
      });
  }, [data, heute]);

  const monate = useMemo(() => (data ? baueMonate(data, heute, naechste) : []), [data, heute, naechste]);

  // Was in den nächsten 30 Tagen noch abgeht.
  const naechste30 = useMemo(() => {
    const grenze = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + 30);
    return naechste
      .filter((n) => n.abo.status === "aktiv" && n.datum && !n.belegFehlt && n.datum <= grenze)
      .reduce((s, n) => s + n.abo.betrag, 0);
  }, [naechste, heute]);

  const legende = data
    ? [
        ...data.abos.map((a) => ({ label: a.name, farbe: farbe({ abo: a.id, kategorie: a.kategorie }) })),
        ...(data.bezahltBusiness > 0 ? [{ label: "Etsy (Business)", farbe: FARBE_BUSINESS }] : []),
      ]
    : [];

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={iconBadge("green")}>💸</span>
        <h2 className={HEADING}>Ausgaben KI &amp; Tools</h2>
        {data?.stand && (
          <span className="ml-auto text-[11px] text-zinc-500">
            Belege bis {data.stand.slice(8, 10)}.{data.stand.slice(5, 7)}.
          </span>
        )}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr_1.3fr]">
            {/* Links: die drei Zahlen */}
            <div className="flex flex-col gap-2">
              <Kachel
                label="Bisher bezahlt"
                wert={euro(data.bezahltGesamt)}
                sub={`Werkzeuge ${euro(data.bezahltWerkzeug)} · Etsy ${euro(data.bezahltBusiness)}`}
                akzent
              />
              <Kachel
                label="Laufend pro Monat"
                wert={`${data.monatlichGeschaetzt ? "≈ " : ""}${euro(data.monatlichLaufend)}`}
                sub={`≈ ${euro(data.monatlichLaufend * 12)} aufs Jahr`}
              />
              <Kachel label="Nächste 30 Tage" wert={euro(naechste30)} sub="was sicher noch abgebucht wird" />
            </div>

            {/* Mitte: nächste Abbuchungen */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">Nächste Abbuchung</span>
              {naechste.map((n) => (
                <AbbuchungZeile key={n.abo.id} n={n} />
              ))}
              {data.monatlichGeschaetzt && (
                <span className="text-[11px] text-zinc-500">≈ = geschätzt (Dollar-Abo, Kurs schwankt)</span>
              )}
            </div>

            {/* Rechts: Verlauf pro Monat */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-wide text-zinc-500">Pro Monat</span>
              <MonatsChart monate={monate} />
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {legende.map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.farbe }} />
                    {l.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={stueckStyle({ key: "x", farbe: "#a1a1aa", betrag: 0, erwartet: true, label: "" })}
                  />
                  erwartet
                </span>
              </div>
            </div>
          </div>

          <Belege zahlungen={data.zahlungen} />
        </>
      )}
    </div>
  );
}
