"use client";

import { useEffect, useState } from "react";

type Reminder = { text: string };
type RemindersResponse = { heute: Reminder[]; woche: Reminder[] };

function TodoColumn({ title, items }: { title: string; items: Reminder[] }) {
  return (
    <div className="flex-1">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </h3>
      {items.length === 0 && (
        <p className="text-sm text-zinc-400">Nichts offen.</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded border border-zinc-100 px-2 py-1.5 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
          >
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TodoLists() {
  const [data, setData] = useState<RemindersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reminders")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Unbekannter Fehler");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        To-Dos
      </h2>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-400">Lädt…</p>}
      {data && (
        <div className="flex gap-4">
          <TodoColumn title="Heute / dringend" items={data.heute} />
          <TodoColumn title="Diese Woche" items={data.woche} />
        </div>
      )}
    </div>
  );
}
