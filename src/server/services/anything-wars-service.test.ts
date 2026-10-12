import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { EXPERIENCE_PRESETS } from "@/lib/experiences/presets";
import { WORLD_PRESETS } from "@/lib/worlds/presets";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createEntity } from "./entity-service";
import { createExperienceProfile } from "./experience-profile-service";
import { createProject } from "./project-service";
import { createSimulation } from "./simulation-service";
import { getSimulationRun } from "./simulation-run-service";
import { createWorld } from "./world-service";
import {
  createAnythingWarsEvent,
  createAnythingWarsRun,
  getAnythingWarsEvent,
  listAnythingWarsEvents,
  markAnythingWarsEventReady,
  updateAnythingWarsEvent,
} from "./anything-wars-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function account() {
  sequence += 1;
  return registerUser({
    displayName: `Anything Wars User ${sequence}`,
    email: `anything-wars-${sequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

function worldInput() {
  const preset = WORLD_PRESETS[0]!;
  return {
    name: "Anything Wars Arena",
    description: "Original product test World Blueprint.",
    category: preset.category,
    status: "DRAFT",
    tags: ["Anything Wars"],
    biome: preset.biome,
    visibility: "WORKSPACE",
    blueprint: structuredClone(preset.blueprint),
    assetAssociations: [],
    entityAssociations: [],
    changeNote: "Initial version",
  };
}

function experienceInput() {
  const preset = EXPERIENCE_PRESETS[0]!;
  return {
    name: "Anything Wars Presentation",
    description: "Original presentation direction.",
    status: "DRAFT",
    tags: ["Anything Wars"],
    definition: structuredClone(preset.definition),
    changeNote: "Initial version",
  };
}

async function scenario() {
  const owner = await account();
  const first = await createEntity(owner.user.id, owner.workspaceId, { name: "Lion", category: "creature" });
  const second = await createEntity(owner.user.id, owner.workspaceId, { name: "Falcon", category: "creature" });
  const project = await createProject(owner.user.id, owner.workspaceId, { name: "Anything Wars Project" });
  const world = await createWorld(owner.user.id, owner.workspaceId, worldInput());
  const experience = await createExperienceProfile(owner.user.id, owner.workspaceId, experienceInput());
  return { owner, first, second, project, world, experience };
}

function eventInput(source: Awaited<ReturnType<typeof scenario>>) {
  return {
    projectId: source.project.id,
    name: "Lion vs Falcon",
    description: "A real Anything Wars duel.",
    mode: "battle",
    seed: "SV-AW000001",
    participants: [{ entityId: source.first.id }, { entityId: source.second.id }],
    configuration: { general: { roundLimit: 120 }, mode: { format: "duel" } },
    worldId: source.world.id,
    worldVersion: source.world.currentVersion,
    experienceProfileId: source.experience.id,
    experienceProfileVersion: source.experience.currentVersion,
  };
}

describe("Anything Wars service composition", () => {
  it("creates a marked generic Simulation with real config and pinned World/Experience snapshots", async () => {
    const source = await scenario();
    const event = await createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, eventInput(source));
    expect(event).toMatchObject({ mode: "battle", worldId: source.world.id, worldVersion: 1, experienceProfileId: source.experience.id, experienceProfileVersion: 1 });
    expect(event.metadata).toMatchObject({ product: "anything-wars", productVersion: 0 });
    expect(event.configuration.mode).toMatchObject({ format: "duel" });
    await markAnythingWarsEventReady(source.owner.user.id, source.owner.workspaceId, event.id);
    const run = await createAnythingWarsRun(source.owner.user.id, source.owner.workspaceId, event.id);
    expect(run.inputSnapshot.world).toMatchObject({ worldId: source.world.id, version: 1, name: source.world.name });
    expect(run.inputSnapshot.experienceProfile).toMatchObject({ experienceProfileId: source.experience.id, version: 1, name: source.experience.name });
    expect(run.participants.map((participant) => participant.name)).toEqual(["Lion", "Falcon"]);
    expect((await listAnythingWarsEvents(source.owner.user.id, source.owner.workspaceId))[0]?.simulation.id).toBe(event.id);
  });

  it("rejects future/product-invalid modes and executable participant violations", async () => {
    const source = await scenario();
    await expect(createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, { ...eventInput(source), mode: "economy" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, { ...eventInput(source), mode: "tournament" })).rejects.toBeInstanceOf(ValidationError);
    const invalid = await createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, {
      ...eventInput(source), participants: [{ entityId: source.first.id }],
    });
    await expect(markAnythingWarsEventReady(source.owner.user.id, source.owner.workspaceId, invalid.id)).rejects.toThrow("exactly two");
    expect(await prisma.simulationRun.count({ where: { simulationId: invalid.id } })).toBe(0);
  });

  it("enforces permissions, workspace isolation, safe product lookup, and foreign bindings", async () => {
    const source = await scenario();
    const viewer = await account();
    const foreign = await account();
    await prisma.workspaceMember.create({ data: { workspaceId: source.owner.workspaceId, userId: viewer.user.id, role: "VIEWER" } });
    const event = await createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, eventInput(source));
    expect((await getAnythingWarsEvent(viewer.user.id, source.owner.workspaceId, event.id)).id).toBe(event.id);
    await expect(updateAnythingWarsEvent(viewer.user.id, source.owner.workspaceId, event.id, { name: "Forbidden" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(createAnythingWarsRun(viewer.user.id, source.owner.workspaceId, event.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getAnythingWarsEvent(foreign.user.id, foreign.workspaceId, event.id)).rejects.toBeInstanceOf(NotFoundError);

    const generic = await createSimulation(source.owner.user.id, source.owner.workspaceId, {
      projectId: source.project.id, name: "Generic Battle", mode: "battle", seed: "SV-GENERIC1",
      participants: [{ entityId: source.first.id }, { entityId: source.second.id }],
      configuration: { mode: { format: "duel" } },
    });
    await expect(getAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, generic.id)).rejects.toBeInstanceOf(NotFoundError);

    const foreignWorld = await createWorld(foreign.user.id, foreign.workspaceId, worldInput());
    await expect(createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, {
      ...eventInput(source), worldId: foreignWorld.id, worldVersion: 1,
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("creates independent Run Again and Rematch records without changing historical Run truth", async () => {
    const source = await scenario();
    const event = await createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, eventInput(source));
    await markAnythingWarsEventReady(source.owner.user.id, source.owner.workspaceId, event.id);
    const firstRun = await createAnythingWarsRun(source.owner.user.id, source.owner.workspaceId, event.id);
    const frozen = structuredClone(firstRun.inputSnapshot);
    const secondRun = await createAnythingWarsRun(source.owner.user.id, source.owner.workspaceId, event.id);
    expect(secondRun.id).not.toBe(firstRun.id);
    expect(secondRun.inputSnapshot).toMatchObject({
      simulationId: frozen.simulationId,
      simulationName: frozen.simulationName,
      mode: frozen.mode,
      configuration: frozen.configuration,
      presentation: frozen.presentation,
      resolvedSeed: frozen.resolvedSeed,
      world: frozen.world,
      experienceProfile: frozen.experienceProfile,
    });
    expect(secondRun.participants.map((participant) => participant.sourceEntityId))
      .toEqual(firstRun.participants.map((participant) => participant.sourceEntityId));

    await updateAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, event.id, { name: "Edited future event" });
    const rematch = await createAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, {
      ...eventInput(source), name: "Editable Rematch", seed: "SV-AW000002",
    });
    expect(rematch.id).not.toBe(event.id);
    expect((await getSimulationRun(source.owner.user.id, source.owner.workspaceId, firstRun.id)).inputSnapshot).toEqual(frozen);
    expect((await getAnythingWarsEvent(source.owner.user.id, source.owner.workspaceId, event.id)).name).toBe("Edited future event");
  });
});
