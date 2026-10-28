"use client";

import { useEffect, useState } from "react";
import { CARD, HEADING, iconBadge, ROW } from "@/lib/ui";
import type { HabitStand, HabitAuswertung, Wert } from "@/lib/habits";

/** Farbe nach Erfüllungsquote – gleiche Logik wie die Notenfarben. */
function quoteFarbe(q: number | null): string {
  if (q === null) return "#52525b";
  if (q >= 0.8) return "#34d399"; // emerald-400
  if (q >= 0.6) return "#a3e635"; // lime-400
  if (q >= 0.4) return "#fbbf24"; // amber-400
  if (q > 0) return "#fb923c"; // orange-400
  return "#fb7185"; // rose-400
}

function zellFarbe(w: Wert): string {
  switch (w.status) {
    case "ok":
      return "#34d399";
    case "fehlt":
      return "#fb7185";
    case "nichtFaellig":
      return "rgba(255,255,255,0.06)";
    default:
      return "rgba(255,255,255,0.13)";
  }
}

function fmt(n: number | null, stellen = 1): string {
  if (n === null) return "–";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

const STATUS_TEXT: Record<Wert["status"], string> = {
  ok: "erledigt",
  fehlt: "ausgefallen",
  nichtFaellig: "nicht fällig",
  unbekannt: "nicht erfasst",
};

/** Eine Zeile: Habit links, Tagesraster rechts, Kennzahl ganz rechts. */
function HabitZeile({ h, tage }: { h: HabitAuswertung; tage: HabitStand["tage"] }) {
  const { def } = h;

  // Die Kennzahl rechts: bei numerischen Habits der Schnitt gegen das Ziel,
  // sonst die Quote. Das ist der Punkt, den Marcel sehen will – nicht ob,
  // sondern wie viel.
  const kennzahl =
    def.numerisch && h.schnitt !== null
      ? `${fmt(h.schnitt, def.einheit === "h" ? 1 : 0)}${def.einheit ? " " + def.einheit : ""}`
      : h.quote !== null
        ? `${Math.round(h.quote * 100)} %`
        : "–";

  const zielErreicht =
    def.numerisch && def.ziel !== null && h.schnitt !== null
      ? h.schnitt >= def.ziel
      : null;

  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span className="w-4 shrink-0 text-center text-[11px]">{def.icon}</span>
      <span className="w-[92px] shrink-0 truncate text-[11px] text-zinc-400">
        {def.label}
      </span>

      {/* Tagesraster */}
      <div className="flex flex-1 gap-[3px]">
        {h.verlauf.map((w, i) => (
          <div
            key={tage[i]?.datum ?? i}
            className="h-4 min-w-[10px] max-w-[34px] flex-1 rounded-[3px]"
            style={{ backgroundColor: zellFarbe(w) }}
            title={`${tage[i]?.wochentag ?? ""} ${tage[i]?.datum ?? ""} · ${def.label}: ${
              w.roh && w.roh !== "✓" && w.roh !== "✗" && w.roh !== "–" && w.roh !== "?"
                ? w.roh
                : STATUS_TEXT[w.status]
            }`}
          />
        ))}
      </div>

      {/* Kennzahl */}
      <span
        className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums"
        style={{
          color:
            zielErreicht === null
              ? quoteFarbe(h.quote)
              : zielErreicht
                ? "#34d399"
                : "#fb923c",
        }}
        title={
          def.ziel !== null
            ? `Ziel: ${def.ziel} ${def.einheit} · Schnitt der letzten Tage`
            : `${h.erledigt} von ${h.faellig} fälligen Tagen`
        }
      >
        {kennzahl}
      </span>

      {/* Ausfallserie – die Zahl, die weh tut */}
      <span className="w-9 shrink-0 text-right text-[10px] tabular-nums">
        {h.ausfallStreak >= 2 ? (
          <span className="text-rose-400" title={`${h.ausfallStreak} Tage in Folge ausgefallen`}>
            ✗{h.ausfallStreak}
          </span>
        ) : h.streak >= 2 ? (
          <span className="text-emerald-400" title={`${h.streak} Tage in Folge erledigt`}>
            ✓{h.streak}
          </span>
        ) : (
          <span className="text-zinc-700">–</span>
        )}
      </span>
    </div>
  );
}

export function HabitWidget() {
  const [data, setData] = useState<HabitStand | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/habits")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok)
          throw new Error(
            json.details ? `${json.error}: ${json.details}` : (json.error ?? "Unbekannter Fehler"),
          );
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  // Habits, die gerade reißen – das ist der Teil, der eine Reaktion auslöst.
  const reissen =
    data?.habits
      .filter((h) => h.ausfallStreak >= 2)
      .sort((a, b) => b.ausfallStreak - a.ausfallStreak) ?? [];

  const laeuft =
    data?.habits.filter((h) => h.streak >= 2).sort((a, b) => b.streak - a.streak) ?? [];

  return (
    <div className={CARD}>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className={iconBadge("purple")}>🔁</span>
        <h2 className={HEADING}>Habits</h2>
        {data && (
          <span className="ml-auto text-[11px] text-zinc-600">
            letzte {data.tage.length} Tage
          </span>
        )}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}

      {data && (
        <div className="flex flex-col gap-3">
          {/* Warnung, wenn der Abend-Check Lücken hat */}
          {data.tageSeitLetztem !== null && data.tageSeitLetztem > 1 && (
            <p className="rounded-lg border border-amber-400/25 bg-amber-500/[0.08] px-2.5 py-1.5 text-[11px] text-amber-300/90">
              ⚠️ Letzter Eintrag ist vom <strong>{data.letzterEintrag}</strong> — das sind{" "}
              {data.tageSeitLetztem} Tage her. Ohne Abend-Check keine Daten; die Lücken
              unten sind grau, nicht rot.
            </p>
          )}

          {/* Kopfzeile mit den Wochentagen */}
          <div className="flex items-center gap-2">
            <span className="w-4 shrink-0" />
            <span className="w-[92px] shrink-0" />
            <div className="flex flex-1 gap-[3px]">
              {data.tage.map((t) => (
                <span
                  key={t.datum}
                  className="min-w-[10px] max-w-[34px] flex-1 text-center text-[9px] text-zinc-600"
                  title={t.datum}
                >
                  {t.wochentag}
                </span>
              ))}
            </div>
            <span className="w-14 shrink-0 text-right text-[9px] uppercase tracking-wide text-zinc-600">
              Schnitt
            </span>
            <span className="w-9 shrink-0 text-right text-[9px] uppercase tracking-wide text-zinc-600">
              Serie
            </span>
          </div>

          {/* Die Habits */}
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {data.habits.map((h) => (
              <HabitZeile key={h.def.key} h={h} tage={data.tage} />
            ))}
          </div>

          {/* Was reißt, was läuft */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={ROW}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Reißt gerade
              </p>
              {reissen.length === 0 ? (
                <p className="mt-1 text-[11px] text-zinc-600">
                  Nichts länger als einen Tag ausgefallen.
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {reissen.map((h) => (
                    <span
                      key={h.def.key}
                      className="rounded-lg border border-rose-400/25 bg-rose-500/[0.08] px-2 py-0.5 text-[11px] text-rose-300"
                    >
                      {h.def.icon} {h.def.label}{" "}
                      <span className="tabular-nums opacity-80">
                        {h.ausfallStreak} Tage
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className={ROW}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Läuft
              </p>
              {laeuft.length === 0 ? (
                <p className="mt-1 text-[11px] text-zinc-600">
                  Noch keine Serie von zwei Tagen.
                </p>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {laeuft.map((h) => (
                    <span
                      key={h.def.key}
                      className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.08] px-2 py-0.5 text-[11px] text-emerald-300"
                    >
                      {h.def.icon} {h.def.label}{" "}
                      <span className="tabular-nums opacity-80">{h.streak} Tage</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-600">
            <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: "#34d399" }} />
            erledigt ·{" "}
            <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: "#fb7185" }} />
            ausgefallen ·{" "}
            <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: "rgba(255,255,255,0.13)" }} />
            nicht erfasst ·{" "}
            <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
            nicht fällig.{" "}
            <strong className="text-zinc-500">Die Spalte „Schnitt“</strong> zeigt bei
            Fahrschul-App, Lesen und Schlaf den <strong>Durchschnittswert</strong> gegen
            das Ziel (grün = Ziel erreicht), sonst den Anteil erledigter Tage.{" "}
            <span className="text-amber-500/80">
              Grau heißt nicht „nicht gemacht“, sondern „nie abgefragt“ — nicht als
              Ausfall lesen.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
