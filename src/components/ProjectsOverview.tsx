"use client";

import { useEffect, useState } from "react";
import { CARD, HEADING, iconBadge, pill } from "@/lib/ui";

type Project = {
  name: string;
  path: string;
  status: string | null;
  nextStep: string | null;
};

const STATUS_PILL: Record<string, "green" | "amber" | "neutral"> = {
  aktiv: "green",
  pausiert: "amber",
  abgeschlossen: "neutral",
};

export function ProjectsOverview() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Unbekannter Fehler");
        setProjects(json.projects);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={iconBadge("blue")}>🗂️</span>
        <h2 className={HEADING}>Projekte</h2>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!projects && !error && <p className="text-sm text-zinc-500">Lädt…</p>}
      {projects && (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li
              key={p.path}
              className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-100">{p.name}</span>
                {p.status && (
                  <span className={pill(STATUS_PILL[p.status] ?? "neutral")}>
                    {p.status}
                  </span>
                )}
              </div>
              {p.nextStep && (
                <p className="mt-1 text-xs text-zinc-500">→ {p.nextStep}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
