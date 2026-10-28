import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";
import { snapshotResponse } from "@/lib/snapshot";
import { parseReminders } from "@/lib/reminders";

const PATH = "00 Kontext/Erinnerungen.md";

export async function GET() {
  try {
    const content = await readNote(PATH);
    if (content === null) {
      return NextResponse.json({ heute: [], woche: [] });
    }
    return NextResponse.json(parseReminders(content));
  } catch (err) {
    // Obsidian nicht erreichbar (z. B. auf Vercel oder wenn der Dev-Server
    // nicht laeuft): lieber den letzten bekannten Stand zeigen als nichts.
    // Die Antwort traegt X-Snapshot-Stale, das Offline-Band macht es sichtbar.
    const stale = snapshotResponse("reminders");
    if (stale) return stale;
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
