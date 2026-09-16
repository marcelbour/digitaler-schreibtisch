"use client";

import { useState } from "react";

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
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Schneller Gedanke
      </h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Idee, To-Do, Gedanke… landet in 01 Inbox/Brain Dump.md"
        rows={3}
        className="w-full resize-none rounded border border-zinc-200 bg-zinc-50 p-2 text-sm text-zinc-800 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          {status === "saved" && "✓ gespeichert"}
          {status === "error" && <span className="text-red-500">{error}</span>}
          {status === "idle" && "Strg/Cmd+Enter zum Speichern"}
        </span>
        <button
          onClick={submit}
          disabled={status === "saving" || !text.trim()}
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {status === "saving" ? "Speichert…" : "In Inbox speichern"}
        </button>
      </div>
    </div>
  );
}
