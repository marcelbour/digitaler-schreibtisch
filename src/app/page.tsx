import { VaultBrowser } from "@/components/VaultBrowser";
import { TodayWidget } from "@/components/TodayWidget";
import { ProjectsOverview } from "@/components/ProjectsOverview";
import { CountdownWidget } from "@/components/CountdownWidget";
import { QuickCapture } from "@/components/QuickCapture";
import { GraphView } from "@/components/GraphView";
import { TodoLists } from "@/components/TodoLists";
import { CalendarWidget } from "@/components/CalendarWidget";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-6 py-8 md:px-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">
          Digitaler Schreibtisch
        </h1>
        <p className="text-sm text-zinc-500">Alles Wichtige auf einen Blick.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div id="fokus">
          <CountdownWidget />
        </div>
        <div id="todos">
          <TodoLists />
        </div>
        <div id="heute">
          <TodayWidget />
        </div>
        <div id="kalender" className="md:col-span-2 xl:col-span-3">
          <CalendarWidget />
        </div>
        <div id="projekte">
          <ProjectsOverview />
        </div>
        <div id="capture">
          <QuickCapture />
        </div>
        <div id="vault">
          <VaultBrowser />
        </div>
        <div id="graph">
          <GraphView />
        </div>
      </div>
    </main>
  );
}
