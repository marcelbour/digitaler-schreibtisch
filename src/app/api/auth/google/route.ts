import { NextResponse } from "next/server";
import { getAuthUrl, GoogleConfigError } from "@/lib/google";

// Einmaliger Autorisierungs-Schritt: im Browser öffnen (http://localhost:3000/api/auth/google),
// mit Google-Account einloggen (der als Testnutzer im OAuth-Zustimmungsbildschirm hinterlegt ist),
// wird danach zu /api/auth/callback/google weitergeleitet, wo der refresh_token angezeigt wird.
export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof GoogleConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
