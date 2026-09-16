import { VaultBrowser } from "@/components/VaultBrowser";
import { TodayWidget } from "@/components/TodayWidget";
import { ProjectsOverview } from "@/components/ProjectsOverview";
import { CountdownWidget } from "@/components/CountdownWidget";
import { QuickCapture } from "@/components/QuickCapture";
import { GraphView } from "@/components/GraphView";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Digitaler Schreibtisch
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Alles Wichtige auf einen Blick.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-6">
          <CountdownWidget />
          <TodayWidget />
          <QuickCapture />
          <ProjectsOverview />
          <VaultBrowser />
          <GraphView />
        </div>
      </main>
    </div>
  );
}
