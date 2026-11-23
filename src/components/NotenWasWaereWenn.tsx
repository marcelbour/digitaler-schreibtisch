"use client";

import { useCallback, useMemo, useState } from "react";
import { abiNote, punkteFuerNote, waehleEinbringung, type NotenStand } from "@/lib/noten";

// ── Was-wäre-wenn ──────────────────────────────────────────────────────────
// Alles, was noch nicht feststeht (laufendes + kommendes Halbjahr, die fünf
// Abiturprüfungen, die Seminararbeit), bekommt einen Regler 0–15.
//
// Vorbelegt ist ein REALISTISCHER Vorschlag je Fach, kein Pauschalschnitt:
//   • Klausur-Niveau  = Schnitt aller bisherigen großen LN im Fach
//   • Klein-Niveau    = Schnitt aller bisherigen kleinen LN im Fach
//   • offenes Halbjahr       → (Klausur-Niveau + Klein-Niveau) / 2
//   • laufendes Halbjahr     → was schon da ist, zählt echt; nur das Fehlende
//                              wird mit dem Niveau aufgefüllt
//   • schriftliche Prüfung   → Klausur-Niveau (eine Abiprüfung IST eine Klausur)
//   • Kolloquium / Sport     → Gesamtniveau des Fachs
// So zieht z.B. Deutsch die schwachen Klausuren (7, 4) mit, obwohl die
// kleinen LN gut sind – der 10er aus 12/1 trägt nicht allein.
//
// Zielnote gewählt → alle NICHT fixierten Regler werden um denselben Betrag
// gegenüber dem Vorschlag verschoben, bis die Punkte reichen. Die Stärken
// und Schwächen zwischen den Fächern bleiben dabei erhalten.
// Wer einen Regler anfasst, fixiert ihn (📌) – die übrigen gleichen aus.
//
// Die Streichungen im Topf werden mit den hypothetischen Noten NEU gewählt
// (dieselbe Funktion wie auf dem Server), sonst würde eine gedachte 4 in
// Informatik eingebracht, die in Wahrheit gestrichen würde.

type Gruppe = { id: string; titel: string; hinweis: string };

type Regler = {
  id: string;
  gruppe: string;
  label: string;
  kurz: string;
  /** Ungerundeter Vorschlag – Basis fürs Verteilen. */
  basis: number;
  /** Woraus der Vorschlag kommt, für den Tooltip. */
  herkunft: string;
};

function punkteFarbe(p: number): string {
  if (p >= 13) return "#34d399";
  if (p >= 10) return "#a3e635";
  if (p >= 7) return "#fbbf24";
  if (p >= 5) return "#fb923c";
  return "#fb7185";
}

function noteFarbe(n: number | null): string {
  if (n === null) return "#fb7185";
  if (n <= 1.5) return "#34d399";
  if (n <= 2.5) return "#a3e635";
  if (n <= 3.3) return "#fbbf24";
  return "#fb923c";
}

const komma = (n: number, stellen = 1) =>
  n.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });

const mittel = (w: number[]) => (w.length ? w.reduce((a, b) => a + b, 0) / w.length : null);
const klemme = (n: number) => Math.min(15, Math.max(0, n));

const ZIELE = Array.from({ length: 31 }, (_, i) => Math.round((1 + i * 0.1) * 10) / 10);

export function NotenWasWaereWenn({ data }: { data: NotenStand }) {
  // ---- 1. Regler + Vorschlag aus den Daten ableiten ----
  const { regler, gruppen } = useMemo(() => {
    const regler: Regler[] = [];
    const gruppen: Gruppe[] = [];

    // Fachniveaus aus allem, was es schon gibt (abgeschlossen + laufend).
    type Niveau = { gross: number[]; klein: number[]; zeugnis: number[] };
    const niv = new Map<string, Niveau>();
    for (const h of data.halbjahre)
      for (const s of h.slots) {
        const n = niv.get(s.fach) ?? { gross: [], klein: [], zeugnis: [] };
        if (s.gross !== null) n.gross.push(s.gross);
        if (s.klein !== null) n.klein.push(s.klein);
        if (h.abgeschlossen && s.zeugnis !== null) n.zeugnis.push(s.zeugnis);
        niv.set(s.fach, n);
      }
    const gesamtNiveau =
      mittel(
        data.halbjahre
          .filter((h) => h.abgeschlossen)
          .flatMap((h) => h.slots.map((s) => s.zeugnis).filter((z): z is number => z !== null)),
      ) ?? 8;

    const fachNiveau = (fach: string) => {
      const n = niv.get(fach);
      const g = mittel(n?.gross ?? []);
      const k = mittel(n?.klein ?? []);
      const z = mittel(n?.zeugnis ?? []);
      const gesamt = g !== null && k !== null ? (g + k) / 2 : (z ?? g ?? k ?? gesamtNiveau);
      return { g, k, z, gesamt };
    };

    for (const h of data.halbjahre) {
      if (h.abgeschlossen) continue;
      gruppen.push({
        id: h.id,
        titel: h.id,
        hinweis: h.begonnen ? "läuft – vorhandene Noten sind eingerechnet" : "noch nicht begonnen",
      });
      for (const s of h.slots) {
        const f = fachNiveau(s.fach);
        let basis: number;
        let herkunft: string;
        if (s.gross !== null || s.klein !== null) {
          const g = s.gross ?? f.g;
          const k = s.klein ?? f.k;
          basis = g !== null && k !== null ? (g + k) / 2 : (s.roh ?? f.gesamt);
          herkunft =
            `bisher: ${s.gross !== null ? `Klausur ${komma(s.gross, 0)}` : "keine Klausur"}` +
            `, ${s.klein !== null ? `kleine LN Ø ${komma(s.klein)}` : "keine kleinen LN"}` +
            (s.gross === null && f.g !== null ? ` · Klausur mit deinem Ø ${komma(f.g)} angesetzt` : "") +
            (s.klein === null && f.k !== null ? ` · kleine LN mit deinem Ø ${komma(f.k)} angesetzt` : "");
        } else {
          basis = f.gesamt;
          herkunft =
            f.g !== null && f.k !== null
              ? `dein Fachniveau: Klausuren Ø ${komma(f.g)}, kleine LN Ø ${komma(f.k)}`
              : `dein bisheriger Zeugnisschnitt im Fach: ${komma(f.gesamt)}`;
        }
        regler.push({
          id: s.id,
          gruppe: h.id,
          label: s.fach,
          kurz: s.kuerzel,
          basis: klemme(basis),
          herkunft,
        });
      }
    }

    if (data.pruefungen.some((p) => p.punkte === null)) {
      gruppen.push({ id: "abi", titel: "Abiturprüfungen", hinweis: "zählen vierfach" });
      for (const p of data.pruefungen) {
        if (p.punkte !== null) continue;
        const f = fachNiveau(p.fach);
        const schriftlich = p.art.toLowerCase().includes("schrift");
        const basis = schriftlich && f.g !== null ? f.g : f.gesamt;
        regler.push({
          id: `abi|${p.fach}`,
          gruppe: "abi",
          label: `${p.fach} (${p.art})`,
          kurz: data.halbjahre.flatMap((h) => h.slots).find((s) => s.fach === p.fach)?.kuerzel ??
            p.fach.slice(0, 3),
          basis: klemme(basis),
          herkunft:
            schriftlich && f.g !== null
              ? `schriftliche Prüfung → dein Klausur-Ø im Fach: ${komma(f.g)}`
              : `dein Gesamtniveau im Fach: ${komma(f.gesamt)}`,
        });
      }
    }

    const w = data.wSeminar;
    if (w && w.arbeitNote === null) {
      const wNiv = mittel(Object.values(w.punkte)) ?? gesamtNiveau;
      gruppen.push({
        id: "sa",
        titel: "Seminararbeit",
        hinweis: "(2 × Arbeit + Präsentation) / 3, zählt doppelt",
      });
      if (w.schriftlich === null)
        regler.push({
          id: "sa|schriftlich",
          gruppe: "sa",
          label: "Schriftliche Arbeit",
          kurz: "Arb",
          basis: klemme(wNiv),
          herkunft: `dein W-Seminar-Schnitt: ${komma(wNiv)}`,
        });
      if (w.praesentation === null)
        regler.push({
          id: "sa|praesentation",
          gruppe: "sa",
          label: "Präsentation",
          kurz: "Präs",
          basis: klemme(wNiv),
          herkunft: `dein W-Seminar-Schnitt: ${komma(wNiv)}`,
        });
    }

    return { regler, gruppen };
  }, [data]);

  const vorschlagWerte = useMemo(
    () => Object.fromEntries(regler.map((r) => [r.id, Math.round(r.basis)])),
    [regler],
  );

  const [werte, setWerte] = useState<Record<string, number>>(vorschlagWerte);
  const [pins, setPins] = useState<Set<string>>(new Set());
  const [ziel, setZiel] = useState<number | null>(null);

  // Kein Reset-Effekt nötig: Das Widget lädt die Daten einmal, und die
  // Komponente wird erst beim Aufklappen erzeugt.

  // ---- 2. Gesamtrechnung für einen Satz Reglerwerte ----
  const poolRegeln = useMemo(
    () =>
      data.regeln
        .filter((r) => !r.pflicht)
        .map((r) => ({ fach: r.fach, streichbar: r.streichbar ?? 1 })),
    [data],
  );

  const rechne = useCallback(
    (w: Record<string, number>) => {
      const slots = data.halbjahre.flatMap((h) =>
        h.slots.map((s) => ({
          id: s.id,
          fach: s.fach,
          halbjahr: s.halbjahr,
          pflicht: s.pflicht,
          wert: h.abgeschlossen ? s.zeugnis : (w[s.id] ?? s.zeugnis),
        })),
      );
      const ausPool = waehleEinbringung(
        slots.filter((s) => !s.pflicht),
        poolRegeln,
        data.pool.soll,
      );
      const drin = slots.filter((s) => s.pflicht || ausPool.has(s.id));
      const hjl = drin.map((s) => s.wert ?? 0);

      const wSem = Object.values(data.wSeminar?.punkte ?? {});
      let saNote: number | null = null;
      if (data.wSeminar) {
        const sw = data.wSeminar;
        saNote =
          sw.arbeitNote ??
          Math.round(
            (2 * (sw.schriftlich ?? w["sa|schriftlich"] ?? 0) +
              (sw.praesentation ?? w["sa|praesentation"] ?? 0)) /
              3,
          );
      }
      const blockI =
        hjl.reduce((a, b) => a + b, 0) +
        wSem.reduce((a, b) => a + b, 0) +
        (saNote ?? 0) * 2;
      const blockII = data.pruefungen.reduce(
        (a, p) => a + (p.punkte ?? w[`abi|${p.fach}`] ?? 0) * 4,
        0,
      );
      const alle40 = [...hjl, ...wSem, ...(saNote !== null ? [saNote, saNote] : [])];
      const gesamt = blockI + blockII;
      return {
        gesamt,
        blockI,
        blockII,
        note: abiNote(gesamt),
        saNote,
        gestrichen: new Set(slots.filter((s) => !s.pflicht && !ausPool.has(s.id)).map((s) => s.id)),
        unterFuenf: alle40.filter((p) => p < 5).length,
        nullPunkte: alle40.filter((p) => p === 0).length,
      };
    },
    [data, poolRegeln],
  );

  // ---- 3. Auf Zielnote verteilen ----
  // Alle freien Regler um denselben Betrag d gegenüber dem Vorschlag
  // verschieben; das kleinste d nehmen, das reicht.
  const verteile = useCallback(
    (basisWerte: Record<string, number>, fix: Set<string>, zielNote: number) => {
      const noetig = punkteFuerNote(zielNote, data.soll.maxGesamt, data.soll.bestehen);
      const frei = regler.filter((r) => !fix.has(r.id));
      const mit = (d: number) => {
        const w = { ...basisWerte };
        for (const r of frei) w[r.id] = klemme(Math.round(r.basis + d));
        return w;
      };
      if (noetig === null) return { werte: mit(15), erreichbar: false };
      for (let d = -15; d <= 15.001; d += 0.05) {
        const w = mit(d);
        if (rechne(w).gesamt >= noetig) return { werte: w, erreichbar: true };
      }
      return { werte: mit(15), erreichbar: false };
    },
    [regler, rechne, data.soll],
  );

  const ergebnis = useMemo(() => rechne(werte), [rechne, werte]);
  const vorschlagErgebnis = useMemo(() => rechne(vorschlagWerte), [rechne, vorschlagWerte]);
  const noetig = ziel === null ? null : punkteFuerNote(ziel, data.soll.maxGesamt, data.soll.bestehen);

  const setzeZiel = (z: number | null) => {
    setZiel(z);
    if (z !== null) setWerte(verteile(werte, pins, z).werte);
  };

  const schiebe = (id: string, v: number) => {
    const neuPins = new Set(pins).add(id);
    const neu = { ...werte, [id]: v };
    setPins(neuPins);
    setWerte(ziel !== null ? verteile(neu, neuPins, ziel).werte : neu);
  };

  const loese = (id: string) => {
    const neuPins = new Set(pins);
    neuPins.delete(id);
    setPins(neuPins);
    if (ziel !== null) setWerte(verteile(werte, neuPins, ziel).werte);
  };

  const zurueck = () => {
    setPins(new Set());
    setWerte(ziel !== null ? verteile(vorschlagWerte, new Set(), ziel).werte : vorschlagWerte);
  };

  const zielErreicht = noetig !== null && ergebnis.gesamt >= noetig;
  const offeneWerte = regler.map((r) => werte[r.id] ?? 0);
  const schnittOffen = mittel(offeneWerte) ?? 0;
  const schnittVorschlag = mittel(regler.map((r) => vorschlagWerte[r.id] ?? 0)) ?? 0;
  const erlaubtUnter5 = data.soll.gesamt - data.soll.fuenfPunkteHuerde;

  if (!regler.length)
    return <p className="text-[11px] text-zinc-500">Es ist nichts mehr offen – alles steht fest.</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* ── Kopf: Ergebnis + Ziel ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-semibold tabular-nums"
            style={{ color: noteFarbe(ergebnis.note) }}
          >
            {ergebnis.note === null ? "–" : komma(ergebnis.note)}
          </span>
          <div className="leading-tight">
            <p className="text-xs text-zinc-300">
              <strong className="tabular-nums">{ergebnis.gesamt}</strong> / {data.soll.maxGesamt} P
            </p>
            <p className="text-[10px] text-zinc-500">
              Vorschlag ergäbe{" "}
              {vorschlagErgebnis.note === null ? "–" : komma(vorschlagErgebnis.note)} (
              {vorschlagErgebnis.gesamt} P)
            </p>
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          🎯 Ziel
          <select
            value={ziel ?? ""}
            onChange={(e) => setzeZiel(e.target.value === "" ? null : Number(e.target.value))}
            className="rounded-md border border-white/10 bg-[#1a1b26] px-1.5 py-0.5 text-[11px] text-zinc-200"
          >
            <option value="">frei spielen</option>
            {ZIELE.map((z) => (
              <option key={z} value={z}>
                {komma(z)}
              </option>
            ))}
          </select>
        </label>

        {noetig !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              zielErreicht ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
            }`}
          >
            {zielErreicht
              ? `✓ reicht (${noetig} P nötig)`
              : `✕ nicht erreichbar mit den fixierten Werten – ${noetig} P nötig`}
          </span>
        )}

        <div className="ml-auto flex gap-1.5">
          <button
            onClick={zurueck}
            className="rounded-lg border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            title="Alle Regler zurück auf den realistischen Vorschlag, Fixierungen lösen"
          >
            ↺ Vorschlag
          </button>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-500">
        Ø der offenen Leistungen:{" "}
        <strong className="tabular-nums" style={{ color: punkteFarbe(schnittOffen) }}>
          {komma(schnittOffen)}
        </strong>{" "}
        (Vorschlag {komma(schnittVorschlag)}) · Block I {ergebnis.blockI}/{data.soll.maxBlockI} ·
        Block II {ergebnis.blockII}/{data.soll.maxBlockII} ·{" "}
        <span className={ergebnis.unterFuenf > erlaubtUnter5 ? "text-rose-400" : ""}>
          {ergebnis.unterFuenf} von max. {erlaubtUnter5} Unterpunktungen
        </span>
        {ergebnis.nullPunkte > 0 && (
          <span className="text-rose-400"> · {ergebnis.nullPunkte}× 0 Punkte eingebracht!</span>
        )}
      </p>

      {/* ── Regler nach Gruppen ── */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {gruppen.map((g) => (
          <div key={g.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-zinc-300">{g.titel}</span>
              <span className="truncate text-[10px] text-zinc-600">{g.hinweis}</span>
            </div>
            <div className="flex flex-col gap-1">
              {regler
                .filter((r) => r.gruppe === g.id)
                .map((r) => {
                  const v = werte[r.id] ?? 0;
                  const diff = v - (vorschlagWerte[r.id] ?? 0);
                  const fix = pins.has(r.id);
                  const weg = ergebnis.gestrichen.has(r.id);
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-1.5 text-[11px] ${weg ? "opacity-45" : ""}`}
                      title={`${r.label}\nVorschlag ${vorschlagWerte[r.id]} – ${r.herkunft}${
                        weg ? "\nMit diesen Noten wird das hier gestrichen, zählt also nicht." : ""
                      }`}
                    >
                      <span className={`w-8 shrink-0 ${weg ? "text-zinc-600 line-through" : "text-zinc-400"}`}>
                        {r.kurz}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={15}
                        step={1}
                        value={v}
                        onChange={(e) => schiebe(r.id, Number(e.target.value))}
                        className="h-1 flex-1 cursor-pointer"
                        style={{ accentColor: punkteFarbe(v) }}
                      />
                      <span
                        className="w-5 shrink-0 text-right font-semibold tabular-nums"
                        style={{ color: punkteFarbe(v) }}
                      >
                        {v}
                      </span>
                      <span
                        className={`w-6 shrink-0 text-right text-[10px] tabular-nums ${
                          diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-zinc-700"
                        }`}
                      >
                        {diff === 0 ? "±0" : diff > 0 ? `+${diff}` : diff}
                      </span>
                      <button
                        onClick={() => fix && loese(r.id)}
                        className={`w-4 shrink-0 text-[10px] ${fix ? "cursor-pointer" : "cursor-default opacity-0"}`}
                        title={fix ? "Fixiert – klicken zum Lösen" : ""}
                      >
                        📌
                      </button>
                    </div>
                  );
                })}
            </div>
            {g.id === "sa" && ergebnis.saNote !== null && (
              <p className="mt-1 text-[10px] text-zinc-500">
                → Seminararbeitsnote {ergebnis.saNote} × 2 = {ergebnis.saNote * 2} P
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-zinc-600">
        <strong className="text-zinc-500">So funktioniert&apos;s:</strong> Vorbelegt ist ein
        realistischer Vorschlag aus deinen bisherigen Noten je Fach — Klausuren und kleine LN
        getrennt, eine schriftliche Abiprüfung zählt wie eine Klausur (Maus auf eine Zeile zeigt,
        woraus der Wert kommt). Wählst du ein <strong>Ziel</strong>, werden alle Regler
        gleichmäßig hoch- oder runtergeschoben, bis es reicht. Ziehst du einen Regler selbst, wird er{" "}
        <strong>fixiert 📌</strong> und die übrigen gleichen aus. +/− zeigt den Abstand zum
        Vorschlag. Durchgestrichen = würde mit diesen Noten gestrichen, zählt also nicht. Die
        Einbringung wird hier immer optimal gewählt, unabhängig von deinen Häkchen oben.
      </p>
    </div>
  );
}
