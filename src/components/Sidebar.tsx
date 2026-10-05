const NAV = [
  { href: "#fokus", icon: "⏳", label: "Fokus" },
  { href: "#todos", icon: "✅", label: "To-Dos" },
  { href: "#kalender", icon: "📅", label: "Kalender" },
  { href: "#heute", icon: "🏠", label: "Heute" },
  { href: "#projekte", icon: "🗂️", label: "Projekte" },
  { href: "#capture", icon: "✍️", label: "Schneller Gedanke" },
  { href: "#vault", icon: "📁", label: "Vault" },
  { href: "#graph", icon: "🕸️", label: "Graph" },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-[#0e0f17] px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-lg">
          🧠
        </span>
        <div>
          <p className="text-sm font-semibold text-zinc-100">Digitaler Schreibtisch</p>
          <p className="text-xs text-zinc-500">Marcel Bour</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
