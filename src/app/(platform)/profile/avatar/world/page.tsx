import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/context";
import { getMyPlayerAvatar } from "@/server/services/player-avatar-service";
import { PlayerAvatarPlayableWorld } from "@/components/player/player-avatar-playable-world";

export const metadata: Metadata = { title: "Avatar Playground | SIMVERSE" };

export default async function PlayerAvatarWorldPage() {
  const user = await requireUser();
  const appearance = await getMyPlayerAvatar(user.id);
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href="/profile/avatar" className="text-sm font-semibold text-accent hover:underline">← Back to My Avatar</Link>
    <header>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Player avatar / playable proof</p>
      <h1 className="mt-1 text-3xl font-semibold">Your character, your first steps</h1>
      <p className="mt-2 max-w-2xl text-sm text-secondary">
        Your saved SIMVERSE avatar now moves through a small original 3D playground.
        Explore the area and collect the four markers. Your appearance is loaded from your account.
      </p>
    </header>
    <PlayerAvatarPlayableWorld appearance={appearance}/>
    <p className="rounded-xl border border-border bg-surface p-4 text-xs text-secondary">
      Prototype limitation: This is a small single-player movement demonstration with basic collision,
      not persistent world geography, online multiplayer, authored game levels, imported rigged characters or the final SIMVERSE runtime.
      Markers and position reset when you leave.
    </p>
  </div>;
}
