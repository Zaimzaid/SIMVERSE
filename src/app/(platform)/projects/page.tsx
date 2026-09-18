import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import {
  DEFAULT_PROJECT_SORT,
  PROJECT_SORTS,
  PROJECT_STATUS_FILTERS,
  type ProjectSort,
  type ProjectStatusFilter,
} from "@/lib/projects/constants";
import { requirePlatformContext } from "@/server/context";
import { listProjects } from "@/server/services/project-service";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectLibraryControls } from "@/components/projects/project-library-controls";
import { ProjectPagination } from "@/components/projects/project-pagination";

export const metadata: Metadata = { title: "Projects" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, workspace, permissions } = await requirePlatformContext();
  const canView = permissions.includes("project.view");
  const canCreate = permissions.includes("project.create");

  if (!canView) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={FolderKanban}
          title="Projects"
          description="Group related entities and simulations into projects you can organize and share with your team."
        />
        <EmptyState
          icon={FolderKanban}
          title="No access to projects"
          description="Your role doesn’t include access to this workspace’s projects."
        />
      </div>
    );
  }

  const sp = await searchParams;
  const search = first(sp.q);

  const statusRaw = first(sp.status).toUpperCase();
  const status: ProjectStatusFilter = (PROJECT_STATUS_FILTERS as readonly string[]).includes(statusRaw)
    ? (statusRaw as ProjectStatusFilter)
    : "ACTIVE";

  const sortRaw = first(sp.sort);
  const sort: ProjectSort = (PROJECT_SORTS as readonly string[]).includes(sortRaw)
    ? (sortRaw as ProjectSort)
    : DEFAULT_PROJECT_SORT;

  const pageNum = Math.max(1, Number.parseInt(first(sp.page), 10) || 1);

  const result = await listProjects(user.id, workspace.id, {
    search,
    status,
    sort,
    page: pageNum,
  });

  const hasAnyFilter = search !== "" || status !== "ACTIVE";

  // Build a page href that preserves the active filters.
  const hrefForPage = (page: number) => {
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (status !== "ACTIVE") qs.set("status", status);
    if (sort !== DEFAULT_PROJECT_SORT) qs.set("sort", sort);
    if (page > 1) qs.set("page", String(page));
    const str = qs.toString();
    return str ? `/projects?${str}` : "/projects";
  };

  const createAction = canCreate ? (
    <Link href="/projects/new" className={buttonClasses()}>
      <Plus className="size-4" />
      Create Project
    </Link>
  ) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FolderKanban}
        title="Projects"
        description="Group related entities and simulations into projects you can organize and share with your team."
        actions={createAction}
      />

      {/* First-run empty state: no projects at all and no active filters. */}
      {result.total === 0 && !hasAnyFilter ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet."
          description="Projects are workspaces for your work — group the entities you’ve built and the simulations you configure. Create your first to get started."
          action={
            canCreate ? (
              <Link href="/projects/new" className={buttonClasses()}>
                <Plus className="size-4" />
                CREATE YOUR FIRST PROJECT
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <ProjectLibraryControls current={{ search, status, sort }} />

          {result.items.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects match your filters"
              description="Try a different search term or status — or clear the filters to see everything."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.items.map((project) => (
                <ProjectCard key={project.id} project={project} permissions={permissions} />
              ))}
            </div>
          )}

          <ProjectPagination
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
