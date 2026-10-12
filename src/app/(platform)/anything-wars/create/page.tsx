import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Swords } from "lucide-react";
import { redirect } from "next/navigation";
import { ANYTHING_WARS_EVENT_MODES, isAnythingWarsEventMode } from "@/lib/anything-wars/constants";
import { NotFoundError } from "@/lib/errors";
import { PROJECT_MAX_PAGE_SIZE } from "@/lib/projects/constants";
import { defaultModeConfig } from "@/lib/simulations/config";
import { requirePlatformContext } from "@/server/context";
import { getAnythingWarsEvent } from "@/server/services/anything-wars-service";
import { getProject, listProjects } from "@/server/services/project-service";
import { listWorldBindingOptions } from "@/server/services/world-service";
import { listExperienceBindingOptions } from "@/server/services/experience-profile-service";
import { SimulationBuilder } from "@/components/simulations/simulation-builder";
import { emptyBuilderInitial, simulationToBuilderInitial } from "@/components/simulations/simulation-builder-model";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Create War" };
type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

export default async function AnythingWarsCreatePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user, workspace, permissions } = await requirePlatformContext();
  const query = await searchParams;
  const requestedMode = first(query.mode).toLowerCase();
  if (requestedMode === "tournament") redirect("/anything-wars/tournaments/new");
  if (requestedMode && !isAnythingWarsEventMode(requestedMode)) {
    return <EmptyState icon={Swords} title="That mode is coming later" description={`Anything Wars v0 supports ${ANYTHING_WARS_EVENT_MODES.join(", ")}, plus the dedicated Tournament flow.`} action={<Link href="/anything-wars" className={buttonClasses({ variant: "secondary" })}>Back to Anything Wars</Link>} />;
  }

  const eventId = first(query.eventId);
  const rematchId = first(query.rematch);
  const editing = Boolean(eventId);
  const requiredPermission = editing ? "simulation.edit" : "simulation.create";
  if (!permissions.includes(requiredPermission)) {
    return <EmptyState icon={Swords} title="You cannot configure this war" description="Your workspace role does not include the required simulation permission." action={<Link href="/anything-wars" className={buttonClasses({ variant: "secondary" })}>Back to Anything Wars</Link>} />;
  }

  const [projectList, worlds, experiences] = await Promise.all([
    listProjects(user.id, workspace.id, { status: "ACTIVE", sort: "name_asc", pageSize: PROJECT_MAX_PAGE_SIZE }),
    listWorldBindingOptions(user.id, workspace.id),
    listExperienceBindingOptions(user.id, workspace.id),
  ]);
  const projects = projectList.items.map((project) => ({ id: project.id, name: project.name }));
  let projectName: string | undefined;
  let initial = emptyBuilderInitial(first(query.projectId));

  if (eventId || rematchId) {
    const source = await getAnythingWarsEvent(user.id, workspace.id, eventId || rematchId);
    initial = simulationToBuilderInitial(source);
    projectName = source.projectName ?? undefined;
    if (rematchId) {
      initial = { ...initial, id: "", name: `${source.name} Rematch`, seed: "" };
    }
  } else if (requestedMode) {
    initial = { ...initial, mode: requestedMode, modeConfig: defaultModeConfig(requestedMode) };
  }

  if (initial.projectId && !projects.some((project) => project.id === initial.projectId) && !projectName) {
    try {
      const project = await getProject(user.id, workspace.id, initial.projectId);
      projectName = project.name;
    } catch (error) {
      if (!(error instanceof NotFoundError)) throw error;
      initial = { ...initial, projectId: "" };
    }
  }

  if (!projects.length && !initial.projectId) {
    return <EmptyState icon={Swords} title="Create a project first" description="Anything Wars uses a Project's existing Entities as competitors." action={permissions.includes("project.create") ? <Link href="/projects/new" className={buttonClasses()}>Create project</Link> : undefined} />;
  }

  return (
    <div className="space-y-6">
      <Link href={editing ? `/anything-wars/events/${eventId}` : "/anything-wars"} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" />Anything Wars</Link>
      <PageHeader eyebrow="Anything Wars" icon={Swords} title={editing ? "Edit War" : rematchId ? "Set up Rematch" : "Start a New War"} description="Choose competitors, an optional World and presentation style, then configure the authoritative match." />
      <SimulationBuilder
        mode={editing ? "edit" : "create"}
        initial={initial}
        projects={projects}
        worlds={worlds}
        experiences={experiences}
        projectName={projectName}
        variant="anything-wars"
        canRun={permissions.includes("simulation.run")}
      />
    </div>
  );
}
