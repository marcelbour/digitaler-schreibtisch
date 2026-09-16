import { NextResponse } from "next/server";
import { listFolder, readNote, errorToResponseInit } from "@/lib/obsidian";

const FOLDER = "02 Projekte";

type ProjectSummary = {
  name: string;
  path: string;
  status: string | null;
  nextStep: string | null;
};

function extractFrontmatterField(content: string, field: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const line = match[1]
    .split("\n")
    .find((l) => l.trim().startsWith(`${field}:`));
  if (!line) return null;
  return line.split(":").slice(1).join(":").trim();
}

function extractNextStep(content: string): string | null {
  // Erste offene Checkbox ("- [ ] ...") im gesamten Dokument.
  const match = content.match(/^- \[ \] (.+)$/m);
  return match ? match[1].trim() : null;
}

export async function GET() {
  try {
    const files = await listFolder(FOLDER);
    const mdFiles = files.filter((f) => !f.endsWith("/") && f.endsWith(".md"));

    const projects: ProjectSummary[] = await Promise.all(
      mdFiles.map(async (file) => {
        const path = `${FOLDER}/${file}`;
        const content = await readNote(path);
        const name = file.replace(/\.md$/, "");
        if (content === null) {
          return { name, path, status: null, nextStep: null };
        }
        return {
          name,
          path,
          status: extractFrontmatterField(content, "status"),
          nextStep: extractNextStep(content),
        };
      }),
    );

    projects.sort((a, b) => a.name.localeCompare(b.name, "de"));
    return NextResponse.json({ projects });
  } catch (err) {
    const { body, status } = errorToResponseInit(err);
    return NextResponse.json(body, { status });
  }
}
