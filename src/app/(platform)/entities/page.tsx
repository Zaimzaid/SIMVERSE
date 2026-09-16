import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Plus } from "lucide-react";
import {
  DEFAULT_ENTITY_SORT,
  ENTITY_SORTS,
  ENTITY_STATUS_FILTERS,
  type EntitySort,
  type EntityStatusFilter,
} from "@/lib/entities/constants";
import { resolveCategory } from "@/lib/entities/categories";
import { requirePlatformContext } from "@/server/context";
import {
  listEntities,
  listWorkspaceCategories,
  listWorkspaceTags,
} from "@/server/services/entity-service";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityCard } from "@/components/entities/entity-card";
import { EntityLibraryControls } from "@/components/entities/entity-library-controls";
import { EntityPagination } from "@/components/entities/entity-pagination";

export const metadata: Metadata = { title: "Entities" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, workspace, permissions } = await requirePlatformContext();
  const canView = permissions.includes("entity.view");
  const canCreate = permissions.includes("entity.create");

  if (!canView) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={Boxes}
          title="Entities"
          description="Create and manage the objects that exist inside your SIMVERSE worlds and simulations."
        />
        <EmptyState
          icon={Boxes}
          title="No access to entities"
          description="Your role doesn’t include access to this workspace’s entities."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const search = first(sp.q);
  const category = first(sp.category);
  const tag = first(sp.tag);

  const statusRaw = first(sp.status).toUpperCase();
  const status: EntityStatusFilter = (ENTITY_STATUS_FILTERS as readonly string[]).includes(statusRaw)
    ? (statusRaw as EntityStatusFilter)
    : "ACTIVE";

  const sortRaw = first(sp.sort);
  const sort: EntitySort = (ENTITY_SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as EntitySort)
    : DEFAULT_ENTITY_SORT;

  const pageNum = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);

  const [result, tags, categoryKeys] = await Promise.all([
    listEntities(user.id, workspace.id, { search, category, tag, status, sort, page: pageNum }),
    listWorkspaceTags(user.id, workspace.id),
    listWorkspaceCategories(user.id, workspace.id),
  ]);

  const categoryOptions = categoryKeys
    .map((key) => ({ key, label: resolveCategory(key).label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const hasAnyFilter =
    search !== "" || category !== "" || tag !== "" || status !== "ACTIVE";

  // Build a page href that preserves the active filters.
  const hrefForPage = (page: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (category) qs.set("category", category);
    if (tag) qs.set("tag", tag);
    if (status !== "ACTIVE") qs.set("status", status);
    if (sort !== DEFAULT_ENTITY_SORT) qs.set("sort", sort);
    if (page > 1) qs.set("page", String(page));
    const str = qs.toString();
    return str ? `/entities?${str}` : "/entities";
  };

  const createAction = canCreate ? (
    <Link href="/entities/new" className={buttonClasses()}>
      <Plus className="size-4" />
      Create Entity
    </Link>
  ) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Boxes}
        title="Entities"
        description="Create and manage the objects that exist inside your SIMVERSE worlds and simulations."
        actions={createAction}
      />

      {/* First-run empty state: no entities at all and no active filters. */}
      {result.total === 0 && !hasAnyFilter ? (
        <EmptyState
          icon={Boxes}
          title="No entities yet."
          description="Entities are the building blocks of your simulations — countries, robots, teams, farms, or anything you invent. Create your first to get started."
          action={
            canCreate ? (
              <Link href="/entities/new" className={buttonClasses()}>
                <Plus className="size-4" />
                CREATE YOUR FIRST ENTITY
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <EntityLibraryControls
            categories={categoryOptions}
            tags={tags.map((t) => ({ slug: t.slug, name: t.name }))}
            current={{ search, category, status, tag, sort }}
          />

          {result.items.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No entities match your filters"
              description="Try a different search term, category, or status — or clear the filters to see everything."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((entity) => (
                <EntityCard key={entity.id} entity={entity} permissions={permissions} />
              ))}
            </div>
          )}

          <EntityPagination
            page={result.page}
            pageCount={result.pageCount}
            total={result.total}
            hrefForPage={hrefForPage}
          />
        </>
      )}
    </div>
  );
}
