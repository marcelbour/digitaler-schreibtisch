import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";
import { snapshotResponse } from "@/lib/snapshot";
import { parseHabitStand, HabitDataError } from "@/lib/habits";

const PATH = "03 Bereiche/Routinen & Gewohnheiten/Habit-Log.md";

export async function GET() {
  try {
    const content = await readNote(PATH);
    // Sichtbar scheitern statt leer rendern – ein leerer Habit-Tracker
    // sähe aus wie „nichts getan", nicht wie „kaputt". Lehre vom 13.10.
    if (content === null) {
      return NextResponse.json(
        { error: `Habit-Log nicht gefunden: ${PATH}` },
        { status: 404 },
      );
    }
    return NextResponse.json(parseHabitStand(content));
  } catch (err) {
    if (err instanceof HabitDataError) {
      return NextResponse.json(
        { error: "Habit-Log lässt sich nicht lesen", details: err.message },
        { status: 422 },
      );
    }
    // Obsidian nicht erreichbar (z. B. auf Vercel oder wenn der Dev-Server
    // nicht laeuft): lieber den letzten bekannten Stand zeigen als nichts.
    // Die Antwort traegt X-Snapshot-Stale, das Offline-Band macht es sichtbar.
    const stale = snapshotResponse("habits");
    if (stale) return stale;
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
