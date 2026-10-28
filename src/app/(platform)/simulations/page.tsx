import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Swords } from "lucide-react";
import {
  DEFAULT_SIMULATION_SORT,
  SIMULATION_SORTS,
  SIMULATION_STATUS_FILTERS,
  type SimulationSort,
  type SimulationStatusFilter,
} from "@/lib/simulations/constants";
import { PROJECT_MAX_PAGE_SIZE } from "@/lib/projects/constants";
import { requirePlatformContext } from "@/server/context";
import { listSimulations } from "@/server/services/simulation-service";
import { listProjects } from "@/server/services/project-service";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SimulationCard } from "@/components/simulations/simulation-card";
import {
  SimulationLibraryControls,
  SIMULATION_STATUS_UI_DEFAULT,
  type SimulationStatusUiValue,
} from "@/components/simulations/simulation-library-controls";
import { SimulationPagination } from "@/components/simulations/simulation-pagination";

export const metadata: Metadata = { title: "Simulations" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function SimulationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, workspace, permissions } = await requirePlatformContext();
  const canView = permissions.includes("simulation.view");
  const canCreate = permissions.includes("simulation.create");

  if (!canView) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={Swords}
          title="Simulations"
          description="Configure simulation blueprints from the entities in your projects."
        />
        <EmptyState
          icon={Swords}
          title="No access to simulations"
          description="Your role doesn’t include access to this workspace’s simulations."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const search = first(sp.q);

  // "ACTIVE" is a UI-only sentinel meaning "hide archived"; it is not a stored
  // status, so it maps to an absent status filter when querying the service.
  const statusRaw = first(sp.status).toUpperCase();
  const status: SimulationStatusUiValue = (SIMULATION_STATUS_FILTERS as readonly string[]).includes(statusRaw)
    ? (statusRaw as SimulationStatusFilter)
    : SIMULATION_STATUS_UI_DEFAULT;

  const mode = first(sp.mode);
  const projectId = first(sp.project);

  const sortRaw = first(sp.sort);
  const sort: SimulationSort = (SIMULATION_SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as SimulationSort)
    : DEFAULT_SIMULATION_SORT;

  const pageNum = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);

  const [result, projectList] = await Promise.all([
    listSimulations(user.id, workspace.id, {
      search,
      status: status === SIMULATION_STATUS_UI_DEFAULT ? undefined : status,
      mode: mode || undefined,
      projectId: projectId || undefined,
      sort,
      page: pageNum,
    }),
    listProjects(user.id, workspace.id, {
      status: "ACTIVE",
      sort: "name_asc",
      pageSize: PROJECT_MAX_PAGE_SIZE,
    }),
  ]);

  const projectFilterOptions = projectList.items.map((p) => ({ id: p.id, name: p.name }));

  const hasAnyFilter =
    search !== "" || status !== SIMULATION_STATUS_UI_DEFAULT || mode !== "" || projectId !== "";

  // Build a page href that preserves the active filters.
  const hrefForPage = (page: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (status !== SIMULATION_STATUS_UI_DEFAULT) qs.set("status", status);
    if (mode) qs.set("mode", mode);
    if (projectId) qs.set("project", projectId);
    if (sort !== DEFAULT_SIMULATION_SORT) qs.set("sort", sort);
    if (page > 1) qs.set("page", String(page));
    const str = qs.toString();
    return str ? `/simulations?${str}` : "/simulations";
  };

  const createAction = canCreate ? (
    <Link href="/simulations/new" className={buttonClasses()}>
      <Plus className="size-4" />
      New simulation
    </Link>
  ) : undefined;

  return (
    <div className="space-y-6">
      <div className="simverse-page-scene simverse-page-scene--simulation">
        <PageHeader
          icon={Swords}
          title="Simulations"
          description="A simulation is a reusable blueprint: a mode, the entities that take part, and the settings around them. Execution availability depends on the mode module."
          actions={createAction}
        />
      </div>

      {/* First-run empty state: nothing configured yet and no active filters. */}
      {result.total === 0 && !hasAnyFilter ? (
        <EmptyState
          icon={Swords}
          title="No simulations yet."
          description="Pick a mode, choose entities from one of your projects, and configure the rules. Save it as a draft and refine it any time. Create your first to get started."
          action={
            canCreate ? (
              <Link href="/simulations/new" className={buttonClasses()}>
                <Plus className="size-4" />
                CREATE YOUR FIRST SIMULATION
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <SimulationLibraryControls
            current={{ search, status, mode, projectId, sort }}
            projects={projectFilterOptions}
          />

          {result.items.length === 0 ? (
            <EmptyState
              icon={Swords}
              title="No simulations match your filters"
              description="Try a different search term, mode, project or status — or clear the filters to see everything."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((simulation) => (
                <SimulationCard key={simulation.id} simulation={simulation} permissions={permissions} />
              ))}
            </div>
          )}

          <SimulationPagination
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
