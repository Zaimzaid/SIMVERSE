"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Grid2X2, List, Search, X } from "lucide-react";
import { ASSET_SORTS, ASSET_SORT_LABELS, ASSET_STATUSES, ASSET_STATUS_LABELS,
  ASSET_TYPES, ASSET_TYPE_LABELS, type AssetSort, type AssetStatusFilter, type AssetType } from "@/lib/assets/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  tags: { slug: string; name: string }[];
  entities: { id: string; name: string }[];
  current: { search: string; type: "" | AssetType; status: AssetStatusFilter; tag: string;
    entityId: string; sort: AssetSort; view: "gallery" | "list" };
}
export function AssetLibraryControls({ tags, entities, current }: Props) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const [, startTransition] = useTransition(); const [search, setSearch] = useState(current.search);
  useEffect(() => setSearch(current.search), [current.search]);
  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) value ? next.set(key, value) : next.delete(key);
    next.delete("page");
    startTransition(() => router.push(next.size ? `${pathname}?${next}` : pathname));
  }
  useEffect(() => { const timer = setTimeout(() => {
    if (search !== current.search) apply({ q: search || null });
  }, 350); return () => clearTimeout(timer); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const filtered = current.search || current.type || current.status !== "CURRENT" || current.tag || current.entityId;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted" /><Label htmlFor="asset-search" className="sr-only">Search assets</Label>
          <Input id="asset-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets by name or description…" className="pl-9" /></div>
        <Select value={current.sort} onChange={(event) => apply({ sort: event.target.value })} className="lg:w-48">
          {ASSET_SORTS.map((sort) => <option key={sort} value={sort}>{ASSET_SORT_LABELS[sort]}</option>)}</Select>
        <div className="flex rounded-lg border border-border-strong p-1">
          {(["gallery", "list"] as const).map((view) => { const Icon = view === "gallery" ? Grid2X2 : List; return (
            <button key={view} type="button" onClick={() => apply({ view: view === "gallery" ? null : view })}
              aria-label={`${view} view`} className={cn("rounded-md p-1.5", current.view === view ? "bg-accent-soft text-accent" : "text-muted")}><Icon className="size-4" /></button>); })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={current.type} onChange={(event) => apply({ type: event.target.value || null })} className="w-auto min-w-40"><option value="">All asset types</option>
          {ASSET_TYPES.map((type) => <option key={type} value={type}>{ASSET_TYPE_LABELS[type]}</option>)}</Select>
        <Select value={current.status} onChange={(event) => apply({ status: event.target.value === "CURRENT" ? null : event.target.value })} className="w-auto min-w-40">
          {["CURRENT" as const, ...ASSET_STATUSES, "ALL" as const].map((status) => <option key={status} value={status}>{ASSET_STATUS_LABELS[status]}</option>)}</Select>
        {tags.length ? <Select value={current.tag} onChange={(event) => apply({ tag: event.target.value || null })} className="w-auto min-w-36"><option value="">All tags</option>
          {tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.name}</option>)}</Select> : null}
        {entities.length ? <Select value={current.entityId} onChange={(event) => apply({ entity: event.target.value || null })} className="w-auto min-w-44"><option value="">All Entity links</option>
          {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</Select> : null}
        {filtered ? <button type="button" onClick={() => { setSearch(""); startTransition(() => router.push(pathname)); }} className="inline-flex items-center gap-1 px-2 text-sm text-muted hover:text-foreground"><X className="size-4" />Clear</button> : null}
      </div>
    </div>
  );
}
