import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/context";
import { getMyPlayerAvatar } from "@/server/services/player-avatar-service";
import { PlayerAvatarEditor } from "@/components/player/player-avatar-editor";

export const metadata: Metadata = { title: "My 3D Avatar | SIMVERSE" };
export default async function MyAvatarPage() {
  const user = await requireUser();
  const appearance = await getMyPlayerAvatar(user.id);
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href="/profile" className="text-sm font-semibold text-accent">← Back to My Profile</Link>
    <header><h1 className="text-3xl font-semibold">My 3D Avatar</h1>
    <p className="mt-2 text-sm text-secondary">Create a lightweight character and save your appearance to your SIMVERSE identity.</p></header>
    <PlayerAvatarEditor initial={appearance}/>
  </div>;
}
