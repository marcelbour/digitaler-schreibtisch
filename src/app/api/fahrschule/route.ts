import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";
import { parseFahrschuleBudget, FahrschuleDataError } from "@/lib/fahrschule";

const PATH = "02 Projekte/Führerschein - Budget (Daten).md";

export async function GET() {
  try {
    const content = await readNote(PATH);
    // Bewusst KEIN leeres Ergebnis zurückgeben: Ein Budget-Widget, das 0,00 €
    // anzeigt, sieht aus wie "alles bezahlt". Lieber sichtbar scheitern.
    if (content === null) {
      return NextResponse.json(
        { error: `Datendatei nicht gefunden: ${PATH}` },
        { status: 404 },
      );
    }
    return NextResponse.json(parseFahrschuleBudget(content));
  } catch (err) {
    if (err instanceof FahrschuleDataError) {
      return NextResponse.json(
        { error: "Budget-Daten sind unvollständig", details: err.message },
        { status: 422 },
      );
    }
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
