import type { Metadata } from "next";
import { FolderKanban, GitBranch, LayoutGrid, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { FeaturePreview } from "@/components/platform/feature-preview";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        icon={FolderKanban}
        title="Projects"
        description="Group related worlds, entities, and simulations into projects you can share with your team."
        actions={<ComingSoonButton label="New project" feature="Creating projects arrives in a future phase." />}
      />
      <EmptyState
        futurePhase
        icon={FolderKanban}
        title="No projects yet"
        description="Projects will help you organize your work and collaborate. This is coming in a future phase."
      />
      <FeaturePreview
        items={[
          { icon: LayoutGrid, title: "Organized boards", description: "Keep worlds, entities, and runs together in one place." },
          { icon: Users, title: "Team collaboration", description: "Invite teammates and work on projects with roles." },
          { icon: GitBranch, title: "Version history", description: "Track changes and revisit earlier states of a project." },
        ]}
      />
    </div>
  );
}
