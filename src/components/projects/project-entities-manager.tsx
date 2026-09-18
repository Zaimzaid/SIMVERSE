"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Boxes, Check, Plus, Search, X } from "lucide-react";
import { resolveCategory } from "@/lib/entities/categories";
import { apiFetch } from "@/lib/client/api";
import type { EntityView } from "@/server/services/entity-service";
import type { ProjectView } from "@/server/services/project-service";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";

interface EntityListResponse {
  items: EntityView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface ProjectEntitiesManagerProps {
  projectId: string;
  initialEntities: EntityView[];
  /** Whether the current role may add/remove entity links (project.entity.manage). */
  canManage: boolean;
}

/**
 * Manages the entities referenced by a project. Entities are LINKED by
 * reference, never cloned — adding uses the existing Entity Library, and removing
 * deletes only the link (the Entity stays in the library).
 */
export function ProjectEntitiesManager({
  projectId,
  initialEntities,
  canManage,
}: ProjectEntitiesManagerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [entities, setEntities] = useState<EntityView[]>(initialEntities);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function onRemove(entity: EntityView) {
    setRemovingId(entity.id);
    const { error } = await apiFetch<{ project: ProjectView }>(
      `/api/projects/${projectId}/entities/${entity.id}`,
      { method: "DELETE" },
    );
    setRemovingId(null);
    if (error) {
      toast({ variant: "error", title: "Couldn’t remove entity", description: error.message });
      return;
    }
    setEntities((prev) => prev.filter((e) => e.id !== entity.id));
    toast({
      variant: "success",
      title: "Entity removed",
      description: `“${entity.name}” was removed from this project. It’s still in your library.`,
    });
    router.refresh();
  }

  function onAdded(added: EntityView[]) {
    // Merge, de-duplicating by id, and keep a stable name order.
    setEntities((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      for (const e of added) byId.set(e.id, e);
      return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    });
    setPickerOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {entities.length} {entities.length === 1 ? "entity" : "entities"} referenced
        </p>
        {canManage ? (
          <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="size-4" />
            Add entities
          </Button>
        ) : null}
      </div>

      {entities.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No entities in this project yet"
          description="Add existing entities from your library to organize them under this project. Entities are referenced, not copied — they stay available everywhere."
          action={
            canManage ? (
              <Button variant="secondary" onClick={() => setPickerOpen(true)}>
                <Plus className="size-4" />
                Add entities
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {entities.map((entity) => {
            const category = resolveCategory(entity.category);
            const CategoryIcon = category.icon;
            return (
              <li
                key={entity.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-strong bg-background/60 text-accent">
                  {entity.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entity.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <CategoryIcon className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/entities/${entity.id}`}
                    className="truncate font-medium text-foreground hover:text-accent"
                  >
                    {entity.name}
                  </Link>
                  <p className="truncate text-xs text-muted">{category.label}</p>
                </div>
                {canManage ? (
                  <Button
                    variant="icon"
                    size="sm"
                    onClick={() => onRemove(entity)}
                    disabled={removingId === entity.id}
                    aria-label={`Remove ${entity.name} from project`}
                    title="Remove from project"
                  >
                    <X className="size-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <AddEntitiesModal
          projectId={projectId}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onAdded={onAdded}
        />
      ) : null}
    </div>
  );
}

interface AddEntitiesModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onAdded: (added: EntityView[]) => void;
}

/** Searchable multi-select of ACTIVE entities not already in the project. */
function AddEntitiesModal({ projectId, open, onClose, onAdded }: AddEntitiesModalProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<EntityView[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(
    async (term: string) => {
      const id = ++reqId.current;
      setLoading(true);
      const qs = new URLSearchParams({ notInProjectId: projectId, status: "ACTIVE", pageSize: "50" });
      if (term) qs.set("search", term);
      const { data, error } = await apiFetch<EntityListResponse>(`/api/entities?${qs.toString()}`);
      // Ignore out-of-order responses.
      if (id !== reqId.current) return;
      setLoading(false);
      if (error) {
        toast({ variant: "error", title: "Couldn’t load entities", description: error.message });
        return;
      }
      setResults(data?.items ?? []);
    },
    [projectId, toast],
  );

  // Reset and load when opened.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected(new Set());
    void load("");
  }, [open, load]);

  // Debounce search → reload.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search, open, load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    const entityIds = [...selected];
    const { error } = await apiFetch<{ project: ProjectView }>(`/api/projects/${projectId}/entities`, {
      method: "POST",
      body: JSON.stringify({ entityIds }),
    });
    setSubmitting(false);
    if (error) {
      toast({ variant: "error", title: "Couldn’t add entities", description: error.message });
      return;
    }
    const added = results.filter((e) => selected.has(e.id));
    toast({
      variant: "success",
      title: added.length === 1 ? "Entity added" : "Entities added",
      description: `${added.length} ${added.length === 1 ? "entity" : "entities"} added to this project.`,
    });
    onAdded(added);
  }

  return (
    <Modal
      open={open}
      onClose={() => (submitting ? undefined : onClose())}
      title="Add entities"
      description="Choose existing entities from your library to reference in this project."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={submitting} disabled={selected.size === 0}>
            {selected.size === 0
              ? "Add selected"
              : `Add ${selected.size} ${selected.size === 1 ? "entity" : "entities"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities…"
            className="pl-9"
            aria-label="Search entities to add"
          />
        </div>

        <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
          {loading ? (
            <p className="p-6 text-center text-sm text-muted">Loading…</p>
          ) : results.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">
              {search.trim()
                ? "No matching entities available to add."
                : "Every active entity is already in this project, or you have none yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((entity) => {
                const category = resolveCategory(entity.category);
                const CategoryIcon = category.icon;
                const isSelected = selected.has(entity.id);
                return (
                  <li key={entity.id}>
                    <button
                      type="button"
                      onClick={() => toggle(entity.id)}
                      className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-hover"
                      aria-pressed={isSelected}
                    >
                      <span
                        className={`grid size-5 shrink-0 place-items-center rounded-md border ${
                          isSelected
                            ? "border-accent bg-accent text-accent-foreground"
                            : "border-border-strong"
                        }`}
                        aria-hidden="true"
                      >
                        {isSelected ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-border-strong bg-background/60 text-accent">
                        {entity.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entity.imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <CategoryIcon className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{entity.name}</span>
                        <span className="block truncate text-xs text-muted">{category.label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
