import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";
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
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
