import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/context";
import { getMyFoundingReviewQueue } from "@/server/services/founding-citizenship-intake-service";
import { FoundingReviewQueue } from "@/components/player/founding-review-queue";

export const metadata: Metadata = {
  title: "Restricted Founding Citizenship Review | SIMVERSE",
  robots: { index: false, follow: false },
};

export default async function FoundingReviewerPage() {
  const user = await requireUser();
  // Throws access denied if no independently granted, active reviewer permission.
  const queue = await getMyFoundingReviewQueue(user.id);
  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <Link href="/profile/civilization" className="inline-block text-sm font-semibold text-accent hover:underline">
        ← My Civilization
      </Link>
      <header>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-accent">
          <ShieldCheck className="size-4" aria-hidden /> Independent country-scoped review permission
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Citizenship review queue</h1>
        <p className="mt-2 text-sm text-secondary">
          {queue.permittedCountries} authorized country scope(s) · No issuance or approval permission
        </p>
      </header>
      <FoundingReviewQueue applications={queue.applications} />
    </main>
  );
}
