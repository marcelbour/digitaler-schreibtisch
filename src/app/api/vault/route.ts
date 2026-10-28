import { NextRequest, NextResponse } from "next/server";
import { listFolder, errorToResponseInit } from "@/lib/obsidian";
import { snapshotResponse } from "@/lib/snapshot";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  try {
    const files = await listFolder(path);
    return NextResponse.json({ files });
  } catch (err) {
    // Obsidian nicht erreichbar (z. B. auf Vercel oder wenn der Dev-Server
    // nicht laeuft): lieber den letzten bekannten Stand zeigen als nichts.
    // Die Antwort traegt X-Snapshot-Stale, das Offline-Band macht es sichtbar.
    const stale = snapshotResponse("vault");
    if (stale) return stale;
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
