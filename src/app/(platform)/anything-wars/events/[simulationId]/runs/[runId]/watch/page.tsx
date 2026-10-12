import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { anythingWarsRunHref } from "@/lib/anything-wars/routes";
import { NotFoundError } from "@/lib/errors";
import { BATTLE_MODULE_ID, BATTLE_MODULE_VERSION } from "@/lib/modules/battle/config";
import { requirePlatformContext } from "@/server/context";
import { getAnythingWarsEvent } from "@/server/services/anything-wars-service";
import { getSimulationRun } from "@/server/services/simulation-run-service";
import { SimulationViewer } from "@/components/viewer/simulation-viewer";

export const metadata: Metadata = { title: "Watch Anything Wars Replay" };

export default async function AnythingWarsWatchPage({ params }: { params: Promise<{ simulationId: string; runId: string }> }) {
  const { simulationId, runId } = await params;
  const { user, workspace } = await requirePlatformContext();
  let event: Awaited<ReturnType<typeof getAnythingWarsEvent>>;
  let run: Awaited<ReturnType<typeof getSimulationRun>>;
  try {
    [event, run] = await Promise.all([
      getAnythingWarsEvent(user.id, workspace.id, simulationId),
      getSimulationRun(user.id, workspace.id, runId),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (run.simulationId !== event.id) notFound();
  const resultsHref = anythingWarsRunHref(event.id, run.id);
  if (run.status !== "COMPLETED" || !run.result || run.moduleId !== BATTLE_MODULE_ID || run.moduleVersion !== BATTLE_MODULE_VERSION) {
    return <div className="rounded-xl border border-border bg-surface p-8 text-center"><h1 className="text-xl font-semibold text-foreground">3D replay is available for completed Battle v1 Runs.</h1><Link href={resultsHref} className="mt-4 inline-block text-accent hover:underline">View Run</Link></div>;
  }
  return <SimulationViewer runId={run.id} simulationId={event.id} title={run.inputSnapshot.simulationName} moduleId={run.moduleId} moduleVersion={run.moduleVersion} participants={run.participants} result={run.result.modulePayload} eventCount={run.eventCount} resultsHref={resultsHref} />;
}
