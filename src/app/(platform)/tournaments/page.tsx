import type { Metadata } from "next";
import { Trophy, ListOrdered, CalendarDays, Network } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturePreview } from "@/components/platform/feature-preview";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Tournaments" };

export default function TournamentsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={Trophy}
        title="Tournaments"
        description="Pit entities against each other across brackets and seasons, then crown the outcomes."
        actions={<ComingSoonButton label="New tournament" feature="Tournaments arrive in a future phase." />}
      />
      <EmptyState
        futurePhase
        icon={Trophy}
        title="No tournaments yet"
        description="Brackets, standings, and seasons will show up here. This is coming in a future phase."
      />
      <FeaturePreview
        items={[
          { icon: Network, title: "Brackets", description: "Single and double elimination, round robin, and more." },
          { icon: ListOrdered, title: "Leaderboards", description: "Rank entities as results come in." },
          { icon: CalendarDays, title: "Seasons", description: "Run recurring competitions over time." },
        ]}
      />
    </div>
  );
}
