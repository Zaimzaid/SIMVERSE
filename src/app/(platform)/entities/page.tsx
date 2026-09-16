import type { Metadata } from "next";
import { Boxes, Library, SlidersHorizontal, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturePreview } from "@/components/platform/feature-preview";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Entities" };

export default function EntitiesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Boxes}
        title="Entities"
        description="Entities are the things that live in your worlds — each with its own traits, stats, and behaviors."
        actions={<ComingSoonButton label="New entity" feature="Creating entities arrives in a future phase." />}
      />
      <EmptyState
        futurePhase
        icon={Boxes}
        title="No entities yet"
        description="Your reusable library of entities will live here. This is coming in a future phase."
      />
      <FeaturePreview
        items={[
          { icon: SlidersHorizontal, title: "Traits & stats", description: "Give entities the attributes that drive outcomes." },
          { icon: Sparkles, title: "Behaviors", description: "Define how entities act and react in a world." },
          { icon: Library, title: "Reusable library", description: "Save entities and drop them into any simulation." },
        ]}
      />
    </div>
  );
}
