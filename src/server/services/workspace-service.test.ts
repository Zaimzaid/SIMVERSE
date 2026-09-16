import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { registerUser } from "@/server/services/auth-service";
import {
  getWorkspaceMembers,
  listWorkspacesForUser,
  requireMembership,
  updateWorkspace,
} from "@/server/services/workspace-service";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";

beforeEach(async () => {
  await resetDb();
});

async function makeUser(email: string) {
  return registerUser({
    displayName: `User ${email}`,
    email,
    password: "Password123",
    confirmPassword: "Password123",
  });
}

describe("requireMembership", () => {
  it("resolves membership for a member", async () => {
    const { user, workspaceId } = await makeUser("owner@example.com");
    const membership = await requireMembership(user.id, workspaceId, "workspace.view");
    expect(membership.role).toBe("OWNER");
  });

  it("throws NotFound (not Authorization) for a non-member — workspace isolation", async () => {
    const a = await makeUser("a@example.com");
    const b = await makeUser("b@example.com");
    // a is not a member of b's workspace; must not reveal it exists.
    await expect(requireMembership(a.user.id, b.workspaceId)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("updateWorkspace", () => {
  it("lets an OWNER rename the workspace and persists the change", async () => {
    const { user, workspaceId } = await makeUser("owner2@example.com");
    const updated = await updateWorkspace(user.id, workspaceId, {
      name: "Renamed Workspace",
    });
    expect(updated.name).toBe("Renamed Workspace");

    const fromDb = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    expect(fromDb?.name).toBe("Renamed Workspace");
  });

  it("forbids a VIEWER from editing (AuthorizationError)", async () => {
    const owner = await makeUser("owner3@example.com");
    const viewer = await makeUser("viewer@example.com");
    await prisma.workspaceMember.create({
      data: { workspaceId: owner.workspaceId, userId: viewer.user.id, role: "VIEWER" },
    });

    // Viewer can view...
    const membership = await requireMembership(
      viewer.user.id,
      owner.workspaceId,
      "workspace.view",
    );
    expect(membership.role).toBe("VIEWER");

    // ...but cannot edit.
    await expect(
      updateWorkspace(viewer.user.id, owner.workspaceId, { name: "Nope" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("prevents a non-member from editing another user's workspace", async () => {
    const a = await makeUser("iso-a@example.com");
    const b = await makeUser("iso-b@example.com");

    await expect(
      updateWorkspace(a.user.id, b.workspaceId, { name: "Hacked" }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const fromDb = await prisma.workspace.findUnique({ where: { id: b.workspaceId } });
    expect(fromDb?.name).not.toBe("Hacked");
  });

  it("validates the new workspace name", async () => {
    const { user, workspaceId } = await makeUser("owner4@example.com");
    await expect(
      updateWorkspace(user.id, workspaceId, { name: "x" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("getWorkspaceMembers", () => {
  it("returns the owner and never leaks password hashes", async () => {
    const owner = await makeUser("owner5@example.com");
    const members = await getWorkspaceMembers(owner.user.id, owner.workspaceId);
    expect(members).toHaveLength(1);

    const first = members[0];
    expect(first).toBeDefined();
    if (!first) return;
    expect(first.role).toBe("OWNER");
    expect(first.user.email).toBe("owner5@example.com");
    expect(Object.hasOwn(first.user, "passwordHash")).toBe(false);
  });
});

describe("listWorkspacesForUser", () => {
  it("returns the user's personal workspace", async () => {
    const owner = await makeUser("solo@example.com");
    const list = await listWorkspacesForUser(owner.user.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(owner.workspaceId);
  });
});
