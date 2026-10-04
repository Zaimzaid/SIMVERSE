import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { WorkspaceRole } from "@/lib/permissions";
import { DEFAULT_VISUAL_PROFILE } from "@/lib/visuals/profile";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { deterministicTestRegistry } from "../../../test/fixtures/deterministic-engine-module";
import { registerUser } from "./auth-service";
import { createEntity, upsertEntityVisualProfile } from "./entity-service";
import { createProject } from "./project-service";
import { createSimulation, markSimulationReady } from "./simulation-service";
import { createSimulationRun } from "./simulation-run-service";
import {
  archiveAsset, createAsset, deleteAsset, getAsset, getAssetVersion, listAssets,
  listAssetVersions, restoreAsset, updateAsset,
} from "./asset-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function account() {
  sequence += 1;
  return registerUser({ displayName: `Asset User ${sequence}`, email: `asset-${sequence}-${Date.now()}@example.com`,
    password: "Password123", confirmPassword: "Password123" });
}
async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}
function modelInput(overrides: Record<string, unknown> = {}) {
  return {
    name: "Savannah Lion", description: "Original SIMVERSE creature model", type: "CREATURE",
    status: "DRAFT", tags: ["Creature", "Savannah"], provenance: { kind: "ORIGINAL", notes: "Built for SIMVERSE" },
    licenseInfo: { type: "PROPRIETARY", name: "SIMVERSE original" },
    authorInfo: { name: "SIMVERSE Art Team", organization: "SIMVERSE" },
    externalReference: "/library/lion/v1/lion.glb", thumbnailReference: "https://assets.example/lion.webp",
    technicalMetadata: { colorSpace: "sRGB", contentHash: "sha256:example" },
    modelSpecification: { format: "GLB", triangleCount: 42000, lods: [{ level: 0, triangleCount: 42000 }],
      dimensions: { x: 2.1, y: 1.2, z: 0.8, unit: "METER" }, scale: 1,
      skeletonReference: "simverse-quadruped-v1", materialSlots: ["Body", "Eyes"],
      textureReferences: ["/library/lion/v1/albedo.ktx2"] },
    productionChecklist: [{ key: "concept", completed: true }, { key: "modeling", completed: true },
      { key: "runtime_validation", completed: false }],
    entityAssociations: [], derivedFromAssetIds: [], changeNote: "Initial version", ...overrides,
  };
}

describe("Asset Library CRUD, versions and discovery", () => {
  it("creates, reads, updates and permanently deletes an archived workspace Asset", async () => {
    const owner = await account();
    const created = await createAsset(owner.user.id, owner.workspaceId, modelInput());
    expect(created).toMatchObject({ name: "Savannah Lion", type: "CREATURE", status: "DRAFT", currentVersion: 1 });
    expect(created.version.modelSpecification).toMatchObject({ format: "GLB", triangleCount: 42000 });
    const updated = await updateAsset(owner.user.id, owner.workspaceId, created.id,
      { name: "Savannah Lion Hero", status: "CONCEPT_APPROVED", changeNote: "Concept approved" });
    expect(updated).toMatchObject({ name: "Savannah Lion Hero", status: "CONCEPT_APPROVED", currentVersion: 2 });
    expect((await getAsset(owner.user.id, owner.workspaceId, created.id)).version.changeNote).toBe("Concept approved");
    await archiveAsset(owner.user.id, owner.workspaceId, created.id);
    await deleteAsset(owner.user.id, owner.workspaceId, created.id);
    await expect(getAsset(owner.user.id, owner.workspaceId, created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps old versions immutable and inspectable", async () => {
    const owner = await account();
    const asset = await createAsset(owner.user.id, owner.workspaceId, modelInput());
    await updateAsset(owner.user.id, owner.workspaceId, asset.id, {
      name: "Lion v2", externalReference: "/library/lion/v2/lion.glb", tags: ["Creature", "Hero"],
    });
    const versions = await listAssetVersions(owner.user.id, owner.workspaceId, asset.id);
    expect(versions.map((version) => version.version)).toEqual([2, 1]);
    const first = await getAssetVersion(owner.user.id, owner.workspaceId, asset.id, 1);
    expect(first).toMatchObject({ name: "Savannah Lion", externalReference: "/library/lion/v1/lion.glb", tags: ["Creature", "Savannah"] });
    expect((await prisma.assetVersion.findUniqueOrThrow({ where: { assetId_version: { assetId: asset.id, version: 1 } } })).name)
      .toBe("Savannah Lion");
  });

  it("searches and filters by type, status, tag, Entity and updated ordering", async () => {
    const owner = await account();
    const lion = await createEntity(owner.user.id, owner.workspaceId, { name: "Lion Entity", category: "animal" });
    const creature = await createAsset(owner.user.id, owner.workspaceId, modelInput({
      entityAssociations: [{ entityId: lion.id, purpose: "PRIMARY" }],
    }));
    await createAsset(owner.user.id, owner.workspaceId, {
      ...modelInput(), name: "Roar", type: "AUDIO", tags: ["Audio"], modelSpecification: undefined,
      externalReference: "/library/audio/roar.wav",
    });
    expect((await listAssets(owner.user.id, owner.workspaceId, { search: "lion" })).items.map((item) => item.id)).toEqual([creature.id]);
    expect((await listAssets(owner.user.id, owner.workspaceId, { type: "AUDIO" })).items[0]?.name).toBe("Roar");
    expect((await listAssets(owner.user.id, owner.workspaceId, { tag: "savannah" })).items[0]?.id).toBe(creature.id);
    expect((await listAssets(owner.user.id, owner.workspaceId, { entityId: lion.id })).items[0]?.id).toBe(creature.id);
    expect((await listAssets(owner.user.id, owner.workspaceId, { sort: "name_asc" })).items.map((item) => item.name))
      .toEqual(["Roar", "Savannah Lion"]);
  });
});

describe("Asset authorization, isolation and references", () => {
  it("allows asset.view but enforces asset.manage and hides foreign workspaces", async () => {
    const owner = await account(); const viewer = await account(); const foreign = await account();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const asset = await createAsset(owner.user.id, owner.workspaceId, modelInput());
    expect((await getAsset(viewer.user.id, owner.workspaceId, asset.id)).id).toBe(asset.id);
    await expect(updateAsset(viewer.user.id, owner.workspaceId, asset.id, { name: "Hacked" }))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(getAsset(foreign.user.id, foreign.workspaceId, asset.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getAsset(foreign.user.id, owner.workspaceId, asset.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects foreign Entity and parent Asset references atomically", async () => {
    const owner = await account(); const foreign = await account();
    const foreignEntity = await createEntity(foreign.user.id, foreign.workspaceId, { name: "Foreign", category: "object" });
    const foreignAsset = await createAsset(foreign.user.id, foreign.workspaceId, modelInput({ name: "Foreign Asset" }));
    await expect(createAsset(owner.user.id, owner.workspaceId, modelInput({
      entityAssociations: [{ entityId: foreignEntity.id, purpose: "PRIMARY" }], derivedFromAssetIds: [foreignAsset.id],
    }))).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.asset.count({ where: { workspaceId: owner.workspaceId } })).toBe(0);
  });

  it("creates version-pinned Entity and derived-Asset relationships", async () => {
    const owner = await account();
    const entity = await createEntity(owner.user.id, owner.workspaceId, { name: "Lion", category: "animal" });
    const concept = await createAsset(owner.user.id, owner.workspaceId, { ...modelInput(), name: "Lion Concept", type: "CONCEPT_ART", modelSpecification: undefined });
    const model = await createAsset(owner.user.id, owner.workspaceId, modelInput({
      entityAssociations: [{ entityId: entity.id, purpose: "PRIMARY" }], derivedFromAssetIds: [concept.id],
      provenance: { kind: "DERIVED", sourceName: "Lion Concept" },
    }));
    expect(model.entities[0]).toMatchObject({ entityId: entity.id, version: 1, purpose: "PRIMARY" });
    expect(model.parents[0]).toMatchObject({ id: concept.id, relationship: "DERIVED_FROM" });
    const updated = await updateAsset(owner.user.id, owner.workspaceId, model.id, { status: "CONCEPT_APPROVED" });
    expect(updated.entities[0]?.version).toBe(2);
    expect((await getAssetVersion(owner.user.id, owner.workspaceId, model.id, 1)).entityAssociations[0]?.entityId).toBe(entity.id);
  });
});

describe("Asset production lifecycle and validation", () => {
  it("archives and restores with immutable lifecycle versions", async () => {
    const owner = await account(); const asset = await createAsset(owner.user.id, owner.workspaceId, modelInput());
    await updateAsset(owner.user.id, owner.workspaceId, asset.id, { status: "CONCEPT_APPROVED" });
    const archived = await archiveAsset(owner.user.id, owner.workspaceId, asset.id);
    expect(archived).toMatchObject({ status: "ARCHIVED", currentVersion: 3, archivedFromStatus: "CONCEPT_APPROVED" });
    expect(archived.archivedAt).not.toBeNull();
    await expect(updateAsset(owner.user.id, owner.workspaceId, asset.id, { name: "No" })).rejects.toBeInstanceOf(ValidationError);
    const restored = await restoreAsset(owner.user.id, owner.workspaceId, asset.id);
    expect(restored).toMatchObject({ status: "CONCEPT_APPROVED", currentVersion: 4, archivedFromStatus: null });
    expect(restored.archivedAt).toBeNull();
    expect((await listAssetVersions(owner.user.id, owner.workspaceId, asset.id)).map((version) => version.status))
      .toEqual(["CONCEPT_APPROVED", "ARCHIVED", "CONCEPT_APPROVED", "DRAFT"]);
  });

  it("enforces production status transitions and archive-before-delete", async () => {
    const owner = await account(); const asset = await createAsset(owner.user.id, owner.workspaceId, modelInput());
    await expect(updateAsset(owner.user.id, owner.workspaceId, asset.id, { status: "RUNTIME_READY" }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(deleteAsset(owner.user.id, owner.workspaceId, asset.id)).rejects.toBeInstanceOf(ConflictError);
    expect((await getAsset(owner.user.id, owner.workspaceId, asset.id)).status).toBe("DRAFT");
  });

  it("rejects credential-bearing references and incomplete provenance or licenses", async () => {
    const owner = await account();
    await expect(createAsset(owner.user.id, owner.workspaceId, modelInput({
      externalReference: "https://assets.example/lion.glb?token=secret",
    }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createAsset(owner.user.id, owner.workspaceId, modelInput({
      externalReference: "/library/lion.glb?api_key=secret",
    }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createAsset(owner.user.id, owner.workspaceId, modelInput({
      provenance: { kind: "IMPORTED" },
    }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createAsset(owner.user.id, owner.workspaceId, modelInput({
      licenseInfo: { type: "CC_BY" },
    }))).rejects.toBeInstanceOf(ValidationError);
    await expect(createAsset(owner.user.id, owner.workspaceId, modelInput({
      provenance: { kind: "DERIVED", sourceName: "Missing parent" },
    }))).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("historical SimulationRun isolation", () => {
  it("never mutates a Run visual snapshot when an associated Asset changes", async () => {
    const owner = await account();
    const first = await createEntity(owner.user.id, owner.workspaceId, { name: "Lion", category: "animal" });
    const second = await createEntity(owner.user.id, owner.workspaceId, { name: "Tiger", category: "animal" });
    await upsertEntityVisualProfile(owner.user.id, owner.workspaceId, first.id, {
      ...DEFAULT_VISUAL_PROFILE, sourceType: "MODEL_3D", modelUrl: "/library/lion/v1/lion.glb", archetype: "QUADRUPED",
    });
    const asset = await createAsset(owner.user.id, owner.workspaceId, modelInput({
      entityAssociations: [{ entityId: first.id, purpose: "PRIMARY" }],
    }));
    const project = await createProject(owner.user.id, owner.workspaceId, { name: "Snapshot Project" });
    const simulation = await createSimulation(owner.user.id, owner.workspaceId, {
      projectId: project.id, name: "Asset Snapshot", mode: "test-sequence", seed: "SV-ABCD2345",
      participants: [{ entityId: first.id }, { entityId: second.id }],
    });
    await markSimulationReady(owner.user.id, owner.workspaceId, simulation.id);
    const run = await createSimulationRun(owner.user.id, owner.workspaceId, simulation.id, deterministicTestRegistry);
    const before = (await prisma.simulationRun.findUniqueOrThrow({ where: { id: run.id } })).inputSnapshot;
    expect(run.participants[0]?.visualProfile?.modelUrl).toBe("/library/lion/v1/lion.glb");
    await updateAsset(owner.user.id, owner.workspaceId, asset.id, {
      externalReference: "/library/lion/v2/lion.glb", name: "Savannah Lion v2",
    });
    const stored = await prisma.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(stored.inputSnapshot).toBe(before);
    expect(JSON.parse(stored.inputSnapshot).participants[0].visualProfile.modelUrl).toBe("/library/lion/v1/lion.glb");
  });
});
