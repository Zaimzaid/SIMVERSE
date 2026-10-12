export function anythingWarsEventHref(simulationId: string): string {
  return `/anything-wars/events/${encodeURIComponent(simulationId)}`;
}

export function anythingWarsRunHref(simulationId: string, runId: string): string {
  return `${anythingWarsEventHref(simulationId)}/runs/${encodeURIComponent(runId)}`;
}

export function anythingWarsWatchHref(simulationId: string, runId: string): string {
  return `${anythingWarsRunHref(simulationId, runId)}/watch`;
}

export function anythingWarsRematchHref(simulationId: string): string {
  return `/anything-wars/create?rematch=${encodeURIComponent(simulationId)}`;
}

export function anythingWarsQuickHref(mode?: string): string {
  return mode ? `/anything-wars/quick?mode=${encodeURIComponent(mode)}` : "/anything-wars/quick";
}
