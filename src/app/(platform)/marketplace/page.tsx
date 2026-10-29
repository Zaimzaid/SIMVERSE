import Link from "next/link";
import { ArrowUpRight, Boxes, Compass, Heart, Package, Search, ShieldCheck, Sparkles, Store } from "lucide-react";
import { publicCatalog } from "@/server/services/marketplace-service";
import { MarketplaceAction } from "@/components/marketplace/marketplace-controls";
export const metadata={title:"SIMVERSE Marketplace"};
const sections=[{value:"",label:"All items"},{value:"CHARACTERS",label:"Characters"},{value:"CREATURES",label:"Animals"},{value:"VEHICLES",label:"Vehicles"},{value:"BUILDINGS",label:"Buildings"},{value:"ANIMATION",label:"Animations"},{value:"ENVIRONMENTS",label:"Worlds"}];
export default async function MarketplaceHome({searchParams}:{searchParams:Promise<{q?:string;category?:string;page?:string}>}){
  const p=await searchParams;
  const category=sections.some(s=>s.value===p.category)?(p.category??""):"";
  const result=await publicCatalog({q:p.q??"",category,page:Number(p.page??1)});
  return <main className="mx-auto max-w-7xl space-y-8 pb-16">
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-indigo-900 via-slate-900 to-violet-950 p-6 text-white sm:p-10">
      <div className="pointer-events-none absolute -right-14 -top-16 size-72 rounded-full bg-violet-400/15 blur-3xl" />
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-indigo-200"><Sparkles className="size-4"/>SIMVERSE · Marketplace</p>
      <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">Discover assets.<br/>Bring your universe to life.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Browse original 3D resources, discover independent creators, and collect compatible assets for your next experience.</p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/marketplace/library" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"><Package className="size-4"/>My Library</Link>
        <Link href="/marketplace/sell" className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-semibold text-white"><Store className="size-4"/>Sell an Item <ArrowUpRight className="size-4"/></Link>
      </div>
    </section>
    <div className="flex flex-wrap gap-3 text-sm">
      <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2"><ShieldCheck className="size-4"/> Moderated listings</span>
      <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2"><Boxes className="size-4"/> Version-pinned assets</span>
      <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2"><Heart className="size-4"/> Creator-owned storefronts</span>
    </div>
    <section className="space-y-5" aria-label="Browse catalog">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Explore the collection</h2><span className="text-sm text-muted">{result.total} published assets</span></div>
      <form action="/marketplace" className="flex gap-2"><label htmlFor="market-q" className="sr-only">Search assets</label><input id="market-q" name="q" defaultValue={p.q??""} placeholder="Search creators, characters, vehicles..." className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm"/><button className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"><Search className="size-4"/>Search</button></form>
      <nav aria-label="Categories" className="flex flex-wrap gap-2">{sections.map(s=><Link key={s.label} href={s.value?`/marketplace?category=${s.value}`:"/marketplace"} aria-current={category===s.value?"page":undefined} className={`rounded-full border px-4 py-2 text-sm ${category===s.value?"border-foreground bg-foreground text-background":"border-border hover:bg-card"}`}>{s.label}</Link>)}</nav>
      {result.items.length===0?<div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center"><Compass className="mx-auto mb-4 size-9 text-muted"/><h3 className="text-lg font-semibold">No approved items yet</h3><p className="mt-2 text-sm text-muted">Creators can submit original validated assets. A separate moderator must approve each item before publication.</p><Link href="/marketplace/sell" className="mt-4 inline-block underline underline-offset-4">Open your store</Link></div>:
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.items.map((item,index)=><article key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-lg">
        <Link href={`/marketplace/${item.id}`} className={`flex aspect-[16/10] items-center justify-center bg-gradient-to-br ${index%3===0?"from-indigo-200/60 to-blue-700/20":index%3===1?"from-orange-200/60 to-violet-600/20":"from-emerald-200/60 to-sky-700/20"}`}><Boxes className="size-16 text-foreground/40" aria-hidden="true"/></Link>
        <div className="space-y-3 p-5">
          <div className="flex justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-muted">{item.category.replaceAll("_"," ")}</span><span className="text-sm font-semibold">Free</span></div>
          <Link href={`/marketplace/${item.id}`} className="block text-lg font-semibold hover:underline">{item.title}</Link>
          <p className="line-clamp-2 text-sm text-muted">{item.description}</p>
          <p className="text-xs text-muted">by {item.seller?.displayName} · {item.licenseType.toLowerCase()} license</p>
          <MarketplaceAction action="acquire-free" id={item.id}/>
        </div>
      </article>)}</div>}
      {result.pageCount>1&&<div className="flex justify-between text-sm">{result.page>1?<Link href={`/marketplace?page=${result.page-1}`}>Previous</Link>:<span/>}<span>Page {result.page} of {result.pageCount}</span>{result.page<result.pageCount?<Link href={`/marketplace?page=${result.page+1}`}>Next</Link>:<span/>}</div>}
    </section>
    <p className="text-xs text-muted">Free-asset preview release. Paid checkout, direct trading and production file hosting are not enabled.</p>
  </main>;
}