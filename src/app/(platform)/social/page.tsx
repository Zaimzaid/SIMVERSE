import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireUser } from "@/server/context";
import { listSocial } from "@/server/services/social-service";
import { CommunityV3 } from "@/components/social/community-v3";
import { PageHeader } from "@/components/ui/page-header";
export const metadata:Metadata={title:"Friends & Messages"};
export default async function SocialPage(){
  const user=await requireUser();
  const initial=await listSocial(user.id);
  return <div className="space-y-6">
    <PageHeader icon={Users} eyebrow="Community" title="Friends & Messages"
      description="Discover public players, accept friendships and exchange private SIMVERSE messages. Social connections require mutual consent."/>
    <CommunityV3 userId={user.id} initial={initial}/>
  </div>;
}
