import { google } from "googleapis";

export class GoogleConfigError extends Error {}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleConfigError(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI fehlen in .env.local",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** OAuth2-Client für den einmaligen Autorisierungs-Flow (Login-Redirect + Callback). */
export function createOAuthClient() {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Autorisierungs-URL, die den Nutzer zum Google-Login schickt. */
export function getAuthUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // nötig, damit wir einen refresh_token bekommen
    prompt: "consent", // erzwingt erneute Zustimmung -> garantiert refresh_token auch bei wiederholtem Login
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });
}

/**
 * OAuth2-Client für laufende API-Aufrufe (Kalender-Widget), einmal autorisiert
 * über den GOOGLE_REFRESH_TOKEN aus .env.local. Kein Nutzer-Login pro Aufruf nötig,
 * da Marcel der einzige Nutzer dieses Dashboards ist.
 */
export function createAuthorizedClient() {
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new GoogleConfigError(
      "GOOGLE_REFRESH_TOKEN fehlt in .env.local – einmal /api/auth/google im Browser öffnen, um ihn zu holen.",
    );
  }
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
};

/**
 * Termine der kommenden 7 Tage, rollierend ab heute (nicht starr Mo-So) -
 * auf Marcels Wunsch (18.09.): "heute" soll immer ganz links stehen, damit
 * z.B. an einem Freitag auch wirklich die nächsten 7 Tage sichtbar sind,
 * statt nur bis Sonntag.
 */
export async function getWeekEvents(): Promise<CalendarEvent[]> {
  const auth = createAuthorizedClient();
  const calendar = google.calendar({ version: "v3", auth });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: today.toISOString(),
    timeMax: in7Days.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items ?? []).map((event) => ({
    id: event.id ?? crypto.randomUUID(),
    title: event.summary ?? "(ohne Titel)",
    start: event.start?.dateTime ?? event.start?.date ?? null,
    end: event.end?.dateTime ?? event.end?.date ?? null,
    allDay: !event.start?.dateTime,
  }));
}
