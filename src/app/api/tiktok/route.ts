import { NextResponse } from "next/server";
import { snapshotResponse } from "@/lib/snapshot";
import { getTikTokStats, TikTokNotConnected, tiktokConfig } from "@/lib/tiktok";

// Live-Zahlen des TikTok-Accounts. Siehe src/lib/tiktok.ts.
export async function GET() {
  try {
    return NextResponse.json(await getTikTokStats(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    // Auf Vercel gibt es keine Token-Datei – dort zählt nur der Schnappschuss.
    if (err instanceof TikTokNotConnected && !process.env.VERCEL) {
      return NextResponse.json(
        { notConnected: true, configured: tiktokConfig() !== null, message: err.message },
        { status: 503 },
      );
    }
    const stale = snapshotResponse("tiktok");
    if (stale) return stale;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
