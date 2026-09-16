import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";

const PATH = "00 Kontext/Erinnerungen.md";

type Reminder = { text: string };

function parseReminders(content: string): { heute: Reminder[]; woche: Reminder[] } {
  const heute: Reminder[] = [];
  const woche: Reminder[] = [];

  // Nur der Abschnitt zwischen "## Aktiv" und der nächsten "## "-Überschrift zählt.
  const activeMatch = content.match(/## Aktiv\n([\s\S]*?)(?=\n## |$)/);
  if (!activeMatch) return { heute, woche };

  const lines = activeMatch[1].split("\n").filter((l) => l.trim().startsWith("- "));
  for (const line of lines) {
    const match = line.match(/^- `\[(HEUTE|WOCHE)\]`\s*(.+)$/);
    if (!match) continue;
    // Markdown-Fettschrift (**...**) für die Anzeige entfernen.
    const text = match[2].replace(/\*\*/g, "").trim();
    const target = match[1] === "HEUTE" ? heute : woche;
    target.push({ text });
  }

  return { heute, woche };
}

export async function GET() {
  try {
    const content = await readNote(PATH);
    if (content === null) {
      return NextResponse.json({ heute: [], woche: [] });
    }
    return NextResponse.json(parseReminders(content));
  } catch (err) {
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
