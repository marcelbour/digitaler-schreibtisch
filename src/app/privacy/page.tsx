export const metadata = {
  title: "Datenschutzerklärung – Digitaler Schreibtisch",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 min-h-full overflow-y-auto px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">Datenschutzerklärung</h1>

        <p className="text-zinc-300">
          Der Digitale Schreibtisch ist ein privates, persönliches Dashboard
          für den Eigengebrauch. Es wird von einer einzigen Person (dem
          Entwickler selbst) genutzt und ist nicht öffentlich zugänglich.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Welche Daten werden verarbeitet?</h2>
          <p className="text-zinc-300">
            Die App greift lesend auf den Google Kalender sowie auf eine
            persönliche Notizsammlung (Obsidian-Vault über Microsoft OneDrive)
            des Nutzers zu, um Termine und Notizen im Dashboard anzuzeigen.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Weitergabe an Dritte</h2>
          <p className="text-zinc-300">
            Es findet keine Weitergabe von Daten an Dritte statt. Alle
            abgerufenen Daten werden ausschließlich zur Anzeige im
            persönlichen Dashboard verwendet und nicht gespeichert,
            verkauft oder an andere Dienste übermittelt.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium">Kontakt</h2>
          <p className="text-zinc-300">
            Bei Fragen zu dieser Datenschutzerklärung:{" "}
            <a
              href="mailto:marcel.bour187@gmail.com"
              className="underline hover:text-white"
            >
              marcel.bour187@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
