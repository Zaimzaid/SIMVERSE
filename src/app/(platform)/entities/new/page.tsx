import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Boxes } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { listAttributeDefinitions } from "@/server/services/attribute-service";
import { listWorkspaceTags } from "@/server/services/entity-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { EntityForm } from "@/components/entities/entity-form";

export const metadata: Metadata = { title: "Create entity" };

export default async function NewEntityPage() {
  const { user, workspace, permissions } = await requirePlatformContext();

  if (!permissions.includes("entity.create")) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={Boxes}
          title="Create entity"
          description="Add a new object to this workspace."
        />
        <EmptyState
          icon={Boxes}
          title="You can’t create entities"
          description="Your role doesn’t include permission to create entities in this workspace."
          action={
            <Link href="/entities" className={buttonClasses({ variant: "secondary" })}>
              <ArrowLeft className="size-4" />
              Back to Entities
            </Link>
          }
        />
      </div>
    );
  }

  const [definitions, tags] = await Promise.all([
    listAttributeDefinitions(user.id, workspace.id),
    listWorkspaceTags(user.id, workspace.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/entities"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Entities
        </Link>
        <PageHeader
          icon={Boxes}
          title="Create entity"
          description="Define a new object for your worlds — its identity, look, and attributes. You can change everything later."
        />
      </div>

      <EntityForm
        mode="create"
        initialDefinitions={definitions}
        tagSuggestions={tags.map((t) => t.name)}
      />
    </div>
  );
}
