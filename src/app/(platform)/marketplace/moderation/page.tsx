import { requirePlatformContext } from "@/server/context";
import { reviewQueue } from "@/server/services/marketplace-service";
import { ModerationControls } from "@/components/marketplace/moderation-controls";
import { ShieldAlert } from "lucide-react";
export default async function MarketplaceModeration(){
 const {user}=await requirePlatformContext();
 const listings=await reviewQueue(user.id);
 return <main className="mx-auto max-w-5xl space-y-6 pb-16"><div><p className="flex items-center gap-2 text-sm text-muted"><ShieldAlert className="size-4"/>Independently authorized moderators</p><h1 className="mt-2 text-3xl font-bold">Marketplace review queue</h1><p className="mt-2 text-sm text-muted">Inspect the source asset and rights before approval. You cannot review your own listings.</p></div>
 {listings.length===0?<div className="rounded-xl border border-border p-8">No pending listing reviews.</div>:<div className="space-y-3">{listings.map(l=><article key={l.id} className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">{l.title}</h2><p className="my-2 text-sm text-muted">{l.description}</p><p className="mb-3 text-xs text-muted">Asset {l.sourceAssetId} · Version {l.sourceVersion} · {l.category} · {l.licenseType}</p><ModerationControls id={l.id}/></article>)}</div>}</main>;
}