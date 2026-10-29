import Link from "next/link";
import { Package, ArrowUpRight } from "lucide-react";
import { MarketplaceAction } from "@/components/marketplace/marketplace-controls";
import { requirePlatformContext } from "@/server/context";
import { myMarketLibrary } from "@/server/services/marketplace-service";
export default async function MarketplaceLibrary(){
 const {user}=await requirePlatformContext();
 const items=await myMarketLibrary(user.id);
 return <main className="mx-auto max-w-5xl space-y-7 pb-16">
   <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted">Marketplace / My Library</p><h1 className="mt-2 text-3xl font-bold">My acquired assets</h1><p className="mt-2 text-sm text-muted">Your licenses are recorded here. They do not grant resale rights or automatic compatibility.</p></div><Link href="/marketplace" className="rounded-xl border border-border px-4 py-2 text-sm">Discover items</Link></div>
   {items.length===0?<div className="rounded-2xl border border-dashed border-border p-12 text-center"><Package className="mx-auto mb-3 size-10 text-muted"/><p>No assets in your library yet.</p><Link href="/marketplace" className="mt-3 inline-block underline">Browse the marketplace</Link></div>:
   <div className="grid gap-3 sm:grid-cols-2">{items.map(item=><article key={item.id} className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-semibold text-muted">{item.licenseType} LICENSE</p><h2 className="mt-2 text-lg font-semibold">{item.listing?.title??"Unavailable listing"}</h2><p className="mt-1 text-sm text-muted">Asset version {item.assetVersion} · Acquired {item.createdAt.toLocaleDateString()}</p><div className="mt-4 flex flex-wrap gap-3"><MarketplaceAction action="import-entitlement" id={item.id}/><Link href="/assets" className="inline-flex items-center gap-2 text-sm underline">Go to Asset Library <ArrowUpRight className="size-4"/></Link></div><p className="mt-3 text-xs text-muted">Import creates a licensed reference in your active workspace. The original file may require external access and game compatibility is not guaranteed.</p></article>)}</div>}
 </main>;
}