import type { Metadata } from "next";
import { Package, Upload, Image as ImageIcon, Share2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturePreview } from "@/components/platform/feature-preview";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Assets" };

export default function AssetsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Package}
        title="Assets"
        description="Your shared library of media — sprites, models, images, and audio used across worlds and entities."
        actions={<ComingSoonButton label="Upload asset" feature="Asset uploads arrive in a future phase." />}
      />
      <EmptyState
        futurePhase
        icon={Package}
        title="Your asset library is empty"
        description="Uploaded and generated media will be collected here. This is coming in a future phase."
      />
      <FeaturePreview
        items={[
          { icon: Upload, title: "Uploads", description: "Bring your own images, models, and audio." },
          { icon: ImageIcon, title: "Sprites & models", description: "Manage the visuals that represent your entities." },
          { icon: Share2, title: "Shared media", description: "Reuse assets across every project in a workspace." },
        ]}
      />
    </div>
  );
}
