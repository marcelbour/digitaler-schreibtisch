import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";
import { snapshotResponse } from "@/lib/snapshot";
import { parseAusgaben, AusgabenDataError } from "@/lib/ausgaben";

const PATH = "03 Bereiche/Finanzen/Ausgaben KI & Tools (Daten).md";

export async function GET() {
  try {
    const content = await readNote(PATH);
    // Kein leeres Ergebnis: 0,00 € sähe aus wie "keine Ausgaben".
    if (content === null) {
      return NextResponse.json(
        { error: `Datendatei nicht gefunden: ${PATH}` },
        { status: 404 },
      );
    }
    return NextResponse.json(parseAusgaben(content));
  } catch (err) {
    if (err instanceof AusgabenDataError) {
      return NextResponse.json(
        { error: "Ausgaben-Daten sind unvollständig", details: err.message },
        { status: 422 },
      );
    }
    const stale = snapshotResponse("ausgaben");
    if (stale) return stale;
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
