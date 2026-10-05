"use client";

import { useState } from "react";
import { CARD, HEADING, iconBadge } from "@/lib/ui";

export function QuickCapture() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unbekannter Fehler");
      setText("");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className={iconBadge("pink")}>✍️</span>
        <h2 className={HEADING}>Schneller Gedanke</h2>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Idee, To-Do, Gedanke… landet in 01 Inbox/Brain Dump.md"
        rows={3}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-400/50"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {status === "saved" && <span className="text-emerald-400">✓ gespeichert</span>}
          {status === "error" && <span className="text-rose-400">{error}</span>}
          {status === "idle" && "Strg/Cmd+Enter zum Speichern"}
        </span>
        <button
          onClick={submit}
          disabled={status === "saving" || !text.trim()}
          className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-900 transition-opacity disabled:opacity-40"
        >
          {status === "saving" ? "Speichert…" : "In Inbox speichern"}
        </button>
      </div>
    </div>
  );
}
