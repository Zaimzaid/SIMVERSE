import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import { NotFoundError } from "@/lib/errors";
import { PROJECT_MAX_PAGE_SIZE } from "@/lib/projects/constants";
import { requirePlatformContext } from "@/server/context";
import { getProject, listProjects } from "@/server/services/project-service";
import { listWorldBindingOptions } from "@/server/services/world-service";
import { listExperienceBindingOptions } from "@/server/services/experience-profile-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { SimulationBuilder } from "@/components/simulations/simulation-builder";
import { emptyBuilderInitial } from "@/components/simulations/simulation-builder-model";

export const metadata: Metadata = { title: "New simulation" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function NewSimulationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, workspace, permissions } = await requirePlatformContext();

  if (!permissions.includes("simulation.create")) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={Swords}
          title="New simulation"
          description="Configure a new simulation blueprint."
        />
        <EmptyState
          icon={Swords}
          title="You can’t create simulations"
          description="Your role doesn’t include permission to create simulations in this workspace."
          action={
            <Link href="/simulations" className={buttonClasses({ variant: "secondary" })}>
              <ArrowLeft className="size-4" />
              Back to simulations
            </Link>
          }
        />
      </div>
    );
  }

  // Active projects the simulation may belong to (a simulation always lives in a project).
  const [projectList, worlds, experiences] = await Promise.all([
    listProjects(user.id, workspace.id, { status: "ACTIVE", sort: "name_asc", pageSize: PROJECT_MAX_PAGE_SIZE }),
    listWorldBindingOptions(user.id, workspace.id),
    listExperienceBindingOptions(user.id, workspace.id),
  ]);
  const projects = projectList.items.map((p) => ({ id: p.id, name: p.name }));

  // Resolve an optional ?projectId= preselection. It MUST belong to this
  // workspace: an unknown or foreign id simply falls back to no preselection and
  // never reveals whether such a record exists elsewhere (safe NotFound).
  const sp = await searchParams;
  const requestedProjectId = first(sp.projectId);
  let preselectId = "";
  let projectName: string | undefined;

  if (requestedProjectId) {
    const known = projectList.items.find((p) => p.id === requestedProjectId);
    if (known) {
      preselectId = known.id;
      projectName = known.name;
    } else {
      // Could be an active project beyond this page, or an archived one — confirm
      // workspace ownership before preselecting; ignore silently if it isn't ours.
      try {
        const project = await getProject(user.id, workspace.id, requestedProjectId);
        preselectId = project.id;
        projectName = project.name;
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
      }
    }
  }

  const noProjects = projects.length === 0 && preselectId === "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={preselectId ? `/projects/${preselectId}` : "/simulations"}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {projectName ?? "Simulations"}
        </Link>
        <PageHeader
          icon={Swords}
          title="New simulation"
          description="Configure a simulation blueprint — mode, participants, settings and presentation. Save a draft any time; execution depends on mode availability."
        />
      </div>

      {noProjects ? (
        <EmptyState
          icon={Swords}
          title="Create a project first"
          description="A simulation lives inside a project and draws its participants from that project’s entities. Create a project and add some entities, then come back to configure a simulation."
          action={
            permissions.includes("project.create") ? (
              <Link href="/projects/new" className={buttonClasses()}>
                Create a project
              </Link>
            ) : undefined
          }
        />
      ) : (
        <SimulationBuilder
          mode="create"
          initial={emptyBuilderInitial(preselectId)}
          projects={projects}
          worlds={worlds}
          experiences={experiences}
          projectName={projectName}
        />
      )}
    </div>
  );
}
