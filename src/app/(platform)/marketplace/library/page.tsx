import Link from "next/link";
import { Package, ArrowUpRight } from "lucide-react";
import { MarketplaceAction } from "@/components/marketplace/marketplace-controls";
import { MarketPreviewPanel } from "@/components/marketplace/market-preview-panel";
import { MarketUseControls } from "@/components/marketplace/market-use-controls";
import { requirePlatformContext } from "@/server/context";
import { myMarketLibrary } from "@/server/services/marketplace-service";
import { listEntities } from "@/server/services/entity-service";
import { listWorlds } from "@/server/services/world-service";
import { isMarketModelReference } from "@/lib/marketplace/model-ref";

export default async function MarketplaceLibrary(){
 const {user,workspace,permissions}=await requirePlatformContext();
 const [items,entityResult,worldResult]=await Promise.all([
   myMarketLibrary(user.id),
   permissions.includes("entity.edit")
     ? listEntities(user.id,workspace.id,{status:"ACTIVE",pageSize:100})
     : Promise.resolve(null),
   permissions.includes("world.manage")
     ? listWorlds(user.id,workspace.id,{status:"CURRENT",pageSize:100})
     : Promise.resolve(null),
 ]);
 const entities=entityResult?.items.map(e=>({id:e.id,name:e.name}))??[];
 const worlds=worldResult?.items.filter(w=>w.status!=="ARCHIVED").map(w=>({id:w.id,name:w.name}))??[];
 return <main className="mx-auto max-w-5xl space-y-7 pb-16">
   <header className="flex flex-wrap items-end justify-between gap-3">
     <div><p className="text-sm text-muted">Marketplace / My Library</p>
       <h1 className="mt-2 text-3xl font-bold">My acquired assets</h1>
       <p className="mt-2 max-w-2xl text-sm text-muted">Your licensed items, ready for private previews and compatible SIMVERSE projects. Licenses do not grant resale rights.</p>
     </div>
     <Link href="/marketplace" className="rounded-xl border border-border px-4 py-2 text-sm">Discover items</Link>
   </header>
   {items.length===0?
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <Package className="mx-auto mb-3 size-10 text-muted"/>
      <p>No assets in your library yet.</p><Link href="/marketplace" className="mt-3 inline-block underline">Browse the marketplace</Link>
    </div>:
    <div className="space-y-5">{items.map(item=>
      <article key={item.id} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <p className="text-xs font-semibold text-muted">{item.licenseType} LICENSE</p>
          <h2 className="mt-2 text-lg font-semibold">{item.listing?.title??"Unavailable listing"}</h2>
          <p className="mt-1 text-sm text-muted">Version {item.assetVersion} · Acquired {item.createdAt.toLocaleDateString()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {permissions.includes("asset.manage")&&<MarketplaceAction action="import-entitlement" id={item.id}/>}
          <Link href="/assets" className="inline-flex items-center gap-1 text-sm underline underline-offset-2">
            Asset Library <ArrowUpRight className="size-4"/>
          </Link>
        </div>
        {item.modelUrl&&isMarketModelReference(item.modelUrl)&&<>
          <MarketPreviewPanel modelUrl={item.modelUrl}/>
          {(permissions.includes("entity.edit")||permissions.includes("world.manage"))&&
            <MarketUseControls entitlementId={item.id} entities={entities} worlds={worlds}/>}
        </>}
        <p className="text-xs text-muted">Imports and World associations are licensed references, not unrestricted downloads or a guarantee of animation/gameplay readiness. Only authorized users can view private GLBs.</p>
      </article>
    )}</div>}
 </main>;
}
