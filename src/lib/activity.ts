import {
  Archive,
  ArchiveRestore,
  Boxes,
  Copy,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  Building2,
  type LucideIcon,
} from "lucide-react";

export interface ActivityDescriptor {
  icon: LucideIcon;
  label: string;
}

/** Turn an audit action into a human-readable label + icon for the UI. */
export function describeAuditAction(
  action: string,
  metadata: Record<string, unknown> | null,
): ActivityDescriptor {
  const name = metadataName(metadata);
  switch (action) {
    case "user.registered":
      return { icon: UserPlus, label: "Account created" };
    case "user.logged_in":
      return { icon: LogIn, label: "Signed in" };
    case "user.logged_out":
      return { icon: LogOut, label: "Signed out" };
    case "user.profile_updated":
      return { icon: Pencil, label: "Profile updated" };
    case "workspace.created":
      return {
        icon: Sparkles,
        label: name ? `Created workspace “${name}”` : "Workspace created",
      };
    case "workspace.updated":
      return {
        icon: Building2,
        label: name ? `Renamed workspace to “${name}”` : "Workspace updated",
      };
    case "entity.created":
      return { icon: Plus, label: name ? `Created entity “${name}”` : "Created an entity" };
    case "entity.updated":
      return { icon: Pencil, label: name ? `Updated entity “${name}”` : "Updated an entity" };
    case "entity.duplicated":
      return { icon: Copy, label: name ? `Duplicated entity “${name}”` : "Duplicated an entity" };
    case "entity.archived":
      return { icon: Archive, label: name ? `Archived entity “${name}”` : "Archived an entity" };
    case "entity.restored":
      return { icon: ArchiveRestore, label: name ? `Restored entity “${name}”` : "Restored an entity" };
    case "entity.deleted":
      return { icon: Trash2, label: name ? `Deleted entity “${name}”` : "Deleted an entity" };
    case "attribute.created":
      return { icon: SlidersHorizontal, label: name ? `Created attribute “${name}”` : "Created an attribute" };
    case "attribute.updated":
      return { icon: SlidersHorizontal, label: name ? `Updated attribute “${name}”` : "Updated an attribute" };
    default:
      return { icon: Boxes, label: action };
  }
}

function metadataName(metadata: Record<string, unknown> | null): string | null {
  const name = metadata?.name;
  return typeof name === "string" ? name : null;
}
