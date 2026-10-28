import { NextResponse } from "next/server";
import { readNote, stripFrontmatter, errorToResponseInit } from "@/lib/obsidian";
import { snapshotResponse } from "@/lib/snapshot";

function todayPath(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `05 Daily Notes/${yyyy}-${mm}-${dd}.md`;
}

export async function GET() {
  const path = todayPath();
  try {
    const raw = await readNote(path);
    if (raw === null) {
      return NextResponse.json({ path, exists: false, content: null });
    }
    return NextResponse.json({
      path,
      exists: true,
      content: stripFrontmatter(raw),
    });
  } catch (err) {
    // Obsidian nicht erreichbar (z. B. auf Vercel oder wenn der Dev-Server
    // nicht laeuft): lieber den letzten bekannten Stand zeigen als nichts.
    // Die Antwort traegt X-Snapshot-Stale, das Offline-Band macht es sichtbar.
    const stale = snapshotResponse("today");
    if (stale) return stale;
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
