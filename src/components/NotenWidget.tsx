"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD, HEADING, iconBadge, ROW } from "@/lib/ui";
import { abiNote, type NotenStand, type Slot } from "@/lib/noten";

/** Farbskala für Notenpunkte – rot bei wenig, grün bei viel. */
function punkteFarbe(p: number): string {
  if (p >= 13) return "#34d399"; // emerald-400
  if (p >= 10) return "#a3e635"; // lime-400
  if (p >= 7) return "#fbbf24"; // amber-400
  if (p >= 5) return "#fb923c"; // orange-400
  return "#fb7185"; // rose-400
}

/** Farbskala für die Abiturnote – 1,0 grün, 4,0 rot. */
function noteFarbe(n: number | null): string {
  if (n === null) return "#fb7185";
  if (n <= 1.5) return "#34d399";
  if (n <= 2.5) return "#a3e635";
  if (n <= 3.3) return "#fbbf24";
  return "#fb923c";
}

function fmt(n: number | null, stellen = 2): string {
  if (n === null) return "–";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

/** Waagrechte Leiste 0–15 Punkte. */
function Leiste({ wert }: { wert: number | null }) {
  const anteil = wert === null ? 0 : Math.min(1, Math.max(0, wert / 15));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      {wert !== null && (
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${anteil * 100}%`, backgroundColor: punkteFarbe(wert) }}
        />
      )}
    </div>
  );
}

export function NotenWidget() {
  const [data, setData] = useState<NotenStand | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Marcels eigene Auswahl. null = noch nicht angefasst, es gilt der Vorschlag. */
  const [wahl, setWahl] = useState<Set<string> | null>(null);

  useEffect(() => {
    fetch("/api/noten")
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

  /** Der Vorschlag aus der Einbringungslogik (Serverseite). */
  const vorschlag = useMemo(() => {
    const s = new Set<string>();
    if (!data) return s;
    for (const h of data.halbjahre)
      for (const sl of h.slots) if (sl.eingebracht) s.add(sl.id);
    return s;
  }, [data]);

  const aktiv = wahl ?? vorschlag;
  const abweichend = useMemo(() => {
    if (!wahl) return false;
    if (wahl.size !== vorschlag.size) return true;
    for (const k of wahl) if (!vorschlag.has(k)) return true;
    return false;
  }, [wahl, vorschlag]);

  const toggle = (sl: Slot) => {
    if (sl.pflicht) return;
    setWahl((alt) => {
      const neu = new Set(alt ?? vorschlag);
      if (neu.has(sl.id)) neu.delete(sl.id);
      else neu.add(sl.id);
      return neu;
    });
  };

  // ---- Abiturrechnung ----
  const abi = useMemo(() => {
    if (!data) return null;

    const gewaehlt: Slot[] = [];
    for (const h of data.halbjahre)
      for (const sl of h.slots) if (aktiv.has(sl.id)) gewaehlt.push(sl);

    const benotet = gewaehlt.filter((s) => s.zeugnis !== null);
    const punkteFaecher = benotet.reduce((a, s) => a + (s.zeugnis as number), 0);
    const offeneFaecher = gewaehlt.length - benotet.length;

    // W-Seminar: 2 Halbjahresleistungen, stehen bereits fest.
    const wPunkte = Object.values(data.wSeminar?.punkte ?? {});
    const wSumme = wPunkte.reduce((a, b) => a + b, 0);
    const wAnzahl = wPunkte.length;

    // Seminararbeit: gerundete Note, doppelt gewertet (max 30 P).
    const sa = data.wSeminar?.arbeitNote ?? null;
    const saPunkte = sa !== null ? sa * 2 : 0;
    const saOffen = sa === null ? 2 : 0;

    const blockIErreicht = punkteFaecher + wSumme + saPunkte;
    const blockIOffen = offeneFaecher + saOffen;
    const hjlGesamt = gewaehlt.length + wAnzahl + 2;

    // Leistungsniveau für die Hochrechnung: Schnitt aller bereits
    // feststehenden eingebrachten Halbjahresleistungen.
    const niveauBasis = [...benotet.map((s) => s.zeugnis as number), ...wPunkte];
    const niveau = niveauBasis.length
      ? niveauBasis.reduce((a, b) => a + b, 0) / niveauBasis.length
      : 0;

    const blockIHoch = blockIErreicht + blockIOffen * niveau;
    const blockIBest = blockIErreicht + blockIOffen * 15;

    // Block II: 5 Abiturprüfungen, vierfach gewertet.
    const pr = data.pruefungen;
    const blockIIErreicht = pr.reduce((a, p) => a + (p.punkte ?? 0) * 4, 0);
    const blockIIOffen = pr.filter((p) => p.punkte === null).length;
    const blockIIHoch = blockIIErreicht + blockIIOffen * niveau * 4;
    const blockIIBest = blockIIErreicht + blockIIOffen * 15 * 4;

    const gesamtHoch = Math.round(blockIHoch + blockIIHoch);
    const gesamtBest = Math.round(blockIBest + blockIIBest);

    // ---- Hürden aus der OSK-Unterlage ----
    const alleEingebracht = [
      ...benotet.map((s) => s.zeugnis as number),
      ...wPunkte,
      ...(sa !== null ? [sa, sa] : []),
    ];
    const nullPunkte = alleEingebracht.filter((p) => p === 0).length;
    const abFuenf = alleEingebracht.filter((p) => p >= 5).length;
    const unterFuenf = alleEingebracht.filter((p) => p < 5).length;

    return {
      gewaehltFaecher: gewaehlt.length,
      hjlGesamt,
      blockIErreicht: Math.round(blockIErreicht),
      blockIHoch: Math.round(blockIHoch),
      blockIOffen,
      blockIIErreicht,
      blockIIOffen,
      blockIIHoch: Math.round(blockIIHoch),
      gesamtHoch,
      gesamtBest,
      noteHoch: abiNote(gesamtHoch),
      noteBest: abiNote(gesamtBest),
      niveau,
      nullPunkte,
      abFuenf,
      unterFuenf,
      feststehend: alleEingebracht.length,
    };
  }, [data, aktiv]);

  const sollFaecher = data?.soll.ausFaechern ?? 36;
  const zuViel = abi ? abi.gewaehltFaecher > sollFaecher : false;
  const zuWenig = abi ? abi.gewaehltFaecher < sollFaecher : false;

  return (
    <div className={CARD}>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className={iconBadge("green")}>📊</span>
        <h2 className={HEADING}>Noten &amp; Einbringung</h2>
        {abi && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
              zuViel
                ? "bg-rose-500/15 text-rose-300"
                : zuWenig
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-emerald-500/15 text-emerald-300"
            }`}
            title="Eingebrachte Halbjahresleistungen aus Fächern (ohne Seminar)"
          >
            {abi.gewaehltFaecher} / {sollFaecher} eingebracht
          </span>
        )}
        {abweichend && (
          <button
            onClick={() => setWahl(null)}
            className="rounded-lg border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            🎯 beste Auswahl
          </button>
        )}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}

      {data && abi && (
        <div className="flex flex-col gap-4">
          {/* ═══ Abi-Hochrechnung ═══ */}
          <div className="rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.14] to-fuchsia-500/[0.06] p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-4xl font-semibold tabular-nums"
                  style={{ color: noteFarbe(abi.noteHoch) }}
                >
                  {abi.noteHoch === null ? "–" : fmt(abi.noteHoch, 1)}
                </span>
                <div className="leading-tight">
                  <p className="text-xs font-medium text-zinc-300">Abi-Schnitt</p>
                  <p className="text-[10px] text-zinc-500">hochgerechnet</p>
                </div>
              </div>

              <div className="flex-1 min-w-[260px]">
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="tabular-nums text-zinc-400">
                    <strong className="text-zinc-200">{abi.gesamtHoch}</strong> von{" "}
                    {data.soll.maxGesamt} möglichen Punkten
                  </span>
                  <span className="text-zinc-600">
                    900 P = Note 1,0 · {data.soll.bestehen} P = Note 4,0
                  </span>
                </div>
                {/* Balken: sicher (satt) + Hochrechnung (blass) */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-violet-400/25"
                    style={{ width: `${(abi.gesamtHoch / data.soll.maxGesamt) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-violet-400"
                    style={{
                      width: `${((abi.blockIErreicht + abi.blockIIErreicht) / data.soll.maxGesamt) * 100}%`,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 w-0.5 bg-rose-400"
                    style={{ left: `${(data.soll.bestehen / data.soll.maxGesamt) * 100}%` }}
                    title={`Bestehensgrenze: unter ${data.soll.bestehen} Punkten gibt es kein Abitur`}
                  />
                </div>
                {/* Legende zum Balken – ohne sie ist er nicht lesbar */}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-violet-400" />
                    sicher: {abi.blockIErreicht + abi.blockIIErreicht} P
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm bg-violet-400/25" />
                    kommt vermutlich dazu:{" "}
                    {abi.gesamtHoch - abi.blockIErreicht - abi.blockIIErreicht} P
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-0.5 bg-rose-400" />
                    Bestehensgrenze {data.soll.bestehen} P
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-zinc-500">
                  <span>
                    <span className="text-zinc-400">Block I</span>{" "}
                    <span className="tabular-nums text-zinc-300">
                      {abi.blockIErreicht}
                    </span>
                    /{data.soll.maxBlockI}
                    {abi.blockIOffen > 0 && (
                      <span className="text-zinc-600"> · {abi.blockIOffen} HJL offen</span>
                    )}
                  </span>
                  <span>
                    <span className="text-zinc-400">Block II</span>{" "}
                    {abi.blockIIOffen === 5 ? (
                      <span className="text-zinc-600">alle 5 Prüfungen offen</span>
                    ) : (
                      <span className="tabular-nums text-zinc-300">
                        {abi.blockIIErreicht}/{data.soll.maxBlockII}
                      </span>
                    )}
                  </span>
                  <span>
                    <span className="text-zinc-400">bestenfalls</span>{" "}
                    <span className="tabular-nums text-zinc-300">
                      {fmt(abi.noteBest, 1)}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-2.5 border-t border-white/[0.07] pt-2 text-[11px] leading-relaxed text-zinc-500">
              <strong className="text-zinc-300">So liest sich die Zahl:</strong> Dein Abitur
              wird aus <strong>900 Punkten</strong> gebildet — 600 aus den 40
              Halbjahresleistungen (Block I) und 300 aus den 5 Abiturprüfungen (Block II).
              Die {abi.gesamtHoch} sind die Punktzahl, auf die du{" "}
              <strong className="text-zinc-300">
                hinausläufst, wenn du genau so weitermachst wie bisher
              </strong>{" "}
              — die {abi.blockIOffen + abi.blockIIOffen} noch offenen Leistungen sind dafür
              mit deinem bisherigen Schnitt von{" "}
              <strong className="text-zinc-400">{fmt(abi.niveau)}</strong> Punkten angesetzt.
              Fest stehen erst{" "}
              <strong className="text-zinc-400">{abi.feststehend}</strong> von{" "}
              {abi.hjlGesamt} Halbjahresleistungen und {5 - abi.blockIIOffen} von 5
              Abiturprüfungen.{" "}
              <span className="text-amber-500/80">
                Das ist eine Fortschreibung, keine Vorhersage — besser wirst du durch
                bessere Noten, nicht durch Warten.
              </span>
            </p>
          </div>

          {/* ═══ Halbjahre nebeneinander ═══ */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.halbjahre.map((h) => {
              const eingebrachtMitNote = h.slots.filter(
                (s) => aktiv.has(s.id) && s.zeugnis !== null,
              );
              const schnitt = eingebrachtMitNote.length
                ? eingebrachtMitNote.reduce((a, s) => a + (s.zeugnis as number), 0) /
                  eingebrachtMitNote.length
                : null;

              return (
                <div key={h.id} className={ROW}>
                  {/* Kopf: Schnitt oben */}
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-zinc-300">{h.id}</span>
                    <span className="text-[10px] text-zinc-600">
                      {h.abgeschlossen
                        ? "abgeschlossen"
                        : h.begonnen
                          ? "läuft"
                          : "noch nicht begonnen"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-2xl font-semibold tabular-nums"
                      style={{ color: schnitt === null ? "#52525b" : punkteFarbe(schnitt) }}
                    >
                      {fmt(schnitt)}
                    </span>
                    <span className="text-[10px] text-zinc-600">Punkte Ø</span>
                  </div>

                  {/* Leiste */}
                  <div className="mb-2 mt-1.5">
                    <Leiste wert={schnitt} />
                  </div>

                  {/* Noten darunter */}
                  <div className="flex flex-col gap-px">
                    {h.slots.map((s) => {
                      const an = aktiv.has(s.id);
                      const empfohlen = vorschlag.has(s.id);
                      const abweicht = an !== empfohlen;
                      const klickbar = !s.pflicht;
                      return (
                        <div
                          key={s.id}
                          onClick={() => toggle(s)}
                          title={
                            s.pflicht
                              ? `${s.fach} – Pflichteinbringung, nicht abwählbar`
                              : `${s.fach} – klicken zum ${an ? "Streichen" : "Einbringen"}${
                                  empfohlen ? " · empfohlen: einbringen" : " · empfohlen: streichen"
                                }`
                          }
                          className={`flex items-center gap-1.5 rounded px-1 py-[3px] text-[11px] ${
                            klickbar ? "cursor-pointer hover:bg-white/5" : ""
                          } ${an ? "" : "opacity-45"} ${
                            abweicht ? "border-l-2 border-amber-400/60" : "border-l-2 border-transparent"
                          }`}
                        >
                          <span
                            className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border text-[8px] leading-none ${
                              an
                                ? s.pflicht
                                  ? "border-zinc-600 bg-zinc-600 text-zinc-300"
                                  : "border-emerald-400/70 bg-emerald-400/80 text-zinc-900"
                                : "border-zinc-700"
                            }`}
                          >
                            {an ? "✓" : ""}
                          </span>
                          <span
                            className={`w-7 shrink-0 ${an ? "text-zinc-400" : "text-zinc-600 line-through"}`}
                          >
                            {s.kuerzel}
                          </span>
                          <span className="flex-1 truncate text-zinc-600">
                            {s.gross !== null && `K${fmt(s.gross, 0)}`}
                            {s.gross !== null && s.klein !== null && "·"}
                            {s.klein !== null && `k${fmt(s.klein, 1)}`}
                          </span>
                          <span
                            className="w-5 shrink-0 text-right font-semibold tabular-nums"
                            style={{
                              color:
                                s.zeugnis === null ? "#52525b" : punkteFarbe(s.zeugnis),
                            }}
                          >
                            {s.zeugnis ?? "–"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ═══ Seminar + Prüfungen + Hürden ═══ */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {data.wSeminar && (
              <div className={ROW}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  W-Seminar &amp; Seminararbeit
                </p>
                <p className="mt-0.5 truncate text-[11px] text-zinc-500" title={data.wSeminar.thema}>
                  {data.wSeminar.thema}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {Object.entries(data.wSeminar.punkte).map(([k, v]) => (
                    <span key={k} className="text-zinc-400">
                      {k}{" "}
                      <span className="font-semibold" style={{ color: punkteFarbe(v) }}>
                        {v}
                      </span>
                    </span>
                  ))}
                  <span className="text-zinc-400">
                    Arbeit{" "}
                    {data.wSeminar.arbeitNote === null ? (
                      <span className="text-zinc-600">offen</span>
                    ) : (
                      <span
                        className="font-semibold"
                        style={{ color: punkteFarbe(data.wSeminar.arbeitNote) }}
                      >
                        {data.wSeminar.arbeitNote}
                      </span>
                    )}
                    <span className="text-zinc-600"> ×2</span>
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                  Note = (2 × schriftliche Arbeit + Präsentation) / 3, auf ganze Punkte
                  gerundet, dann doppelt gewertet — max 30 P.
                </p>
              </div>
            )}

            <div className={ROW}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Abiturprüfungen · Block II
              </p>
              <div className="mt-1 flex flex-col gap-px">
                {data.pruefungen.map((p) => (
                  <div key={p.fach} className="flex items-center gap-1.5 text-[11px]">
                    <span className="flex-1 truncate text-zinc-400">{p.fach}</span>
                    <span className="text-[10px] text-zinc-600">{p.art}</span>
                    <span
                      className="w-12 shrink-0 text-right tabular-nums"
                      style={{ color: p.punkte === null ? "#52525b" : punkteFarbe(p.punkte) }}
                    >
                      {p.punkte === null ? "offen" : `${p.punkte * 4} P`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                Jede Prüfung zählt <strong>vierfach</strong>, also max 60 Punkte.
              </p>
            </div>

            <div className={ROW}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Sperren &amp; Hürden
              </p>
              <div className="mt-1 flex flex-col gap-1 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className={abi.nullPunkte === 0 ? "text-emerald-400" : "text-rose-400"}>
                    {abi.nullPunkte === 0 ? "✓" : "✕"}
                  </span>
                  <span className="flex-1 text-zinc-400">0-Punkte-Sperre</span>
                  <span className="text-zinc-600">
                    {abi.nullPunkte === 0 ? "keine" : `${abi.nullPunkte} ×`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={
                      abi.unterFuenf <= data.soll.gesamt - data.soll.fuenfPunkteHuerde
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }
                  >
                    {abi.unterFuenf <= data.soll.gesamt - data.soll.fuenfPunkteHuerde ? "✓" : "✕"}
                  </span>
                  <span className="flex-1 text-zinc-400">5-Punkte-Hürde</span>
                  <span className="tabular-nums text-zinc-600">
                    {abi.abFuenf} ab 5 P · {abi.unterFuenf} drunter
                  </span>
                </div>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600">
                In {data.soll.fuenfPunkteHuerde} der {data.soll.gesamt}{" "}
                Halbjahresleistungen müssen ≥ 5 Punkte stehen — es sind also höchstens{" "}
                {data.soll.gesamt - data.soll.fuenfPunkteHuerde} Unterpunktungen erlaubt.
                Geprüft wird hier nur, was schon feststeht ({abi.feststehend} von{" "}
                {abi.hjlGesamt}).
              </p>
            </div>
          </div>

          {/* ═══ Legende ═══ */}
          <p className="text-[11px] leading-relaxed text-zinc-600">
            <strong className="text-zinc-500">Ankreuzen</strong> = einbringen. Graue Kästchen
            sind <strong>Pflichteinbringungen</strong> und nicht abwählbar: Deutsch, Mathe,
            Französisch, Sport und Wirtschaft als Prüfungsfächer, Biologie als einzige
            Naturwissenschaft — je 4 Halbjahre. Grüne Haken sind{" "}
            <strong>frei wählbar</strong>, vorausgewählt ist die beste Kombination.{" "}
            <span className="text-amber-500/80">
              Ein gelber Balken links heißt: hier weichst du vom besten Vorschlag ab.
            </span>
            <br />
            Aus {data.pool.faecher.join(", ")} kommen{" "}
            <strong>{data.pool.soll} von {data.pool.verfuegbar}</strong>{" "}
            Halbjahresleistungen, also{" "}
            <strong>{data.pool.streichungen} Streichungen</strong> (40 − 4 Seminar −{" "}
            {data.soll.ausFaechern - data.pool.soll} Pflicht). Das läuft in{" "}
            {data.pool.soll > data.pool.mindest ? (
              <>
                <strong>zwei Stufen</strong>: Je Fach ist eine Mindestzahl gesetzt —
                das sind {data.pool.mindest} feste Plätze. Die restlichen{" "}
                <strong>{data.pool.soll - data.pool.mindest}</strong> sind{" "}
                <strong>freie Einbringungen</strong> und gehen an die besten übrigen
                (offiziell sind bis zu 3 erlaubt).
              </>
            ) : (
              <>
                festen Mindestzahlen je Fach: Geschichte, Ethik und Kunst je 3 von 4,
                Informatik 2 von 4, PuG 1 von 2. Das ergibt genau {data.pool.mindest} —{" "}
                <strong>die Verteilung ist damit vollständig bestimmt</strong>, es bleibt
                keine freie Einbringung übrig. Gestrichen wird in jedem Fach die
                schwächste.
              </>
            )}{" "}
            <span className="text-zinc-500">
              Noch unbenotete Halbjahre werden mit deinem bisherigen Schnitt bewertet —
              sonst würde eine echte 11 gestrichen, nur weil ein unbekanntes Halbjahr
              blind Vorrang hätte.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
