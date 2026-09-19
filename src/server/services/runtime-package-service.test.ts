import { beforeEach, describe, expect, it } from "vitest";
import { RuntimeProtocolError } from "@/lib/runtime-protocol/v1";
import { DEFAULT_VISUAL_PROFILE } from "@/lib/visuals/profile";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  createEntity,
  updateEntity,
  upsertEntityVisualProfile,
} from "./entity-service";
import { createProject } from "./project-service";
import { getSimulationRuntimePackageV1 } from "./runtime-package-service";
import {
  createSimulationRun,
  executeUntilComplete,
  startSimulationRun,
} from "./simulation-run-service";
import {
  createSimulation,
  markSimulationReady,
} from "./simulation-service";

beforeEach(async () => { await resetDb(); });

describe("Runtime Package service", () => {
  it("projects only immutable persisted Run history through the canonical v1 builder", async () => {
    const account = await registerUser({
      displayName: "Runtime Package Owner",
      email: `runtime-package-${Date.now()}@example.com`,
      password: "Password123",
      confirmPassword: "Password123",
    });
    const { workspaceId } = account;
    const userId = account.user.id;
    const lion = await createEntity(userId, workspaceId, {
      name: "Historical Lion",
      category: "animal",
      metadata: { privateAuditNote: "must-not-leave-platform" },
    });
    const tiger = await createEntity(userId, workspaceId, {
      name: "Historical Tiger",
      category: "animal",
    });
    await upsertEntityVisualProfile(userId, workspaceId, lion.id, {
      ...DEFAULT_VISUAL_PROFILE,
      sourceType: "MODEL_3D",
      modelUrl: "/models/historical-lion.glb",
      archetype: "QUADRUPED",
      animationProfile: { IDLE: "Idle", ATTACK_PRIMARY: "Bite" },
    });
    const project = await createProject(userId, workspaceId, { name: "Runtime Protocol Project" });
    const simulation = await createSimulation(userId, workspaceId, {
      projectId: project.id,
      name: "Runtime Protocol Duel",
      mode: "battle",
      seed: "SV-PROTOCOL",
      participants: [{ entityId: lion.id }, { entityId: tiger.id }],
      configuration: {
        general: { roundLimit: 120 },
        mode: { format: "duel" },
      },
    });
    await markSimulationReady(userId, workspaceId, simulation.id);
    const run = await createSimulationRun(userId, workspaceId, simulation.id);

    await expect(getSimulationRuntimePackageV1(userId, workspaceId, run.id))
      .rejects.toMatchObject<Partial<RuntimeProtocolError>>({ code: "RUN_NOT_COMPLETED" });

    await updateEntity(userId, workspaceId, lion.id, {
      name: "Live Lion Changed Later",
      metadata: { apiToken: "must-never-appear" },
    });
    await upsertEntityVisualProfile(userId, workspaceId, lion.id, {
      ...DEFAULT_VISUAL_PROFILE,
      sourceType: "MODEL_3D",
      modelUrl: "/models/live-replacement.glb",
      archetype: "ROBOT",
      animationProfile: { IDLE: "ReplacementIdle" },
    });

    await startSimulationRun(userId, workspaceId, run.id);
    const completed = await executeUntilComplete(userId, workspaceId, run.id, 160);
    const runtimePackage = await getSimulationRuntimePackageV1(userId, workspaceId, run.id);

    expect(runtimePackage.run.runId).toBe(run.id);
    expect(runtimePackage.participants[0]).toMatchObject({
      sourceEntityId: lion.id,
      identity: { displayName: "Historical Lion" },
      visual: {
        archetype: "QUADRUPED",
        modelReference: "/models/historical-lion.glb",
        animationMapping: { IDLE: "Idle", ATTACK_PRIMARY: "Bite" },
      },
    });
    expect(runtimePackage.result.payload).toEqual(completed.result?.modulePayload);
    expect(runtimePackage.events.at(-1)?.type).toBe("battle.completed");
    expect(runtimePackage.events).toHaveLength(completed.eventCount);
    const serialized = JSON.stringify(runtimePackage);
    expect(serialized).not.toContain("must-not-leave-platform");
    expect(serialized).not.toContain("must-never-appear");
    expect(serialized).not.toContain("workspaceId");
    expect(serialized).not.toContain("Live Lion Changed Later");
    expect(serialized).not.toContain("live-replacement.glb");
  }, 30_000);
});
