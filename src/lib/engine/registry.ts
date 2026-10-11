import type { EngineModule } from "./module";
import { battleModule } from "@/lib/modules/battle/battle-module";
import { raceModule } from "@/lib/modules/race/race-module";
import { survivalModule } from "@/lib/modules/survival/survival-module";

/** Configuration availability lives in the Mode Catalog; this registry alone
 * determines execution availability. */
export class EngineModuleRegistry {
  private readonly byMode: ReadonlyMap<string, EngineModule>;

  constructor(modules: readonly EngineModule[] = []) {
    const byMode = new Map<string, EngineModule>();
    for (const module of modules) {
      if (!module.mode || !module.id || !module.version || byMode.has(module.mode)) {
        throw new Error("Engine module registration is invalid or duplicated.");
      }
      byMode.set(module.mode, module);
    }
    this.byMode = byMode;
  }

  forMode(mode: string): EngineModule | undefined {
    return this.byMode.get(mode);
  }

  forRun(mode: string, id: string, version: string): EngineModule | undefined {
    const module = this.byMode.get(mode);
    return module?.id === id && module.version === version ? module : undefined;
  }

  canExecute(mode: string): boolean {
    return this.byMode.has(mode);
  }
}

export const productionEngineRegistry = new EngineModuleRegistry([battleModule, raceModule, survivalModule]);
