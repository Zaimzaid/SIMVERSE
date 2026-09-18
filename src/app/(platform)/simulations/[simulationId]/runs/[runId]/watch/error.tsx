"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function WatchError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Replay could not load:", error); }, [error]);
  return <div role="alert" className="rounded-2xl border border-danger/30 bg-surface p-8 text-center">
    <h1 className="text-xl font-semibold text-foreground">Replay could not load.</h1>
    <p className="mt-2 text-sm text-secondary">The saved run is unchanged. Try again or return to Simulations.</p>
    <div className="mt-4 flex justify-center gap-4 text-sm"><button type="button" onClick={reset} className="text-accent hover:underline">Try again</button>
      <Link href="/simulations" className="text-accent hover:underline">Simulations</Link></div>
  </div>;
}
