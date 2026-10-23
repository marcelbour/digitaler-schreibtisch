import { NextResponse } from "next/server";
import { readNote, errorToResponseInit } from "@/lib/obsidian";
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
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
