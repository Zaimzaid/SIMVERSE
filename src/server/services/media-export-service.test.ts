import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { resetDb } from "../../../test/helpers/db";
import { addMember, newAccount, seedCompletedRun } from "../../../test/helpers/media";
import { createMediaArtifactFromRun, createMediaArtifactVersion } from "./media-artifact-service";
import { renderArtifactExport } from "./media-export-service";

beforeEach(async () => { await resetDb(); });

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function asBytes(body: string | Uint8Array): Uint8Array {
  if (typeof body === "string") throw new Error("Expected binary body.");
  return body;
}

async function artifactFor(moduleId: "battle" | "race" | "survival" = "battle") {
  const owner = await newAccount();
  const source = await seedCompletedRun(owner, moduleId);
  const artifact = await createMediaArtifactFromRun(owner.user.id, owner.workspaceId, { runId: source.run.id, aspectRatio: "LANDSCAPE_16_9" });
  return { owner, source, artifact };
}

describe("media export — rendering", () => {
  it("renders a PNG with a valid signature and exact dimensions", async () => {
    const { owner, artifact } = await artifactFor("battle");
    const result = await renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "png" });
    expect(result.contentType).toBe("image/png");
    const bytes = asBytes(result.body);
    expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(16)).toBe(1920);
    expect(view.getUint32(20)).toBe(1080);
    expect(result.byteLength).toBe(bytes.byteLength);
    expect(result.byteLength).toBeGreaterThan(1000);
    expect(result.byteLength).toBeLessThan(4_000_000);
  });

  it("renders an SVG with the right content type and a safe filename", async () => {
    const { owner, artifact } = await artifactFor("race");
    const result = await renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg" });
    expect(result.contentType).toBe("image/svg+xml");
    expect(typeof result.body).toBe("string");
    expect((result.body as string).startsWith("<svg")).toBe(true);
    expect(result.filename).toMatch(/^[a-z0-9-]+-result-card-v1-landscape\.svg$/);
  });

  it("honors the ratio override and export type in dimensions and filename", async () => {
    const { owner, artifact } = await artifactFor("survival");
    const result = await renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "STORY_POSTER", format: "png", ratio: "PORTRAIT_9_16" });
    expect(result.filename).toMatch(/-story-poster-v1-vertical\.png$/);
    const bytes = asBytes(result.body);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(16)).toBe(1080);
    expect(view.getUint32(20)).toBe(1920);
  });
});

describe("media export — validation and isolation", () => {
  it("rejects unsupported formats and export types", async () => {
    const { owner, artifact } = await artifactFor();
    await expect(renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "gif" }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "VIDEO", format: "png" }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an unknown version", async () => {
    const { owner, artifact } = await artifactFor();
    await expect(renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg", version: 99 }))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("allows a workspace viewer to export but isolates foreign workspaces", async () => {
    const { owner, artifact } = await artifactFor();
    const viewer = await newAccount("Viewer");
    await addMember(owner.workspaceId, viewer.user.id, "VIEWER");
    const foreign = await newAccount("Foreign");

    const viewed = await renderArtifactExport(viewer.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg" });
    expect((viewed.body as string).startsWith("<svg")).toBe(true);

    await expect(renderArtifactExport(foreign.user.id, foreign.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg" }))
      .rejects.toBeInstanceOf(NotFoundError);
    await expect(renderArtifactExport(foreign.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg" }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("media export — version immutability", () => {
  it("keeps version 1 stable after a version 2 edit and renders version 2's new copy", async () => {
    const { owner, artifact } = await artifactFor();
    const v1Before = await renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg", version: 1 });

    await createMediaArtifactVersion(owner.user.id, owner.workspaceId, artifact.id, {
      title: "Edited Title",
      subtitle: "A brand-new creator subtitle",
      description: "Only presentation copy changed.",
      aspectRatio: "LANDSCAPE_16_9",
      status: "READY",
      scenes: artifact.version.storyboard.scenes.map((scene) => ({ id: scene.id, order: scene.order, title: scene.title, caption: scene.caption, enabled: scene.enabled })),
    });

    const v1After = await renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg", version: 1 });
    expect(v1After.body).toBe(v1Before.body);

    const v2 = await renderArtifactExport(owner.user.id, owner.workspaceId, artifact.id, { exportType: "RESULT_CARD", format: "svg", version: 2 });
    expect(v2.body).not.toBe(v1Before.body);
    expect(v2.body as string).toContain("A brand-new creator subtitle");
    expect(v1Before.body as string).not.toContain("A brand-new creator subtitle");
  });
});
