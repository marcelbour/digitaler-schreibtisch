import { NextRequest, NextResponse } from "next/server";
import { appendToNote, errorToResponseInit } from "@/lib/obsidian";

const INBOX_PATH = "01 Inbox/Brain Dump.md";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "Text darf nicht leer sein" }, { status: 400 });
  }

  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;

  const entry = `\n- [${date}] ${text} (via Dashboard)`;

  try {
    await appendToNote(INBOX_PATH, entry);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body: errBody, status } = errorToResponseInit(err);
    return NextResponse.json(errBody, { status });
  }
}
