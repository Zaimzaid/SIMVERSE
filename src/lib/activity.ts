import {
  Aperture,
  Archive,
  ArchiveRestore,
  Boxes,
  CheckCircle2,
  Copy,
  FileText,
  FolderPlus,
  FolderCog,
  Globe2,
  LogIn,
  LogOut,
  MinusCircle,
  Pencil,
  Plus,
  PlusCircle,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
  Users,
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
    case "world.created":
      return { icon: Globe2, label: name ? `Created World “${name}”` : "Created a World" };
    case "world.updated":
      return { icon: Globe2, label: name ? `Updated World “${name}”` : "Updated a World" };
    case "world.archived":
      return { icon: Archive, label: name ? `Archived World “${name}”` : "Archived a World" };
    case "world.restored":
      return { icon: ArchiveRestore, label: name ? `Restored World “${name}”` : "Restored a World" };
    case "world.deleted":
      return { icon: Trash2, label: name ? `Deleted World “${name}”` : "Deleted a World" };
    case "experience.created":
      return { icon: Aperture, label: name ? `Created Experience Profile “${name}”` : "Created an Experience Profile" };
    case "experience.updated":
      return { icon: Aperture, label: name ? `Updated Experience Profile “${name}”` : "Updated an Experience Profile" };
    case "experience.archived":
      return { icon: Archive, label: name ? `Archived Experience Profile “${name}”` : "Archived an Experience Profile" };
    case "experience.restored":
      return { icon: ArchiveRestore, label: name ? `Restored Experience Profile “${name}”` : "Restored an Experience Profile" };
    case "experience.deleted":
      return { icon: Trash2, label: name ? `Deleted Experience Profile “${name}”` : "Deleted an Experience Profile" };
    case "tournament.created":
      return { icon: Trophy, label: name ? `Created Tournament ${name}` : "Created a Tournament" };
    case "tournament.updated":
      return { icon: Trophy, label: name ? `Updated Tournament ${name}` : "Updated a Tournament" };
    case "tournament.participants_updated":
      return { icon: Users, label: "Updated Tournament participants" };
    case "tournament.structure_generated":
      return { icon: Trophy, label: "Generated Tournament bracket or schedule" };
    case "tournament.ready":
      return { icon: CheckCircle2, label: "Marked Tournament ready" };
    case "tournament.started":
      return { icon: Trophy, label: "Started Tournament" };
    case "tournament.paused":
      return { icon: Trophy, label: "Paused Tournament" };
    case "tournament.resumed":
      return { icon: Trophy, label: "Resumed Tournament" };
    case "tournament.cancelled":
      return { icon: MinusCircle, label: "Cancelled Tournament" };
    case "tournament.match_run_created":
      return { icon: Swords, label: "Launched Tournament Match Run" };
    case "tournament.result_accepted":
      return { icon: CheckCircle2, label: "Accepted authoritative Tournament Match result" };
    case "tournament.participant_advanced":
      return { icon: Trophy, label: "Advanced Tournament participant" };
    case "tournament.completed":
      return { icon: Trophy, label: "Completed Tournament" };
    case "tournament.archived":
      return { icon: Archive, label: name ? `Archived Tournament ${name}` : "Archived a Tournament" };
    case "tournament.restored":
      return { icon: ArchiveRestore, label: name ? `Restored Tournament ${name}` : "Restored a Tournament" };
    case "tournament.deleted":
      return { icon: Trash2, label: name ? `Deleted Tournament ${name}` : "Deleted a Tournament" };
    default:
      return { icon: Boxes, label: action };
  }
}

function metadataName(metadata: Record<string, unknown> | null): string | null {
  const name = metadata?.name;
  return typeof name === "string" ? name : null;
}
