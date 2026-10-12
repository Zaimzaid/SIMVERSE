"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Boxes, Check, Plus, Search, X } from "lucide-react";
import { resolveCategory } from "@/lib/entities/categories";
import { apiFetch } from "@/lib/client/api";
import type { EntityView } from "@/server/services/entity-service";
import type { ParticipantChoice } from "./simulation-builder-model";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

interface EntityListResponse {
  items: EntityView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface EntityPickerProps {
  /** Pool source: only entities linked to this project are offered. */
  projectId: string | null;
  value: ParticipantChoice[];
  onChange: (next: ParticipantChoice[]) => void;
  minEntities: number;
  maxEntities?: number;
  language?: "entities" | "competitors";
  createHref?: string;
  showAttributes?: boolean;
}

/**
 * Select which of a project's entities take part in a simulation. Entities are
 * referenced by id — never copied — and the pool is scoped to the chosen project
 * (which the service keeps workspace-scoped, so nothing foreign is reachable).
 * Selection order becomes participant position; registered modules may use it
 * as a stable tie-break during execution.
 */
export function EntityPicker({
  projectId,
  value,
  onChange,
  minEntities,
  maxEntities,
  language = "entities",
  createHref,
  showAttributes = false,
}: EntityPickerProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EntityView[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  const selectedIds = new Set(value.map((v) => v.entityId));

  const load = useCallback(
    async (term: string, pid: string) => {
      const id = ++reqId.current;
      setLoading(true);
      const qs = new URLSearchParams({ projectId: pid, status: "ACTIVE", pageSize: "100" });
      if (term) qs.set("search", term);
      const { data, error } = await apiFetch<EntityListResponse>(`/api/entities?${qs.toString()}`);
      if (id !== reqId.current) return; // ignore out-of-order responses
      setLoading(false);
      if (error) {
        toast({ variant: "error", title: "Couldn’t load entities", description: error.message });
        return;
      }
      setResults(data?.items ?? []);
    },
    [toast],
  );

  // (Re)load whenever the project changes.
  useEffect(() => {
    if (!projectId) {
      setResults([]);
      return;
    }
    setSearch("");
    void load("", projectId);
  }, [projectId, load]);

  // Debounce search → reload.
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => void load(search.trim(), projectId), 350);
    return () => clearTimeout(timer);
  }, [search, projectId, load]);

  function add(entity: EntityView) {
    if (selectedIds.has(entity.id)) return;
    if (maxEntities !== undefined && value.length >= maxEntities) {
      toast({
        variant: "error",
        title: `Maximum ${language} selected`,
        description: `This mode supports at most ${maxEntities} ${language}.`,
      });
      return;
    }
    onChange([
      ...value,
      {
        entityId: entity.id,
        name: entity.name,
        category: entity.category,
        imageUrl: entity.imageUrl,
        importantAttributes: entity.attributes.slice(0, 3).map((attribute) => ({
          name: attribute.name,
          value: `${String(attribute.value)}${attribute.unit ? ` ${attribute.unit}` : ""}`,
        })),
      },
    ]);
  }

  function remove(entityId: string) {
    onChange(value.filter((v) => v.entityId !== entityId));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(next);
  }

  const available = results.filter((e) => !selectedIds.has(e.id));
  const enough = value.length >= minEntities && (maxEntities === undefined || value.length <= maxEntities);
  const singular = language === "competitors" ? "competitor" : "entity";

  if (!projectId) {
    return (
      <EmptyState
        icon={Boxes}
        title="Choose a project first"
        description={`Participants come from the project's ${language}. Pick a project in the Basics step, then add ${language} from your library.`}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Selection summary */}
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${
          enough ? "border-success/30 bg-success-soft text-success" : "border-border-strong bg-surface text-secondary"
        }`}
      >
        <span>
          {value.length} selected · needs at least {minEntities}{maxEntities !== undefined ? ` and at most ${maxEntities}` : ""}
        </span>
        {enough ? (
          <span className="inline-flex items-center gap-1 font-medium">
            <Check className="size-4" /> Enough to be ready
          </span>
        ) : (
          <span className="text-muted">
            {value.length < minEntities
              ? `Add ${minEntities - value.length} more to mark ready`
              : `Remove ${value.length - (maxEntities ?? value.length)} to meet this mode's limit`}
          </span>
        )}
      </div>

      {/* Selected participants (ordered) */}
      {value.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Selected {language}</h4>
          <ul className="space-y-2">
            {value.map((p, index) => {
              const category = resolveCategory(p.category);
              const CategoryIcon = category.icon;
              return (
                <li
                  key={p.entityId}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface-hover text-xs font-medium text-muted">
                    {index + 1}
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-strong bg-background/60 text-accent">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <CategoryIcon className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="truncate text-xs text-muted">{category.label}</p>
                    {showAttributes && p.importantAttributes?.length ? (
                      <p className="mt-1 truncate text-[11px] text-muted">
                        {p.importantAttributes.map((attribute) => `${attribute.name}: ${attribute.value}`).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${p.name} up`}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={() => move(index, 1)}
                      disabled={index === value.length - 1}
                      aria-label={`Move ${p.name} down`}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="icon"
                      size="sm"
                      onClick={() => remove(p.entityId)}
                      aria-label={`Remove ${p.name}`}
                      title="Remove participant"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Available entities */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Add from this project</h4>
          {createHref ? (
            <Link href={createHref} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              <Plus className="size-3.5" /> Create new {singular}
            </Link>
          ) : null}
        </div>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this project’s entities…"
            className="pl-9"
            aria-label="Search entities to add"
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted">Loading…</p>
          ) : available.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              {search.trim()
                ? "No matching entities in this project."
                : value.length > 0
                  ? "Every entity in this project is already selected."
                  : "This project has no active entities yet. Add some from the project’s Entities tab."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {available.map((entity) => {
                const category = resolveCategory(entity.category);
                const CategoryIcon = category.icon;
                return (
                  <li key={entity.id}>
                    <button
                      type="button"
                      onClick={() => add(entity)}
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-hover"
                    >
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-strong bg-background/60 text-accent">
                        {entity.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entity.imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <CategoryIcon className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{entity.name}</span>
                        <span className="block truncate text-xs text-muted">{category.label}</span>
                        {showAttributes && entity.attributes.length ? (
                          <span className="mt-1 block truncate text-[11px] text-muted">
                            {entity.attributes.slice(0, 3).map((attribute) => `${attribute.name}: ${String(attribute.value)}`).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                        <Plus className="size-4" />
                        Add
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
