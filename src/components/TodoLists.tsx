"use client";

import { useEffect, useState } from "react";
import { CARD, HEADING, iconBadge, ROW } from "@/lib/ui";

type Reminder = { text: string };
type RemindersResponse = { heute: Reminder[]; woche: Reminder[] };

function TodoColumn({ title, items }: { title: string; items: Reminder[] }) {
  return (
    <div className="flex-1">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      {items.length === 0 && <p className="text-sm text-zinc-500">Nichts offen.</p>}
      <ul className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <li key={i} className={`${ROW} text-sm text-zinc-300`}>
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
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={iconBadge("green")}>✅</span>
        <h2 className={HEADING}>To-Dos</h2>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}
      {data && (
        <div className="flex gap-4">
          <TodoColumn title="Heute / dringend" items={data.heute} />
          <TodoColumn title="Diese Woche" items={data.woche} />
        </div>
      )}
    </div>
  );
}
