import Link from "next/link";
import { notFound } from "next/navigation";
import { Box, ChevronLeft, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";
import { publicListing } from "@/server/services/marketplace-service";
import { MarketplaceAction } from "@/components/marketplace/marketplace-controls";
export default async function MarketProduct({params}:{params:Promise<{listingId:string}>}) {
  const {listingId}=await params;
  const item=await publicListing(listingId).catch(()=>null);
  if(!item)notFound();
  return <main className="mx-auto max-w-6xl space-y-7 pb-16">
    <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-muted"><ChevronLeft className="size-4"/>Back to Marketplace</Link>
    <div className="grid gap-8 md:grid-cols-2">
      <section className="flex min-h-72 items-center justify-center rounded-3xl border border-border bg-gradient-to-br from-indigo-200/40 via-card to-violet-400/20">
        {item.previewUrl?<img src={item.previewUrl} alt={item.title+" preview"} className="h-full w-full rounded-3xl object-contain"/>:<div className="space-y-4 text-center"><Box className="mx-auto size-24 text-muted"/><p className="text-sm text-muted">Preview image not available</p></div>}
      </section>
      <section className="space-y-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted"><Sparkles className="size-4"/>{item.category.replaceAll("_"," ")}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{item.title}</h1>
        <p className="text-sm text-muted">Sold by {item.seller.displayName}{item.seller.verified?" · Verified creator":""}</p>
        <div className="text-3xl font-bold">Free</div>
        <p className="leading-7 text-muted">{item.description}</p>
        <div className="flex flex-wrap gap-3"><MarketplaceAction action="acquire-free" id={item.id}/><MarketplaceAction action="wishlist" id={item.id}/></div>
        <div className="space-y-3 rounded-2xl border border-border p-5 text-sm">
          <h2 className="font-semibold">What you receive</h2>
          <p className="flex items-center gap-2"><FileCheck2 className="size-4"/> A license to asset version {item.sourceVersion}</p>
          <p className="flex items-center gap-2"><ShieldCheck className="size-4"/> {item.licenseType==="PERSONAL"?"Personal-use license":"Commercial-use license"} · not transferable</p>
          <p className="text-muted">A 3D model is not automatically animated or playable. Compatibility must be validated in the target SIMVERSE experience.</p>
        </div>
      </section>
    </div>
  </main>;
}