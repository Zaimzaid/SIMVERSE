import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, Clapperboard, FileBadge2, IdCard, Plane,
  Settings2, Shield, Sparkles, UserRound, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { requireUser } from "@/server/context";
import { getMyPlayerIdentity, listPlayerHomeCountries } from "@/server/services/player-identity-service";
import { getMyCreatorPortfolio } from "@/server/services/profile-portfolio-service";
import { listSocial } from "@/server/services/social-service";
import { PlayerIdentityForm } from "@/components/player/player-identity-form";

export const metadata: Metadata = { title: "My Profile | SIMVERSE" };
const sections = [
  { label: "My Identity", detail: "Who you are and what others can see", href: "#identity", icon: IdCard },
  { label: "My Avatar", detail: "Customize your saved 3D character", href: "/profile/avatar", icon: UserRound },
  { label: "My Community", detail: "Friends, messages and invitations", href: "/social", icon: Users },
  { label: "My Economy", detail: "Career, credits, companies and jobs", href: "/profile/career", icon: BriefcaseBusiness },
  { label: "My Documents", detail: "Virtual ID, citizenship and travel", href: "/profile/documents", icon: FileBadge2 },
  { label: "My Creations", detail: "Your projects, worlds and published work", href: "/profile/creations", icon: Clapperboard },
  { label: "My Settings", detail: "Security, notifications and appearance", href: "/settings", icon: Settings2 },
] as const;

export default async function MyProfilePage() {
  const user = await requireUser();
  const [identity, countries, social, portfolio] = await Promise.all([
    getMyPlayerIdentity(user.id), listPlayerHomeCountries(), listSocial(user.id), getMyCreatorPortfolio(user.id),
  ]);
  const steps = [
    { done: Boolean(identity.username), label: "Choose your username" },
    { done: Boolean(identity.avatarUrl), label: "Add a profile photo" },
    { done: Boolean(identity.biography.trim()), label: "Write a short introduction" },
    { done: identity.profileVisibility === "PUBLIC", label: "Choose whether to make your profile public (optional)" },
  ];
  const completed = steps.filter((step) => step.done).length;
  return <div className="mx-auto max-w-6xl space-y-7">
    <section className="overflow-hidden rounded-3xl border border-border bg-surface">
      <div className="relative h-36 bg-gradient-to-br from-[#13283e] via-[#087988] to-[#1a4f65] sm:h-52">
        {identity.bannerUrl && <img src={identity.bannerUrl} alt="" className="size-full object-cover"/>}
      </div>
      <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-8">
        <Avatar name={identity.displayName} src={identity.avatarUrl} size="lg" className="ring-4 ring-surface"/>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">My SIMVERSE profile</p>
          <h1 className="truncate text-2xl font-semibold sm:text-3xl">{identity.displayName}</h1>
          <p className="text-sm text-secondary">{identity.username ? "@" + identity.username : "Choose your username to get started"}</p>
          {identity.biography && <p className="mt-1 max-w-xl text-sm text-secondary">{identity.biography}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="#identity" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white">Edit profile</Link>
          {identity.username && identity.profileVisibility === "PUBLIC" && <Link href={"/u/" + identity.username}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">View as visitor</Link>}
        </div>
      </div>
    </section>
    <section aria-label="Profile overview" className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-secondary">Your friends</p><p className="mt-1 text-2xl font-semibold">{social.friends.length}</p><Link href="/social" className="mt-2 block text-xs text-accent">Open community →</Link></div>
      <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-secondary">Creations in your workspaces</p><p className="mt-1 text-2xl font-semibold">{portfolio.items.length}</p><Link href="/profile/creations" className="mt-2 block text-xs text-accent">My creations →</Link></div>
      <div className="rounded-2xl border border-border bg-surface p-4"><p className="text-xs text-secondary">Publicly shared stories</p><p className="mt-1 text-2xl font-semibold">{portfolio.published.length}</p><Link href="/profile/creations" className="mt-2 block text-xs text-accent">View portfolio →</Link></div>
    </section>
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="getting-started">
      <div className="flex items-start gap-3"><Sparkles className="mt-1 size-5 text-accent"/>
        <div className="flex-1"><h2 id="getting-started" className="text-lg font-semibold">Make your profile yours</h2>
          <p className="text-sm text-secondary">{completed} of 4 optional setup steps completed. You can explore SIMVERSE at any time.</p></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => <div key={step.label} className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm">
          <span aria-hidden className={step.done ? "text-emerald-500" : "text-muted"}>{step.done ? "✓" : "○"}</span>{step.label}</div>)}
      </div>
      <Link href="#identity" className="mt-3 inline-block text-sm font-semibold text-accent">Continue setup →</Link>
    </section>
    <section aria-labelledby="profile-sections">
      <h2 id="profile-sections" className="mb-3 text-xl font-semibold">Your SIMVERSE</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({label,detail,href,icon:Icon}) =>
          <Link key={label} href={href} className="group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/50 hover:bg-surface-hover">
            <div className="flex items-start justify-between"><span className="rounded-xl bg-accent-soft p-3 text-accent"><Icon className="size-5"/></span><ArrowUpRight className="size-4 text-muted group-hover:text-accent"/></div>
            <div><h3 className="font-semibold">{label}</h3><p className="mt-1 text-xs text-secondary">{detail}</p></div>
          </Link>)}
      </div>
      <Link href="/profile/travel" className="mt-3 inline-flex items-center gap-2 text-sm text-accent"><Plane className="size-4"/> Travel and immigration</Link>
    </section>
    <section id="identity" className="scroll-mt-6 space-y-4" aria-labelledby="identity-title">
      <div><h2 id="identity-title" className="text-xl font-semibold">Edit My Identity</h2>
        <p className="mt-1 text-sm text-secondary">Keep your name, photo, privacy and virtual-world identity in one place.</p></div>
      <PlayerIdentityForm initial={identity} countries={countries}/>
    </section>
    <p className="flex items-center gap-2 text-xs text-secondary"><Shield className="size-4"/>Your private email, SIMVERSE identity number and virtual document records do not appear on public profiles.</p>
  </div>;
}
