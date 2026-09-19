import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import { DEFAULT_VISUAL_PROFILE } from "@/lib/visuals/profile";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";
import { registerUser } from "./auth-service";
import {
  archiveEntity,
  createEntity,
  deleteEntityVisualProfile,
  deleteEntity,
  duplicateEntity,
  getEntityVisualProfile,
  restoreEntity,
  upsertEntityVisualProfile,
} from "./entity-service";

beforeEach(async () => { await resetDb(); });
let sequence = 0;
async function account() {
  sequence += 1;
  return registerUser({
    displayName: `Visual User ${sequence}`,
    email: `visual-${sequence}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

const modelProfile = {
  ...DEFAULT_VISUAL_PROFILE,
  sourceType: "MODEL_3D" as const,
  modelUrl: "/models/simverse-sentinel.gltf",
  portraitUrl: "https://example.com/sentinel.png",
  archetype: "ROBOT" as const,
  scale: 1.2,
  rotationY: 90,
  animationProfile: { IDLE: "idle", ATTACK_PRIMARY: "attack_1", VICTORY: "victory" },
};

describe("Entity Visual Profile service", () => {
  it("creates, reads and updates a durable profile with a revision", async () => {
    const owner = await account();
    const entity = await createEntity(owner.user.id, owner.workspaceId, { name: "Sentinel", category: "robot" });
    const created = await upsertEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id, modelProfile);
    expect(created).toMatchObject({ entityId: entity.id, archetype: "ROBOT", revision: 1 });
    expect((await getEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id))?.animationProfile)
      .toMatchObject({ ATTACK_PRIMARY: "attack_1" });
    const updated = await upsertEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id, {
      ...modelProfile, archetype: "QUADRUPED", scale: 0.8,
    });
    expect(updated).toMatchObject({ archetype: "QUADRUPED", scale: 0.8, revision: 2 });
  });

  it("rejects invalid values and enforces view/edit permissions plus workspace isolation", async () => {
    const owner = await account();
    const viewer = await account();
    const foreign = await account();
    const entity = await createEntity(owner.user.id, owner.workspaceId, { name: "Private", category: "object" });
    await prisma.workspaceMember.create({ data: { workspaceId: owner.workspaceId, userId: viewer.user.id, role: "VIEWER" } });
    await expect(upsertEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id, {
      ...modelProfile, archetype: "BIRD",
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(upsertEntityVisualProfile(viewer.user.id, owner.workspaceId, entity.id, modelProfile))
      .rejects.toBeInstanceOf(AuthorizationError);
    expect(await getEntityVisualProfile(viewer.user.id, owner.workspaceId, entity.id)).toBeNull();
    await expect(getEntityVisualProfile(foreign.user.id, foreign.workspaceId, entity.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("copies configuration independently and preserves it through archive/restore", async () => {
    const owner = await account();
    const entity = await createEntity(owner.user.id, owner.workspaceId, { name: "Lion", category: "animal" });
    await upsertEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id, { ...modelProfile, archetype: "QUADRUPED" });
    const copy = await duplicateEntity(owner.user.id, owner.workspaceId, entity.id);
    const copyProfile = await getEntityVisualProfile(owner.user.id, owner.workspaceId, copy.id);
    expect(copyProfile).toMatchObject({ archetype: "QUADRUPED", revision: 1 });
    expect(copyProfile?.id).not.toBe((await getEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id))?.id);
    await upsertEntityVisualProfile(owner.user.id, owner.workspaceId, copy.id, { ...modelProfile, archetype: "VEHICLE_GROUND" });
    expect((await getEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id))?.archetype).toBe("QUADRUPED");
    await archiveEntity(owner.user.id, owner.workspaceId, entity.id);
    await restoreEntity(owner.user.id, owner.workspaceId, entity.id);
    expect((await getEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id))?.archetype).toBe("QUADRUPED");
  });

  it("cascades the profile when its Entity is permanently deleted", async () => {
    const owner = await account();
    const entity = await createEntity(owner.user.id, owner.workspaceId, { name: "Temporary", category: "object" });
    await upsertEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id, modelProfile);
    await deleteEntity(owner.user.id, owner.workspaceId, entity.id);
    expect(await prisma.entityVisualProfile.count({ where: { entityId: entity.id } })).toBe(0);
  });

  it("deletes visual configuration without deleting the Entity", async () => {
    const owner = await account();
    const entity = await createEntity(owner.user.id, owner.workspaceId, { name: "Fallback", category: "abstract" });
    await upsertEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id, modelProfile);
    await deleteEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id);
    expect(await getEntityVisualProfile(owner.user.id, owner.workspaceId, entity.id)).toBeNull();
    expect(await prisma.entity.findUnique({ where: { id: entity.id } })).not.toBeNull();
  });
});
