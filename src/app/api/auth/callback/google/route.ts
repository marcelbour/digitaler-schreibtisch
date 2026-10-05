import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient } from "@/lib/google";

// Empfängt den Google-Redirect nach dem Login, tauscht den Code gegen Tokens.
// Der refresh_token wird nur EINMALIG von Google ausgegeben (bei erneuter Autorisierung
// mit prompt=consent aber wieder) -> hier im Browser anzeigen, damit er von Hand in
// .env.local als GOOGLE_REFRESH_TOKEN eingetragen werden kann. Danach läuft das
// Kalender-Widget ohne weiteren Login.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ error: "Kein 'code' Parameter erhalten." }, { status: 400 });
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      return new NextResponse(
        `<p>Kein refresh_token erhalten (Google gibt ihn nur beim ersten Autorisieren einer App aus).</p>
         <p>Geh in die <a href="https://myaccount.google.com/permissions" target="_blank">Google-Kontoberechtigungen</a>,
         entferne den Zugriff für "Digitaler Schreibtisch" und öffne dann
         <a href="/api/auth/google">/api/auth/google</a> erneut.</p>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    return new NextResponse(
      `<p>Autorisierung erfolgreich. Diesen Wert einmalig kopieren und Claude im Chat schicken
       (wird dann sicher in .env.local als GOOGLE_REFRESH_TOKEN eingetragen):</p>
       <pre style="padding:12px;background:#f4f4f4;border-radius:6px;user-select:all;">${tokens.refresh_token}</pre>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
