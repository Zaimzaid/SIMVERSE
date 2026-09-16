import Link from "next/link";
import type { Permission } from "@/lib/permissions";
import { resolveCategory } from "@/lib/entities/categories";
import { formatRelativeTime } from "@/lib/utils";
import type { EntityView } from "@/server/services/entity-service";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EntityActions } from "./entity-actions";

export interface EntityCardProps {
  entity: EntityView;
  permissions: Permission[];
}

/** A single entity in the Library grid. The whole card links to the detail view. */
export function EntityCard({ entity, permissions }: EntityCardProps) {
  const category = resolveCategory(entity.category);
  const CategoryIcon = category.icon;
  const attrCount = entity.attributes.length;
  const isArchived = entity.status === "ARCHIVED";

  return (
    <Card interactive as="article" className="relative flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border-strong bg-background/60 text-accent"
          style={
            entity.primaryColor
              ? { borderColor: `${entity.primaryColor}66`, color: entity.primaryColor }
              : undefined
          }
        >
          {entity.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entity.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <CategoryIcon className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <CategoryIcon className="size-3" />
              {category.label}
            </Badge>
            {isArchived ? <Badge variant="warning">Archived</Badge> : null}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-foreground">
            <Link
              href={`/entities/${entity.id}`}
              className="after:absolute after:inset-0 after:content-[''] hover:text-accent focus-visible:outline-none"
            >
              {entity.name}
            </Link>
          </h3>
          {entity.shortName ? (
            <p className="truncate text-sm text-muted">{entity.shortName}</p>
          ) : null}
        </div>

        {/* Sits above the stretched link so the menu stays clickable. */}
        <div className="relative z-10 -mr-1 -mt-1">
          <EntityActions entity={entity} permissions={permissions} />
        </div>
      </div>

      {entity.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-secondary">{entity.description}</p>
      ) : null}

      {entity.tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entity.tags.slice(0, 4).map((tag) => (
            <span
              key={tag.id}
              className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-secondary"
            >
              {tag.name}
            </span>
          ))}
          {entity.tags.length > 4 ? (
            <span className="rounded-md px-1 py-0.5 text-xs text-muted">
              +{entity.tags.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
        <span>
          {attrCount} attribute{attrCount === 1 ? "" : "s"}
        </span>
        <span>Updated {formatRelativeTime(entity.updatedAt)}</span>
      </div>
    </Card>
  );
}
