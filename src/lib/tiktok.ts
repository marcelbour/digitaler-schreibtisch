import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * TikTok-Widget (16.11.2026, von Marcel bestellt): „Es soll wirklich die
 * Hauptdaten vom TikTok-Account zeigen … und sich richtig oft updaten."
 *
 * DATENQUELLE: die offizielle TikTok Display API (Login Kit), nicht Metricool.
 * Metricools eigene API gibt es nur im kostenpflichtigen Advanced-Tarif, und
 * der Metricool-Zugang über Claude (MCP) ist für das Dashboard nicht nutzbar.
 *
 * Doku (abgerufen 16.11.2026):
 * - Nutzerdaten:  https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info
 *   (follower_count, likes_count, video_count brauchen den Scope user.info.stats)
 * - Videoliste:   https://developers.tiktok.com/doc/tiktok-api-v2-video-list (Scope video.list)
 * - Videofelder:  https://developers.tiktok.com/doc/tiktok-api-v2-video-object
 * - Token:        https://developers.tiktok.com/doc/oauth-get-a-user-access-token
 * - Laufzeiten:   https://developers.tiktok.com/doc/oauth-user-access-token-management
 *   Access-Token 2 h, Refresh-Token 180 Tage. JEDE Erneuerung liefert einen
 *   NEUEN Refresh-Token und entwertet den alten. Deshalb liegt er in einer
 *   Datei, die bei jeder Erneuerung überschrieben wird – nicht in .env.local.
 *
 * Grenze: Reichweite, Wiedergabezeit und „Für dich"-Anteil liefert diese API
 * NICHT. Die gibt es nur in TikTok Studio bzw. Metricool.
 */

export const TIKTOK_SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_URL = "https://open.tiktokapis.com/v2/user/info/";
const VIDEO_URL = "https://open.tiktokapis.com/v2/video/list/";

/** Liegt neben package.json und ist per .gitignore ausgeschlossen. */
const TOKEN_FILE = path.join(process.cwd(), ".tiktok-tokens.json");

type TokenStore = {
  access_token: string;
  refresh_token: string;
  /** Unix-Millisekunden */
  access_expires_at: number;
  refresh_expires_at: number;
  open_id: string;
  scope: string;
};

export class TikTokNotConnected extends Error {}

export function tiktokConfig() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirectUri) return null;
  return { clientKey, clientSecret, redirectUri };
}

async function readStore(): Promise<TokenStore | null> {
  try {
    return JSON.parse(await readFile(TOKEN_FILE, "utf8")) as TokenStore;
  } catch {
    return null;
  }
}

async function writeStore(store: TokenStore) {
  await writeFile(TOKEN_FILE, JSON.stringify(store, null, 2), "utf8");
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenStore> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error || !json.access_token || !json.refresh_token) {
    throw new Error(
      `TikTok-Token fehlgeschlagen: ${json.error ?? res.status} ${json.error_description ?? ""}`.trim(),
    );
  }
  const now = Date.now();
  const store: TokenStore = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    access_expires_at: now + (json.expires_in ?? 0) * 1000,
    refresh_expires_at: now + (json.refresh_expires_in ?? 0) * 1000,
    open_id: json.open_id ?? "",
    scope: json.scope ?? "",
  };
  await writeStore(store);
  return store;
}

/** Einmalig nach dem Login: Code gegen Tokens tauschen und speichern. */
export async function exchangeCode(code: string) {
  const cfg = tiktokConfig();
  if (!cfg) throw new TikTokNotConnected("TIKTOK_* fehlt in .env.local");
  return tokenRequest({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: cfg.redirectUri,
  });
}

// Mehrere gleichzeitige Anfragen dürfen nicht doppelt erneuern – die zweite
// Erneuerung würde mit dem bereits entwerteten Refresh-Token scheitern.
let refreshing: Promise<TokenStore> | null = null;

async function getAccessToken(): Promise<string> {
  const cfg = tiktokConfig();
  if (!cfg) throw new TikTokNotConnected("TIKTOK_* fehlt in .env.local");
  const store = await readStore();
  if (!store) throw new TikTokNotConnected("Noch nicht mit TikTok verbunden");

  // 5 Minuten Puffer vor Ablauf.
  if (store.access_expires_at - Date.now() > 5 * 60_000) return store.access_token;

  if (store.refresh_expires_at && store.refresh_expires_at < Date.now()) {
    throw new TikTokNotConnected("Anmeldung abgelaufen (180 Tage) – neu verbinden");
  }
  refreshing ??= tokenRequest({
    client_key: cfg.clientKey,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
    refresh_token: store.refresh_token,
  }).finally(() => {
    refreshing = null;
  });
  return (await refreshing).access_token;
}

type ApiEnvelope<T> = { data?: T; error?: { code?: string; message?: string } };

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  // TikTok liefert auch bei Erfolg ein error-Objekt mit code "ok".
  if (!res.ok || (json.error?.code && json.error.code !== "ok")) {
    throw new Error(`TikTok-API: ${json.error?.code ?? res.status} ${json.error?.message ?? ""}`.trim());
  }
  if (!json.data) throw new Error("TikTok-API: leere Antwort");
  return json.data;
}

export type TikTokVideo = {
  id: string;
  createTime: number;
  title: string;
  shareUrl: string;
  cover: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type TikTokStats = {
  fetchedAt: string;
  user: {
    displayName: string;
    username: string;
    avatar: string;
    profileUrl: string;
    followers: number;
    following: number;
    likes: number;
    videoCount: number;
  };
  totals: { views: number; likes: number; comments: number; shares: number };
  videos: TikTokVideo[];
};

type RawUser = {
  user?: {
    display_name?: string;
    username?: string;
    avatar_url_100?: string;
    profile_deep_link?: string;
    follower_count?: number;
    following_count?: number;
    likes_count?: number;
    video_count?: number;
  };
};

type RawVideos = {
  videos?: Array<{
    id: string;
    create_time?: number;
    title?: string;
    video_description?: string;
    share_url?: string;
    cover_image_url?: string;
    duration?: number;
    view_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
  }>;
  cursor?: number;
  has_more?: boolean;
};

// Kurzer Zwischenspeicher: Mehrere Tabs/Widgets sollen nicht jede Sekunde
// TikTok anfragen. 60 Sekunden sind „richtig oft" genug.
let cache: { at: number; data: TikTokStats } | null = null;
const CACHE_MS = 60_000;

export async function getTikTokStats(): Promise<TikTokStats> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const userFields =
    "display_name,username,avatar_url_100,profile_deep_link,follower_count,following_count,likes_count,video_count";
  const videoFields =
    "id,create_time,title,video_description,share_url,cover_image_url,duration,view_count,like_count,comment_count,share_count";

  const userData = await api<RawUser>(`${USER_URL}?fields=${userFields}`);

  // Alle Videos einsammeln (max. 20 pro Seite laut Beispiel der Doku),
  // mit Obergrenze, damit ein Fehler nicht endlos blättert.
  const raw: NonNullable<RawVideos["videos"]> = [];
  let cursor: number | undefined;
  for (let page = 0; page < 10; page++) {
    const body: Record<string, number> = { max_count: 20 };
    if (cursor !== undefined) body.cursor = cursor;
    const v = await api<RawVideos>(`${VIDEO_URL}?fields=${videoFields}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    raw.push(...(v.videos ?? []));
    if (!v.has_more || v.cursor === undefined) break;
    cursor = v.cursor;
  }

  const videos: TikTokVideo[] = raw
    .map((v) => ({
      id: v.id,
      createTime: v.create_time ?? 0,
      title: (v.title || v.video_description || "").trim(),
      shareUrl: v.share_url ?? "",
      cover: v.cover_image_url ?? "",
      duration: v.duration ?? 0,
      views: v.view_count ?? 0,
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
    }))
    .sort((a, b) => b.createTime - a.createTime);

  const u = userData.user ?? {};
  const data: TikTokStats = {
    fetchedAt: new Date().toISOString(),
    user: {
      displayName: u.display_name ?? "",
      username: u.username ?? "",
      avatar: u.avatar_url_100 ?? "",
      profileUrl: u.profile_deep_link ?? (u.username ? `https://www.tiktok.com/@${u.username}` : ""),
      followers: u.follower_count ?? 0,
      following: u.following_count ?? 0,
      likes: u.likes_count ?? 0,
      videoCount: u.video_count ?? videos.length,
    },
    totals: videos.reduce(
      (t, v) => ({
        views: t.views + v.views,
        likes: t.likes + v.likes,
        comments: t.comments + v.comments,
        shares: t.shares + v.shares,
      }),
      { views: 0, likes: 0, comments: 0, shares: 0 },
    ),
    videos,
  };
  cache = { at: Date.now(), data };
  return data;
}
