"use client";

import { useEffect, useMemo, useState } from "react";

type GraphNode = { id: string; label: string; folder: string };
type GraphEdge = { source: string; target: string };
type GraphResponse = { nodes: GraphNode[]; edges: GraphEdge[] };

type Positioned = GraphNode & { x: number; y: number };

const WIDTH = 480;
const HEIGHT = 420;

const PALETTE = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
];

function colorForFolder(folder: string): string {
  let hash = 0;
  for (let i = 0; i < folder.length; i++) hash = (hash * 31 + folder.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** Einfaches Fruchterman-Reingold-artiges Kräfte-Layout, einmalig berechnet (kein Live-Physik-Loop). */
function computeLayout(nodes: GraphNode[], edges: GraphEdge[]): Positioned[] {
  const n = nodes.length;
  if (n === 0) return [];

  const area = WIDTH * HEIGHT;
  const k = Math.sqrt(area / n) * 0.9;

  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, i) => {
    const angle = (i / n) * Math.PI * 2;
    const r = Math.min(WIDTH, HEIGHT) * 0.35;
    positions.set(node.id, {
      x: WIDTH / 2 + Math.cos(angle) * r,
      y: HEIGHT / 2 + Math.sin(angle) * r,
    });
  });

  const iterations = 250;
  for (let iter = 0; iter < iterations; iter++) {
    const temperature = (1 - iter / iterations) * (WIDTH / 20);
    const disp = new Map<string, { x: number; y: number }>();
    nodes.forEach((node) => disp.set(node.id, { x: 0, y: 0 }));

    // Abstoßung zwischen allen Knotenpaaren
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const pa = positions.get(a.id)!;
        const pb = positions.get(b.id)!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const da = disp.get(a.id)!;
        const db = disp.get(b.id)!;
        da.x += dx;
        da.y += dy;
        db.x -= dx;
        db.y -= dy;
      }
    }

    // Anziehung entlang der Kanten
    for (const edge of edges) {
      const pa = positions.get(edge.source);
      const pb = positions.get(edge.target);
      if (!pa || !pb) continue;
      let dx = pa.x - pb.x;
      let dy = pa.y - pb.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      const da = disp.get(edge.source)!;
      const db = disp.get(edge.target)!;
      da.x -= dx;
      da.y -= dy;
      db.x += dx;
      db.y += dy;
    }

    // Verschiebung anwenden, begrenzt durch "Temperatur"
    for (const node of nodes) {
      const d = disp.get(node.id)!;
      const dist = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const limited = Math.min(dist, temperature);
      const p = positions.get(node.id)!;
      p.x += (d.x / dist) * limited;
      p.y += (d.y / dist) * limited;
      p.x = Math.min(WIDTH - 10, Math.max(10, p.x));
      p.y = Math.min(HEIGHT - 10, Math.max(10, p.y));
    }
  }

  return nodes.map((node) => ({ ...node, ...positions.get(node.id)! }));
}

export function GraphView() {
  const [data, setData] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/graph")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Unbekannter Fehler");
        setData(json);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const positioned = useMemo(
    () => (data ? computeLayout(data.nodes, data.edges) : []),
    [data],
  );
  const posById = useMemo(() => {
    const map = new Map<string, Positioned>();
    positioned.forEach((p) => map.set(p.id, p));
    return map;
  }, [positioned]);

  return (
    <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Graph-Ansicht ({data?.nodes.length ?? 0} Notizen)
      </h2>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!data && !error && <p className="text-sm text-zinc-400">Lädt… (kann bei vielen Notizen ein paar Sekunden dauern)</p>}
      {data && (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full rounded bg-zinc-50 dark:bg-zinc-950"
        >
          {data.edges.map((edge, i) => {
            const a = posById.get(edge.source);
            const b = posById.get(edge.target);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                className="text-zinc-300 dark:text-zinc-700"
                strokeWidth={1}
              />
            );
          })}
          {positioned.map((node) => (
            <g
              key={node.id}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered((h) => (h === node.id ? null : h))}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={hovered === node.id ? 6 : 4}
                fill={colorForFolder(node.folder)}
              >
                <title>{node.id}</title>
              </circle>
              {hovered === node.id && (
                <text
                  x={node.x + 8}
                  y={node.y + 4}
                  fontSize={10}
                  className="fill-zinc-800 dark:fill-zinc-200"
                >
                  {node.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
