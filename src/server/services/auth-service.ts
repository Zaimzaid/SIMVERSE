import { randomBytes } from "node:crypto";
import { newSimverseId } from "./player-identity-service";
import {
  AuthenticationError,
  ConflictError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { SafeUser } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { loginSchema, parseOrThrow, registerSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { prisma, toSafeUser, SAFE_USER_OMIT } from "@/server/db/client";
import { recordAudit } from "./audit-service";
import { verificationEnabled,mailConfigured } from "./email-verification-service";

export interface RegisterResult {
  user: SafeUser;
  workspaceId: string;
}

/**
 * Register a new user. On success, atomically creates the user, their personal
 * workspace, and an OWNER membership. Validation and duplicate-email checks are
 * authoritative here (server-side).
 */
export async function registerUser(input: unknown): Promise<RegisterResult> {
  const { displayName, email, password } = parseOrThrow(
    registerSchema,
    input,
    "Please correct the highlighted fields.",
  );

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError("An account already exists with this email address.");
  }

  const requireVerification=verificationEnabled();
  if(requireVerification&&!mailConfigured())throw new ConflictError("Account registration is temporarily unavailable. Email delivery is not configured.");
  const passwordHash = await hashPassword(password);
  const workspaceName = `${displayName}'s Workspace`;
  const slug = `${slugify(displayName) || "workspace"}-${randomBytes(3).toString("hex")}`;

  const { user, workspace } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { displayName, email, passwordHash, emailVerificationRequired:requireVerification },
      omit: SAFE_USER_OMIT,
    });
    await tx.playerIdentity.create({
      data: { userId: createdUser.id, simverseId: newSimverseId() },
    });
    const createdWorkspace = await tx.workspace.create({
      data: { name: workspaceName, slug, ownerId: createdUser.id },
    });
    await tx.workspaceMember.create({
      data: {
        workspaceId: createdWorkspace.id,
        userId: createdUser.id,
        role: "OWNER",
      },
    });
    return { user: createdUser, workspace: createdWorkspace };
  });

  await recordAudit({ action: "user.registered", actorUserId: user.id });
  await recordAudit({
    action: "workspace.created",
    actorUserId: user.id,
    workspaceId: workspace.id,
    entityType: "Workspace",
    entityId: workspace.id,
    metadata: { name: workspaceName },
  });

  logger.info("User registered", { userId: user.id, workspaceId: workspace.id });

  return { user, workspaceId: workspace.id };
}

/**
 * Authenticate a user by email + password. Returns a safe user on success and
 * throws a generic AuthenticationError otherwise (no user enumeration).
 */
export async function authenticateUser(input: unknown): Promise<SafeUser> {
  const { email, password } = parseOrThrow(
    loginSchema,
    input,
    "Enter your email and password.",
  );

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Perform a hash anyway to keep timing roughly constant.
    await verifyPassword(password, `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`);
    throw new AuthenticationError();
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError();
  }
  if(user.emailVerificationRequired && !user.emailVerifiedAt){
    throw new AuthenticationError("Verify your email address before logging in. You can request another verification email.");
  }

  await recordAudit({ action: "user.logged_in", actorUserId: user.id });
  logger.info("User logged in", { userId: user.id });

  return toSafeUser(user);
}
