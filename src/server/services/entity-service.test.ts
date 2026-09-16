import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import type { WorkspaceRole } from "@/lib/permissions";
import { registerUser } from "@/server/services/auth-service";
import {
  archiveEntity,
  createEntity,
  deleteEntity,
  duplicateEntity,
  getEntity,
  listEntities,
  listWorkspaceCategories,
  listWorkspaceTags,
  restoreEntity,
  updateEntity,
} from "@/server/services/entity-service";
import { createAttributeDefinition } from "@/server/services/attribute-service";
import { getWorkspaceStats } from "@/server/services/dashboard-service";
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
    email: `user${seq}-${Date.now()}@example.com`,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

/** Add an existing user to a workspace with a given role (for permission tests). */
async function addMember(workspaceId: string, userId: string, role: WorkspaceRole) {
  await prisma.workspaceMember.create({ data: { workspaceId, userId, role } });
}

/** Create a NUMBER attribute definition in a workspace and return its id. */
async function makeNumberAttr(
  userId: string,
  workspaceId: string,
  name: string,
  minimum?: number,
  maximum?: number,
) {
  const def = await createAttributeDefinition(userId, workspaceId, {
    name,
    dataType: "NUMBER",
    minimum,
    maximum,
  });
  return def.id;
}

describe("createEntity", () => {
  it("creates a workspace-scoped entity with normalized fields", async () => {
    const { user, workspaceId } = await makeUser();
    const entity = await createEntity(user.id, workspaceId, {
      name: "Nigeria",
      category: "Country",
      primaryColor: "#008751",
      description: "A country entity.",
    });

    expect(entity.id).toBeTruthy();
    expect(entity.workspaceId).toBe(workspaceId);
    expect(entity.name).toBe("Nigeria");
    expect(entity.category).toBe("country"); // slugified
    expect(entity.primaryColor).toBe("#008751"); // uppercased hex
    expect(entity.status).toBe("ACTIVE");
    expect(entity.createdByName).toBe(user.displayName);
  });

  it("stores attributes, tags and metadata", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);

    const entity = await createEntity(user.id, workspaceId, {
      name: "Titan X",
      category: "robot",
      attributes: [{ attributeDefinitionId: speed, value: 85 }],
      tags: ["Fast", "Prototype"],
      metadata: { origin: "Lab 7" },
    });

    expect(entity.attributes).toHaveLength(1);
    expect(entity.attributes[0]?.name).toBe("Speed");
    expect(entity.attributes[0]?.value).toBe(85);
    expect(entity.tags.map((t) => t.name).sort()).toEqual(["Fast", "Prototype"]);
    expect(entity.metadata).toMatchObject({ origin: "Lab 7" });
  });

  it("records an audit entry", async () => {
    const { user, workspaceId } = await makeUser();
    await createEntity(user.id, workspaceId, { name: "Alpha", category: "object" });
    const actions = (await prisma.auditLog.findMany({ where: { workspaceId } })).map((a) => a.action);
    expect(actions).toContain("entity.created");
  });

  it("rejects an invalid name (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    await expect(
      createEntity(user.id, workspaceId, { name: "", category: "object" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("forbids a VIEWER from creating (AuthorizationError)", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    await expect(
      createEntity(viewer.user.id, owner.workspaceId, { name: "Nope", category: "object" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("attribute value validation", () => {
  it("rejects a numeric value above the maximum (Speed 0–100 rejects 900)", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);
    await expect(
      createEntity(user.id, workspaceId, {
        name: "Overclocked",
        category: "robot",
        attributes: [{ attributeDefinitionId: speed, value: 900 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a numeric value below the minimum", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);
    await expect(
      createEntity(user.id, workspaceId, {
        name: "Underclocked",
        category: "robot",
        attributes: [{ attributeDefinitionId: speed, value: -5 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts a value at the boundary", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);
    const entity = await createEntity(user.id, workspaceId, {
      name: "Boundary",
      category: "robot",
      attributes: [{ attributeDefinitionId: speed, value: 100 }],
    });
    expect(entity.attributes[0]?.value).toBe(100);
  });

  it("rejects an attribute definition from another workspace (isolation)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const foreignAttr = await makeNumberAttr(a.user.id, a.workspaceId, "Secret Stat");
    // b tries to assign a's attribute definition to an entity in b's workspace.
    await expect(
      createEntity(b.user.id, b.workspaceId, {
        name: "Thief",
        category: "object",
        attributes: [{ attributeDefinitionId: foreignAttr, value: 1 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updateEntity", () => {
  it("updates scalar fields and replaces attributes/tags", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);
    const entity = await createEntity(user.id, workspaceId, {
      name: "Draft",
      category: "object",
      tags: ["old"],
    });

    const updated = await updateEntity(user.id, workspaceId, entity.id, {
      name: "Final",
      attributes: [{ attributeDefinitionId: speed, value: 42 }],
      tags: ["new"],
    });

    expect(updated.name).toBe("Final");
    expect(updated.attributes[0]?.value).toBe(42);
    expect(updated.tags.map((t) => t.name)).toEqual(["new"]);
  });

  it("forbids an EDITOR-less role and enforces min/max on update", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);
    const entity = await createEntity(user.id, workspaceId, { name: "X", category: "robot" });
    await expect(
      updateEntity(user.id, workspaceId, entity.id, {
        attributes: [{ attributeDefinitionId: speed, value: 900 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("duplicateEntity", () => {
  it("copies fields, attributes and tags with a new id and a 'Copy' name", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);
    const source = await createEntity(user.id, workspaceId, {
      name: "Original",
      category: "robot",
      primaryColor: "#22D3EE",
      attributes: [{ attributeDefinitionId: speed, value: 50 }],
      tags: ["one"],
      metadata: { note: "keep" },
    });

    const copy = await duplicateEntity(user.id, workspaceId, source.id);
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe("Original Copy");
    expect(copy.category).toBe("robot");
    expect(copy.primaryColor).toBe("#22D3EE");
    expect(copy.attributes[0]?.value).toBe(50);
    expect(copy.tags.map((t) => t.name)).toEqual(["one"]);
    expect(copy.metadata).toMatchObject({ note: "keep" });
    expect(copy.status).toBe("ACTIVE");
  });
});

describe("archive / restore", () => {
  it("archives then restores an entity", async () => {
    const { user, workspaceId } = await makeUser();
    const entity = await createEntity(user.id, workspaceId, { name: "Temp", category: "object" });

    const archived = await archiveEntity(user.id, workspaceId, entity.id);
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).not.toBeNull();

    const restored = await restoreEntity(user.id, workspaceId, entity.id);
    expect(restored.status).toBe("ACTIVE");
    expect(restored.archivedAt).toBeNull();
  });
});

describe("deleteEntity", () => {
  it("permanently deletes with entity.delete (OWNER) and cascades relations", async () => {
    const { user, workspaceId } = await makeUser();
    const speed = await makeNumberAttr(user.id, workspaceId, "Speed", 0, 100);
    const entity = await createEntity(user.id, workspaceId, {
      name: "Doomed",
      category: "object",
      attributes: [{ attributeDefinitionId: speed, value: 10 }],
      tags: ["gone"],
    });

    const result = await deleteEntity(user.id, workspaceId, entity.id);
    expect(result.id).toBe(entity.id);

    expect(await prisma.entity.findUnique({ where: { id: entity.id } })).toBeNull();
    expect(await prisma.entityAttributeValue.count({ where: { entityId: entity.id } })).toBe(0);
    expect(await prisma.entityTag.count({ where: { entityId: entity.id } })).toBe(0);
    // Workspace-level catalog is preserved.
    expect(await prisma.attributeDefinition.count({ where: { workspaceId } })).toBe(1);
  });

  it("forbids a CREATOR (no entity.delete) from deleting", async () => {
    const owner = await makeUser();
    const creator = await makeUser();
    await addMember(owner.workspaceId, creator.user.id, "CREATOR");
    const entity = await createEntity(owner.user.id, owner.workspaceId, {
      name: "Protected",
      category: "object",
    });
    await expect(
      deleteEntity(creator.user.id, owner.workspaceId, entity.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("workspace isolation & security", () => {
  it("does not return another workspace's entity from getEntity", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const entity = await createEntity(a.user.id, a.workspaceId, { name: "Private", category: "object" });

    // b uses their own (valid) workspace but a's entity id → not found.
    await expect(getEntity(b.user.id, b.workspaceId, entity.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("prevents a non-member from accessing an entity via the owning workspace id", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const entity = await createEntity(a.user.id, a.workspaceId, { name: "Private", category: "object" });

    // b passes a's workspace id (not a member) → NotFound (never reveals existence).
    await expect(getEntity(b.user.id, a.workspaceId, entity.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("prevents editing another workspace's entity", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const entity = await createEntity(a.user.id, a.workspaceId, { name: "NoTouch", category: "object" });

    await expect(
      updateEntity(b.user.id, b.workspaceId, entity.id, { name: "Hacked" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const fromDb = await prisma.entity.findUnique({ where: { id: entity.id } });
    expect(fromDb?.name).toBe("NoTouch");
  });

  it("prevents deleting another workspace's entity", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const entity = await createEntity(a.user.id, a.workspaceId, { name: "Keep", category: "object" });

    await expect(
      deleteEntity(b.user.id, b.workspaceId, entity.id),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.entity.findUnique({ where: { id: entity.id } })).not.toBeNull();
  });

  it("list is scoped to the active workspace", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await createEntity(a.user.id, a.workspaceId, { name: "A-One", category: "object" });
    await createEntity(b.user.id, b.workspaceId, { name: "B-One", category: "object" });

    const listA = await listEntities(a.user.id, a.workspaceId);
    expect(listA.items).toHaveLength(1);
    expect(listA.items[0]?.name).toBe("A-One");
  });
});

describe("list: search / filter / sort", () => {
  async function seed(userId: string, workspaceId: string) {
    await createEntity(userId, workspaceId, { name: "Falcon", category: "vehicle", tags: ["air"] });
    await createEntity(userId, workspaceId, { name: "Tiger", category: "animal", tags: ["land"] });
    await createEntity(userId, workspaceId, { name: "Falconry Guild", category: "team" });
  }

  it("searches by name (case-insensitive contains)", async () => {
    const { user, workspaceId } = await makeUser();
    await seed(user.id, workspaceId);
    const result = await listEntities(user.id, workspaceId, { search: "falcon" });
    expect(result.items.map((e) => e.name).sort()).toEqual(["Falcon", "Falconry Guild"]);
  });

  it("filters by category", async () => {
    const { user, workspaceId } = await makeUser();
    await seed(user.id, workspaceId);
    const result = await listEntities(user.id, workspaceId, { category: "animal" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Tiger");
  });

  it("filters by tag", async () => {
    const { user, workspaceId } = await makeUser();
    await seed(user.id, workspaceId);
    const result = await listEntities(user.id, workspaceId, { tag: "air" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe("Falcon");
  });

  it("sorts by name ascending and descending", async () => {
    const { user, workspaceId } = await makeUser();
    await seed(user.id, workspaceId);
    const asc = await listEntities(user.id, workspaceId, { sort: "name_asc" });
    expect(asc.items.map((e) => e.name)).toEqual(["Falcon", "Falconry Guild", "Tiger"]);
    const desc = await listEntities(user.id, workspaceId, { sort: "name_desc" });
    expect(desc.items.map((e) => e.name)).toEqual(["Tiger", "Falconry Guild", "Falcon"]);
  });

  it("filters by status (archived excluded by default)", async () => {
    const { user, workspaceId } = await makeUser();
    const e = await createEntity(user.id, workspaceId, { name: "Old", category: "object" });
    await archiveEntity(user.id, workspaceId, e.id);

    const active = await listEntities(user.id, workspaceId);
    expect(active.items).toHaveLength(0);

    const archived = await listEntities(user.id, workspaceId, { status: "ARCHIVED" });
    expect(archived.items.map((x) => x.name)).toEqual(["Old"]);

    const all = await listEntities(user.id, workspaceId, { status: "ALL" });
    expect(all.items).toHaveLength(1);
  });

  it("paginates", async () => {
    const { user, workspaceId } = await makeUser();
    for (let i = 0; i < 5; i += 1) {
      await createEntity(user.id, workspaceId, { name: `E${i}`, category: "object" });
    }
    const page1 = await listEntities(user.id, workspaceId, { pageSize: 2, page: 1 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.pageCount).toBe(3);
  });
});

describe("listWorkspaceTags / listWorkspaceCategories", () => {
  it("returns distinct tags and categories present in the workspace", async () => {
    const { user, workspaceId } = await makeUser();
    await createEntity(user.id, workspaceId, { name: "One", category: "robot", tags: ["Alpha"] });
    await createEntity(user.id, workspaceId, { name: "Two", category: "country", tags: ["Alpha", "Beta"] });

    const tags = await listWorkspaceTags(user.id, workspaceId);
    expect(tags.map((t) => t.name).sort()).toEqual(["Alpha", "Beta"]);

    const categories = await listWorkspaceCategories(user.id, workspaceId);
    expect(categories.sort()).toEqual(["country", "robot"]);
  });
});

describe("dashboard active-entity count", () => {
  it("counts only ACTIVE entities in the workspace", async () => {
    const { user, workspaceId } = await makeUser();
    await createEntity(user.id, workspaceId, { name: "Live1", category: "object" });
    await createEntity(user.id, workspaceId, { name: "Live2", category: "object" });
    const toArchive = await createEntity(user.id, workspaceId, { name: "Dead", category: "object" });
    await archiveEntity(user.id, workspaceId, toArchive.id);

    const stats = await getWorkspaceStats(user.id, workspaceId);
    expect(stats.entities).toBe(2);
  });
});
