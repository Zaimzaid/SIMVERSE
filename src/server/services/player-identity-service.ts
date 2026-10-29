import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { playerIdentityUpdateSchema } from "@/lib/player-identity/schema";
import { prisma } from "@/server/db/client";
import { recordAudit } from "./audit-service";

/** Immutable, opaque SIMVERSE-only identity number; not a national identifier. */
export function newSimverseId(): string {
  return `SV-${randomBytes(12).toString("hex").toUpperCase()}`;
}

/** Lazy migration for accounts registered before PlayerIdentity was added. */
export async function ensurePlayerIdentity(userId: string) {
  return prisma.playerIdentity.upsert({
    where: { userId },
    create: { userId, simverseId: newSimverseId() },
    update: {},
  });
}

export async function listPlayerHomeCountries() {
  return prisma.earthGeoPlace.findMany({
    where: {
      kind: "COUNTRY",
      revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
    },
    select: { id: true, name: true, isoAlpha2: true },
    orderBy: { name: "asc" },
    take: 250,
  });
}

export async function getMyPlayerIdentity(userId: string) {
  await ensurePlayerIdentity(userId);
  const record = await prisma.playerIdentity.findUnique({
    where: { userId },
    include: {
      user: { select: { displayName: true, avatarUrl: true, email: true } },
      homeCountry: { select: { id: true, name: true, isoAlpha2: true } },
      citizenships: {
        select: { id: true, status: true, category: true, createdAt: true, country: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!record) throw new NotFoundError("Your player identity could not be loaded.");
  return {
    simverseId: record.simverseId,
    createdAt: record.createdAt,
    username: record.username,
    displayName: record.user.displayName,
    email: record.user.email,
    avatarUrl: record.user.avatarUrl,
    creatorName: record.creatorName,
    biography: record.biography,
    bannerUrl: record.bannerUrl,
    profileVisibility: record.profileVisibility,
    experienceMode: record.experienceMode,
    homeCountryId: record.homeCountryId,
    homeCountry: record.homeCountry,
    citizenships: record.citizenships,
    citizenshipNotice: "Selecting a virtual home country does not grant SIMVERSE citizenship or travel rights.",
  };
}

export async function updateMyPlayerIdentity(userId: string, payload: unknown) {
  const data = parseOrThrow(playerIdentityUpdateSchema, payload);
  await ensurePlayerIdentity(userId);
  if (data.homeCountryId) {
    const place = await prisma.earthGeoPlace.findFirst({
      where: {
        id: data.homeCountryId,
        kind: "COUNTRY",
        revisions: { some: { isCurrent: true, datasetVersion: { status: "ACTIVE" } } },
      },
      select: { id: true },
    });
    if (!place) throw new ValidationError("Choose a supported SIMVERSE country from the catalog.", [
      { path: "homeCountryId", message: "This country is not available in the active catalog." },
    ]);
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { displayName: data.displayName, avatarUrl: data.avatarUrl },
      });
      await tx.playerIdentity.update({
        where: { userId },
        data: {
          username: data.username,
          creatorName: data.creatorName,
          biography: data.biography,
          bannerUrl: data.bannerUrl,
          experienceMode: data.experienceMode,
          profileVisibility: data.profileVisibility,
          homeCountryId: data.homeCountryId,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("This username is already in use. Choose another.");
    }
    throw error;
  }
  await recordAudit({
    action: "user.player_identity_updated",
    actorUserId: userId,
    entityType: "PlayerIdentity",
    entityId: userId,
    metadata: { changedIdentity: true },
  });
  return getMyPlayerIdentity(userId);
}

/** Anonymous-friendly view: no email, identity number, citizenship files or account roles. */
export async function getPublicPlayerProfile(rawUsername: string) {
  const username = rawUsername.toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username)) return null;
  const profile = await prisma.playerIdentity.findUnique({
    where: { username },
    include: {
      user: { select: { displayName: true, avatarUrl: true, createdAt: true } },
      homeCountry: { select: { name: true } },
    },
  });
  if (!profile || profile.profileVisibility !== "PUBLIC") return null;
  return {
    username: profile.username!,
    userId: profile.userId,
    displayName: profile.user.displayName,
    avatarUrl: profile.user.avatarUrl,
    creatorName: profile.creatorName,
    biography: profile.biography,
    bannerUrl: profile.bannerUrl,
    experienceMode: profile.experienceMode,
    virtualHomeCountry: profile.homeCountry?.name ?? null,
    joinedAt: profile.user.createdAt,
  };
}
