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

/**
 * Aufklappbarer Rechenweg zur Gesamtsumme.
 *
 * Marcel am 27.10.2026: „Ist dieser Gutschein jetzt schon in den Gesamt
 * eingeplant oder nicht? Ich verstehe es nicht ganz." – Der Gutschein WAR
 * schon abgezogen, aber das stand nirgends. Eine grüne Pille mit „−178 €"
 * neben einer Summe ist mehrdeutig: sie kann „ist abgezogen" oder „kommt
 * noch runter" heißen. Deshalb hier die Summe Zeile für Zeile.
 */
function Rechenweg({ data }: { data: Budget }) {
  const [offen, setOffen] = useState(false);

  const zeilen: { label: string; betrag: number; hinweis?: string }[] = [
    { label: "schon bezahlt", betrag: data.bezahlt },
    ...(data.offenFixSumme > 0
      ? [{ label: "offene Festposten", betrag: data.offenFixSumme }]
      : []),
    ...(data.sonderfahrtenKosten > 0
      ? [
          {
            label: "Pflicht-Sonderfahrten",
            betrag: data.sonderfahrtenKosten,
            hinweis: `${data.sonderfahrtenOffen} offen`,
          },
        ]
      : []),
    {
      label: "Übungsstunden",
      betrag: data.uebungKosten,
      hinweis:
        data.gutscheinWert > 0
          ? `${data.uebungsstunden} − ${data.gutscheinFahrstunden} gratis = ${
              data.uebungsstunden - data.gutscheinFahrstunden
            } × ${euro(data.preisFahrstunde)}`
          : `${data.uebungsstunden} × ${euro(data.preisFahrstunde)}`,
    },
  ];

  return (
    <div className="mt-2 border-t border-white/5 pt-2">
      <button
        onClick={() => setOffen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <span className="text-[9px]">{offen ? "▾" : "▸"}</span>
        <span>Wie kommt die Summe zustande?</span>
        {data.gutscheinWert > 0 && !offen && (
          <span className="ml-auto text-emerald-400/80">
            Gutschein ist bereits abgezogen
          </span>
        )}
      </button>

      {offen && (
        <div className="mt-2 flex flex-col gap-1">
          {zeilen.map((z) => (
            <div key={z.label} className="flex items-baseline gap-2 text-[11px]">
              <span className="text-zinc-400">{z.label}</span>
              {z.hinweis && (
                <span className="text-zinc-600">({z.hinweis})</span>
              )}
              <span className="ml-auto tabular-nums text-zinc-300">
                {euro(z.betrag)}
              </span>
            </div>
          ))}

          {data.gutscheinWert > 0 && (
            <div className="flex items-baseline gap-2 text-[11px]">
              <span className="text-emerald-400">
                🎁 davon geschenkt ({data.gutscheinFahrstunden} Gratisstunden)
              </span>
              <span className="ml-auto tabular-nums text-emerald-400">
                −{euro(data.gutscheinWert)}
              </span>
            </div>
          )}

          <div className="mt-1 flex items-baseline gap-2 border-t border-white/10 pt-1.5 text-xs">
            <span className="font-medium text-zinc-300">
              Voraussichtlich gesamt
            </span>
            <span className="ml-auto font-semibold tabular-nums text-zinc-50">
              {euro(data.gesamtMinimum)}
            </span>
          </div>

          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
            {data.gutscheinWert > 0 && (
              <>
                <strong className="text-emerald-400/90">
                  Der Gutschein ist in dieser Summe schon drin.
                </strong>{" "}
                Ohne ihn wären es {euro(data.gesamtMinimum + data.gutscheinWert)}{" "}
                — die {euro(data.gutscheinWert)} sind also gespart, nicht offen.{" "}
              </>
            )}
            Die Übungsstunden sind eine{" "}
            <strong>Schätzung</strong> ({data.uebungsstundenGefahren} gefahren +{" "}
            {data.uebungsstundenGeplant} geplant). Jede zusätzliche Doppelstunde
            kostet {euro(data.preisFahrstunde * 2)}.
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
            Die Gesamtzahl ist Schätzung (gefahren + uebungsstunden_geplant). */}
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
            {data.uebungsstundenGefahren} / {data.uebungsstunden}
          </span>
        </div>
        <p className="pl-[4.5rem] text-[10px] leading-tight text-zinc-600">
          keine Pflicht · davon {data.uebungsstundenGeplant} nur geschätzt
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
            {f.hinweis && <span className="ml-auto shrink-0">🦷</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FahrschuleBudget() {
  const [data, setData] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            {data.gutscheinWert > 0 && (
              <span
                className={`${pill("green")} tabular-nums`}
                title={`${data.gutscheinFahrstunden} Fahrstunden geschenkt. Die ${euro(data.gutscheinWert)} sind in der Gesamtsumme bereits abgezogen.`}
              >
                🎁 {data.gutscheinFahrstunden} gratis · −{euro(data.gutscheinWert)}{" "}
                <span className="opacity-70">schon abgezogen</span>
              </span>
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
