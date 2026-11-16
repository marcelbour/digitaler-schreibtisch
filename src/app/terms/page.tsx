export const metadata = {
  title: "Nutzungsbedingungen – Digitaler Schreibtisch",
};

// Angelegt 16.11.2026: TikTok verlangt bei der App-Registrierung einen Link zu
// Nutzungsbedingungen. Die App ist ein privates Einzelnutzer-Dashboard.
export default function TermsPage() {
  return (
    <main className="flex-1 min-h-full overflow-y-auto px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Nutzungsbedingungen</h1>
        <p className="text-zinc-300">
          Der Digitale Schreibtisch ist ein privates, persönliches Dashboard für
          den Eigengebrauch einer einzigen Person (des Entwicklers selbst). Es
          wird nicht an Dritte angeboten, verkauft oder öffentlich bereitgestellt.
        </p>
        <p className="text-zinc-300">
          Die App liest ausschließlich Daten aus Konten, die dem Nutzer selbst
          gehören (Google Kalender, Notizsammlung, TikTok-Konto), und zeigt sie
          an. Sie veröffentlicht, verändert oder löscht keine Inhalte auf diesen
          Plattformen.
        </p>
        <p className="text-zinc-300">
          Es besteht kein Anspruch auf Verfügbarkeit oder Richtigkeit der
          angezeigten Daten. Die Nutzung der angebundenen Dienste unterliegt
          deren eigenen Bedingungen.
        </p>
        <p className="text-sm text-zinc-500">Stand: 16.11.2026</p>
      </div>
    </main>
  );
}
