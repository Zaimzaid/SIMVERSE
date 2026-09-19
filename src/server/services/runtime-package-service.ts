import {
  buildSimulationRuntimePackageV1,
  type SimulationRuntimePackageV1,
} from "@/lib/runtime-protocol/v1";
import {
  getSimulationRun,
  listSimulationRunEvents,
} from "./simulation-run-service";

const EVENT_PAGE_SIZE = 100;

/**
 * Build a data-minimized Runtime Protocol package through the existing
 * workspace-scoped Run read path. This does not persist or mutate anything.
 */
export async function getSimulationRuntimePackageV1(
  userId: string,
  workspaceId: string,
  runId: string,
): Promise<SimulationRuntimePackageV1> {
  const run = await getSimulationRun(userId, workspaceId, runId);
  const events = [];
  let afterSequence = 0;
  for (;;) {
    const page = await listSimulationRunEvents(
      userId,
      workspaceId,
      runId,
      afterSequence,
      EVENT_PAGE_SIZE,
    );
    events.push(...page.items);
    if (!page.hasMore) break;
    afterSequence = page.nextAfterSequence;
  }
  return buildSimulationRuntimePackageV1({ run, events });
}
