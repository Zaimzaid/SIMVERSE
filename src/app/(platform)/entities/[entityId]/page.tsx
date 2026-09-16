import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  Hash,
  Pencil,
  Tag as TagIcon,
  User as UserIcon,
} from "lucide-react";
import { NotFoundError } from "@/lib/errors";
import { resolveCategory } from "@/lib/entities/categories";
import { ATTRIBUTE_DATA_TYPE_META } from "@/lib/entities/constants";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import {
  getEntity,
  type EntityAttributeView,
  type EntityView,
} from "@/server/services/entity-service";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EntityActions } from "@/components/entities/entity-actions";

interface PageParams {
  params: Promise<{ entityId: string }>;
}

/** Load an entity, translating a service NotFoundError into a real 404. */
async function loadEntity(userId: string, workspaceId: string, entityId: string): Promise<EntityView> {
  try {
    return await getEntity(userId, workspaceId, entityId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { entityId } = await params;
  try {
    const { user, workspace } = await requirePlatformContext();
    const entity = await getEntity(user.id, workspace.id, entityId);
    return { title: entity.name };
  } catch {
    return { title: "Entity" };
  }
}

function formatAttributeValue(attr: EntityAttributeView): string {
  if (attr.dataType === "BOOLEAN") return attr.value ? "Yes" : "No";
  if (attr.dataType === "NUMBER") {
    const num = typeof attr.value === "number" ? attr.value : Number(attr.value);
    const text = Number.isFinite(num) ? String(num) : String(attr.value);
    return attr.unit ? `${text} ${attr.unit}` : text;
  }
  return String(attr.value);
}

/** For a bounded numeric attribute, the fill fraction (0–1) for a small meter. */
function numericFraction(attr: EntityAttributeView): number | null {
  if (attr.dataType !== "NUMBER" || attr.minimum == null || attr.maximum == null) return null;
  const num = typeof attr.value === "number" ? attr.value : Number(attr.value);
  if (!Number.isFinite(num) || attr.maximum <= attr.minimum) return null;
  const fraction = (num - attr.minimum) / (attr.maximum - attr.minimum);
  return Math.min(1, Math.max(0, fraction));
}

export default async function EntityDetailPage({ params }: PageParams) {
  const { entityId } = await params;
  const { user, workspace, permissions } = await requirePlatformContext();

  const entity = await loadEntity(user.id, workspace.id, entityId);

  const category = resolveCategory(entity.category);
  const CategoryIcon = category.icon;
  const isArchived = entity.status === "ARCHIVED";
  const canEdit = permissions.includes("entity.edit");
  const metadataEntries = Object.entries(entity.metadata ?? {});
  const accent = entity.primaryColor ?? undefined;

  return (
    <div className="space-y-6">
      <Link
        href="/entities"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Entities
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span
            className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border-strong bg-background/60 text-accent"
            style={accent ? { borderColor: `${accent}66`, color: accent } : undefined}
          >
            {entity.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entity.imageUrl} alt="" className="size-full object-cover" />
            ) : (
              <CategoryIcon className="size-7" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <CategoryIcon className="size-3" />
                {category.label}
              </Badge>
              {isArchived ? <Badge variant="warning">Archived</Badge> : null}
            </div>
            <h1 className="mt-2 truncate font-display text-2xl font-semibold text-foreground">
              {entity.name}
            </h1>
            {entity.shortName ? (
              <p className="text-sm text-muted">{entity.shortName}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit ? (
            <Link href={`/entities/${entity.id}/edit`} className={buttonClasses({ variant: "secondary" })}>
              <Pencil className="size-4" />
              Edit
            </Link>
          ) : null}
          <EntityActions
            entity={{ id: entity.id, name: entity.name, status: entity.status }}
            permissions={permissions}
            showView={false}
            navigateOnDuplicate
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {entity.description ? (
            <Card as="section">
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                  {entity.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card as="section">
            <CardHeader>
              <CardTitle>Attributes</CardTitle>
            </CardHeader>
            <CardContent>
              {entity.attributes.length === 0 ? (
                <p className="text-sm text-muted">No attributes assigned to this entity.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {entity.attributes.map((attr) => {
                    const fraction = numericFraction(attr);
                    return (
                      <li key={attr.attributeDefinitionId} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{attr.name}</span>
                            <span className="ml-2 text-xs text-muted">
                              {ATTRIBUTE_DATA_TYPE_META[attr.dataType].label}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono text-sm text-foreground">
                            {formatAttributeValue(attr)}
                          </span>
                        </div>
                        {fraction != null ? (
                          <div
                            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.round(fraction * 100)}%`,
                                backgroundColor: accent ?? "var(--color-accent)",
                              }}
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {metadataEntries.length > 0 ? (
            <Card as="section">
              <CardHeader>
                <CardTitle>Additional info</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {metadataEntries.map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <dt className="text-xs uppercase tracking-wide text-muted">{key}</dt>
                      <dd className="mt-0.5 break-words text-sm text-secondary">
                        {typeof value === "string" ? value : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {(entity.primaryColor || entity.secondaryColor) ? (
            <Card as="section">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {entity.primaryColor ? (
                  <ColorRow label="Primary" value={entity.primaryColor} />
                ) : null}
                {entity.secondaryColor ? (
                  <ColorRow label="Secondary" value={entity.secondaryColor} />
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {entity.tags.length > 0 ? (
            <Card as="section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TagIcon className="size-4 text-muted" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {entity.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/entities?tag=${encodeURIComponent(tag.slug)}`}
                      className="rounded-md bg-surface-hover px-2 py-0.5 text-xs text-secondary transition-colors hover:text-foreground"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card as="section">
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {entity.createdByName ? (
                <MetaRow icon={UserIcon} label="Created by" value={entity.createdByName} />
              ) : null}
              <MetaRow
                icon={CalendarPlus}
                label="Created"
                value={formatRelativeTime(entity.createdAt)}
              />
              <MetaRow
                icon={CalendarClock}
                label="Updated"
                value={formatRelativeTime(entity.updatedAt)}
              />
              <MetaRow icon={Hash} label="ID" value={entity.id} mono />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ColorRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="size-8 shrink-0 rounded-lg border border-border-strong"
        style={{ backgroundColor: value }}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="font-mono text-sm text-foreground">{value}</p>
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
