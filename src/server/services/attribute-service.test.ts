import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import type { WorkspaceRole } from "@/lib/permissions";
import { registerUser } from "@/server/services/auth-service";
import {
  createAttributeDefinition,
  getAttributeDefinition,
  listAttributeDefinitions,
  materializeAttributePreset,
  updateAttributeDefinition,
} from "@/server/services/attribute-service";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";

beforeEach(async () => {
  await resetDb();
});

let seq = 0;
async function makeUser() {
  seq += 1;
  return registerUser({
    displayName: `User ${seq}`,
    email: `attr${seq}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}

describe("createAttributeDefinition", () => {
  it("creates a custom NUMBER definition with a slugified key", async () => {
    const { user, workspaceId } = await makeUser();
    const def = await createAttributeDefinition(user.id, workspaceId, {
      name: "Top Speed",
      dataType: "NUMBER",
      unit: "km/h",
      minimum: 0,
      maximum: 400,
    });

    expect(def.id).toBeTruthy();
    expect(def.workspaceId).toBe(workspaceId);
    expect(def.key).toBe("top-speed");
    expect(def.dataType).toBe("NUMBER");
    expect(def.unit).toBe("km/h");
    expect(def.minimum).toBe(0);
    expect(def.maximum).toBe(400);
    expect(def.isBuiltIn).toBe(false);
  });

  it("creates a SELECT definition with options", async () => {
    const { user, workspaceId } = await makeUser();
    const def = await createAttributeDefinition(user.id, workspaceId, {
      name: "Element",
      dataType: "SELECT",
      options: ["Fire", "Water", "Earth"],
    });
    expect(def.dataType).toBe("SELECT");
    expect(def.options).toEqual(["Fire", "Water", "Earth"]);
  });

  it("rejects a duplicate key within the workspace (ConflictError)", async () => {
    const { user, workspaceId } = await makeUser();
    await createAttributeDefinition(user.id, workspaceId, { name: "Speed", dataType: "NUMBER" });
    // "speed" and "Speed" collapse to the same key.
    await expect(
      createAttributeDefinition(user.id, workspaceId, { name: "speed", dataType: "NUMBER" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects minimum greater than maximum (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    await expect(
      createAttributeDefinition(user.id, workspaceId, {
        name: "Bad Range",
        dataType: "NUMBER",
        minimum: 100,
        maximum: 0,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a SELECT with no options (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    await expect(
      createAttributeDefinition(user.id, workspaceId, { name: "Empty Choice", dataType: "SELECT" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("records an audit entry", async () => {
    const { user, workspaceId } = await makeUser();
    await createAttributeDefinition(user.id, workspaceId, { name: "Morale", dataType: "NUMBER" });
    const actions = (await prisma.auditLog.findMany({ where: { workspaceId } })).map((a) => a.action);
    expect(actions).toContain("attribute.created");
  });

  it("forbids a VIEWER from creating (AuthorizationError)", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    await expect(
      createAttributeDefinition(viewer.user.id, owner.workspaceId, { name: "Nope", dataType: "NUMBER" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("materializeAttributePreset", () => {
  it("creates a built-in preset definition (Speed 0–100)", async () => {
    const { user, workspaceId } = await makeUser();
    const def = await materializeAttributePreset(user.id, workspaceId, "speed");
    expect(def.key).toBe("speed");
    expect(def.name).toBe("Speed");
    expect(def.dataType).toBe("NUMBER");
    expect(def.minimum).toBe(0);
    expect(def.maximum).toBe(100);
    expect(def.defaultValue).toBe("50");
    expect(def.isBuiltIn).toBe(true);
  });

  it("is idempotent — returns the existing definition on a second call", async () => {
    const { user, workspaceId } = await makeUser();
    const first = await materializeAttributePreset(user.id, workspaceId, "strength");
    const second = await materializeAttributePreset(user.id, workspaceId, "strength");
    expect(second.id).toBe(first.id);
    expect(await prisma.attributeDefinition.count({ where: { workspaceId } })).toBe(1);
  });

  it("rejects an unknown preset (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    await expect(
      materializeAttributePreset(user.id, workspaceId, "not-a-preset"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updateAttributeDefinition", () => {
  it("updates editable fields (name, unit, bounds)", async () => {
    const { user, workspaceId } = await makeUser();
    const def = await createAttributeDefinition(user.id, workspaceId, {
      name: "Speed",
      dataType: "NUMBER",
      minimum: 0,
      maximum: 100,
    });
    const updated = await updateAttributeDefinition(user.id, workspaceId, def.id, {
      name: "Velocity",
      unit: "m/s",
      maximum: 200,
    });
    expect(updated.name).toBe("Velocity");
    expect(updated.key).toBe("velocity"); // key follows the renamed name
    expect(updated.unit).toBe("m/s");
    expect(updated.maximum).toBe(200);
    expect(updated.dataType).toBe("NUMBER"); // dataType is immutable
  });

  it("rejects a rename that collides with another definition (ConflictError)", async () => {
    const { user, workspaceId } = await makeUser();
    await createAttributeDefinition(user.id, workspaceId, { name: "Speed", dataType: "NUMBER" });
    const other = await createAttributeDefinition(user.id, workspaceId, { name: "Strength", dataType: "NUMBER" });
    await expect(
      updateAttributeDefinition(user.id, workspaceId, other.id, { name: "Speed" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("forbids a VIEWER from updating (AuthorizationError)", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const def = await createAttributeDefinition(owner.user.id, owner.workspaceId, {
      name: "Speed",
      dataType: "NUMBER",
    });
    await expect(
      updateAttributeDefinition(viewer.user.id, owner.workspaceId, def.id, { name: "Hax" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("listAttributeDefinitions & workspace isolation", () => {
  it("lists only the active workspace's definitions", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await createAttributeDefinition(a.user.id, a.workspaceId, { name: "A-Speed", dataType: "NUMBER" });
    await createAttributeDefinition(b.user.id, b.workspaceId, { name: "B-Power", dataType: "NUMBER" });

    const listA = await listAttributeDefinitions(a.user.id, a.workspaceId);
    expect(listA.map((d) => d.name)).toEqual(["A-Speed"]);

    const listB = await listAttributeDefinitions(b.user.id, b.workspaceId);
    expect(listB.map((d) => d.name)).toEqual(["B-Power"]);
  });

  it("does not expose another workspace's definition via getAttributeDefinition", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const secret = await createAttributeDefinition(a.user.id, a.workspaceId, {
      name: "Secret Stat",
      dataType: "NUMBER",
    });

    // b uses their own workspace but a's definition id → not found.
    await expect(
      getAttributeDefinition(b.user.id, b.workspaceId, secret.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("prevents a non-member from reading definitions via the owning workspace id", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await createAttributeDefinition(a.user.id, a.workspaceId, { name: "Private", dataType: "NUMBER" });

    // b passes a's workspace id but is not a member → NotFound (isolation).
    await expect(
      listAttributeDefinitions(b.user.id, a.workspaceId),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
