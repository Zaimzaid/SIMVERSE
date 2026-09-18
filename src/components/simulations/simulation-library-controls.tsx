"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  DEFAULT_SIMULATION_SORT,
  SIMULATION_SORTS,
  SIMULATION_SORT_LABELS,
  type SimulationSort,
  type SimulationStatusFilter,
} from "@/lib/simulations/constants";
import { selectableModes } from "@/lib/simulations/modes";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/field";

/**
 * The status value the UI shows by default. It is not one of the stored
 * SimulationStatusFilter values — it stands for "hide archived", which the
 * service applies when no status param is present.
 */
export const SIMULATION_STATUS_UI_DEFAULT = "ACTIVE" as const;

export type SimulationStatusUiValue = SimulationStatusFilter | typeof SIMULATION_STATUS_UI_DEFAULT;

export interface SimulationLibraryControlsProps {
  current: {
    search: string;
    status: SimulationStatusUiValue;
    mode: string;
    projectId: string;
    sort: SimulationSort;
  };
  /** When provided, a project filter is shown. Omit to hide it (e.g. inside a project). */
  projects?: { id: string; name: string }[];
}

const STATUS_LABELS: Record<SimulationStatusUiValue, string> = {
  ACTIVE: "Active",
  DRAFT: "Draft",
  READY: "Ready",
  ARCHIVED: "Archived",
  ALL: "All statuses",
};

const STATUS_OPTIONS: SimulationStatusUiValue[] = ["ACTIVE", "DRAFT", "READY", "ARCHIVED", "ALL"];

const MODE_OPTIONS = selectableModes();

/** Search / filter / sort bar for the Simulation Library. All state lives in the URL query. */
export function SimulationLibraryControls({ current, projects }: SimulationLibraryControlsProps) {
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
    current.status !== SIMULATION_STATUS_UI_DEFAULT ||
    current.mode !== "" ||
    current.projectId !== "" ||
    current.sort !== DEFAULT_SIMULATION_SORT;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Label htmlFor="simulation-search" className="sr-only">
            Search simulations
          </Label>
          <Input
            id="simulation-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="hidden size-4 shrink-0 text-muted sm:block" aria-hidden="true" />
          <Label htmlFor="simulation-sort" className="sr-only">
            Sort
          </Label>
          <Select
            id="simulation-sort"
            value={current.sort}
            onChange={(e) => apply({ sort: e.target.value })}
            className="w-48"
          >
            {SIMULATION_SORTS.map((s) => (
              <option key={s} value={s}>
                {SIMULATION_SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="simulation-status-filter" className="sr-only">
          Status
        </Label>
        <Select
          id="simulation-status-filter"
          value={current.status}
          onChange={(e) =>
            apply({ status: e.target.value === SIMULATION_STATUS_UI_DEFAULT ? null : e.target.value })
          }
          className="w-auto min-w-36"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        <Label htmlFor="simulation-mode-filter" className="sr-only">
          Mode
        </Label>
        <Select
          id="simulation-mode-filter"
          value={current.mode}
          onChange={(e) => apply({ mode: e.target.value || null })}
          className="w-auto min-w-36"
        >
          <option value="">All modes</option>
          {MODE_OPTIONS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </Select>

        {projects && projects.length > 0 ? (
          <>
            <Label htmlFor="simulation-project-filter" className="sr-only">
              Project
            </Label>
            <Select
              id="simulation-project-filter"
              value={current.projectId}
              onChange={(e) => apply({ project: e.target.value || null })}
              className="w-auto min-w-44"
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
