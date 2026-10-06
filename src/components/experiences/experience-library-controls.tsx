"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Grid2X2, List, Search, X } from "lucide-react";
import {
  EXPERIENCE_PRESET_TYPES, EXPERIENCE_PROFILE_STATUSES, EXPERIENCE_PROFILE_STATUS_LABELS,
  EXPERIENCE_SORTS, EXPERIENCE_SORT_LABELS, type ExperiencePresetType,
  type ExperienceProfileStatusFilter, type ExperienceSort,
} from "@/lib/experiences/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props { tags: { slug: string; name: string }[]; current: { search: string; preset: "" | ExperiencePresetType; module: string; mode: string; status: ExperienceProfileStatusFilter; tag: string; sort: ExperienceSort; view: "gallery" | "list" } }
export function ExperienceLibraryControls({ tags, current }: Props) {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams(); const [, startTransition] = useTransition(); const [search, setSearch] = useState(current.search);
  useEffect(() => setSearch(current.search), [current.search]);
  function apply(updates: Record<string, string | null>) { const next = new URLSearchParams(params.toString()); for (const [key, value] of Object.entries(updates)) value ? next.set(key, value) : next.delete(key); next.delete("page"); startTransition(() => router.push(next.size ? `${pathname}?${next}` : pathname)); }
  useEffect(() => { const timer = setTimeout(() => { if (search !== current.search) apply({ q: search || null }); }, 350); return () => clearTimeout(timer); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  const filtered = current.search || current.preset || current.module || current.mode || current.status !== "CURRENT" || current.tag;
  return <div className="space-y-3"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted" /><Label htmlFor="experience-search" className="sr-only">Search Experience Profiles</Label><Input id="experience-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Experience Profiles…" className="pl-9" /></div>
    <Select value={current.sort} onChange={(event) => apply({ sort: event.target.value })} className="lg:w-48">{EXPERIENCE_SORTS.map((sort) => <option key={sort} value={sort}>{EXPERIENCE_SORT_LABELS[sort]}</option>)}</Select>
    <div className="flex rounded-lg border border-border-strong p-1">{(["gallery", "list"] as const).map((view) => { const Icon = view === "gallery" ? Grid2X2 : List; return <button key={view} type="button" aria-label={`${view} view`} onClick={() => apply({ view: view === "gallery" ? null : view })} className={cn("rounded-md p-1.5", current.view === view ? "bg-accent-soft text-accent" : "text-muted")}><Icon className="size-4" /></button>; })}</div></div>
    <div className="flex flex-wrap gap-2"><Select value={current.preset} onChange={(event) => apply({ preset: event.target.value || null })} className="w-auto min-w-40"><option value="">All presets</option>{EXPERIENCE_PRESET_TYPES.map((preset) => <option key={preset} value={preset}>{preset.replaceAll("_", " ")}</option>)}</Select>
      <Select value={current.status} onChange={(event) => apply({ status: event.target.value === "CURRENT" ? null : event.target.value })} className="w-auto min-w-40">{["CURRENT" as const, ...EXPERIENCE_PROFILE_STATUSES, "ALL" as const].map((status) => <option key={status} value={status}>{EXPERIENCE_PROFILE_STATUS_LABELS[status]}</option>)}</Select>
      <Input value={current.module} onChange={(event) => apply({ module: event.target.value || null })} placeholder="Module" className="w-32" />
      <Input value={current.mode} onChange={(event) => apply({ mode: event.target.value || null })} placeholder="Mode" className="w-32" />
      {tags.length ? <Select value={current.tag} onChange={(event) => apply({ tag: event.target.value || null })} className="w-auto min-w-36"><option value="">All tags</option>{tags.map((tag) => <option key={tag.slug} value={tag.slug}>{tag.name}</option>)}</Select> : null}
      {filtered ? <button type="button" onClick={() => { setSearch(""); startTransition(() => router.push(pathname)); }} className="inline-flex items-center gap-1 px-2 text-sm text-muted"><X className="size-4" />Clear</button> : null}
    </div></div>;
}
