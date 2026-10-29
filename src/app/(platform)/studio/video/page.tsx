import type { Metadata } from "next";
import { Video } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { VideoStudio } from "@/components/media/video-studio";

export const metadata: Metadata = { title: "Video Studio · SIMVERSE" };

export default async function VideoStudioPage() {
  const { permissions } = await requirePlatformContext();
  const canEdit = permissions.includes("media.create") && permissions.includes("media.edit");
  return (
    <div className="space-y-6">
      <div className="simverse-page-scene simverse-page-scene--create">
        <PageHeader
          icon={Video}
          eyebrow="Creator / Media"
          title="Video Studio"
          description="Import footage, trim, add captions or watermarks, adjust picture and sound, and download your edited video."
        />
      </div>
      <VideoStudio canEdit={canEdit} />
    </div>
  );
}
