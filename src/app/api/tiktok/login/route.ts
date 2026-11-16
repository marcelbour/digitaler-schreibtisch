import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { TIKTOK_SCOPES, tiktokConfig } from "@/lib/tiktok";

// Startet die einmalige TikTok-Anmeldung. Nur lokal sinnvoll (http://localhost:3000),
// weil die Tokens in einer Datei auf diesem PC landen.
export async function GET() {
  const cfg = tiktokConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI fehlen in .env.local" },
      { status: 500 },
    );
  }
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", cfg.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_SCOPES);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set("tiktok_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/api/tiktok",
    maxAge: 600,
  });
  return res;
}
