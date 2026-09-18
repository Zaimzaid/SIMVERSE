import {
  Archive,
  ArchiveRestore,
  Boxes,
  CheckCircle2,
  Copy,
  FileText,
  FolderPlus,
  FolderCog,
  LogIn,
  LogOut,
  MinusCircle,
  Pencil,
  Plus,
  PlusCircle,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  Building2,
  Wand2,
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
    case "project.created":
      return { icon: FolderPlus, label: name ? `Created project “${name}”` : "Created a project" };
    case "project.updated":
      return { icon: FolderCog, label: name ? `Updated project “${name}”` : "Updated a project" };
    case "project.archived":
      return { icon: Archive, label: name ? `Archived project “${name}”` : "Archived a project" };
    case "project.restored":
      return { icon: ArchiveRestore, label: name ? `Restored project “${name}”` : "Restored a project" };
    case "project.deleted":
      return { icon: Trash2, label: name ? `Deleted project “${name}”` : "Deleted a project" };
    case "project.entity_added":
      return { icon: PlusCircle, label: name ? `Added entity “${name}” to a project` : "Added an entity to a project" };
    case "project.entity_removed":
      return { icon: MinusCircle, label: name ? `Removed entity “${name}” from a project` : "Removed an entity from a project" };
    case "simulation.created":
      return { icon: Wand2, label: name ? `Created simulation “${name}”` : "Created a simulation" };
    case "simulation.updated":
      return { icon: Pencil, label: name ? `Updated simulation “${name}”` : "Updated a simulation" };
    case "simulation.duplicated":
      return { icon: Copy, label: name ? `Duplicated simulation “${name}”` : "Duplicated a simulation" };
    case "simulation.archived":
      return { icon: Archive, label: name ? `Archived simulation “${name}”` : "Archived a simulation" };
    case "simulation.restored":
      return { icon: ArchiveRestore, label: name ? `Restored simulation “${name}”` : "Restored a simulation" };
    case "simulation.deleted":
      return { icon: Trash2, label: name ? `Deleted simulation “${name}”` : "Deleted a simulation" };
    case "simulation.ready":
      return { icon: CheckCircle2, label: name ? `Marked simulation “${name}” ready` : "Marked a simulation ready" };
    case "simulation.draft":
      return { icon: FileText, label: name ? `Moved simulation “${name}” to draft` : "Moved a simulation to draft" };
    default:
      return { icon: Boxes, label: action };
  }
}

function metadataName(metadata: Record<string, unknown> | null): string | null {
  const name = metadata?.name;
  return typeof name === "string" ? name : null;
}
