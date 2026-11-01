import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/server/context";
import { getMyVascoinOverview } from "@/server/services/vascoin-service";
import { VascoinWalletClient } from "@/components/civilization/vascoin-wallet-client";

export const metadata: Metadata = {
  title: "My Vascoin Wallet | SIMVERSE",
  robots: { index: false, follow: false },
};

export default async function MyVascoinPage() {
  const user = await requireUser();
  const initial = await getMyVascoinOverview(user.id);
  return (
    <main className="mx-auto max-w-5xl space-y-7">
      <Link href="/profile/civilization"
        className="inline-block text-sm font-semibold text-accent hover:underline">
        ← My Civilization
      </Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          Phase 6 · Build Your Civilization
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Vascoin Wallet
        </h1>
        <p className="mt-3 text-sm leading-7 text-secondary">
          Your virtual civilization credits, check-ins and district treasury.
          Completely separate from SVC, GFC and real-world money.
        </p>
      </header>
      <VascoinWalletClient initial={initial} />
    </main>
  );
}
