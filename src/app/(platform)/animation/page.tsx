import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listAnimationProjects } from "@/server/services/animation-project-service";
import { AnimationStudio } from "@/components/animation/animation-studio";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Animation Studio" };
export default async function AnimationStudioPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  const canCreate = permissions.includes("media.create");
  const canEdit = permissions.includes("media.edit");
  const projects = await listAnimationProjects(user.id, workspace.id);
  return <div className="space-y-6">
    <div className="simverse-page-scene simverse-page-scene--create">
      <PageHeader icon={Clapperboard} eyebrow="Creator / Animation" title="Animation Studio"
        description="Design independent 2D animated scenes with characters, keyframe timelines and browser previews. Save your projects without starting a simulation." />
    </div>
    <AnimationStudio projects={projects.map(p=>({...p,createdAt:p.createdAt.toISOString(),updatedAt:p.updatedAt.toISOString()}))}
      canCreate={canCreate} canEdit={canEdit}/>
  </div>;
}
