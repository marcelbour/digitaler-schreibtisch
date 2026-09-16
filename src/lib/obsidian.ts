import { Agent, fetch as undiciFetch } from "undici";

// Das Local REST API Plugin von Obsidian nutzt ein selbstsigniertes
// HTTPS-Zertifikat. Da wir hier ausschließlich lokal auf 127.0.0.1
// zugreifen (nie über das offene Internet), ist das Überspringen der
// Zertifikatsprüfung für genau diese eine Verbindung unproblematisch.
const insecureAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

export class ObsidianConfigError extends Error {}
export class ObsidianConnectionError extends Error {}

function getConfig() {
  const apiUrl = process.env.OBSIDIAN_API_URL;
  const apiKey = process.env.OBSIDIAN_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new ObsidianConfigError(
      "OBSIDIAN_API_URL / OBSIDIAN_API_KEY fehlen in .env.local",
    );
  }
  return { apiUrl, apiKey };
}

function buildUrl(apiUrl: string, path: string) {
  return `${apiUrl}/vault/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

/** Ordnerinhalt (Liste von Dateien/Unterordnern) abrufen. Ordner enden mit "/". */
export async function listFolder(path: string): Promise<string[]> {
  const { apiUrl, apiKey } = getConfig();
  const normalizedPath = path && !path.endsWith("/") ? `${path}/` : path;
  try {
    const res = await undiciFetch(buildUrl(apiUrl, normalizedPath), {
      headers: { Authorization: `Bearer ${apiKey}` },
      dispatcher: insecureAgent,
    });
    if (!res.ok) {
      throw new ObsidianConnectionError(`Obsidian API antwortete mit ${res.status}`);
    }
    const data = (await res.json()) as { files: string[] };
    return data.files;
  } catch (err) {
    if (err instanceof ObsidianConnectionError) throw err;
    throw new ObsidianConnectionError(
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Rohen Markdown-Inhalt einer Datei abrufen. Gibt null zurück, wenn die Datei nicht existiert. */
export async function readNote(path: string): Promise<string | null> {
  const { apiUrl, apiKey } = getConfig();
  try {
    const res = await undiciFetch(buildUrl(apiUrl, path), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "text/markdown",
      },
      dispatcher: insecureAgent,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new ObsidianConnectionError(`Obsidian API antwortete mit ${res.status}`);
    }
    return await res.text();
  } catch (err) {
    if (err instanceof ObsidianConnectionError) throw err;
    throw new ObsidianConnectionError(
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Text an das Ende einer Datei anhängen (erstellt die Datei, falls sie nicht existiert). */
export async function appendToNote(path: string, content: string): Promise<void> {
  const { apiUrl, apiKey } = getConfig();
  try {
    const res = await undiciFetch(buildUrl(apiUrl, path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "text/markdown",
      },
      body: content,
      dispatcher: insecureAgent,
    });
    if (!res.ok) {
      throw new ObsidianConnectionError(`Obsidian API antwortete mit ${res.status}`);
    }
  } catch (err) {
    if (err instanceof ObsidianConnectionError) throw err;
    throw new ObsidianConnectionError(
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** Entfernt YAML-Frontmatter (--- ... ---) vom Anfang eines Notiz-Texts. */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

export function errorToResponseInit(err: unknown): { body: { error: string; details?: string }; status: number } {
  if (err instanceof ObsidianConfigError) {
    return { body: { error: err.message }, status: 500 };
  }
  if (err instanceof ObsidianConnectionError) {
    return {
      body: {
        error:
          "Konnte Obsidian nicht erreichen. Läuft Obsidian mit aktiviertem Local REST API Plugin auf diesem PC?",
        details: err.message,
      },
      status: 502,
    };
  }
  return {
    body: { error: err instanceof Error ? err.message : String(err) },
    status: 500,
  };
}
