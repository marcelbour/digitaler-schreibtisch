// Mini-Renderer für das Inline-Markdown, das in den Erinnerungen tatsächlich vorkommt.
// Absichtlich keine Markdown-Bibliothek: gebraucht werden genau vier Dinge, und eine
// Volllösung würde Blockelemente mitbringen, die in einer Widget-Zeile nur störn.
//
//   **fett**        → hervorgehoben (Daten, Fristen, Warnungen)
//   *kursiv*        → Marcels wörtliche Zitate
//   `code`          → Tags wie [HEUTE], Dateinamen
//   [[pfad|label]]  → nur der Label bzw. der Dateiname, ohne Ordnerpfad und .md
//
// Vorher wurden die Sternchen einfach weggeworfen (`.replace(/\*\*/g, "")`), damit war
// in einem 1.500 Zeichen langen Detailtext nichts mehr betont.

import type { ReactNode } from "react";

/** [[04 Ressourcen/Schule/Deutsch/Referat.md|Referat]] → "Referat" */
function wikilinkLabel(target: string): string {
  const [path, label] = target.split("|");
  if (label) return label.trim();
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.md$/, "").trim();
}

// Ein Pass über alle vier Muster. Die Reihenfolge der Alternativen zählt:
// ** vor *, sonst schluckt die Kursiv-Regel die Fett-Marker.
const TOKEN = /\[\[([^\]]+)\]\]|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

export function InlineMarkdown({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));

    const [, wikilink, bold, italic, code] = match;
    if (wikilink !== undefined) {
      nodes.push(
        <span key={key++} className="text-violet-300">
          {wikilinkLabel(wikilink)}
        </span>,
      );
    } else if (bold !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-zinc-100">
          {bold}
        </strong>,
      );
    } else if (italic !== undefined) {
      nodes.push(
        <em key={key++} className="text-zinc-400">
          {italic}
        </em>,
      );
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.95em] text-zinc-200"
        >
          {code}
        </code>,
      );
    }

    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return <>{nodes}</>;
}
