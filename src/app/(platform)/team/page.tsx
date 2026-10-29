import type {Metadata} from "next";
import {Users} from "lucide-react";
import {requirePlatformContext} from "@/server/context";
import {getWorkspaceMembers} from "@/server/services/workspace-service";
import {listWorkspaceInvitations,listWorkspaceTeamActivity} from "@/server/services/team-service";
import {PageHeader} from "@/components/ui/page-header";
import {TeamPanel} from "@/components/platform/team/team-panel";
export const metadata:Metadata={title:"Team"};
export default async function TeamPage(){
 const {user,workspace,role,permissions}=await requirePlatformContext();
 const canManage=permissions.includes("workspace.members.manage");
 const [members,invitations,activity]=await Promise.all([
  getWorkspaceMembers(user.id,workspace.id),
  canManage?listWorkspaceInvitations(user.id,workspace.id):Promise.resolve([]),
  canManage?listWorkspaceTeamActivity(user.id,workspace.id):Promise.resolve([]),
 ]);
 return <div className="space-y-6">
  <PageHeader icon={Users} title="Team" description={`Manage who can access ${workspace.name} and what they can do.`}/>
  <TeamPanel workspaceId={workspace.id} actorRole={role} currentUserId={user.id} canManage={canManage}
   members={members.map(m=>({id:m.id,userId:m.userId,role:m.role,
    name:m.user.displayName,email:m.user.email,avatarUrl:m.user.avatarUrl,joinedAt:m.createdAt.toISOString()}))}
   invitations={invitations.map(i=>({id:i.id,email:i.email,role:i.role,expiresAt:i.expiresAt.toISOString()}))}
   activity={activity.map(a=>({id:a.id,action:a.action,at:a.createdAt.toISOString(),actor:a.actor?.displayName??"System"}))}/>
 </div>;
}
