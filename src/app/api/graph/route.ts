import { NextResponse } from "next/server";
import { listFolder, readNote, errorToResponseInit } from "@/lib/obsidian";

// Ordner, die für die Graph-Ansicht keinen Mehrwert bieten (Anhänge sind keine
// Notizen, .obsidian ist Konfiguration) bzw. zu groß/irrelevant für Links sind.
const EXCLUDED_TOP_LEVEL = new Set(["07 Anhänge", ".obsidian"]);

async function collectMarkdownPaths(folder: string, isRoot = false): Promise<string[]> {
  const entries = await listFolder(folder);
  const paths: string[] = [];

  for (const entry of entries) {
    const isFolder = entry.endsWith("/");
    const name = isFolder ? entry.slice(0, -1) : entry;
    if (isRoot && EXCLUDED_TOP_LEVEL.has(name)) continue;
    if (name.startsWith(".")) continue;

    const path = folder ? `${folder}/${name}` : name;
    if (isFolder) {
      const nested = await collectMarkdownPaths(path);
      paths.push(...nested);
    } else if (name.endsWith(".md")) {
      paths.push(path);
    }
  }

  return paths;
}

const WIKILINK_RE = /\[\[([^\]|#]+)/g;

export async function GET() {
  try {
    const paths = await collectMarkdownPaths("", true);

    // id = Pfad ohne ".md"-Endung, z.B. "02 Projekte/Abitur"
    const ids = paths.map((p) => p.slice(0, -3));
    const basenameMap = new Map<string, string[]>();
    for (const id of ids) {
      const basename = id.split("/").pop()!.toLowerCase();
      const list = basenameMap.get(basename) ?? [];
      list.push(id);
      basenameMap.set(basename, list);
    }

    function resolveLink(rawTarget: string): string | null {
      const target = rawTarget.trim().replace(/\.md$/i, "");
      if (!target) return null;
      const asId = ids.find((id) => id.toLowerCase() === target.toLowerCase());
      if (asId) return asId;
      const basename = target.split("/").pop()!.toLowerCase();
      const candidates = basenameMap.get(basename);
      if (candidates && candidates.length > 0) return candidates[0];
      return null;
    }

    const nodes = ids.map((id) => ({
      id,
      label: id.split("/").pop()!,
      folder: id.includes("/") ? id.split("/")[0] : "(root)",
    }));

    const edgeSet = new Set<string>();
    const edges: { source: string; target: string }[] = [];

    await Promise.all(
      paths.map(async (path) => {
        const content = await readNote(path);
        if (!content) return;
        const sourceId = path.slice(0, -3);
        for (const match of content.matchAll(WIKILINK_RE)) {
          const targetId = resolveLink(match[1]);
          if (!targetId || targetId === sourceId) continue;
          const key = [sourceId, targetId].sort().join("::");
          if (edgeSet.has(key)) continue;
          edgeSet.add(key);
          edges.push({ source: sourceId, target: targetId });
        }
      }),
    );

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
