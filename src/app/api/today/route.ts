import { NextResponse } from "next/server";
import { readNote, stripFrontmatter, errorToResponseInit } from "@/lib/obsidian";

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
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
