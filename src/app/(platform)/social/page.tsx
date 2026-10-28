import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import { listSocial } from "@/server/services/social-service";
import { CommunityV3 } from "@/components/social/community-v3";

export const metadata: Metadata = { title: "Friends & Messages" };

export default async function SocialPage() {
  const user = await requireUser();
  const initial = await listSocial(user.id);
  // CommunityV3 owns the page heading. Do not render a second PageHeader.
  return <CommunityV3 userId={user.id} initial={initial} />;
}
