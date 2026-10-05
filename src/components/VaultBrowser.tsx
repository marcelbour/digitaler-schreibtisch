"use client";

import { useEffect, useState } from "react";
import { CARD, HEADING, iconBadge } from "@/lib/ui";

type Entry = {
  name: string;
  path: string;
  isFolder: boolean;
};

function parseEntries(rawFiles: string[], parentPath: string): Entry[] {
  return rawFiles
    .map((raw) => {
      const isFolder = raw.endsWith("/");
      const name = isFolder ? raw.slice(0, -1) : raw;
      const path = parentPath ? `${parentPath}/${name}` : name;
      return { name, path, isFolder };
    })
    .sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "de");
    });
}

async function fetchEntries(path: string): Promise<Entry[]> {
  const res = await fetch(`/api/vault?path=${encodeURIComponent(path)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Unbekannter Fehler");
  }
  return parseEntries(data.files as string[], path);
}

function FolderNode({ path, name }: { path: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!open && entries === null) {
      setLoading(true);
      setError(null);
      try {
        setEntries(await fetchEntries(path));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    setOpen((o) => !o);
  }

  return (
    <li>
      <button
        onClick={toggle}
        className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-white/5"
      >
        <span className="w-3 text-zinc-500">{open ? "▾" : "▸"}</span>
        <span>📁</span>
        <span className="text-zinc-200">{name}</span>
      </button>
      {open && (
        <div className="ml-4 border-l border-white/10 pl-2">
          {loading && <p className="px-1.5 py-1 text-xs text-zinc-500">Lädt…</p>}
          {error && <p className="px-1.5 py-1 text-xs text-rose-400">{error}</p>}
          {entries && (
            <ul>
              {entries.map((entry) =>
                entry.isFolder ? (
                  <FolderNode key={entry.path} path={entry.path} name={entry.name} />
                ) : (
                  <li
                    key={entry.path}
                    className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 pl-[1.125rem] text-sm text-zinc-500"
                  >
                    <span>📄</span>
                    <span>{entry.name}</span>
                  </li>
                ),
              )}
              {entries.length === 0 && (
                <li className="px-1.5 py-1 text-xs text-zinc-500">leer</li>
              )}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function VaultBrowser() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries("")
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={iconBadge("amber")}>📁</span>
        <h2 className={HEADING}>Vault-Übersicht</h2>
      </div>
      {error && (
        <p className="text-sm text-rose-400">
          {error}
          <br />
          <span className="text-xs text-zinc-500">
            Läuft die App lokal (npm run dev) und Obsidian mit aktiviertem
            Local REST API Plugin?
          </span>
        </p>
      )}
      {!entries && !error && <p className="text-sm text-zinc-500">Lädt…</p>}
      {entries && (
        <ul>
          {entries.map((entry) =>
            entry.isFolder ? (
              <FolderNode key={entry.path} path={entry.path} name={entry.name} />
            ) : (
              <li
                key={entry.path}
                className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm text-zinc-500"
              >
                <span>📄</span>
                <span>{entry.name}</span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
