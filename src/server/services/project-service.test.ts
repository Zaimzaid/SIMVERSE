import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError, ValidationError } from "@/lib/errors";
import type { WorkspaceRole } from "@/lib/permissions";
import { registerUser } from "@/server/services/auth-service";
import {
  addProjectEntities,
  archiveProject,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  removeProjectEntity,
  restoreProject,
  updateProject,
} from "@/server/services/project-service";
import { createEntity } from "@/server/services/entity-service";
import { createSimulation } from "@/server/services/simulation-service";
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

describe("createProject", () => {
  it("creates a workspace-scoped project with a slug and ACTIVE status", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, {
      name: "African Nations",
      description: "A body of work.",
    });

    expect(project.id).toBeTruthy();
    expect(project.workspaceId).toBe(workspaceId);
    expect(project.name).toBe("African Nations");
    expect(project.slug).toBe("african-nations"); // slugified
    expect(project.status).toBe("ACTIVE");
    expect(project.entityCount).toBe(0);
    expect(project.simulationCount).toBe(0);
    expect(project.createdByName).toBe(user.displayName);
  });

  it("records an audit entry", async () => {
    const { user, workspaceId } = await makeUser();
    await createProject(user.id, workspaceId, { name: "Audited" });
    const actions = (await prisma.auditLog.findMany({ where: { workspaceId } })).map((a) => a.action);
    expect(actions).toContain("project.created");
  });

  it("rejects an empty name (ValidationError)", async () => {
    const { user, workspaceId } = await makeUser();
    await expect(createProject(user.id, workspaceId, { name: "" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("forbids a VIEWER from creating (AuthorizationError)", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    await expect(
      createProject(viewer.user.id, owner.workspaceId, { name: "Nope" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("updateProject", () => {
  it("updates scalar fields and re-slugs on a name change", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Draft Name" });

    const updated = await updateProject(user.id, workspaceId, project.id, {
      name: "Final Name",
      description: "Now described.",
    });

    expect(updated.name).toBe("Final Name");
    expect(updated.slug).toBe("final-name");
    expect(updated.description).toBe("Now described.");
  });
});

describe("archive / restore", () => {
  it("archives then restores a project", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Temp" });

    const archived = await archiveProject(user.id, workspaceId, project.id);
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).not.toBeNull();

    const restored = await restoreProject(user.id, workspaceId, project.id);
    expect(restored.status).toBe("ACTIVE");
    expect(restored.archivedAt).toBeNull();
  });

  it("archiving a project never touches its linked entities", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Container" });
    const entity = await createEntity(user.id, workspaceId, { name: "Shared", category: "object" });
    await addProjectEntities(user.id, workspaceId, project.id, { entityIds: [entity.id] });

    await archiveProject(user.id, workspaceId, project.id);

    // The Entity and its link both survive — archiving is a status change only.
    expect(await prisma.entity.findUnique({ where: { id: entity.id } })).not.toBeNull();
    expect(
      await prisma.projectEntity.count({ where: { projectId: project.id, entityId: entity.id } }),
    ).toBe(1);
  });
});

describe("deleteProject", () => {
  it("deletes the project and cascades links + owned simulations, but never the shared entities", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Doomed" });
    const entity = await createEntity(user.id, workspaceId, { name: "Survivor", category: "object" });
    await addProjectEntities(user.id, workspaceId, project.id, { entityIds: [entity.id] });
    const simulation = await createSimulation(user.id, workspaceId, {
      projectId: project.id,
      name: "Owned Sim",
      mode: "battle",
      participants: [{ entityId: entity.id }],
    });

    const result = await deleteProject(user.id, workspaceId, project.id);
    expect(result.id).toBe(project.id);

    // Project, its entity links and its owned simulations are gone…
    expect(await prisma.project.findUnique({ where: { id: project.id } })).toBeNull();
    expect(await prisma.projectEntity.count({ where: { projectId: project.id } })).toBe(0);
    expect(await prisma.simulation.findUnique({ where: { id: simulation.id } })).toBeNull();
    expect(await prisma.simulationEntity.count({ where: { simulationId: simulation.id } })).toBe(0);
    // …but the shared Entity itself is preserved.
    expect(await prisma.entity.findUnique({ where: { id: entity.id } })).not.toBeNull();
  });

  it("forbids a CREATOR (no project.delete) from deleting", async () => {
    const owner = await makeUser();
    const creator = await makeUser();
    await addMember(owner.workspaceId, creator.user.id, "CREATOR");
    const project = await createProject(owner.user.id, owner.workspaceId, { name: "Protected" });
    await expect(
      deleteProject(creator.user.id, owner.workspaceId, project.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("workspace isolation & security", () => {
  it("does not return another workspace's project from getProject", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const project = await createProject(a.user.id, a.workspaceId, { name: "Private" });

    // b uses their own (valid) workspace but a's project id → not found.
    await expect(getProject(b.user.id, b.workspaceId, project.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("prevents a non-member from accessing a project via the owning workspace id", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const project = await createProject(a.user.id, a.workspaceId, { name: "Private" });

    // b passes a's workspace id (not a member) → NotFound (never reveals existence).
    await expect(getProject(b.user.id, a.workspaceId, project.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("prevents editing another workspace's project", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const project = await createProject(a.user.id, a.workspaceId, { name: "NoTouch" });

    await expect(
      updateProject(b.user.id, b.workspaceId, project.id, { name: "Hacked" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const fromDb = await prisma.project.findUnique({ where: { id: project.id } });
    expect(fromDb?.name).toBe("NoTouch");
  });

  it("list is scoped to the active workspace", async () => {
    const a = await makeUser();
    const b = await makeUser();
    await createProject(a.user.id, a.workspaceId, { name: "A-One" });
    await createProject(b.user.id, b.workspaceId, { name: "B-One" });

    const listA = await listProjects(a.user.id, a.workspaceId);
    expect(listA.items).toHaveLength(1);
    expect(listA.items[0]?.name).toBe("A-One");
  });
});

describe("project ↔ entity links", () => {
  it("adds existing entities to a project by reference and reflects the count", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Roster" });
    const e1 = await createEntity(user.id, workspaceId, { name: "One", category: "object" });
    const e2 = await createEntity(user.id, workspaceId, { name: "Two", category: "object" });

    const updated = await addProjectEntities(user.id, workspaceId, project.id, {
      entityIds: [e1.id, e2.id],
    });

    expect(updated.entityCount).toBe(2);
    expect(await prisma.projectEntity.count({ where: { projectId: project.id } })).toBe(2);
  });

  it("skips an already-linked entity instead of creating a duplicate", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Roster" });
    const entity = await createEntity(user.id, workspaceId, { name: "One", category: "object" });

    await addProjectEntities(user.id, workspaceId, project.id, { entityIds: [entity.id] });
    // Adding the same entity again is a no-op — no throw, no duplicate link row.
    const updated = await addProjectEntities(user.id, workspaceId, project.id, {
      entityIds: [entity.id],
    });

    expect(updated.entityCount).toBe(1);
    expect(await prisma.projectEntity.count({ where: { projectId: project.id } })).toBe(1);
  });

  it("rejects an entity from another workspace (cross-workspace reference blocked)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const project = await createProject(a.user.id, a.workspaceId, { name: "A Project" });
    const foreign = await createEntity(b.user.id, b.workspaceId, { name: "B Entity", category: "object" });

    // Project A (workspace A) must never be able to reference Entity from workspace B.
    await expect(
      addProjectEntities(a.user.id, a.workspaceId, project.id, { entityIds: [foreign.id] }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.projectEntity.count({ where: { projectId: project.id } })).toBe(0);
  });

  it("rejects a batch that mixes an owned entity with a foreign one (all-or-nothing)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const project = await createProject(a.user.id, a.workspaceId, { name: "A Project" });
    const owned = await createEntity(a.user.id, a.workspaceId, { name: "Mine", category: "object" });
    const foreign = await createEntity(b.user.id, b.workspaceId, { name: "Theirs", category: "object" });

    await expect(
      addProjectEntities(a.user.id, a.workspaceId, project.id, {
        entityIds: [owned.id, foreign.id],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Nothing is linked when any id in the batch is invalid.
    expect(await prisma.projectEntity.count({ where: { projectId: project.id } })).toBe(0);
  });

  it("rejects adding entities to a project in another workspace (safe NotFound)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const project = await createProject(a.user.id, a.workspaceId, { name: "A Project" });
    const entity = await createEntity(b.user.id, b.workspaceId, { name: "B Entity", category: "object" });

    // b targets a's project id from their own workspace → the project is not found there.
    await expect(
      addProjectEntities(b.user.id, b.workspaceId, project.id, { entityIds: [entity.id] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("forbids a VIEWER from managing project entities (AuthorizationError)", async () => {
    const owner = await makeUser();
    const viewer = await makeUser();
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const project = await createProject(owner.user.id, owner.workspaceId, { name: "Roster" });
    const entity = await createEntity(owner.user.id, owner.workspaceId, {
      name: "One",
      category: "object",
    });

    await expect(
      addProjectEntities(viewer.user.id, owner.workspaceId, project.id, { entityIds: [entity.id] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("removes an entity link without deleting the entity", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Roster" });
    const entity = await createEntity(user.id, workspaceId, { name: "One", category: "object" });
    await addProjectEntities(user.id, workspaceId, project.id, { entityIds: [entity.id] });

    const updated = await removeProjectEntity(user.id, workspaceId, project.id, entity.id);

    expect(updated.entityCount).toBe(0);
    expect(await prisma.projectEntity.count({ where: { projectId: project.id } })).toBe(0);
    // The Entity itself is untouched.
    expect(await prisma.entity.findUnique({ where: { id: entity.id } })).not.toBeNull();
  });

  it("treats removing a non-existent link as a no-op", async () => {
    const { user, workspaceId } = await makeUser();
    const project = await createProject(user.id, workspaceId, { name: "Roster" });
    const entity = await createEntity(user.id, workspaceId, { name: "Unlinked", category: "object" });

    // The entity was never linked — removing it does not throw.
    const updated = await removeProjectEntity(user.id, workspaceId, project.id, entity.id);
    expect(updated.entityCount).toBe(0);
  });
});

describe("list: search / filter / sort / paginate", () => {
  async function seed(userId: string, workspaceId: string) {
    await createProject(userId, workspaceId, { name: "Falcon Program" });
    await createProject(userId, workspaceId, { name: "Tiger Program" });
    await createProject(userId, workspaceId, { name: "Falconry Guild" });
  }

  it("searches by name (case-insensitive contains)", async () => {
    const { user, workspaceId } = await makeUser();
    await seed(user.id, workspaceId);
    const result = await listProjects(user.id, workspaceId, { search: "falcon" });
    expect(result.items.map((p) => p.name).sort()).toEqual(["Falcon Program", "Falconry Guild"]);
  });

  it("sorts by name ascending and descending", async () => {
    const { user, workspaceId } = await makeUser();
    await seed(user.id, workspaceId);
    const asc = await listProjects(user.id, workspaceId, { sort: "name_asc" });
    expect(asc.items.map((p) => p.name)).toEqual(["Falcon Program", "Falconry Guild", "Tiger Program"]);
    const desc = await listProjects(user.id, workspaceId, { sort: "name_desc" });
    expect(desc.items.map((p) => p.name)).toEqual(["Tiger Program", "Falconry Guild", "Falcon Program"]);
  });

  it("filters by status (archived excluded by default)", async () => {
    const { user, workspaceId } = await makeUser();
    const p = await createProject(user.id, workspaceId, { name: "Old" });
    await createProject(user.id, workspaceId, { name: "Live" });
    await archiveProject(user.id, workspaceId, p.id);

    const active = await listProjects(user.id, workspaceId);
    expect(active.items.map((x) => x.name)).toEqual(["Live"]);

    const archived = await listProjects(user.id, workspaceId, { status: "ARCHIVED" });
    expect(archived.items.map((x) => x.name)).toEqual(["Old"]);

    const all = await listProjects(user.id, workspaceId, { status: "ALL" });
    expect(all.items).toHaveLength(2);
  });

  it("paginates", async () => {
    const { user, workspaceId } = await makeUser();
    for (let i = 0; i < 5; i += 1) {
      await createProject(user.id, workspaceId, { name: `P${i}` });
    }
    const page1 = await listProjects(user.id, workspaceId, { pageSize: 2, page: 1 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.pageCount).toBe(3);
  });
});

describe("dashboard project count", () => {
  it("counts only ACTIVE projects in the workspace", async () => {
    const { user, workspaceId } = await makeUser();
    await createProject(user.id, workspaceId, { name: "Live1" });
    await createProject(user.id, workspaceId, { name: "Live2" });
    const toArchive = await createProject(user.id, workspaceId, { name: "Dead" });
    await archiveProject(user.id, workspaceId, toArchive.id);

    const stats = await getWorkspaceStats(user.id, workspaceId);
    expect(stats.projects).toBe(2);
  });
});
