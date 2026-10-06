import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import { NotFoundError } from "@/lib/errors";
import { PROJECT_MAX_PAGE_SIZE } from "@/lib/projects/constants";
import { requirePlatformContext } from "@/server/context";
import { getSimulation, type SimulationView } from "@/server/services/simulation-service";
import { getProject, listProjects } from "@/server/services/project-service";
import { listWorldBindingOptions } from "@/server/services/world-service";
import { listExperienceBindingOptions } from "@/server/services/experience-profile-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { SimulationBuilder } from "@/components/simulations/simulation-builder";
import { simulationToBuilderInitial } from "@/components/simulations/simulation-builder-model";

export const metadata: Metadata = { title: "Edit simulation" };

interface PageParams {
  params: Promise<{ simulationId: string }>;
}

async function loadSimulation(
  userId: string,
  workspaceId: string,
  simulationId: string,
): Promise<SimulationView> {
  try {
    return await getSimulation(userId, workspaceId, simulationId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export default async function EditSimulationPage({ params }: PageParams) {
  const { simulationId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();

  const simulation = await loadSimulation(user.id, workspace.id, simulationId);

  const backToSimulation = (
    <Link
      href={`/simulations/${simulation.id}`}
      className={buttonClasses({ variant: "secondary" })}
    >
      <ArrowLeft className="size-4" />
      Back to simulation
    </Link>
  );

  if (!permissions.includes("simulation.edit")) {
    return (
      <div className="space-y-8">
        <PageHeader icon={Swords} title="Edit simulation" description={`Update ${simulation.name}.`} />
        <EmptyState
          icon={Swords}
          title="You can’t edit this simulation"
          description="Your role doesn’t include permission to edit simulations in this workspace."
          action={backToSimulation}
        />
      </div>
    );
  }

  // An archived blueprint is read-only until restored — the same rule the actions
  // menu enforces (Edit is hidden while archived).
  if (simulation.status === "ARCHIVED") {
    return (
      <div className="space-y-8">
        <PageHeader icon={Swords} title="Edit simulation" description={`Update ${simulation.name}.`} />
        <EmptyState
          icon={Swords}
          title="Restore this simulation to edit it"
          description="This simulation is archived. Restore it first, then you can change its configuration."
          action={backToSimulation}
        />
      </div>
    );
  }

  // Projects the simulation can belong to. Include the current project even if it
  // isn't in the active page, so the builder can always display the selection.
  const [projectList, worlds, experiences] = await Promise.all([
    listProjects(user.id, workspace.id, { status: "ACTIVE", sort: "name_asc", pageSize: PROJECT_MAX_PAGE_SIZE }),
    listWorldBindingOptions(user.id, workspace.id),
    listExperienceBindingOptions(user.id, workspace.id),
  ]);
  const projects = projectList.items.map((p) => ({ id: p.id, name: p.name }));

  if (!projects.some((p) => p.id === simulation.projectId)) {
    try {
      const current = await getProject(user.id, workspace.id, simulation.projectId);
      projects.unshift({ id: current.id, name: current.name });
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/simulations/${simulation.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {simulation.name}
        </Link>
        <PageHeader
          icon={Swords}
          title="Edit simulation"
          description="Update this simulation’s mode, participants, settings and presentation. Execution depends on mode availability."
        />
      </div>

      <SimulationBuilder
        mode="edit"
        initial={simulationToBuilderInitial(simulation)}
        projects={projects}
        worlds={worlds}
        experiences={experiences}
        projectName={simulation.projectName ?? undefined}
      />
    </div>
  );
}
