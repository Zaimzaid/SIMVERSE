import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe2, Shield, Clapperboard } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { prisma } from "@/server/db/client";
import { getSessionUser } from "@/server/auth/session";
import { friendshipKey } from "@/server/services/social-service";
import { getPublicCreatorPortfolio } from "@/server/services/profile-portfolio-service";
import { getPublicPlayerProfile, getViewablePlayerProfile } from "@/server/services/player-identity-service";
import { PublicProfileFriendActions } from "@/components/player/public-profile-friend-actions";

type Props = { params: Promise<{ username: string }> };

// Session-aware, never cached across public and friend-only viewers.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const viewer = await getSessionUser();
  const player = await getViewablePlayerProfile(username, viewer?.id ?? null);
  const publiclyListed = Boolean(player && await getPublicPlayerProfile(username));
  return {
    title: player ? "@" + player.username + " | SIMVERSE" : "Player profile | SIMVERSE",
    robots: { index: publiclyListed, follow: publiclyListed },
  };
}
export default async function PublicPlayerPage({ params }: Props) {
  const { username } = await params;
  const viewer = await getSessionUser();
  const player = await getViewablePlayerProfile(username, viewer?.id ?? null);
  if (!player) notFound();
  const own = viewer?.id === player.userId;
  let relation: { kind: "NONE" | "INCOMING" | "OUTGOING" | "FRIENDS" | "BLOCKED"; requestId: string | null } = { kind: "NONE", requestId: null };
  if (viewer && !own) {
    const [connection, blocked] = await Promise.all([
      prisma.socialFriendship.findUnique({ where: { pairKey: friendshipKey(viewer.id, player.userId) },
        select: { id: true, status: true, senderId: true, receiverId: true } }),
      prisma.socialBlock.count({ where: { OR: [
        { blockerId: viewer.id, blockedId: player.userId }, { blockerId: player.userId, blockedId: viewer.id },
      ] } }),
    ]);
    if (blocked) relation = { kind: "BLOCKED", requestId: null };
    else if (connection?.status === "ACCEPTED") relation = { kind: "FRIENDS", requestId: connection.id };
    else if (connection?.receiverId === viewer.id) relation = { kind: "INCOMING", requestId: connection.id };
    else if (connection?.senderId === viewer.id) relation = { kind: "OUTGOING", requestId: connection.id };
  }
  const works = await getPublicCreatorPortfolio(player.userId);
  return <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="relative h-40 bg-gradient-to-r from-[#16304a] via-[#087788] to-[#16485f] sm:h-56">
        {player.bannerUrl ? <img src={player.bannerUrl} alt="" className="size-full object-cover"/> : null}
      </div>
      <div className="space-y-6 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={player.displayName} src={player.avatarUrl} size="lg"/>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{player.displayName}</h1>
            <p className="text-sm text-accent">@{player.username}</p>
            {player.creatorName && <p className="text-sm text-secondary">{player.creatorName}</p>}
          </div>
          {own && <Link href="/profile" className="rounded-xl border border-border px-4 py-2 text-sm">Edit my profile</Link>}
        </div>
        <p className="whitespace-pre-wrap text-sm text-secondary">{player.biography || "SIMVERSE player"}</p>
        <div className="flex flex-wrap gap-2 text-sm text-secondary">
          <span className="rounded-lg border border-border px-3 py-2">{player.experienceMode === "BOTH" ? "Player & Creator" : player.experienceMode === "PLAYER" ? "Player" : "Creator"}</span>
          {player.virtualHomeCountry && <span className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"><Globe2 className="size-4"/> Virtual home: {player.virtualHomeCountry}</span>}
        </div>
        {!own && viewer && <PublicProfileFriendActions playerId={player.userId} initial={relation}/>}
        {!own && !viewer && <Link href="/login" className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">Sign in to connect</Link>}
        <section aria-label="Published creator work" className="border-t border-border pt-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Clapperboard className="size-5 text-accent"/> Public creations</h2>
          {works.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{works.map((work) =>
            <Link key={work.publicId} href={"/s/" + work.publicId} className="rounded-xl border border-border bg-background p-4 text-sm hover:border-accent">
              <p className="font-semibold">{work.titleOverride || work.artifact.type + " story"}</p>
              <p className="mt-1 text-xs text-secondary">Published SIMVERSE media · View story</p>
            </Link>)}</div> : <p className="mt-3 text-sm text-secondary">No publicly shared creations yet.</p>}
        </section>
        <p className="flex items-start gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted">
          <Shield className="size-4 shrink-0 text-accent"/> Player profile. Private profiles are accessible only to accepted friends. Virtual identities are fictional and are not government credentials.
        </p>
      </div>
    </article>
  </main>;
}
