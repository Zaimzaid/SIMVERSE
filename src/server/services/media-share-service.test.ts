import { beforeEach, describe, expect, it } from "vitest";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { resetDb } from "../../../test/helpers/db";
import { addMember, newAccount, seedCompletedRun } from "../../../test/helpers/media";
import { archiveMediaArtifact, createMediaArtifactFromRun, createMediaArtifactVersion, restoreMediaArtifact } from "./media-artifact-service";
import { getArtifactShare, getPublicMediaShare, renderPublicShareGraphic, revokeArtifactShare, setArtifactShare } from "./media-share-service";

beforeEach(async () => { await resetDb(); });

async function sharedArtifact(moduleId: "battle" | "race" | "survival" = "battle") {
  const owner = await newAccount();
  const source = await seedCompletedRun(owner, moduleId);
  const artifact = await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id, aspectRatio: "LANDSCAPE_16_9" });
  return { owner, source, artifact };
}

describe("media share — creation and lifecycle", () => {
  it("creates an UNLISTED share pinned to the current version with a high-entropy id", async () => {
    const { owner, artifact } = await sharedArtifact();
    const share = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "UNLISTED" });
    expect(share).toMatchObject({ exists: true, visibility: "UNLISTED", pinnedVersion: 1 });
    expect(share.publicId).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  });

  it("does not create a share when setting PRIVATE on an unshared artifact", async () => {
    const { owner, artifact } = await sharedArtifact();
    const share = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PRIVATE" });
    expect(share).toMatchObject({ exists: false, visibility: "PRIVATE", publicId: null });
  });

  it("revokes public access (sets PRIVATE) and keeps the row for re-sharing", async () => {
    const { owner, artifact } = await sharedArtifact();
    const created = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" });
    const revoked = await revokeArtifactShare(owner.user.id, owner.workspaceId, artifact.id);
    expect(revoked).toMatchObject({ exists: true, visibility: "PRIVATE" });
    // Re-sharing reuses the same stable public id.
    const reshared = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "UNLISTED" });
    expect(reshared.publicId).toBe(created.publicId);
  });
});

describe("media share — public resolution", () => {
  it("resolves UNLISTED and PUBLIC anonymously but not PRIVATE, revoked, unknown, or archived", async () => {
    const { owner, artifact } = await sharedArtifact();
    const unlisted = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "UNLISTED" });
    const publicId = unlisted.publicId!;

    expect((await getPublicMediaShare(publicId)).visibility).toBe("UNLISTED");
    await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" });
    expect((await getPublicMediaShare(publicId)).visibility).toBe("PUBLIC");

    await revokeArtifactShare(owner.user.id, owner.workspaceId, artifact.id);
    await expect(getPublicMediaShare(publicId)).rejects.toBeInstanceOf(NotFoundError);

    await expect(getPublicMediaShare("does-not-exist-000000")).rejects.toBeInstanceOf(NotFoundError);

    // Archiving suspends; restoring does NOT auto-republish.
    await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" });
    expect((await getPublicMediaShare(publicId)).visibility).toBe("PUBLIC");
    await archiveMediaArtifact(owner.user.id, owner.workspaceId, artifact.id);
    await expect(getPublicMediaShare(publicId)).rejects.toBeInstanceOf(NotFoundError);
    await restoreMediaArtifact(owner.user.id, owner.workspaceId, artifact.id);
    await expect(getPublicMediaShare(publicId)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getArtifactShare(owner.user.id, owner.workspaceId, artifact.id)).visibility).toBe("PRIVATE");
  });

  it("renders a public graphic for an active share and a safe 404 otherwise", async () => {
    const { owner, artifact } = await sharedArtifact();
    const share = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" });
    const png = await renderPublicShareGraphic(share.publicId!, { format: "png" });
    expect(png.contentType).toBe("image/png");
    expect(Array.from((png.body as Uint8Array).slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await revokeArtifactShare(owner.user.id, owner.workspaceId, artifact.id);
    await expect(renderPublicShareGraphic(share.publicId!, { format: "png" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("media share — version pinning", () => {
  it("keeps the pinned version stable across edits until explicitly repointed", async () => {
    const { owner, artifact } = await sharedArtifact();
    const share = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC", version: 1 });
    const publicId = share.publicId!;
    expect((await getPublicMediaShare(publicId)).artifact.version).toBe(1);

    await createMediaArtifactVersion(owner.user.id, owner.workspaceId, artifact.id, {
      title: "Version Two Title", subtitle: "v2", description: "Second version copy.", aspectRatio: "LANDSCAPE_16_9", status: "READY",
      scenes: artifact.version.storyboard.scenes.map((s) => ({ id: s.id, order: s.order, title: s.title, caption: s.caption, enabled: s.enabled })),
    });
    // Public output still shows Version 1 (version-pinned).
    expect((await getPublicMediaShare(publicId)).artifact.version).toBe(1);

    await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC", version: 2 });
    const now = await getPublicMediaShare(publicId);
    expect(now.artifact.version).toBe(2);
    expect(now.artifact.title).toBe("Version Two Title");
  });
});

describe("media share — permissions and isolation", () => {
  it("allows a Creator to share but denies Editor/Viewer, and isolates workspaces", async () => {
    const owner = await newAccount();
    const creator = await newAccount("Creator");
    const editor = await newAccount("Editor");
    const viewer = await newAccount("Viewer");
    const foreign = await newAccount("Foreign");
    await addMember(owner.workspaceId, creator.user.id, "CREATOR");
    await addMember(owner.workspaceId, editor.user.id, "EDITOR");
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const source = await seedCompletedRun(owner, "race");
    const artifact = await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id });

    const share = await setArtifactShare(creator.user.id, owner.workspaceId, artifact.id, { visibility: "UNLISTED" });
    expect(share.visibility).toBe("UNLISTED");
    // Viewers can read the share state but not mutate; Editors cannot publish.
    expect((await getArtifactShare(viewer.user.id, owner.workspaceId, artifact.id)).visibility).toBe("UNLISTED");
    await expect(setArtifactShare(editor.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(setArtifactShare(viewer.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" })).rejects.toBeInstanceOf(AuthorizationError);
    // A foreign workspace cannot manage this share.
    await expect(setArtifactShare(foreign.user.id, foreign.workspaceId, artifact.id, { visibility: "PUBLIC" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getArtifactShare(foreign.user.id, foreign.workspaceId, artifact.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects pinning a version that does not exist and sharing an archived artifact", async () => {
    const { owner, artifact } = await sharedArtifact();
    await expect(setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC", version: 99 })).rejects.toBeInstanceOf(NotFoundError);
    await archiveMediaArtifact(owner.user.id, owner.workspaceId, artifact.id);
    await expect(setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("public projection exposes only safe display values, never internal identifiers", async () => {
    const { owner, source, artifact } = await sharedArtifact();
    const share = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC" });
    const projection = await getPublicMediaShare(share.publicId!);
    const serialized = JSON.stringify(projection);

    expect(serialized).not.toContain(owner.workspaceId);
    expect(serialized).not.toContain(source.run.id);
    expect(serialized).not.toContain(source.entities[0]!.id);
    expect(serialized).not.toContain(source.participants[0]!.runParticipantId);
    // No internal field names leak either.
    expect(serialized).not.toContain("runParticipantId");
    expect(serialized).not.toContain("sourceEntityId");
    expect(serialized).not.toContain("workspaceId");
    // But safe display data is present.
    expect(projection.participants[0]!.name).toBe("Historical Lion");
    expect(projection.result.ranking[0]!.name).toBe("Historical Lion");
  });
});

describe("media share — creator text safety", () => {
  it("carries creator markup as inert plain text and escapes it in the rendered graphic", async () => {
    const { owner, artifact } = await sharedArtifact();
    const payload = "<script>alert(1)</script>";
    const share = await setArtifactShare(owner.user.id, owner.workspaceId, artifact.id, { visibility: "PUBLIC", titleOverride: payload });
    const projection = await getPublicMediaShare(share.publicId!);
    // The projection carries it verbatim as data; the React page renders it as text.
    expect(projection.artifact.title).toBe(payload);

    // The story poster renders the creator title; it must be escaped, never live markup.
    const svg = await renderPublicShareGraphic(share.publicId!, { format: "svg", type: "STORY_POSTER" });
    expect(svg.body as string).not.toContain("<script>");
    expect(svg.body as string).toContain("&lt;");
  });
});
