import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { getProject, type ProjectView } from "@/server/services/project-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";
import { projectToFormInitial } from "@/components/projects/project-form-model";

export const metadata: Metadata = { title: "Edit project" };

interface PageParams {
  params: Promise<{ projectId: string }>;
}

async function loadProject(userId: string, workspaceId: string, projectId: string): Promise<ProjectView> {
  try {
    return await getProject(userId, workspaceId, projectId);
  } catch (error) {
    if (isHiddenResourceError(error)) notFound();
    throw error;
  }
}

export default async function EditProjectPage({ params }: PageParams) {
  const { projectId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();

  const project = await loadProject(user.id, workspace.id, projectId);

  if (!permissions.includes("project.edit")) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={FolderKanban}
          title="Edit project"
          description={`Update ${project.name}.`}
        />
        <EmptyState
          icon={FolderKanban}
          title="You can’t edit this project"
          description="Your role doesn’t include permission to edit projects in this workspace."
          action={
            <Link href={`/projects/${project.id}`} className={buttonClasses({ variant: "secondary" })}>
              <ArrowLeft className="size-4" />
              Back to project
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/projects/${project.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {project.name}
        </Link>
        <PageHeader
          icon={FolderKanban}
          title="Edit project"
          description="Update this project’s name, description, and appearance."
        />
      </div>

      <ProjectForm mode="edit" initial={projectToFormInitial(project)} />
    </div>
  );
}
