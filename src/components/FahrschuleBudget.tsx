"use client";

import { useEffect, useState } from "react";
import { CARD, HEADING, iconBadge, pill, ROW } from "@/lib/ui";
import type { FahrschuleBudget as Budget, BalkenSegment } from "@/lib/fahrschule";

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function euro(n: number) {
  return EUR.format(n);
}

function cent(n: number) {
  return Math.round(n * 100) / 100;
}

function tag(iso: string) {
  // "2026-10-23" -> "23.10."
  const [, m, d] = iso.split("-");
  return m && d ? `${d}.${m}.` : iso;
}

// Eltern = violett (Dashboard-Grundfarbe), Marcel = rosé.
// Bezahlt = deckend, offen = schraffiert. Die Schraffur macht den Unterschied
// auch ohne Farbsehen erkennbar.
function segmentStyle(seg: BalkenSegment): React.CSSProperties {
  const solid = seg.wer === "eltern" ? "#8b5cf6" : "#fb7185";
  if (seg.bezahlt) return { background: solid };
  const faint = seg.wer === "eltern" ? "#8b5cf64d" : "#fb71854d";
  return {
    background: `repeating-linear-gradient(45deg, ${faint} 0 5px, transparent 5px 10px)`,
    boxShadow: `inset 0 0 0 1px ${faint}`,
  };
}

function Balken({ data }: { data: Budget }) {
  return (
    <div className="mt-1">
      <div className="relative">
        <div className="flex h-5 w-full overflow-hidden rounded-full bg-white/5">
          {data.segmente
            .filter((s) => s.anteil > 0)
            .map((s) => (
              <div
                key={s.key}
                style={{ width: `${s.anteil}%`, ...segmentStyle(s) }}
                title={`${s.label}: ${euro(s.betrag)}`}
              />
            ))}
        </div>
        {/* Marker beim Elternbudget. Liegt bauartbedingt genau auf der Grenze
            zwischen "Eltern offen" und "du bezahlt". */}
        <div
          className="pointer-events-none absolute -top-1 bottom-[-4px] w-0.5 bg-zinc-100"
          style={{ left: `${data.markerAnteil}%` }}
        />
      </div>
      <div className="relative mt-1.5 h-4">
        <span
          className="absolute whitespace-nowrap text-[11px] text-zinc-300"
          style={{
            left: `${data.markerAnteil}%`,
            // Normalfall: Label mittig unter dem Marker, damit das ▲ wirklich
            // auf der Linie sitzt. Erst ganz rechts am Rand nach links kippen,
            // sonst ragt es aus der Karte.
            transform:
              data.markerAnteil > 88 ? "translateX(-100%)" : "translateX(-50%)",
          }}
        >
          ▲ {euro(data.budgetGesamt)} Eltern
        </span>
      </div>
    </div>
  );
}

function Legende({ data }: { data: Budget }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {data.segmente.map((s) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={segmentStyle(s)}
          />
          <span className="truncate text-[11px] text-zinc-500">{s.label}</span>
          <span className="ml-auto text-[11px] tabular-nums text-zinc-300">
            {euro(s.betrag)}
          </span>
        </div>
      ))}
    </div>
  );
}

type Zeile = { label: string; betrag: number; hinweis?: string; gruen?: boolean };

function ZeilenListe({ zeilen }: { zeilen: Zeile[] }) {
  return (
    <div className="flex flex-col gap-1">
      {zeilen.map((z, i) => (
        <div key={`${z.label}-${i}`} className="flex items-baseline gap-2 text-[11px]">
          <span className={z.gruen ? "text-emerald-400" : "text-zinc-400"}>
            {z.label}
            {z.hinweis && (
              <span className={z.gruen ? "text-emerald-400/70" : "text-zinc-600"}>
                {" "}
                · {z.hinweis}
              </span>
            )}
          </span>
          <span
            className={`ml-auto shrink-0 tabular-nums ${
              z.gruen ? "text-emerald-400" : z.betrag < 0 ? "text-zinc-400" : "text-zinc-300"
            }`}
          >
            {z.betrag < 0 ? `−${euro(-z.betrag)}` : euro(z.betrag)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Zwischensumme({ label, betrag }: { label: string; betrag: number }) {
  return (
    <div className="mt-1 flex items-baseline gap-2 border-t border-white/5 pt-1 text-[11px]">
      <span className="font-medium text-zinc-300">{label}</span>
      <span className="ml-auto font-medium tabular-nums text-zinc-200">{euro(betrag)}</span>
    </div>
  );
}

function wer(zahler: string) {
  return zahler === "Marcel" ? "du" : zahler;
}

/**
 * Aufklappbarer Rechenweg zur Gesamtsumme – jeder einzelne Betrag.
 *
 * Marcel am 27.10.2026: „Ist dieser Gutschein jetzt schon in den Gesamt
 * eingeplant oder nicht?" → Summe Zeile für Zeile.
 * Marcel am 16.11.2026: „noch detaillierter … dass da jeder einzelne Betrag
 * drinsteht, der noch zu zahlen ist und der schon gezahlt wurde."
 * Dabei aufgefallen: Die alte Fassung zeigte die Gegenbuchung für die schon
 * bezahlten Fahrstunden (deckt_fahrstunden, −712 €) nicht – die Zeilen ergaben
 * die Summe also gar nicht. Jetzt: (1) jede Zahlung einzeln, (2) jeder offene
 * Posten einzeln, (3) bezahlt + offen = gesamt, mit Selbstprüfung.
 */
function Rechenweg({ data }: { data: Budget }) {
  const [offen, setOffen] = useState(false);
  const p = data.preisFahrstunde;

  // (1) Schon bezahlt – jede Zahlung aus der Datendatei.
  const bezahltZeilen: Zeile[] = data.zahlungen.map((z) => ({
    label: z.posten,
    betrag: z.betrag,
    hinweis: `${wer(z.zahler)}${z.datum ? `, ${tag(z.datum)}` : ", Datum unbekannt"}`,
  }));

  // (2) Noch zu zahlen.
  const offenZeilen: Zeile[] = data.offenFix.map((o) => ({
    label: o.posten,
    betrag: o.betrag,
  }));
  // Noch nicht gefahrene Pflicht-Sonderfahrten, je Art.
  for (const f of data.sonderfahrten) {
    const rest = Math.max(0, f.pflicht - f.gefahren);
    if (rest > 0) {
      offenZeilen.push({
        label: `${f.art}-Fahrten, noch nicht gefahren`,
        betrag: cent(rest * p),
        hinweis: `${rest} × ${euro(p)}`,
      });
    }
  }
  // Schon gefahren, aber noch nicht abgerechnet (negativ = vorausbezahlt).
  const gefahrenStunden =
    data.sonderfahrten.reduce((s, f) => s + Math.min(f.gefahren, f.pflicht), 0) +
    data.uebungsstundenGefahren;
  const nichtAbgerechnet = cent(gefahrenStunden * p - data.fahrstundenBezahlt);
  if (nichtAbgerechnet > 0) {
    offenZeilen.push({
      label: "Gefahren, aber noch nicht abgerechnet",
      betrag: nichtAbgerechnet,
      hinweis: `${Math.round(nichtAbgerechnet / p)} × ${euro(p)}`,
    });
  } else if (nichtAbgerechnet < 0) {
    offenZeilen.push({ label: "Fahrstunden vorausbezahlt", betrag: nichtAbgerechnet });
  }
  if (data.uebungsstundenGeplant > 0) {
    offenZeilen.push({
      label: "Übungsstunden, geschätzt",
      betrag: cent(data.uebungsstundenGeplant * p),
      hinweis: `${data.uebungsstundenGeplant} × ${euro(p)}`,
    });
  }
  if (data.gutscheinWert > 0) {
    offenZeilen.push({
      label: "🎁 Gutschein (noch nicht verrechnet)",
      betrag: -data.gutscheinWert,
      hinweis: `${Math.round(data.gutscheinWert / p)} Gratisstunden`,
      gruen: true,
    });
  }
  const offenSumme = cent(offenZeilen.reduce((s, z) => s + z.betrag, 0));
  const stimmt = Math.abs(cent(data.bezahlt + offenSumme) - data.gesamtMinimum) < 0.01;

  return (
    <div className="mt-2 border-t border-white/5 pt-2">
      <button
        onClick={() => setOffen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <span className="text-[9px]">{offen ? "▾" : "▸"}</span>
        <span>Wie kommt die Summe zustande?</span>
        {data.gutscheinWert > 0 && !offen && (
          <span className="ml-auto text-emerald-400/80">Gutschein ist abgezogen</span>
        )}
        {data.gutscheinWert === 0 && data.gutscheinMoeglich > 0 && !offen && (
          <span className="ml-auto text-zinc-500">Gutschein nicht eingerechnet</span>
        )}
      </button>

      {offen && (
        <div className="mt-2 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-emerald-400/80">
              ✅ Schon bezahlt
            </p>
            <ZeilenListe zeilen={bezahltZeilen} />
            <Zwischensumme label="Summe bezahlt" betrag={data.bezahlt} />
            <p className="mt-0.5 text-[10px] text-zinc-600">
              davon Eltern {euro(data.bezahltAusBudget)} · du {euro(data.bezahltVonMarcel)}
            </p>
          </div>

          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
              ⏳ Noch zu zahlen
            </p>
            <ZeilenListe zeilen={offenZeilen} />
            <Zwischensumme label="Summe offen" betrag={offenSumme} />
            <p className="mt-0.5 text-[10px] text-zinc-600">
              davon Eltern {euro(data.elternOffen)} (Rest vom Budget) · du {euro(data.duOffen)}
            </p>
          </div>

          <div className="border-t border-white/10 pt-1.5">
            <div className="flex items-baseline gap-2 text-[11px] text-zinc-500">
              <span>bezahlt + offen</span>
              <span className="ml-auto tabular-nums">
                {euro(data.bezahlt)} + {euro(offenSumme)}
              </span>
            </div>
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-medium text-zinc-300">= Voraussichtlich gesamt</span>
              <span className="ml-auto font-semibold tabular-nums text-zinc-50">
                {euro(data.gesamtMinimum)}
              </span>
            </div>
            {!stimmt && (
              <p className="mt-1 text-[10px] text-rose-400">
                ⚠️ Die Einzelposten ergeben {euro(cent(data.bezahlt + offenSumme))} statt{" "}
                {euro(data.gesamtMinimum)} – Datendatei prüfen.
              </p>
            )}
          </div>

          <p className="text-[10px] leading-relaxed text-zinc-600">
            {data.gutscheinWert > 0 && (
              <>Ohne Gutschein wären es {euro(data.gesamtMinimum + data.gutscheinWert)}. </>
            )}
            {data.gutscheinWert === 0 && data.gutscheinMoeglich > 0 && (
              <>
                Der Gutschein ist <strong className="text-zinc-400">nicht</strong> abgezogen –
                mit ihm wären es {euro(data.gesamtMinimum - data.gutscheinMoeglich)}.{" "}
              </>
            )}
            {data.uebungsstundenGeplant > 0
              ? "Die Übungsstunden sind teilweise geschätzt. "
              : "Weitere Übungsstunden sind nicht eingerechnet – die Summe ist eine Untergrenze. "}
            Jede zusätzliche Doppelstunde kostet {euro(p * 2)}.
          </p>
        </div>
      )}
    </div>
  );
}

function Sonderfahrten({ data }: { data: Budget }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Fahrstunden-Soll
      </p>
      <div className="flex flex-col gap-1">
        {data.sonderfahrten.map((f) => (
          <div key={f.art} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-zinc-400">{f.art}</span>
            <span className="flex gap-0.5">
              {Array.from({ length: f.pflicht }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${
                    i < f.gefahren ? "bg-emerald-400" : "bg-white/10"
                  }`}
                />
              ))}
            </span>
            <span className="ml-auto tabular-nums text-zinc-500">
              {f.gefahren} / {f.pflicht}
            </span>
          </div>
        ))}

        {/* Übungsstunden sind KEINE Pflicht – andere Farbe, eigene Trennlinie.
            Ohne `uebungsstunden_geplant` wird nur gezählt, was gefahren ist;
            dann wäre "2 / 2" irreführend (es gibt kein Soll), also nur die Zahl. */}
        <div className="mt-1 flex items-center gap-2 border-t border-white/5 pt-1.5 text-xs">
          <span className="w-16 shrink-0 text-zinc-400">Übung</span>
          <span className="flex flex-wrap gap-0.5">
            {Array.from({ length: data.uebungsstunden }, (_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < data.uebungsstundenGefahren ? "bg-amber-400" : "bg-white/10"
                }`}
              />
            ))}
          </span>
          <span className="ml-auto tabular-nums text-zinc-500">
            {data.uebungsstundenGeplant > 0
              ? `${data.uebungsstundenGefahren} / ${data.uebungsstunden}`
              : data.uebungsstundenGefahren}
          </span>
        </div>
        <p className="pl-[4.5rem] text-[10px] leading-tight text-zinc-600">
          keine Pflicht ·{" "}
          {data.uebungsstundenGeplant > 0
            ? `davon ${data.uebungsstundenGeplant} nur geschätzt`
            : "nur gefahrene gezählt"}
        </p>
      </div>
    </div>
  );
}

function Fahrstunden({ data }: { data: Budget }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Fahrstunden
      </p>
      <div className="flex flex-col gap-1">
        {data.fahrstunden.map((f) => (
          <div
            key={f.nr}
            className="flex items-center gap-2 text-xs"
            title={f.hinweis}
          >
            <span>
              {f.status === "gefahren"
                ? "✅"
                : f.status === "abgesagt"
                  ? "🚫"
                  : "⏳"}
            </span>
            <span className="w-12 shrink-0 tabular-nums text-zinc-400">
              {tag(f.datum)}
            </span>
            <span
              className={
                f.inhalt.length ? "truncate text-zinc-300" : "text-zinc-600"
              }
            >
              {f.status === "abgesagt"
                ? "abgesagt – nachbuchen"
                : f.inhalt.length
                  ? f.inhalt.join(" + ")
                  : "offen"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Marcel am 16.11.2026: Gutschein per Häkchen ein-/ausrechnen. Die Wahl bleibt
// im Browser gespeichert; ohne gespeicherte Wahl gilt `gutschein_einrechnen`
// aus der Datendatei.
const GUTSCHEIN_KEY = "fahrschule-gutschein-einrechnen";

export function FahrschuleBudget() {
  const [roh, setData] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mitGutschein, setMitGutschein] = useState<boolean | null>(null);

  useEffect(() => {
    const v = localStorage.getItem(GUTSCHEIN_KEY);
    if (v === "1" || v === "0") setMitGutschein(v === "1");
  }, []);

  const data =
    roh && mitGutschein !== null && mitGutschein !== roh.gutscheinEinrechnen
      ? (roh.alternativ ?? roh)
      : roh;

  function toggleGutschein(an: boolean) {
    setMitGutschein(an);
    localStorage.setItem(GUTSCHEIN_KEY, an ? "1" : "0");
  }

  useEffect(() => {
    fetch("/api/fahrschule")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.details ? `${json.error}: ${json.details}` : (json.error ?? "Unbekannter Fehler"),
          );
        }
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={iconBadge("amber")}>🚗</span>
        <h2 className={HEADING}>Fahrschul-Budget</h2>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}

      {data && (
        <>
          <div className={ROW}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-zinc-500">
                Voraussichtlich gesamt
              </span>
              <span className="text-lg font-semibold tabular-nums text-zinc-50">
                {euro(data.gesamtMinimum)}
              </span>
            </div>
            <Balken data={data} />
            <Legende data={data} />
            <Rechenweg data={data} />
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-zinc-500">dein Anteil</span>
            <span
              className={`${pill(data.eigenanteil > 0 ? "red" : "green")} tabular-nums`}
            >
              {euro(data.eigenanteil)}
            </span>
            <span className="ml-auto text-[11px] text-zinc-600">
              {data.sonderfahrtenOffen} Sonderfahrten offen
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
            {data.gutscheinMoeglich > 0 && (
              <label
                className="flex cursor-pointer select-none items-center gap-1.5"
                title="Häkchen an: Die Gratisstunden werden von der Gesamtsumme abgezogen. Häkchen aus: Gerechnet wird, als müsstest du sie voll zahlen."
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-emerald-400"
                  checked={data.gutscheinEinrechnen}
                  onChange={(e) => toggleGutschein(e.target.checked)}
                />
                <span className={data.gutscheinEinrechnen ? "text-emerald-400" : ""}>
                  🎁 Gutschein einrechnen ({data.gutscheinFahrstunden} Gratisstunden · −
                  {euro(data.gutscheinMoeglich)})
                </span>
              </label>
            )}
          </div>

          <Sonderfahrten data={data} />
          <Fahrstunden data={data} />

          {data.nichtBezifferbar.length > 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
              Nicht enthalten, weil im Original ohne Betrag:{" "}
              {data.nichtBezifferbar.join(" · ")}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
