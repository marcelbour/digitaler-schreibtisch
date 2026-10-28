import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";
import { snapshotResponse } from "@/lib/snapshot";
import { parseNotenStand, NotenDataError } from "@/lib/noten";

const PATH = "04 Ressourcen/Schule/Noten (Daten).md";

export async function GET() {
  try {
    const content = await readNote(PATH);
    // Sichtbar scheitern statt leer rendern – ein Noten-Widget ohne Noten
    // sähe aus, als gäbe es keine.
    if (content === null) {
      return NextResponse.json(
        { error: `Datendatei nicht gefunden: ${PATH}` },
        { status: 404 },
      );
    }
    return NextResponse.json(parseNotenStand(content));
  } catch (err) {
    if (err instanceof NotenDataError) {
      return NextResponse.json(
        { error: "Notendaten sind unvollständig", details: err.message },
        { status: 422 },
      );
    }
    // Obsidian nicht erreichbar (z. B. auf Vercel oder wenn der Dev-Server
    // nicht laeuft): lieber den letzten bekannten Stand zeigen als nichts.
    // Die Antwort traegt X-Snapshot-Stale, das Offline-Band macht es sichtbar.
    const stale = snapshotResponse("noten");
    if (stale) return stale;
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
