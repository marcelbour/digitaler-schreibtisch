"use client";

import { useEffect, useState } from "react";
import { Fragment } from "react";
import { CARD, HEADING, iconBadge } from "@/lib/ui";

type TodayResponse = {
  path: string;
  exists: boolean;
  content: string | null;
};

function renderInline(text: string, key: number) {
  // Sehr einfache Behandlung von **fett** Textstellen.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Fragment key={key}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </Fragment>
  );
}

function MarkdownLite({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="flex flex-col gap-1 text-sm text-zinc-300">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="mt-2 font-semibold text-zinc-100">
              {renderInline(line.slice(3), i)}
            </p>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <p key={i} className="mt-2 text-base font-bold text-zinc-100">
              {renderInline(line.slice(2), i)}
            </p>
          );
        }
        const checkboxMatch = line.match(/^- \[( |x)\] (.+)$/);
        if (checkboxMatch) {
          const done = checkboxMatch[1] === "x";
          return (
            <p key={i} className="flex items-start gap-1.5 pl-1">
              <span>{done ? "☑" : "☐"}</span>
              <span className={done ? "text-zinc-500 line-through" : ""}>
                {renderInline(checkboxMatch[2], i)}
              </span>
            </p>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <p key={i} className="flex items-start gap-1.5 pl-1">
              <span>•</span>
              <span>{renderInline(line.slice(2), i)}</span>
            </p>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line, i)}</p>;
      })}
    </div>
  );
}

export function TodayWidget() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/today")
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
        <span className={iconBadge("cyan")}>🏠</span>
        <h2 className={HEADING}>Heute</h2>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-500">Lädt…</p>}
      {data && !data.exists && (
        <p className="text-sm text-zinc-500">
          Noch keine Daily Note für heute ({data.path.split("/").pop()}).
        </p>
      )}
      {data?.exists && data.content && (
        <div className="max-h-96 overflow-y-auto">
          <MarkdownLite content={data.content} />
        </div>
      )}
    </div>
  );
}
