import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getSimulationRun } from "@/server/services/simulation-run-service";
import { SimulationViewer } from "@/components/viewer/simulation-viewer";

interface PageProps { params: Promise<{ simulationId: string; runId: string }> }

export async function generateMetadata(): Promise<Metadata> { return { title: "Watch simulation replay" }; }

export default async function WatchPage({ params }: PageProps) {
  const { simulationId, runId } = await params;
  const { user, workspace } = await requirePlatformContext();
  let run;
  try {
    run = await getSimulationRun(user.id, workspace.id, runId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  if (run.simulationId !== simulationId) notFound();
  if (run.status !== "COMPLETED" || !run.result) return <div className="rounded-xl border border-border bg-surface p-8 text-center">
    <h1 className="text-xl font-semibold text-foreground">Replay is available after this run completes.</h1>
    <Link href={`/simulations/${simulationId}/runs/${runId}`} className="mt-4 inline-block text-accent hover:underline">View Run Detail</Link>
  </div>;
  return <SimulationViewer runId={run.id} simulationId={simulationId} title={run.inputSnapshot.simulationName}
    moduleId={run.moduleId} moduleVersion={run.moduleVersion} participants={run.participants}
    result={run.result.modulePayload} eventCount={run.eventCount} />;
}
