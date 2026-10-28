import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Globe2, Shield } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { getPublicPlayerProfile } from "@/server/services/player-identity-service";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const player = await getPublicPlayerProfile(username);
  return {
    title: player ? `@${player.username} | SIMVERSE` : "Player not found | SIMVERSE",
    robots: { index: Boolean(player), follow: Boolean(player) },
  };
}

export default async function PublicPlayerPage({ params }: Props) {
  const { username } = await params;
  const player = await getPublicPlayerProfile(username);
  if (!player) notFound();
  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="relative h-40 bg-gradient-to-r from-[#16304a] via-[#087788] to-[#16485f] sm:h-56">
          {player.bannerUrl ? (
            // User-supplied HTTPS banners are optional, and never imply verification.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.bannerUrl} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="space-y-5 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={player.displayName} src={player.avatarUrl} size="lg"/>
            <div>
              <h1 className="text-2xl font-semibold">{player.displayName}</h1>
              <p className="text-sm text-accent">@{player.username}</p>
              {player.creatorName ? <p className="text-sm text-secondary">{player.creatorName}</p> : null}
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">{player.biography || "SIMVERSE player"}</p>
          <div className="flex flex-wrap gap-3 text-sm text-secondary">
            <span className="rounded-lg border border-border px-3 py-2">{player.experienceMode === "BOTH" ? "Player & Creator" : player.experienceMode === "PLAYER" ? "Player" : "Creator"}</span>
            {player.virtualHomeCountry ? <span className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Globe2 className="size-4 text-accent" /> Virtual home: {player.virtualHomeCountry}
            </span> : null}
          </div>
          <p className="flex items-start gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted">
            <Shield className="size-4 shrink-0 text-accent" />
            SIMVERSE public player profile. Virtual identities and country preferences are fictional and are not government credentials.
          </p>
        </div>
      </article>
    </main>
  );
}
