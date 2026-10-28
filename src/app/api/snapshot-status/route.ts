import { NextResponse } from "next/server";
import { readNote } from "@/lib/obsidian";
import { getSnapshotGeneratedAt } from "@/lib/snapshot";

/**
 * Sagt der Oberfläche, ob gerade Live-Daten aus Obsidian kommen oder der
 * Offline-Schnappschuss. Ein einziger Endpunkt für alle Widgets – so braucht
 * nicht jedes Widget seine eigene Veraltet-Anzeige, es gibt ein Band für die
 * ganze Seite.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshotAt = getSnapshotGeneratedAt();

  try {
    // Billigster möglicher Lebenstest: irgendeine Datei anfragen. Ob sie
    // existiert, ist egal – es geht nur darum, ob Obsidian antwortet.
    await readNote("00 Kontext/Erinnerungen.md");
    return NextResponse.json({ live: true, snapshotAt });
  } catch {
    return NextResponse.json({ live: false, snapshotAt });
  }
}
