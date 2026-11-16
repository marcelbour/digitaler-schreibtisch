import { TodayWidget } from "@/components/TodayWidget";
import { ProjectsOverview } from "@/components/ProjectsOverview";
import { CountdownWidget } from "@/components/CountdownWidget";
import { QuickCapture } from "@/components/QuickCapture";
import { TodoLists } from "@/components/TodoLists";
import { CalendarWidget } from "@/components/CalendarWidget";
import { FahrschuleBudget } from "@/components/FahrschuleBudget";
import { NotenWidget } from "@/components/NotenWidget";
import { HabitWidget } from "@/components/HabitWidget";
import { AusgabenWidget } from "@/components/AusgabenWidget";
import OfflineBanner from "@/components/OfflineBanner";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <OfflineBanner />
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">
          Digitaler Schreibtisch
        </h1>
        <p className="text-sm text-zinc-500">Alles Wichtige auf einen Blick.</p>
      </div>
      {/* items-start (24.10.2026): Ohne das zieht das Grid jede Karte auf die Höhe der
          höchsten in ihrer Reihe – der Countdown wurde dadurch zur lilafarbenen
          Riesenfläche. Jetzt ist jede Karte so hoch wie ihr Inhalt. */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Neuordnung 16.11.2026 auf Marcels Wunsch: Was er oft braucht, steht oben
            (Fahrschul-Budget, Schneller Gedanke, Ausgaben). Projekte in der Mitte,
            To-Dos (zugeklappt) und Kalender weiter unten, Countdown und Daily Note
            ("Heute") ganz unten. Vault-Übersicht und Graph sind entfernt. */}
        <div id="fahrschule" className="xl:col-span-2">
          <FahrschuleBudget />
        </div>
        <div id="capture">
          <QuickCapture />
        </div>
        <div id="ausgaben" className="md:col-span-2 xl:col-span-3">
          <AusgabenWidget />
        </div>
        <div id="noten" className="md:col-span-2 xl:col-span-3">
          <NotenWidget />
        </div>
        <div id="habits" className="md:col-span-2 xl:col-span-3">
          <HabitWidget />
        </div>
        <div id="projekte">
          <ProjectsOverview />
        </div>
        <div id="todos" className="xl:col-span-2">
          <TodoLists />
        </div>
        <div id="kalender" className="md:col-span-2 xl:col-span-3">
          <CalendarWidget />
        </div>
        <div id="fokus">
          <CountdownWidget />
        </div>
        <div id="heute" className="xl:col-span-2">
          <TodayWidget />
        </div>
      </div>
    </main>
  );
}
