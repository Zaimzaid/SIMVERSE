import Link from "next/link";
import { Boxes, FolderKanban, Swords } from "lucide-react";
import type { Permission } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/utils";
import type { ProjectView } from "@/server/services/project-service";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProjectActions } from "./project-actions";

export interface ProjectCardProps {
  project: ProjectView;
  permissions: Permission[];
}

/** A single project in the Library grid. The whole card links to the detail view. */
export function ProjectCard({ project, permissions }: ProjectCardProps) {
  const isArchived = project.status === "ARCHIVED";

  return (
    <Card interactive as="article" className="relative flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-strong bg-background/60 text-accent">
          {project.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <FolderKanban className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isArchived ? (
              <Badge variant="warning">Archived</Badge>
            ) : (
              <Badge variant="outline">Project</Badge>
            )}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-foreground">
            <Link
              href={`/projects/${project.id}`}
              className="after:absolute after:inset-0 after:content-[''] hover:text-accent focus-visible:outline-none"
            >
              {project.name}
            </Link>
          </h3>
        </div>

        {/* Sits above the stretched link so the menu stays clickable. */}
        <div className="relative z-10 -mr-1 -mt-1">
          <ProjectActions project={project} permissions={permissions} />
        </div>
      </div>

      {project.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-secondary">{project.description}</p>
      ) : (
        <p className="mt-3 line-clamp-2 text-sm italic text-muted">No description.</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Boxes className="size-3.5" />
            {project.entityCount} {project.entityCount === 1 ? "entity" : "entities"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Swords className="size-3.5" />
            {project.simulationCount} {project.simulationCount === 1 ? "simulation" : "simulations"}
          </span>
        </div>
        <span>Updated {formatRelativeTime(project.updatedAt)}</span>
      </div>
    </Card>
  );
}
