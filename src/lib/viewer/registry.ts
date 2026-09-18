import type { SimulationViewerAdapter } from "./types";
import { battleViewerAdapter } from "./battle-adapter";

export class ViewerAdapterRegistry {
  constructor(private readonly adapters: readonly SimulationViewerAdapter[]) {}

  forRun(moduleId: string, moduleVersion: string): SimulationViewerAdapter | null {
    return this.adapters.find((adapter) => adapter.moduleId === moduleId && adapter.moduleVersions.includes(moduleVersion)) ?? null;
  }
}

export const productionViewerRegistry = new ViewerAdapterRegistry([battleViewerAdapter]);
