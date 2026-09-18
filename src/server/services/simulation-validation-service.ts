import type { SimulationView } from "./simulation-service";

import { normalizeConfigInput } from "@/lib/simulations/config";
import { minEntitiesForMode, resolveMode } from "@/lib/simulations/modes";
import { isValidSeed } from "@/lib/simulations/seed";

/**
 * READY validation for a Simulation *configuration*.
 *
 * This answers one question only: "is this blueprint complete and internally
 * consistent enough to be marked READY?" READY is a configuration state — it does
 * does not by itself imply that an execution module is registered for the mode.
 *
 * The check is pure: it operates on an already-loaded, workspace-scoped
 * SimulationView and performs NO database access and NO execution. Participants
 * were workspace-verified when they were written, so here we only confirm the
 * loaded view still holds together.
 */

export interface SimulationIssue {
  /** Stable machine code for the failed check. */
  code: string;
  /** The builder field/step the issue maps to. */
  field: string;
  /** Human-readable explanation for the UI. */
  message: string;
}

export interface SimulationValidationResult {
  ok: boolean;
  issues: SimulationIssue[];
}

/** Validate a simulation view for the DRAFT → READY transition. Never throws. */
export function validateSimulationForReady(sim: SimulationView): SimulationValidationResult {
  const issues: SimulationIssue[] = [];

  // 1. Name present.
  if (!sim.name || sim.name.trim().length === 0) {
    issues.push({ code: "name_required", field: "name", message: "Give the simulation a name." });
  }

  // 2. Attached to a project (the project is loaded from the same workspace).
  if (!sim.projectId || !sim.projectName) {
    issues.push({
      code: "project_required",
      field: "projectId",
      message: "Attach the simulation to a project.",
    });
  }

  // 3. Mode is valid and actually available (a "coming soon" mode can't be READY).
  const mode = resolveMode(sim.mode);
  if (mode.availability !== "available") {
    issues.push({
      code: "mode_unavailable",
      field: "mode",
      message: `“${mode.label}” isn’t available yet.`,
    });
  }

  // 4. Participant count meets the mode minimum.
  const min = minEntitiesForMode(sim.mode);
  if (sim.participants.length < min) {
    issues.push({
      code: "min_participants",
      field: "participants",
      message: `Add at least ${min} ${min === 1 ? "entity" : "entities"} for ${mode.label} (currently ${sim.participants.length}).`,
    });
  }

  // 5. Every participant still resolves to a live entity in this workspace.
  const orphaned = sim.participants.filter((p) => !p.entity);
  if (orphaned.length > 0) {
    issues.push({
      code: "participants_invalid",
      field: "participants",
      message: "Some participants are no longer valid entities in this workspace.",
    });
  }

  // 6. Stored configuration still matches the versioned schema for this mode.
  try {
    normalizeConfigInput(sim.mode, sim.configuration);
  } catch {
    issues.push({
      code: "config_invalid",
      field: "configuration",
      message: "Some settings are invalid. Revisit Rules & Settings.",
    });
  }

  // 7. Seed is a well-formed label (metadata only; nothing consumes it yet).
  if (!sim.seed || !isValidSeed(sim.seed)) {
    issues.push({
      code: "seed_invalid",
      field: "seed",
      message: "Generate or enter a valid seed (SV-XXXXXXXX).",
    });
  }

  return { ok: issues.length === 0, issues };
}
