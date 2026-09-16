import type { Metadata } from "next";
import { Globe2, Mountain, ScrollText, Wind } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturePreview } from "@/components/platform/feature-preview";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Worlds" };

export default function WorldsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Globe2}
        title="Worlds"
        description="A world is the environment and set of rules your entities inhabit. Design once, simulate endlessly."
        actions={<ComingSoonButton label="New world" feature="Building worlds arrives in a future phase." />}
      />
      <EmptyState
        futurePhase
        icon={Globe2}
        title="No worlds yet"
        description="Your environments and rulesets will appear here. This is coming in a future phase."
      />
      <FeaturePreview
        items={[
          { icon: Mountain, title: "Environments", description: "Shape the space where simulations play out." },
          { icon: ScrollText, title: "Rulesets", description: "Set the laws that govern interactions and outcomes." },
          { icon: Wind, title: "Physics presets", description: "Start from tuned presets or craft your own." },
        ]}
      />
    </div>
  );
}
