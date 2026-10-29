import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  CalendarClock,
  CalendarPlus,
  FolderKanban,
  Hash,
  Pencil,
  Plus,
  Swords,
  User as UserIcon,
} from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors";
import { ENTITY_MAX_PAGE_SIZE } from "@/lib/entities/constants";
import { SIMULATION_MAX_PAGE_SIZE } from "@/lib/simulations/constants";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import { getProject, type ProjectView } from "@/server/services/project-service";
import { listEntities } from "@/server/services/entity-service";
import { listSimulations } from "@/server/services/simulation-service";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectActions } from "@/components/projects/project-actions";
import {ProjectTeamPanel} from "@/components/projects/project-team-panel";
import {listProjectAssignments} from "@/server/services/project-assignment-service";
import {getWorkspaceMembers} from "@/server/services/workspace-service";
import { ProjectEntitiesManager } from "@/components/projects/project-entities-manager";
import { SimulationCard } from "@/components/simulations/simulation-card";

interface PageParams {
  params: Promise<{ projectId: string }>;
}

/** Load a project, translating a service NotFoundError into a real 404. */
async function loadProject(userId: string, workspaceId: string, projectId: string): Promise<ProjectView> {
  try {
    return await getProject(userId, workspaceId, projectId);
  } catch (error) {
    if (isHiddenResourceError(error)) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { projectId } = await params;
  try {
    const { user, workspace } = await requirePlatformContext();
    const project = await getProject(user.id, workspace.id, projectId);
    return { title: project.name };
  } catch {
    return { title: "Project" };
  }
}

export default async function ProjectDetailPage({ params }: PageParams) {
  const { projectId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();

  const project = await loadProject(user.id, workspace.id, projectId);

  const isArchived = project.status === "ARCHIVED";
  const canEdit = permissions.includes("project.edit");
  const canManageEntities = permissions.includes("project.entity.manage");
  const canCreateSimulation = permissions.includes("simulation.create");

  // Entities linked to this project (any status — an archived-but-linked entity
  // still belongs here) and the project's simulations (drafts + ready, no archived).
  const [entityList, simulationList, assignments, teamMembers] = await Promise.all([
    listEntities(user.id, workspace.id, {
      projectId: project.id,
      status: "ALL",
      sort: "name_asc",
      pageSize: ENTITY_MAX_PAGE_SIZE,
    }),
    listSimulations(user.id, workspace.id, {
      projectId: project.id,
      sort: "updated_desc",
      pageSize: SIMULATION_MAX_PAGE_SIZE,
    }),
    listProjectAssignments(user.id,workspace.id,project.id),
    permissions.includes("workspace.members.view")?getWorkspaceMembers(user.id,workspace.id):Promise.resolve([]),
  ]);

  const createSimulationHref = `/simulations/new?projectId=${project.id}`;

  const overviewTab = (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card as="section">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            {project.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                {project.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted">No description yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            icon={Boxes}
            value={project.entityCount}
            label={project.entityCount === 1 ? "entity" : "entities"}
          />
          <StatCard
            icon={Swords}
            value={project.simulationCount}
            label={project.simulationCount === 1 ? "simulation" : "simulations"}
          />
        </div>
      </div>

      <div className="space-y-6">
        <Card as="section">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {project.createdByName ? (
              <MetaRow icon={UserIcon} label="Created by" value={project.createdByName} />
            ) : null}
            <MetaRow icon={CalendarPlus} label="Created" value={formatRelativeTime(project.createdAt)} />
            <MetaRow icon={CalendarClock} label="Updated" value={formatRelativeTime(project.updatedAt)} />
            <MetaRow icon={Hash} label="ID" value={project.id} mono />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const entitiesTab = (
    <ProjectEntitiesManager
      projectId={project.id}
      initialEntities={entityList.items}
      canManage={canManageEntities && !isArchived}
    />
  );

  const simulationsTab = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {simulationList.total} {simulationList.total === 1 ? "simulation" : "simulations"} in this project
        </p>
        {canCreateSimulation && !isArchived ? (
          <Link href={createSimulationHref} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Plus className="size-4" />
            Create simulation
          </Link>
        ) : null}
      </div>

      {simulationList.items.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="No simulations in this project yet"
          description="A simulation draws its participants from this project’s entities. Configure one to get started; execution becomes available as mode modules arrive."
          action={
            canCreateSimulation && !isArchived ? (
              <Link href={createSimulationHref} className={buttonClasses()}>
                <Plus className="size-4" />
                Create simulation
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {simulationList.items.map((simulation) => (
            <SimulationCard
              key={simulation.id}
              simulation={simulation}
              permissions={permissions}
              hideProject
            />
          ))}
        </div>
      )}
    </div>
  );

  const teamTab=<ProjectTeamPanel projectId={project.id}
    canManage={permissions.includes("workspace.members.manage")}
    members={teamMembers.map(m=>({id:m.id,name:m.user.displayName,email:m.user.email}))}
    assignments={assignments.map(a=>({id:a.id,membershipId:a.membershipId,responsibility:a.responsibility,
      notes:a.notes,memberName:a.membership.user.displayName,memberEmail:a.membership.user.email,
      memberAvatar:a.membership.user.avatarUrl}))}/>;
  const tabs: TabItem[] = [
    { id: "overview", label: "Overview", content: overviewTab },
    { id: "entities", label: `Entities (${project.entityCount})`, content: entitiesTab },
    { id: "simulations", label: `Simulations (${project.simulationCount})`, content: simulationsTab },
    { id: "team", label: `Team (${assignments.length})`, content: teamTab },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Projects
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border-strong bg-background/60 text-accent">
            {project.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <FolderKanban className="size-7" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {isArchived ? (
                <Badge variant="warning">Archived</Badge>
              ) : (
                <Badge variant="outline">Project</Badge>
              )}
            </div>
            <h1 className="mt-2 truncate font-display text-2xl font-semibold text-foreground">
              {project.name}
            </h1>
            {project.description ? (
              <p className="mt-0.5 line-clamp-1 text-sm text-muted">{project.description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && !isArchived ? (
            <Link href={`/projects/${project.id}/edit`} className={buttonClasses({ variant: "secondary" })}>
              <Pencil className="size-4" />
              Edit
            </Link>
          ) : null}
          <ProjectActions
            project={{ id: project.id, name: project.name, status: project.status }}
            permissions={permissions}
            showView={false}
          />
        </div>
      </div>

      {/* Archived notice */}
      {isArchived ? (
        <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-secondary">
          This project is archived. Restore it to add entities or configure new simulations.
        </div>
      ) : null}

      <Tabs items={tabs} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Boxes;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border-strong bg-background/60 text-accent">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof UserIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className={`truncate text-secondary${mono ? " font-mono text-xs" : ""}`}>{value}</p>
      </div>
    </div>
  );
}
