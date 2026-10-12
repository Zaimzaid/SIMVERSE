import type { SimulationView } from "@/server/services/simulation-service";
import {
  defaultGeneralConfig,
  defaultModeConfig,
  defaultPresentation,
  type SimulationGeneralConfig,
  type SimulationPresentationConfig,
} from "@/lib/simulations/config";
import { DEFAULT_SIMULATION_MODE } from "@/lib/simulations/modes";

/**
 * Server-safe form model for the Simulation Builder.
 *
 * This module has NO "use client" pragma so a Server Component (the edit page)
 * can call `simulationToBuilderInitial` to build the initializer. The builder
 * itself re-exports only the erased type — never this mapper — so the
 * Server/Client boundary stays intact.
 */

/** A chosen participant, carrying just enough entity info to render it. */
export interface ParticipantChoice {
  entityId: string;
  name: string;
  category: string;
  imageUrl: string | null;
  importantAttributes?: Array<{ name: string; value: string }>;
}

export interface SimulationBuilderInitial {
  id: string;
  name: string;
  projectId: string;
  description: string;
  mode: string;
  participants: ParticipantChoice[];
  general: SimulationGeneralConfig;
  modeConfig: Record<string, unknown>;
  presentation: SimulationPresentationConfig;
  seed: string;
  worldId: string;
  worldVersion: number | null;
  experienceProfileId: string;
  experienceProfileVersion: number | null;
}

/** Blank initializer for a brand-new simulation (optionally preselecting a project). */
export function emptyBuilderInitial(projectId = ""): SimulationBuilderInitial {
  const mode = DEFAULT_SIMULATION_MODE;
  return {
    id: "",
    name: "",
    projectId,
    description: "",
    mode,
    participants: [],
    general: defaultGeneralConfig(),
    modeConfig: defaultModeConfig(mode),
    presentation: defaultPresentation(),
    seed: "",
    worldId: "",
    worldVersion: null,
    experienceProfileId: "",
    experienceProfileVersion: null,
  };
}

/** Map a persisted simulation into the builder's initial editing state. */
export function simulationToBuilderInitial(view: SimulationView): SimulationBuilderInitial {
  return {
    id: view.id,
    name: view.name,
    projectId: view.projectId,
    description: view.description ?? "",
    mode: view.mode,
    participants: view.participants.map((p) => ({
      entityId: p.entityId,
      name: p.entity?.name ?? "Unknown entity",
      category: p.entity?.category ?? "",
      imageUrl: p.entity?.imageUrl ?? null,
    })),
    general: view.configuration.general,
    modeConfig: view.configuration.mode,
    presentation: view.presentation,
    seed: view.seed ?? "",
    worldId: view.worldId ?? "",
    worldVersion: view.worldVersion,
    experienceProfileId: view.experienceProfileId ?? "",
    experienceProfileVersion: view.experienceProfileVersion,
  };
}
