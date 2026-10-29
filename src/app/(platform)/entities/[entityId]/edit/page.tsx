import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, Palette } from "lucide-react";
import { isHiddenResourceError } from "@/lib/errors";
import { requirePlatformContext } from "@/server/context";
import { listAttributeDefinitions } from "@/server/services/attribute-service";
import {
  getEntity,
  listWorkspaceTags,
  type EntityView,
} from "@/server/services/entity-service";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { EntityForm } from "@/components/entities/entity-form";
import { entityToFormInitial } from "@/components/entities/entity-form-model";

export const metadata: Metadata = { title: "Edit entity" };

interface PageParams {
  params: Promise<{ entityId: string }>;
}

async function loadEntity(userId: string, workspaceId: string, entityId: string): Promise<EntityView> {
  try {
    return await getEntity(userId, workspaceId, entityId);
  } catch (error) {
    if (isHiddenResourceError(error)) notFound();
    throw error;
  }
}

export default async function EditEntityPage({ params }: PageParams) {
  const { entityId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();

  const entity = await loadEntity(user.id, workspace.id, entityId);

  if (!permissions.includes("entity.edit")) {
    return (
      <div className="space-y-8">
        <PageHeader
          icon={Boxes}
          title="Edit entity"
          description={`Update ${entity.name}.`}
        />
        <EmptyState
          icon={Boxes}
          title="You can’t edit this entity"
          description="Your role doesn’t include permission to edit entities in this workspace."
          action={
            <Link href={`/entities/${entity.id}`} className={buttonClasses({ variant: "secondary" })}>
              <ArrowLeft className="size-4" />
              Back to entity
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
          href={`/entities/${entity.id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {entity.name}
        </Link>
        <PageHeader
          icon={Boxes}
          title="Edit entity"
          description="Update this entity’s identity, appearance, attributes, and tags."
        />
        <Link href={`/entities/${entity.id}/visuals`} className={buttonClasses({ variant: "secondary", className: "mt-3" })}>
          <Palette className="size-4" />Visuals
        </Link>
      </div>

      <EntityForm
        mode="edit"
        initial={entityToFormInitial(entity)}
        initialDefinitions={definitions}
        tagSuggestions={tags.map((t) => t.name)}
      />
    </div>
  );
}
