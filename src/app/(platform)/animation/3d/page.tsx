import type {Metadata} from "next";
import {Box} from "lucide-react";
import {requirePlatformContext} from "@/server/context";
import {listAnimationProjects} from "@/server/services/animation-project-service";
import {AvatarDirector} from "@/components/animation/avatar-director";
import {PageHeader} from "@/components/ui/page-header";
export const metadata:Metadata={title:"3D Avatar & Camera Studio"};
export default async function Page(){
  const {user,workspace,permissions}=await requirePlatformContext();
  const projects=await listAnimationProjects(user.id,workspace.id);
  return <div className="space-y-5">
    <div className="simverse-page-scene simverse-page-scene--create">
      <PageHeader icon={Box} eyebrow="Animation Studio / Prototype" title="3D Avatar & Camera Lab"
        description="Customize an original 3D avatar, animate a procedural rig, direct the camera, preview dialogue movement and record a silent WebM scene."/>
    </div>
    <AvatarDirector projects={projects.map(x=>({...x,createdAt:x.createdAt.toISOString(),updatedAt:x.updatedAt.toISOString()}))}
      canCreate={permissions.includes("media.create")} canEdit={permissions.includes("media.edit")}/>
  </div>;
}