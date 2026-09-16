import { beforeEach, describe, expect, it } from "vitest";
import { AuthenticationError, ConflictError, ValidationError } from "@/lib/errors";
import { authenticateUser, registerUser } from "@/server/services/auth-service";
import { prisma } from "@/server/db/client";
import { resetDb } from "../../../test/helpers/db";

const validRegistration = {
  displayName: "Alex Chen",
  email: "alex@example.com",
  password: "Password123",
  confirmPassword: "Password123",
};

beforeEach(async () => {
  await resetDb();
});

describe("registerUser", () => {
  it("creates a user, personal workspace, and OWNER membership", async () => {
    const { user, workspaceId } = await registerUser(validRegistration);

    expect(user.email).toBe("alex@example.com");
    expect(user.displayName).toBe("Alex Chen");
    expect(Object.hasOwn(user, "passwordHash")).toBe(false);

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    expect(workspace?.name).toBe("Alex Chen's Workspace");
    expect(workspace?.ownerId).toBe(user.id);
    expect(workspace?.slug).toBeTruthy();

    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: user.id },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("records audit entries for registration and workspace creation", async () => {
    await registerUser(validRegistration);
    const actions = (await prisma.auditLog.findMany()).map((a) => a.action);
    expect(actions).toContain("user.registered");
    expect(actions).toContain("workspace.created");
  });

  it("never stores the password in plaintext", async () => {
    const { user } = await registerUser(validRegistration);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.passwordHash).not.toContain("Password123");
    expect(stored.passwordHash.startsWith("scrypt$")).toBe(true);
  });

  it("rejects a duplicate email", async () => {
    await registerUser(validRegistration);
    await expect(registerUser({ ...validRegistration })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("rejects a weak password", async () => {
    await expect(
      registerUser({
        ...validRegistration,
        password: "weak",
        confirmPassword: "weak",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a mismatched password confirmation", async () => {
    await expect(
      registerUser({ ...validRegistration, confirmPassword: "Different123" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an invalid email", async () => {
    await expect(
      registerUser({ ...validRegistration, email: "not-an-email" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("authenticateUser", () => {
  it("authenticates valid credentials and returns a safe user", async () => {
    await registerUser(validRegistration);
    const user = await authenticateUser({
      email: "alex@example.com",
      password: "Password123",
    });
    expect(user.email).toBe("alex@example.com");
    expect(Object.hasOwn(user, "passwordHash")).toBe(false);
  });

  it("is case-insensitive for email", async () => {
    await registerUser(validRegistration);
    const user = await authenticateUser({
      email: "ALEX@example.com",
      password: "Password123",
    });
    expect(user.email).toBe("alex@example.com");
  });

  it("rejects a wrong password", async () => {
    await registerUser(validRegistration);
    await expect(
      authenticateUser({ email: "alex@example.com", password: "WrongPass123" }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects an unknown email", async () => {
    await expect(
      authenticateUser({ email: "nobody@example.com", password: "Password123" }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});
