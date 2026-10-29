import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clapperboard, LockKeyhole, Share2 } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyCreatorPortfolio } from "@/server/services/profile-portfolio-service";

export const metadata: Metadata = { title: "My Creations | SIMVERSE" };
export default async function MyCreationsPage() {
  const user = await requireUser();
  const portfolio = await getMyCreatorPortfolio(user.id);
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/profile" className="text-sm font-medium text-accent hover:underline">← Back to My Profile</Link>
    <header className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <Clapperboard className="mb-3 size-8 text-accent" />
      <h1 className="text-3xl font-semibold">My Creations</h1>
      <p className="mt-2 max-w-xl text-sm text-secondary">Your own worlds, simulations, animations and published stories in one place. Private work is never displayed on your public profile.</p>
    </header>
    <section className="space-y-3" aria-labelledby="public-work">
      <h2 id="public-work" className="flex items-center gap-2 text-xl font-semibold"><Share2 className="size-5 text-accent"/> Published stories</h2>
      <p className="text-sm text-secondary">Only media you explicitly shared as Public appears on your visitor profile. Unlisted shares are never advertised.</p>
      {portfolio.published.length ? <div className="grid gap-3 sm:grid-cols-2">{portfolio.published.map((work) =>
        <Link key={work.publicId} href={work.href} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 hover:border-accent">
          <span className="font-medium">{work.title}</span><ArrowUpRight className="size-4 text-accent"/>
        </Link>)}</div> :
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-secondary">You have not publicly shared a story yet. Your work stays private by default.</p>}
    </section>
    <section className="space-y-3" aria-labelledby="owned-work">
      <h2 id="owned-work" className="flex items-center gap-2 text-xl font-semibold"><LockKeyhole className="size-5 text-accent"/> My workspace creations</h2>
      <p className="text-sm text-secondary">These are private workspace records, shown only to you while you belong to the workspace. Listing a creation here does not publish it.</p>
      {portfolio.items.length ? <div className="grid gap-3 sm:grid-cols-2">{portfolio.items.map((work) =>
        <Link key={work.type + work.id} href={work.href} className="rounded-xl border border-border bg-surface p-4 hover:border-accent">
          <span className="text-xs font-semibold text-accent">{work.type} · {work.status}</span>
          <div className="mt-2 flex items-center justify-between gap-2"><span className="font-medium">{work.title}</span><ArrowUpRight className="size-4 text-muted"/></div>
        </Link>)}</div> :
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-secondary">You have no creations in your accessible workspaces yet. Start from Create.</p>}
    </section>
  </div>;
}
