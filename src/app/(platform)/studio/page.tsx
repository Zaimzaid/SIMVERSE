import type { Metadata } from "next";
import { Clapperboard, Wand2, Film, FileVideo } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturePreview } from "@/components/platform/feature-preview";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Studio" };

export default function StudioPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Clapperboard}
        title="Studio"
        description="Turn simulation outcomes into stories. The content engine and AI director will assemble highlights and narration here."
        actions={<ComingSoonButton label="New production" feature="The studio arrives in a future phase." />}
      />
      <EmptyState
        futurePhase
        icon={Clapperboard}
        title="The studio is warming up"
        description="Once simulations produce outcomes, you’ll direct and export stories from here. This is coming in a future phase."
      />
      <FeaturePreview
        items={[
          { icon: Wand2, title: "AI director", description: "Automatically find the moments worth telling." },
          { icon: Film, title: "Highlight reels", description: "Assemble the best beats of a simulation." },
          { icon: FileVideo, title: "Story exports", description: "Publish recaps as video and shareable pages." },
        ]}
      />
    </div>
  );
}
