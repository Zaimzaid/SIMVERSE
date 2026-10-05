import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import type { WorkspaceRole } from "@/lib/permissions";
import { WORLD_PRESETS } from "@/lib/worlds/presets";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { deterministicTestRegistry } from "../../../test/fixtures/deterministic-engine-module";
import { registerUser } from "./auth-service";
import { archiveAsset, createAsset } from "./asset-service";
import { createEntity } from "./entity-service";
import { createProject } from "./project-service";
import { createSimulation, markSimulationReady, updateSimulation } from "./simulation-service";
import { createSimulationRun } from "./simulation-run-service";
import {
  archiveWorld, createWorld, deleteWorld, getWorld, getWorldVersion, listWorlds, listWorldVersions,
  restoreWorld, updateWorld,
} from "./world-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function account() {
  sequence += 1;
  return registerUser({ displayName: `World User ${sequence}`, email: `world-${sequence}-${Date.now()}@example.com`, password: "Password123", confirmPassword: "Password123" });
}
async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) { await prisma.workspaceMember.create({ data: { workspaceId, userId, role } }); }
function worldInput(overrides: Record<string, unknown> = {}) {
  const preset = WORLD_PRESETS[0]!;
  return { name: "Open Savannah", description: "Original World Blueprint", category: "natural-environment", status: "DRAFT",
    tags: ["Savannah", "Wildlife"], biome: preset.biome, thumbnailReference: "/worlds/savannah.webp", visibility: "WORKSPACE",
    blueprint: structuredClone(preset.blueprint), assetAssociations: [], entityAssociations: [], changeNote: "Initial version", ...overrides };
}
function assetInput(name = "Acacia") {
  return { name, type: "ENVIRONMENT", status: "DRAFT", tags: ["World"], provenance: { kind: "ORIGINAL", notes: "SIMVERSE original" },
    externalReference: `/library/${name.toLowerCase()}/v1/model.glb`, technicalMetadata: {}, productionChecklist: [], entityAssociations: [], derivedFromAssetIds: [] };
}

describe("World Blueprint CRUD, discovery and immutable versions", () => {
  it("creates, reads, updates and filters workspace Worlds", async () => {
    const owner = await account(); const world = await createWorld(owner.user.id, owner.workspaceId, worldInput());
    expect(world).toMatchObject({ name: "Open Savannah", status: "DRAFT", currentVersion: 1, biome: "SAVANNAH" });
    expect(world.version.blueprint.spawnSets.map((set) => set.identifier)).toEqual(["PredatorStart", "PreyStart"]);
    const updated = await updateWorld(owner.user.id, owner.workspaceId, world.id, { name: "Savannah Reserve", status: "IN_DESIGN", tags: ["Reserve"] });
    expect(updated).toMatchObject({ name: "Savannah Reserve", status: "IN_DESIGN", currentVersion: 2 });
    expect((await listWorlds(owner.user.id, owner.workspaceId, { search: "Reserve", biome: "SAVANNAH", tag: "reserve" })).items[0]?.id).toBe(world.id);
  });

  it("keeps every historical version inspectable and content-addressed", async () => {
    const owner = await account();
    const firstInput = worldInput(); firstInput.blueprint.presentation.metadata = { second: 2, first: 1 };
    const secondInput = worldInput(); secondInput.blueprint.presentation.metadata = { first: 1, second: 2 };
    const world = await createWorld(owner.user.id, owner.workspaceId, firstInput);
    const equivalent = await createWorld(owner.user.id, owner.workspaceId, secondInput);
    expect(equivalent.version.contentHash).toBe(world.version.contentHash);
    await updateWorld(owner.user.id, owner.workspaceId, world.id, { name: "Version Two", status: "IN_DESIGN", changeNote: "Design pass" });
    expect((await listWorldVersions(owner.user.id, owner.workspaceId, world.id)).map((item) => item.version)).toEqual([2, 1]);
    const first = await getWorldVersion(owner.user.id, owner.workspaceId, world.id, 1);
    expect(first.name).toBe("Open Savannah"); expect(first.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect((await prisma.worldVersion.findUniqueOrThrow({ where: { worldId_version: { worldId: world.id, version: 1 } } })).name).toBe("Open Savannah");
  });

  it("archives and restores through immutable lifecycle versions", async () => {
    const owner = await account(); const world = await createWorld(owner.user.id, owner.workspaceId, worldInput());
    const archived = await archiveWorld(owner.user.id, owner.workspaceId, world.id);
    expect(archived).toMatchObject({ status: "ARCHIVED", currentVersion: 2, archivedFromStatus: "DRAFT" });
    await expect(updateWorld(owner.user.id, owner.workspaceId, world.id, { name: "Blocked" })).rejects.toBeInstanceOf(ValidationError);
    const restored = await restoreWorld(owner.user.id, owner.workspaceId, world.id);
    expect(restored).toMatchObject({ status: "DRAFT", currentVersion: 3, archivedFromStatus: null });
  });

  it("rejects invalid status jumps", async () => {
    const owner = await account(); const world = await createWorld(owner.user.id, owner.workspaceId, worldInput());
    await expect(updateWorld(owner.user.id, owner.workspaceId, world.id, { status: "RUNTIME_READY" })).rejects.toBeInstanceOf(ValidationError);
    expect((await getWorld(owner.user.id, owner.workspaceId, world.id)).status).toBe("DRAFT");
  });

  it("requires archive before permanent deletion", async () => {
    const owner = await account(); const world = await createWorld(owner.user.id, owner.workspaceId, worldInput({ name: "Disposable World" }));
    await expect(deleteWorld(owner.user.id, owner.workspaceId, world.id)).rejects.toThrow("Archive this World");
    await archiveWorld(owner.user.id, owner.workspaceId, world.id); await deleteWorld(owner.user.id, owner.workspaceId, world.id);
    await expect(getWorld(owner.user.id, owner.workspaceId, world.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("World authorization and relationships", () => {
  it("allows world.view, enforces world.manage and hides foreign workspace records", async () => {
    const owner = await account(); const viewer = await account(); const foreign = await account(); await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const world = await createWorld(owner.user.id, owner.workspaceId, worldInput());
    expect((await getWorld(viewer.user.id, owner.workspaceId, world.id)).id).toBe(world.id);
    await expect(updateWorld(viewer.user.id, owner.workspaceId, world.id, { name: "No" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getWorld(foreign.user.id, foreign.workspaceId, world.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pins Asset versions and records descriptive Entity relationships", async () => {
    const owner = await account(); const asset = await createAsset(owner.user.id, owner.workspaceId, assetInput());
    const entity = await createEntity(owner.user.id, owner.workspaceId, { name: "Gazelle", category: "animal" });
    const association = { identifier: "acacia_1", assetId: asset.id, assetVersion: 1, role: "VEGETATION", placement: { position: { x: 100, y: 0, z: 50 }, rotationDegrees: { pitch: 0, yaw: 20, roll: 0 }, scale: { x: 1, y: 1, z: 1 } }, configuration: {} };
    const world = await createWorld(owner.user.id, owner.workspaceId, worldInput({ assetAssociations: [association], entityAssociations: [{ entityId: entity.id, relationship: "NATIVE_INHABITANT", configuration: {} }] }));
    expect(world.assets[0]).toMatchObject({ assetId: asset.id, assetVersion: 1, role: "VEGETATION" });
    expect(world.entities[0]).toMatchObject({ entityId: entity.id, relationship: "NATIVE_INHABITANT" });
    expect((await getWorldVersion(owner.user.id, owner.workspaceId, world.id, 1)).assetAssociations[0]?.assetVersion).toBe(1);
  });

  it("rejects foreign, archived and missing Asset version references atomically", async () => {
    const owner = await account(); const foreign = await account(); const foreignAsset = await createAsset(foreign.user.id, foreign.workspaceId, assetInput("Foreign"));
    const archived = await createAsset(owner.user.id, owner.workspaceId, assetInput("Archived")); await archiveAsset(owner.user.id, owner.workspaceId, archived.id);
    const relation = (assetId: string, assetVersion: number) => [{ identifier: "placement", assetId, assetVersion, role: "ENVIRONMENT", configuration: {} }];
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ assetAssociations: relation(foreignAsset.id, 1) }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ assetAssociations: relation(archived.id, 1) }))).rejects.toBeInstanceOf(ValidationError);
    const active = await createAsset(owner.user.id, owner.workspaceId, assetInput("Active"));
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ assetAssociations: relation(active.id, 99) }))).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.world.count({ where: { workspaceId: owner.workspaceId } })).toBe(0);
  });
});

describe("World structural validation", () => {
  it("rejects duplicate zone and spawn identifiers", async () => {
    const owner = await account(); const blueprint = structuredClone(WORLD_PRESETS[0]!.blueprint);
    blueprint.zones.push(structuredClone(blueprint.zones[0]!));
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ blueprint }))).rejects.toBeInstanceOf(ValidationError);
    const spawnBlueprint = structuredClone(WORLD_PRESETS[0]!.blueprint);
    spawnBlueprint.spawnSets[0]!.spawns.push(structuredClone(spawnBlueprint.spawnSets[0]!.spawns[0]!));
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ blueprint: spawnBlueprint }))).rejects.toBeInstanceOf(ValidationError);
    const crossSetBlueprint = structuredClone(WORLD_PRESETS[0]!.blueprint);
    crossSetBlueprint.spawnSets[1]!.spawns[0]!.identifier = crossSetBlueprint.spawnSets[0]!.spawns[0]!.identifier;
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ blueprint: crossSetBlueprint }))).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects coordinates outside World dimensions and unknown zone references", async () => {
    const owner = await account(); const blueprint = structuredClone(WORLD_PRESETS[0]!.blueprint);
    blueprint.spawnSets[0]!.spawns[0]!.position.x = 100_000;
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ blueprint }))).rejects.toBeInstanceOf(ValidationError);
    const oversizedZone = structuredClone(WORLD_PRESETS[0]!.blueprint); oversizedZone.zones[1]!.bounds.size!.x = 100_000;
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ blueprint: oversizedZone }))).rejects.toBeInstanceOf(ValidationError);
    const asset = await createAsset(owner.user.id, owner.workspaceId, assetInput("FarAway"));
    const placement = [{ identifier: "far_away", assetId: asset.id, assetVersion: 1, role: "ENVIRONMENT", placement: { position: { x: 100_000, y: 0, z: 0 }, rotationDegrees: { pitch: 0, yaw: 0, roll: 0 }, scale: { x: 1, y: 1, z: 1 } }, configuration: {} }];
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ assetAssociations: placement }))).rejects.toBeInstanceOf(ValidationError);
    const brokenZone = structuredClone(WORLD_PRESETS[0]!.blueprint); brokenZone.water[0]!.zoneIdentifier = "missing";
    await expect(createWorld(owner.user.id, owner.workspaceId, worldInput({ blueprint: brokenZone }))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("Simulation World bindings and Run truth", () => {
  it("accepts legacy simulations without a World and rejects foreign World bindings", async () => {
    const owner = await account(); const foreign = await account(); const project = await createProject(owner.user.id, owner.workspaceId, { name: "World Project" });
    const legacy = await createSimulation(owner.user.id, owner.workspaceId, { projectId: project.id, name: "Legacy", mode: "test-sequence", seed: "SV-WORLD001" });
    expect(legacy).toMatchObject({ worldId: null, worldVersion: null });
    const foreignWorld = await createWorld(foreign.user.id, foreign.workspaceId, worldInput());
    await expect(updateSimulation(owner.user.id, owner.workspaceId, legacy.id, { worldId: foreignWorld.id, worldVersion: 1 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("pins a World version on Simulation and freezes it into a historical Run", async () => {
    const owner = await account(); const world = await createWorld(owner.user.id, owner.workspaceId, worldInput());
    const first = await createEntity(owner.user.id, owner.workspaceId, { name: "A", category: "object" }); const second = await createEntity(owner.user.id, owner.workspaceId, { name: "B", category: "object" });
    const project = await createProject(owner.user.id, owner.workspaceId, { name: "World Run" });
    const simulation = await createSimulation(owner.user.id, owner.workspaceId, { projectId: project.id, name: "Bound Run", mode: "test-sequence", seed: "SV-WORLD002", participants: [{ entityId: first.id }, { entityId: second.id }], worldId: world.id, worldVersion: 1 });
    expect(simulation).toMatchObject({ worldId: world.id, worldVersion: 1, worldName: "Open Savannah" });
    await markSimulationReady(owner.user.id, owner.workspaceId, simulation.id); const run = await createSimulationRun(owner.user.id, owner.workspaceId, simulation.id, deterministicTestRegistry);
    expect(run.inputSnapshot.world).toMatchObject({ worldId: world.id, version: 1, name: "Open Savannah" });
    const before = (await prisma.simulationRun.findUniqueOrThrow({ where: { id: run.id } })).inputSnapshot;
    await updateWorld(owner.user.id, owner.workspaceId, world.id, { name: "Changed Later", status: "IN_DESIGN" });
    const stored = await prisma.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(stored.inputSnapshot).toBe(before); expect(JSON.parse(stored.inputSnapshot).world.name).toBe("Open Savannah");
  });
});
