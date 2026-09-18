"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  DEFAULT_PROJECT_SORT,
  PROJECT_SORTS,
  PROJECT_SORT_LABELS,
  PROJECT_STATUS_FILTERS,
  type ProjectSort,
  type ProjectStatusFilter,
} from "@/lib/projects/constants";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/field";

export interface ProjectLibraryControlsProps {
  current: {
    search: string;
    status: ProjectStatusFilter;
    sort: ProjectSort;
  };
}

const STATUS_LABELS: Record<ProjectStatusFilter, string> = {
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  ALL: "All statuses",
};

/** Search / filter / sort bar for the Project Library. All state lives in the URL query. */
export function ProjectLibraryControls({ current }: ProjectLibraryControlsProps) {
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
    current.search !== "" || current.status !== "ACTIVE" || current.sort !== DEFAULT_PROJECT_SORT;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Label htmlFor="project-search" className="sr-only">
            Search projects
          </Label>
          <Input
            id="project-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
          <Label htmlFor="project-sort" className="sr-only">
            Sort
          </Label>
          <Select
            id="project-sort"
            value={current.sort}
            onChange={(e) => apply({ sort: e.target.value })}
            className="w-48"
          >
            {PROJECT_SORTS.map((s) => (
              <option key={s} value={s}>
                {PROJECT_SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="project-status-filter" className="sr-only">
          Status
        </Label>
        <Select
          id="project-status-filter"
          value={current.status}
          onChange={(e) => apply({ status: e.target.value === "ACTIVE" ? null : e.target.value })}
          className="w-auto min-w-36"
        >
          {PROJECT_STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

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
