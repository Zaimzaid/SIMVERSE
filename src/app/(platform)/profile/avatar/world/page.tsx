import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/context";
import { getMyPlayerAvatar } from "@/server/services/player-avatar-service";
import { PlayerAvatarPreview } from "@/components/player/player-avatar-preview";

export const metadata: Metadata = { title: "Avatar 3D Test | SIMVERSE" };
export default async function PlayerAvatarTestScene() {
  const user = await requireUser();
  const appearance = await getMyPlayerAvatar(user.id);
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/profile/avatar" className="text-sm font-semibold text-accent">← Back to My Avatar</Link>
    <header><h1 className="text-3xl font-semibold">My character in a 3D scene</h1>
      <p className="mt-2 text-sm text-secondary">This scene loads your saved appearance from the player account, not the Animation Studio. It is a visual proof, not an explorable world.</p></header>
    <PlayerAvatarPreview appearance={appearance} world/>
    <p className="rounded-xl border border-border bg-surface p-4 text-sm text-secondary">Next: connect this avatar configuration to a real world runtime, imported 3D rigs and gameplay movement after visual QA.</p>
  </div>;
}
