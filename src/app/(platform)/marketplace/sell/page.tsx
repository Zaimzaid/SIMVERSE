import Link from "next/link";
import { ArrowLeft, Store, ShieldCheck } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { getMySeller, sellerListings } from "@/server/services/marketplace-service";
import { listAssets } from "@/server/services/asset-service";
import { MarketplaceAction, SellerEnroll, SellerListingForm } from "@/components/marketplace/marketplace-controls";
import { MarketUploadForm } from "@/components/marketplace/market-upload-form";
export default async function SellerDashboard() {
 const {user,workspace,permissions}=await requirePlatformContext();
 const canManage=permissions.includes("asset.manage");
 const seller=canManage?await getMySeller(user.id,workspace.id):null;
 const listings=seller?await sellerListings(user.id,workspace.id):[];
 const assets=seller?await listAssets(user.id,workspace.id,{status:"ALL",pageSize:100}):null;
 const uploadable=assets?.items.filter(a=>["MODEL_3D","ENVIRONMENT","PROP","CHARACTER","CREATURE","VEHICLE"].includes(a.type)&&a.status!=="ARCHIVED"&&a.version.provenance.kind==="ORIGINAL")??[];
 const eligible=assets?.items.filter(a=>["VALIDATED","RUNTIME_READY"].includes(a.status)&&a.version.provenance.kind==="ORIGINAL"&&!!a.version.externalReference)??[];
 return <main className="mx-auto max-w-5xl space-y-7 pb-16">
  <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft className="size-4"/>Marketplace</Link>
  <section className="rounded-3xl border border-border bg-gradient-to-br from-violet-300/20 via-card to-indigo-500/10 p-7"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted"><Store className="size-4"/>Seller Studio</p><h1 className="mt-3 text-3xl font-bold">Create. List. Share.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Open a storefront and list original, validated creator assets. Every listing needs a separate quality review before it appears to buyers.</p></section>
  {!canManage?<p className="rounded-xl border border-border p-5">Your workspace role does not allow you to manage assets. Ask your workspace owner for creator permissions.</p>:!seller?<SellerEnroll/>:<>
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"><div><h2 className="text-lg font-semibold">{seller.displayName}</h2><p className="text-sm text-muted">Your storefront · /{seller.slug}</p></div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600"><ShieldCheck className="size-4"/>Free listings enabled</span></section>
    <MarketUploadForm assets={uploadable.map(a=>({id:a.id,name:a.name}))}/>
    <SellerListingForm assets={eligible.map(a=>({id:a.id,name:a.name,type:a.type}))}/>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Your listings</h2>
    {listings.length===0?<p className="rounded-xl border border-dashed border-border p-7 text-sm text-muted">No listings yet. Create an asset in the Asset Library, validate it, then create a marketplace listing.</p>:
    <div className="space-y-3">{listings.map(l=><article key={l.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"><div className="space-y-1"><h3 className="font-semibold">{l.title}</h3><p className="text-sm text-muted">{l.category} · {l.status.replaceAll("_"," ")} · Free</p>{l.reviewNote&&<p className="text-sm text-muted">Moderator: {l.reviewNote}</p>}</div>{["DRAFT","REJECTED"].includes(l.status)&&<MarketplaceAction action="submit-listing" id={l.id}/>}</article>)}</div>}
    </section>
   </>}
 </main>;
}