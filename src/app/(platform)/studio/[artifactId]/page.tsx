import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getMediaArtifact } from "@/server/services/media-artifact-service";
import { getArtifactShare } from "@/server/services/media-share-service";
import { StoryboardEditor } from "@/components/media/storyboard-editor";

export const metadata: Metadata = { title: "Storyboard · Studio" };
interface PageProps { params: Promise<{ artifactId: string }> }

export default async function StoryboardPage({ params }: PageProps) {
  const { artifactId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();
  let artifact;
  try { artifact = await getMediaArtifact(user.id, workspace.id, artifactId); }
  catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const share = await getArtifactShare(user.id, workspace.id, artifactId);
  return (
    <StoryboardEditor
      key={artifact.currentVersion}
      canEdit={permissions.includes("media.edit")}
      canShare={permissions.includes("media.share")}
      share={{
        exists: share.exists,
        visibility: share.visibility,
        pinnedVersion: share.pinnedVersion,
        publicId: share.publicId,
        titleOverride: share.titleOverride,
      }}
      artifact={{
        id: artifact.id,
        type: artifact.type,
        status: artifact.status,
        currentVersion: artifact.currentVersion,
        source: artifact.source,
        version: {
          title: artifact.version.title,
          subtitle: artifact.version.subtitle,
          description: artifact.version.description,
          aspectRatio: artifact.version.aspectRatio,
          storyboard: artifact.version.storyboard,
        },
        versions: artifact.versions.map((version) => ({
          id: version.id,
          version: version.version,
          status: version.status,
          createdByName: version.createdByName,
          createdAt: version.createdAt.toISOString(),
        })),
      }}
    />
  );
}
