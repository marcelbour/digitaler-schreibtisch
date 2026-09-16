"use client";

import { useEffect, useState } from "react";

type Project = {
  name: string;
  path: string;
  status: string | null;
  nextStep: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  aktiv: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  pausiert: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  abgeschlossen: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
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
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Projekte
      </h2>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!projects && !error && <p className="text-sm text-zinc-400">Lädt…</p>}
      {projects && (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.path} className="rounded border border-zinc-100 p-2 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {p.name}
                </span>
                {p.status && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[p.status] ??
                      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {p.status}
                  </span>
                )}
              </div>
              {p.nextStep && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  → {p.nextStep}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
