"use client";

import { useEffect, useState } from "react";
import { CARD, CARD_HEADER, HEADING, iconBadge, pill, ROW, ROW_HOVER } from "@/lib/ui";
import { InlineMarkdown } from "@/components/InlineMarkdown";
import type { Reminder, RemindersResponse } from "@/lib/reminders";

/**
 * Ein Eintrag: immer die Überschrift, Details nur auf Klick.
 *
 * Von Marcel am 24.10.2026 bestellt – die Einträge in der Vault-Datei sind bewusst
 * ausführlich, im Widget standen sie dadurch als Textblöcke übereinander: "die sind ja
 * richtig lang, wirklich". Einträge ohne Details bekommen keinen Pfeil und sind kein
 * Button – da gibt es nichts zu klicken.
 */
function ReminderRow({ reminder }: { reminder: Reminder }) {
  const [open, setOpen] = useState(false);
  const hasDetails = reminder.details.length > 0;

  const marker = reminder.icon && (
    <span aria-hidden className="shrink-0 leading-5">
      {reminder.icon}
    </span>
  );

  if (!hasDetails) {
    return (
      <li className={`${ROW} flex gap-2 text-sm text-zinc-300`}>
        {marker}
        <span className="min-w-0">{reminder.title}</span>
      </li>
    );
  }

  return (
    <li className={`${ROW} ${ROW_HOVER} p-0 transition-colors`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-zinc-300"
      >
        {marker}
        <span className="min-w-0 flex-1">{reminder.title}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        >
          <path
            d="M7.5 5l5 5-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="border-t border-white/5 px-3 py-2 text-[13px] leading-relaxed text-zinc-400">
          <InlineMarkdown text={reminder.details} />
        </div>
      )}
    </li>
  );
}

function TodoColumn({ title, items }: { title: string; items: Reminder[] }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h3>
        {items.length > 0 && (
          <span className={pill(title.startsWith("Heute") ? "amber" : "neutral")}>
            {items.length}
          </span>
        )}
      </div>
      {items.length === 0 && <p className="text-sm text-zinc-500">Nichts offen.</p>}
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <ReminderRow key={item.title} reminder={item} />
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
      <div className={CARD_HEADER}>
        <span className={iconBadge("green")}>✅</span>
        <h2 className={HEADING}>To-Dos</h2>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}
      {/* Untereinander statt nebeneinander (24.10.2026): In zwei Spalten blieben pro
          Eintrag ~170px, da brach jede Überschrift auf zwei Wörter um. Gestapelt hat
          jede Zeile die volle Kartenbreite – und genau darum ging es. */}
      {data && (
        <div className="flex flex-col gap-4">
          <TodoColumn title="Heute / dringend" items={data.heute} />
          <TodoColumn title="Diese Woche" items={data.woche} />
        </div>
      )}
    </div>
  );
}
