import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { BATTLE_EXPERIENCE_EVENT_TYPES } from "@/lib/experiences/constants";
import { CINEMATIC_BATTLE_BINDINGS, EXPERIENCE_PRESETS } from "@/lib/experiences/presets";
import type { ExperienceDefinitionV1 } from "@/lib/experiences/schemas";
import type { WorkspaceRole } from "@/lib/permissions";
import { ANIMATION_STATES } from "@/lib/visuals/profile";
import { WORLD_PRESETS } from "@/lib/worlds/presets";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import { createAsset } from "./asset-service";
import { createAttributeDefinition } from "./attribute-service";
import { createEntity } from "./entity-service";
import {
  archiveExperienceProfile,
  createExperienceProfile,
  deleteExperienceProfile,
  getExperienceProfile,
  listExperienceBindingOptions,
  listExperienceProfiles,
  listExperienceProfileVersions,
  restoreExperienceProfile,
  updateExperienceProfile,
} from "./experience-profile-service";
import { createProject } from "./project-service";
import { createSimulation, markSimulationReady } from "./simulation-service";
import { createSimulationRun, getSimulationRun } from "./simulation-run-service";
import { createWorld } from "./world-service";

beforeEach(async () => { await resetDb(); });

let sequence = 0;
async function account() {
  sequence += 1;
  return registerUser({
    displayName: `Experience User ${sequence}`,
    email: `experience-${sequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}

function profileInput(overrides: Record<string, unknown> = {}) {
  const preset = EXPERIENCE_PRESETS[0]!;
  return {
    name: "SIMVERSE Cinematic Battle",
    description: "Original engine-neutral presentation direction.",
    status: "DRAFT",
    tags: ["Battle", "Cinematic"],
    thumbnailReference: "/experiences/cinematic-battle.webp",
    definition: structuredClone(preset.definition),
    changeNote: "Initial version",
    ...overrides,
  };
}

function assetInput(name: string, type: "AUDIO" | "VFX" | "OTHER") {
  return {
    name,
    type,
    status: "DRAFT",
    tags: ["Presentation"],
    provenance: { kind: "ORIGINAL", notes: "Original SIMVERSE presentation asset." },
    licenseInfo: { type: "PROPRIETARY", name: "SIMVERSE original" },
    externalReference: `/library/experiences/${name.toLowerCase().replaceAll(" ", "-")}/v1/source.bin`,
    technicalMetadata: {},
    productionChecklist: [],
    entityAssociations: [],
    derivedFromAssetIds: [],
  };
}

function worldInput() {
  const preset = WORLD_PRESETS[0]!;
  return {
    name: "Experience Savannah",
    description: "World integration fixture.",
    category: preset.category,
    status: "DRAFT",
    tags: preset.tags,
    biome: preset.biome,
    visibility: "WORKSPACE",
    blueprint: structuredClone(preset.blueprint),
    assetAssociations: [],
    entityAssociations: [],
    changeNote: "Initial version",
  };
}

function withBinding(
  definition: ExperienceDefinitionV1,
  index: number,
  patch: Record<string, unknown>,
): ExperienceDefinitionV1 {
  const eventBindings = structuredClone(definition.eventBindings);
  eventBindings[index] = { ...eventBindings[index]!, ...patch };
  return { ...structuredClone(definition), eventBindings } as ExperienceDefinitionV1;
}

async function battleSimulation(
  ownerId: string,
  workspaceId: string,
  experienceProfileId?: string,
  experienceProfileVersion?: number,
) {
  const strength = await createAttributeDefinition(ownerId, workspaceId, {
    name: "Strength",
    dataType: "NUMBER",
    minimum: 0,
    maximum: 100,
  });
  const lion = await createEntity(ownerId, workspaceId, {
    name: "Lion",
    category: "creature",
    attributes: [{ attributeDefinitionId: strength.id, value: 90 }],
  });
  const falcon = await createEntity(ownerId, workspaceId, {
    name: "Falcon",
    category: "creature",
    attributes: [{ attributeDefinitionId: strength.id, value: 40 }],
  });
  const project = await createProject(ownerId, workspaceId, { name: "Experience Run Project" });
  const simulation = await createSimulation(ownerId, workspaceId, {
    projectId: project.id,
    name: "Presented Battle",
    mode: "battle",
    seed: "SV-EXPR0001",
    participants: [{ entityId: lion.id }, { entityId: falcon.id }],
    configuration: { general: { roundLimit: 120 }, mode: { format: "duel" } },
    experienceProfileId,
    experienceProfileVersion,
  });
  await markSimulationReady(ownerId, workspaceId, simulation.id);
  return simulation;
}

describe("Experience Profile CRUD, discovery and immutable versions", () => {
  it("creates, reads, updates, filters and keeps historical versions inspectable", async () => {
    const owner = await account();
    const created = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    expect(created).toMatchObject({
      name: "SIMVERSE Cinematic Battle",
      status: "DRAFT",
      currentVersion: 1,
      preset: "CINEMATIC",
    });
    const updated = await updateExperienceProfile(owner.user.id, owner.workspaceId, created.id, {
      name: "Cinematic Battle Approved Design",
      status: "IN_DESIGN",
      tags: ["Battle", "Directed"],
      changeNote: "Direction pass",
    });
    expect(updated).toMatchObject({ status: "IN_DESIGN", currentVersion: 2 });
    const listed = await listExperienceProfiles(owner.user.id, owner.workspaceId, {
      search: "Approved",
      preset: "CINEMATIC",
      module: "battle",
      mode: "battle",
      tag: "directed",
    });
    expect(listed.items.map((item) => item.id)).toEqual([created.id]);
    const versions = await listExperienceProfileVersions(owner.user.id, owner.workspaceId, created.id);
    expect(versions.map((version) => version.version)).toEqual([2, 1]);
    expect(versions[1]).toMatchObject({ name: "SIMVERSE Cinematic Battle", status: "DRAFT" });
  });

  it("creates deterministic canonical hashes for equivalent content", async () => {
    const owner = await account();
    const first = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    const equivalent = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    expect(equivalent.version.contentHash).toBe(first.version.contentHash);
    expect(first.version.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("archives, restores and permanently deletes through immutable lifecycle versions", async () => {
    const owner = await account();
    const profile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    const archived = await archiveExperienceProfile(owner.user.id, owner.workspaceId, profile.id);
    expect(archived).toMatchObject({ status: "ARCHIVED", currentVersion: 2, archivedFromStatus: "DRAFT" });
    await expect(updateExperienceProfile(owner.user.id, owner.workspaceId, profile.id, { name: "Blocked" }))
      .rejects.toBeInstanceOf(ValidationError);
    const restored = await restoreExperienceProfile(owner.user.id, owner.workspaceId, profile.id);
    expect(restored).toMatchObject({ status: "DRAFT", currentVersion: 3, archivedFromStatus: null });
    await archiveExperienceProfile(owner.user.id, owner.workspaceId, profile.id);
    await deleteExperienceProfile(owner.user.id, owner.workspaceId, profile.id);
    await expect(getExperienceProfile(owner.user.id, owner.workspaceId, profile.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("enforces valid production status transitions", async () => {
    const owner = await account();
    const profile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    await expect(updateExperienceProfile(owner.user.id, owner.workspaceId, profile.id, { status: "RUNTIME_READY" }))
      .rejects.toBeInstanceOf(ValidationError);
    expect((await getExperienceProfile(owner.user.id, owner.workspaceId, profile.id)).currentVersion).toBe(1);
  });
});

describe("Experience Profile authorization and references", () => {
  it("allows experience.view, enforces experience.manage and hides foreign records", async () => {
    const owner = await account();
    const viewer = await account();
    const foreign = await account();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const profile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    expect((await getExperienceProfile(viewer.user.id, owner.workspaceId, profile.id)).id).toBe(profile.id);
    await expect(updateExperienceProfile(viewer.user.id, owner.workspaceId, profile.id, { name: "No" }))
      .rejects.toBeInstanceOf(AuthorizationError);
    await expect(getExperienceProfile(foreign.user.id, foreign.workspaceId, profile.id))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("pins workspace Assets by immutable version and validates cue roles", async () => {
    const owner = await account();
    const foreign = await account();
    const audio = await createAsset(owner.user.id, owner.workspaceId, assetInput("Battle Intro", "AUDIO"));
    const vfx = await createAsset(owner.user.id, owner.workspaceId, assetInput("Impact Burst", "VFX"));
    const foreignAudio = await createAsset(foreign.user.id, foreign.workspaceId, assetInput("Foreign Audio", "AUDIO"));
    const base = structuredClone(EXPERIENCE_PRESETS[0]!.definition);
    base.assetAssociations = [
      { identifier: "intro_audio", assetId: audio.id, assetVersion: 1, role: "AUDIO" },
      { identifier: "impact_vfx", assetId: vfx.id, assetVersion: 1, role: "VFX" },
    ];
    base.eventBindings[0] = {
      ...base.eventBindings[0]!,
      audio: { cue: "INTRO", assetIdentifier: "intro_audio" },
      vfx: { cue: "DUST", assetIdentifier: "impact_vfx", surfaceResponseCategory: "dry-grass" },
    };
    const profile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: base }));
    expect(profile.assets.map((asset) => asset.identifier)).toEqual(["impact_vfx", "intro_audio"]);

    const foreignDefinition = structuredClone(base);
    foreignDefinition.assetAssociations[0] = {
      identifier: "intro_audio",
      assetId: foreignAudio.id,
      assetVersion: 1,
      role: "AUDIO",
    };
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: foreignDefinition })))
      .rejects.toBeInstanceOf(ValidationError);

    const missingVersion = structuredClone(base);
    missingVersion.assetAssociations[0]!.assetVersion = 99;
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: missingVersion })))
      .rejects.toBeInstanceOf(ValidationError);

    const wrongType = structuredClone(base);
    wrongType.assetAssociations[0]!.assetId = vfx.id;
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: wrongType })))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("validates Entity, archetype and category overrides without changing Entities", async () => {
    const owner = await account();
    const foreign = await account();
    const lion = await createEntity(owner.user.id, owner.workspaceId, { name: "Lion", category: "creature" });
    const foreignEntity = await createEntity(foreign.user.id, foreign.workspaceId, { name: "Foreign", category: "creature" });
    const definition = withBinding(EXPERIENCE_PRESETS[0]!.definition, 1, {
      override: { kind: "ENTITY", value: lion.id },
    });
    const profile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition }));
    expect(profile.entities).toEqual([expect.objectContaining({ entityId: lion.id, entityName: "Lion" })]);
    expect((await prisma.entity.findUniqueOrThrow({ where: { id: lion.id } })).name).toBe("Lion");

    const foreignDefinition = withBinding(EXPERIENCE_PRESETS[0]!.definition, 1, {
      override: { kind: "ENTITY", value: foreignEntity.id },
    });
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: foreignDefinition })))
      .rejects.toBeInstanceOf(ValidationError);

    const unknownArchetype = withBinding(EXPERIENCE_PRESETS[0]!.definition, 1, {
      override: { kind: "ARCHETYPE", value: "DRAGON" },
    });
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: unknownArchetype })))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("pins workspace World versions and validates presentation zones", async () => {
    const owner = await account();
    const foreign = await account();
    const world = await createWorld(owner.user.id, owner.workspaceId, worldInput());
    const foreignWorld = await createWorld(foreign.user.id, foreign.workspaceId, worldInput());
    const base = structuredClone(EXPERIENCE_PRESETS[0]!.definition);
    base.worldAssociations = [{
      worldId: world.id,
      worldVersion: 1,
      preferredCameraZone: "overview_camera",
      resultZonePreference: "watering_hole",
      vfxSurfaceResponseCategory: "dry-grass",
      ambientIntensity: 0.7,
      lightingCue: "warm-morning",
      weatherPresentationCue: "dust-response",
    }];
    base.eventBindings[0]!.camera!.worldCameraZonePreference = "overview_camera";
    const profile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: base }));
    expect(profile.worlds[0]).toMatchObject({ worldId: world.id, worldVersion: 1, preferredCameraZone: "overview_camera" });

    const unknownZone = structuredClone(base);
    unknownZone.worldAssociations[0]!.preferredCameraZone = "missing_zone";
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: unknownZone })))
      .rejects.toBeInstanceOf(ValidationError);

    const foreignDefinition = structuredClone(base);
    foreignDefinition.worldAssociations[0]!.worldId = foreignWorld.id;
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: foreignDefinition })))
      .rejects.toBeInstanceOf(ValidationError);
  });
});

describe("Experience Profile semantic validation and presets", () => {
  it("rejects unknown events, animation semantics and non-authoritative conditions", async () => {
    const owner = await account();
    const unknownEvent = withBinding(EXPERIENCE_PRESETS[0]!.definition, 0, { eventType: "battle.invented" });
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: unknownEvent })))
      .rejects.toBeInstanceOf(ValidationError);
    const unknownAnimation = withBinding(EXPERIENCE_PRESETS[0]!.definition, 1, { animation: { actor: "ROAR" } });
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: unknownAnimation })))
      .rejects.toBeInstanceOf(ValidationError);
    const invalidCondition = withBinding(EXPERIENCE_PRESETS[0]!.definition, 0, {
      condition: { field: "payload.amount", operator: "GTE", value: 10 },
    });
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: invalidCondition })))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects duplicate selectors, dangling cue references and unbounded timing or intensity", async () => {
    const owner = await account();
    const duplicate = structuredClone(EXPERIENCE_PRESETS[0]!.definition);
    duplicate.eventBindings.push({ ...structuredClone(duplicate.eventBindings[0]!), identifier: "second_intro" });
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: duplicate })))
      .rejects.toBeInstanceOf(ValidationError);

    const dangling = withBinding(EXPERIENCE_PRESETS[0]!.definition, 0, {
      audio: { cue: "INTRO", assetIdentifier: "missing_audio" },
    });
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: dangling })))
      .rejects.toBeInstanceOf(ValidationError);

    const excessiveTiming = structuredClone(EXPERIENCE_PRESETS[0]!.definition);
    excessiveTiming.eventBindings[0]!.timing.holdMs = 60_001;
    excessiveTiming.eventBindings[0]!.intensity.camera = 1.1;
    await expect(createExperienceProfile(owner.user.id, owner.workspaceId, profileInput({ definition: excessiveTiming })))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("ships original presets that cover every authoritative Battle v1 event with standard animation semantics", () => {
    expect(EXPERIENCE_PRESETS.map((preset) => preset.id)).toEqual([
      "simverse-cinematic-battle-v1",
      "competitive",
      "broadcast",
      "minimal",
      "dramatic",
      "documentary",
      "cinematic",
    ]);
    expect(new Set(CINEMATIC_BATTLE_BINDINGS.map((binding) => binding.eventType)))
      .toEqual(new Set(BATTLE_EXPERIENCE_EVENT_TYPES));
    for (const binding of CINEMATIC_BATTLE_BINDINGS) {
      for (const animation of [binding.animation?.actor, binding.animation?.target]) {
        if (animation) expect(ANIMATION_STATES).toContain(animation);
      }
    }
  });
});

describe("Simulation integration and immutable Run presentation truth", () => {
  it("keeps legacy Simulations valid and rejects foreign or incompatible profile bindings", async () => {
    const owner = await account();
    const foreign = await account();
    const project = await createProject(owner.user.id, owner.workspaceId, { name: "Legacy Project" });
    const legacy = await createSimulation(owner.user.id, owner.workspaceId, {
      projectId: project.id,
      name: "Legacy Simulation",
      mode: "test-sequence",
      seed: "SV-LEGACY01",
    });
    expect(legacy).toMatchObject({ experienceProfileId: null, experienceProfileVersion: null });

    const foreignProfile = await createExperienceProfile(foreign.user.id, foreign.workspaceId, profileInput());
    await expect(createSimulation(owner.user.id, owner.workspaceId, {
      projectId: project.id,
      name: "Foreign Binding",
      mode: "battle",
      experienceProfileId: foreignProfile.id,
      experienceProfileVersion: 1,
    })).rejects.toBeInstanceOf(ValidationError);

    const localProfile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    await expect(createSimulation(owner.user.id, owner.workspaceId, {
      projectId: project.id,
      name: "Incompatible Binding",
      mode: "test-sequence",
      experienceProfileId: localProfile.id,
      experienceProfileVersion: 1,
    })).rejects.toBeInstanceOf(ValidationError);

    await archiveExperienceProfile(owner.user.id, owner.workspaceId, localProfile.id);
    await restoreExperienceProfile(owner.user.id, owner.workspaceId, localProfile.id);
    expect((await listExperienceBindingOptions(owner.user.id, owner.workspaceId))
      .filter((option) => option.experienceProfileId === localProfile.id)
      .map((option) => option.version)).toEqual([3, 1]);
    await expect(createSimulation(owner.user.id, owner.workspaceId, {
      projectId: project.id,
      name: "Archived Version Binding",
      mode: "battle",
      experienceProfileId: localProfile.id,
      experienceProfileVersion: 2,
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("freezes the complete selected profile version into a Run without mutating historical truth", async () => {
    const owner = await account();
    const profile = await createExperienceProfile(owner.user.id, owner.workspaceId, profileInput());
    const simulation = await battleSimulation(owner.user.id, owner.workspaceId, profile.id, 1);
    const run = await createSimulationRun(owner.user.id, owner.workspaceId, simulation.id);
    expect(run.inputSnapshot.experienceProfile).toMatchObject({
      snapshotVersion: 1,
      experienceProfileId: profile.id,
      version: 1,
      name: "SIMVERSE Cinematic Battle",
      preset: "CINEMATIC",
    });
    expect(run.inputSnapshot.experienceProfile?.definition.eventBindings).toHaveLength(
      profile.version.definition.eventBindings.length,
    );
    const before = (await prisma.simulationRun.findUniqueOrThrow({ where: { id: run.id } })).inputSnapshot;

    await updateExperienceProfile(owner.user.id, owner.workspaceId, profile.id, {
      name: "Changed After Run",
      status: "IN_DESIGN",
      changeNote: "Later direction",
    });
    await archiveExperienceProfile(owner.user.id, owner.workspaceId, profile.id);
    const historical = await getSimulationRun(owner.user.id, owner.workspaceId, run.id);
    const stored = await prisma.simulationRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(stored.inputSnapshot).toBe(before);
    expect(historical.inputSnapshot.experienceProfile?.name).toBe("SIMVERSE Cinematic Battle");
    await expect(createSimulationRun(owner.user.id, owner.workspaceId, simulation.id))
      .rejects.toBeInstanceOf(ValidationError);
  });
});
