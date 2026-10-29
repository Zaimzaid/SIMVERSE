import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import { listSocial } from "@/server/services/social-service";
import { CommunityV3 } from "@/components/social/community-v3";

export const metadata: Metadata = { title: "Friends & Messages" };

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ peer?: string }> }) {
  const user = await requireUser();
  const initial = await listSocial(user.id);
  const peer = (await searchParams).peer;
  // Deep links may open only existing accepted friends, never arbitrary accounts.
  const initialPeerId = initial.friends.some((friend) => friend.other.id === peer) ? peer : null;
  return <CommunityV3 userId={user.id} initial={initial} initialPeerId={initialPeerId} />;
}
