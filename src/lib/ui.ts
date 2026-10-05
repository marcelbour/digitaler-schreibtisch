// Gemeinsame Style-Bausteine für den dunklen Dashboard-Look (Vorlage: Stakent-Referenz,
// Screenshot von Marcel am 18.09. geliefert). Zentral hier pflegen, damit alle Widgets
// konsistent bleiben und sich die Palette an einer Stelle nachjustieren lässt.

export const CARD =
  "flex h-full w-full flex-col rounded-2xl border border-white/5 bg-[#12131c] p-4 shadow-sm shadow-black/20";

export const CARD_HEADER = "mb-3 flex items-center gap-2.5";

export const HEADING = "text-sm font-semibold text-zinc-100";

export const MUTED = "text-sm text-zinc-500";

type IconColor = "blue" | "purple" | "amber" | "green" | "pink" | "cyan";

const ICON_COLORS: Record<IconColor, string> = {
  blue: "bg-blue-500/15 text-blue-400",
  purple: "bg-violet-500/15 text-violet-400",
  amber: "bg-amber-500/15 text-amber-400",
  green: "bg-emerald-500/15 text-emerald-400",
  pink: "bg-pink-500/15 text-pink-400",
  cyan: "bg-cyan-500/15 text-cyan-400",
};

export function iconBadge(color: IconColor): string {
  return `flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm ${ICON_COLORS[color]}`;
}

type PillTone = "green" | "red" | "amber" | "neutral";

const PILL_TONES: Record<PillTone, string> = {
  green: "bg-emerald-500/15 text-emerald-400",
  red: "bg-rose-500/15 text-rose-400",
  amber: "bg-amber-500/15 text-amber-400",
  neutral: "bg-white/5 text-zinc-400",
};

export function pill(tone: PillTone): string {
  return `shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`;
}

export const ROW = "rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2";
export const ROW_HOVER = "hover:bg-white/5";
