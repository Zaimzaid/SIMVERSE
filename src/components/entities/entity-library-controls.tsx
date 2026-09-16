"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  ENTITY_SORTS,
  ENTITY_SORT_LABELS,
  ENTITY_STATUS_FILTERS,
  type EntitySort,
  type EntityStatusFilter,
} from "@/lib/entities/constants";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/field";

export interface LibraryControlsProps {
  categories: { key: string; label: string }[];
  tags: { slug: string; name: string }[];
  current: {
    search: string;
    category: string;
    status: EntityStatusFilter;
    tag: string;
    sort: EntitySort;
  };
}

const STATUS_LABELS: Record<EntityStatusFilter, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  ALL: "All statuses",
};

/** Search / filter / sort bar for the Entity Library. All state lives in the URL query. */
export function EntityLibraryControls({ categories, tags, current }: LibraryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(current.search);

  // Keep the local input in sync when the URL changes elsewhere (e.g. Clear).
  useEffect(() => {
    setSearch(current.search);
  }, [current.search]);

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any filter/search/sort change returns to the first page.
    next.delete("page");
    startTransition(() => {
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  // Debounce search input → URL.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== current.search) apply({ q: search || null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters =
    current.search !== "" ||
    current.category !== "" ||
    current.tag !== "" ||
    current.status !== "ACTIVE" ||
    current.sort !== ENTITY_SORTS[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Label htmlFor="entity-search" className="sr-only">
            Search entities
          </Label>
          <Input
            id="entity-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, short name, or description…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
          <Label htmlFor="entity-sort" className="sr-only">
            Sort
          </Label>
          <Select
            id="entity-sort"
            value={current.sort}
            onChange={(e) => apply({ sort: e.target.value })}
            className="w-48"
          >
            {ENTITY_SORTS.map((s) => (
              <option key={s} value={s}>
                {ENTITY_SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="entity-category-filter" className="sr-only">
          Category
        </Label>
        <Select
          id="entity-category-filter"
          value={current.category}
          onChange={(e) => apply({ category: e.target.value || null })}
          className="w-auto min-w-40"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>

        <Label htmlFor="entity-status-filter" className="sr-only">
          Status
        </Label>
        <Select
          id="entity-status-filter"
          value={current.status}
          onChange={(e) => apply({ status: e.target.value === "ACTIVE" ? null : e.target.value })}
          className="w-auto min-w-36"
        >
          {ENTITY_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        {tags.length > 0 ? (
          <>
            <Label htmlFor="entity-tag-filter" className="sr-only">
              Tag
            </Label>
            <Select
              id="entity-tag-filter"
              value={current.tag}
              onChange={(e) => apply({ tag: e.target.value || null })}
              className="w-auto min-w-36"
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </Select>
          </>
        ) : null}

        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              startTransition(() => router.push(pathname));
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <X className="size-4" />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
