"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CARD, HEADING, iconBadge, pill, ROW } from "@/lib/ui";
import type { TikTokStats } from "@/lib/tiktok";

// TikTok-Widget (16.11.2026, von Marcel bestellt): Hauptdaten des Accounts,
// „soll sich richtig oft updaten". Lädt alle 2 Minuten neu und zusätzlich
// sofort, wenn der Tab wieder in den Vordergrund kommt.

const REFRESH_MS = 120_000;
const NUM = new Intl.NumberFormat("de-DE");
const num = (n: number) => NUM.format(n);

type NotConnected = { notConnected: true; configured: boolean; message: string };

function datum(unix: number) {
  const d = new Date(unix * 1000);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function seit(iso: string, jetzt: number) {
  const min = Math.round((jetzt - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `vor ${h} Std` : `vor ${Math.floor(h / 24)} Tagen`;
}

function Kachel({ label, wert }: { label: string; wert: number }) {
  return (
    <div className={ROW}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-xl font-semibold tabular-nums text-zinc-50">{num(wert)}</div>
    </div>
  );
}

export function TikTokWidget() {
  const [data, setData] = useState<TikTokStats | null>(null);
  const [setup, setSetup] = useState<NotConnected | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [jetzt, setJetzt] = useState(() => Date.now());

  const laden = useCallback(() => {
    fetch("/api/tiktok", { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (json?.notConnected) {
          setSetup(json as NotConnected);
          return;
        }
        if (!r.ok) throw new Error(json?.error ?? `HTTP ${r.status}`);
        setSetup(null);
        setError(null);
        setStale(r.headers.get("X-Snapshot-Stale") === "1");
        setData(json as TikTokStats);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setJetzt(Date.now()));
  }, []);

  useEffect(() => {
    laden();
    const timer = setInterval(laden, REFRESH_MS);
    const tick = setInterval(() => setJetzt(Date.now()), 30_000);
    const onVisible = () => document.visibilityState === "visible" && laden();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [laden]);

  const kopf = (rechts?: ReactNode) => (
    <div className="mb-3 flex items-center gap-2.5">
      <span className={iconBadge("pink")}>♪</span>
      <h2 className={HEADING}>TikTok</h2>
      {data?.user.username && (
        <a
          href={data.user.profileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          @{data.user.username}
        </a>
      )}
      <div className="ml-auto flex items-center gap-2">{rechts}</div>
    </div>
  );

  if (setup) {
    return (
      <div className={CARD}>
        {kopf()}
        {setup.configured ? (
          <div className="space-y-2 text-sm text-zinc-400">
            <p>Noch nicht mit TikTok verbunden.</p>
            <a
              href="/api/tiktok/login"
              className="inline-block rounded-lg bg-pink-500/20 px-3 py-1.5 font-medium text-pink-300 hover:bg-pink-500/30"
            >
              Mit TikTok verbinden
            </a>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            TikTok-App noch nicht eingetragen (TIKTOK_CLIENT_KEY / _SECRET / _REDIRECT_URI in .env.local).
          </p>
        )}
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={CARD}>
        {kopf()}
        <p className="text-sm text-rose-400">Fehler: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={CARD}>
        {kopf()}
        <p className="text-sm text-zinc-500">Lädt …</p>
      </div>
    );
  }

  return (
    <div className={CARD}>
      {kopf(
        <>
          {stale && <span className={pill("amber")}>Schnappschuss</span>}
          {error && <span className={pill("red")}>Update fehlgeschlagen</span>}
          <button
            onClick={laden}
            className="text-xs text-zinc-500 hover:text-zinc-300"
            title="Jetzt neu laden"
          >
            Stand {seit(data.fetchedAt, jetzt)} ↻
          </button>
        </>,
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kachel label="Follower" wert={data.user.followers} />
        <Kachel label="Aufrufe gesamt" wert={data.totals.views} />
        <Kachel label="Likes gesamt" wert={data.user.likes} />
        <Kachel label="Kommentare" wert={data.totals.comments} />
        <Kachel label="Shares" wert={data.totals.shares} />
        <Kachel label="Videos" wert={data.user.videoCount} />
      </div>

      {data.videos.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th className="py-1 pr-2 font-normal">Datum</th>
                <th className="py-1 pr-2 font-normal">Video</th>
                <th className="py-1 pr-2 text-right font-normal">Aufrufe</th>
                <th className="py-1 pr-2 text-right font-normal">Likes</th>
                <th className="py-1 pr-2 text-right font-normal">Komm.</th>
                <th className="py-1 text-right font-normal">Shares</th>
              </tr>
            </thead>
            <tbody>
              {data.videos.map((v) => (
                <tr key={v.id} className="border-t border-white/5 text-zinc-300">
                  <td className="py-1.5 pr-2 tabular-nums text-zinc-500">{datum(v.createTime)}</td>
                  <td className="max-w-[18rem] truncate py-1.5 pr-2">
                    <a href={v.shareUrl} target="_blank" rel="noreferrer" className="hover:text-zinc-50">
                      {v.title || "(ohne Titel)"}
                    </a>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-100">{num(v.views)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{num(v.likes)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{num(v.comments)}</td>
                  <td className="py-1.5 text-right tabular-nums">{num(v.shares)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
