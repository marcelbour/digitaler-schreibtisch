import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/tiktok";

/**
 * TikTok erlaubt nur https-Weiterleitungen (Login Kit for Web, Abschnitt
 * „Configure redirect URI"). Deshalb ist bei TikTok die Vercel-Adresse
 * eingetragen. Die Vercel-Instanz reicht den Code nur an den lokalen
 * Dev-Server weiter – erst DER tauscht ihn (mit dem Secret) gegen Tokens und
 * speichert sie auf diesem PC. Auf Vercel selbst wird nichts gespeichert.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  if (process.env.VERCEL) {
    const target = new URL("http://localhost:3000/api/tiktok/callback");
    params.forEach((v, k) => target.searchParams.set(k, v));
    return NextResponse.redirect(target);
  }

  const html = (msg: string, status = 200) =>
    new NextResponse(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;background:#0b0c14;color:#e4e4e7;padding:40px">${msg}<p><a style="color:#22d3ee" href="/#tiktok">Zurück zum Dashboard</a></p></body>`,
      { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );

  const error = params.get("error");
  if (error) return html(`<p>TikTok hat abgelehnt: ${error} ${params.get("error_description") ?? ""}</p>`, 400);

  const code = params.get("code");
  const state = params.get("state");
  const expected = request.cookies.get("tiktok_state")?.value;
  if (!code) return html("<p>Kein Code von TikTok erhalten.</p>", 400);
  if (!state || !expected || state !== expected) {
    return html("<p>Sicherheitsprüfung (state) fehlgeschlagen – bitte über den Button im Dashboard neu verbinden.</p>", 400);
  }

  try {
    await exchangeCode(code);
    const res = NextResponse.redirect(new URL("/#tiktok", request.url));
    res.cookies.delete({ name: "tiktok_state", path: "/api/tiktok" });
    return res;
  } catch (err) {
    return html(`<p>${err instanceof Error ? err.message : String(err)}</p>`, 500);
  }
}
