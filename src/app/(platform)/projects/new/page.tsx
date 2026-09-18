import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata: Metadata = { title: "Create project" };

export default async function NewProjectPage() {
  const { permissions } = await requirePlatformContext();

  if (!permissions.includes("project.create")) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={FolderKanban}
          title="Create project"
          description="Add a new project to this workspace."
        />
        <EmptyState
          icon={FolderKanban}
          title="You can’t create projects"
          description="Your role doesn’t include permission to create projects in this workspace."
          action={
            <Link href="/projects" className={buttonClasses({ variant: "secondary" })}>
              <ArrowLeft className="size-4" />
              Back to Projects
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
          href="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Projects
        </Link>
        <PageHeader
          icon={FolderKanban}
          title="Create project"
          description="Name your project and give it a look. You can add entities and configure simulations after it’s created."
        />
      </div>

      <ProjectForm mode="create" />
    </div>
  );
}
