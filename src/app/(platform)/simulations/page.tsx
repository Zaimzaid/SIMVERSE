import type { Metadata } from "next";
import { Activity, Gauge, Play, Swords } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturePreview } from "@/components/platform/feature-preview";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Simulations" };

export default function SimulationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Swords}
        title="Simulations"
        description="Configure scenarios, press play, and watch outcomes resolve. The simulation runtime is a separate core layer, built in a later phase."
        actions={<ComingSoonButton label="New simulation" feature="Running simulations arrives with the core runtime." />}
      />
      <EmptyState
        futurePhase
        icon={Play}
        title="No simulations yet"
        description="Once the simulation runtime lands, your runs and their outcomes will appear here."
      />
      <FeaturePreview
        items={[
          { icon: Gauge, title: "Deterministic runs", description: "Reproducible outcomes from a fixed seed and ruleset." },
          { icon: Play, title: "Live playback", description: "Watch a simulation unfold step by step." },
          { icon: Activity, title: "Outcome analytics", description: "Break down what happened and why." },
        ]}
      />
    </div>
  );
}
