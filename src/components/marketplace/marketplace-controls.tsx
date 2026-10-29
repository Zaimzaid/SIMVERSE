"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Heart, ShoppingBag, LoaderCircle, Send, Store, Plus, Download } from "lucide-react";

async function send(action:string,payload:Record<string,unknown>,id?:string) {
  const response=await fetch("/api/marketplace",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({action,payload,id}),
  });
  const body=await response.json();
  if(!response.ok) throw new Error(body?.error?.message??"Action failed.");
  return body;
}
export function MarketplaceAction({action,id,label}:{action:"acquire-free"|"wishlist"|"submit-listing"|"import-entitlement";id:string;label?:string}) {
  const router=useRouter();
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  async function run(){
    setWorking(true);setMessage("");
    try {
      if(action==="acquire-free") await send(action,{listingId:id});
      if(action==="wishlist") await send(action,{listingId:id,saved:true});
      if(action==="submit-listing") await send(action,{action:"SUBMIT"},id);
      if(action==="import-entitlement") await send(action,{},id);
      setMessage(action==="import-entitlement"?"Reference imported to your active workspace Asset Library.":action==="acquire-free"?"Added to your library.":action==="wishlist"?"Saved to wishlist.":"Submitted for independent review.");
      router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Request failed.");}
    finally{setWorking(false);}
  }
  return <div className="space-y-1">
    <button type="button" disabled={working} onClick={run}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60">
      {working?<LoaderCircle className="size-4 animate-spin"/>:action==="wishlist"?<Heart className="size-4"/>:action==="import-entitlement"?<Download className="size-4"/>:action==="submit-listing"?<Send className="size-4"/>:<ShoppingBag className="size-4"/>}
      {label??(action==="acquire-free"?"Get free":action==="wishlist"?"Save":action==="import-entitlement"?"Import reference":"Submit for review")}
    </button>
    {message&&<p role="status" className="text-xs text-muted">{message}</p>}
  </div>;
}
export function SellerEnroll() {
  const router=useRouter();
  const [working,setWorking]=useState(false);
  const [message,setMessage]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setWorking(true);setMessage("");
    const form=new FormData(e.currentTarget);
    try{
      await send("open-seller",{
        displayName:String(form.get("displayName")??""),
        slug:String(form.get("slug")??""),
        bio:String(form.get("bio")??""),
      });
      setMessage("Your free-asset store was created.");router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Failed to open store.");}
    finally{setWorking(false);}
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <h2 className="flex items-center gap-2 font-semibold"><Store className="size-5"/>Open your creator store</h2>
    <p className="text-sm text-muted">Publish original, validated assets for free. Paid sales are not yet available.</p>
    <label className="block space-y-1 text-sm">Store name<input name="displayName" required minLength={3} maxLength={80} placeholder="Savannah Assets" className="w-full rounded-xl border border-border bg-background p-3"/></label>
    <label className="block space-y-1 text-sm">Store address<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={60} placeholder="savannah-assets" className="w-full rounded-xl border border-border bg-background p-3"/></label>
    <label className="block space-y-1 text-sm">About your store<textarea name="bio" maxLength={1200} rows={3} className="w-full rounded-xl border border-border bg-background p-3"/></label>
    <button disabled={working} className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60">Create store</button>
    {message&&<p role="status" className="text-sm">{message}</p>}
  </form>;
}
export function SellerListingForm({assets}:{assets:{id:string;name:string;type:string}[]}) {
  const router=useRouter();const [working,setWorking]=useState(false);const [message,setMessage]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setWorking(true);setMessage("");
    const element=e.currentTarget;
    const form=new FormData(element);
    try {
      await send("create-listing",{
        sourceAssetId:String(form.get("sourceAssetId")),title:String(form.get("title")),
        description:String(form.get("description")),category:String(form.get("category")),
        productKind:"DIGITAL_ASSET",licenseType:String(form.get("licenseType")),priceMinor:0,
      });
      element.reset();setMessage("Draft created. Submit it for review below.");router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"Failed to create listing.");}
    finally{setWorking(false);}
  }
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
    <h2 className="flex items-center gap-2 font-semibold"><Plus className="size-5"/>List a free asset</h2>
    <p className="text-sm text-muted">Select one of your workspace's original validated assets with an external file reference. Creating a draft does not publish it.</p>
    <label className="block space-y-1 text-sm">Asset<select name="sourceAssetId" required className="w-full rounded-xl border border-border bg-background p-3">{assets.length===0?<option value="">No eligible assets</option>:assets.map(a=><option key={a.id} value={a.id}>{a.name} · {a.type}</option>)}</select></label>
    <label className="block space-y-1 text-sm">Title<input name="title" required minLength={3} maxLength={160} className="w-full rounded-xl border border-border bg-background p-3"/></label>
    <label className="block space-y-1 text-sm">Description<textarea name="description" required minLength={10} maxLength={4000} rows={3} className="w-full rounded-xl border border-border bg-background p-3"/></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-1 text-sm">Category<select name="category" className="w-full rounded-xl border border-border bg-background p-3">{["CHARACTERS","CREATURES","CLOTHING","VEHICLES","BUILDINGS","PROPS","ENVIRONMENTS","ANIMATION","AUDIO","TEMPLATES","MATERIALS","GAME_ITEMS"].map(c=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}</select></label>
      <label className="block space-y-1 text-sm">Buyer license<select name="licenseType" className="w-full rounded-xl border border-border bg-background p-3"><option value="PERSONAL">Personal use</option><option value="COMMERCIAL">Commercial use</option></select></label>
    </div>
    <button disabled={working||!assets.length} className="rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background disabled:opacity-60">Create free listing draft</button>
    {message&&<p role="status" className="text-sm">{message}</p>}
  </form>;
}
