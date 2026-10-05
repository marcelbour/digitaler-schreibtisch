import { NextResponse } from "next/server";
import { getWeekEvents, GoogleConfigError } from "@/lib/google";

export async function GET() {
  try {
    const events = await getWeekEvents();
    return NextResponse.json({ events });
  } catch (err) {
    if (err instanceof GoogleConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
