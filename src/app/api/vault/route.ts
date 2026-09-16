import { NextRequest, NextResponse } from "next/server";
import { listFolder, errorToResponseInit } from "@/lib/obsidian";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path") ?? "";
  try {
    const files = await listFolder(path);
    return NextResponse.json({ files });
  } catch (err) {
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
