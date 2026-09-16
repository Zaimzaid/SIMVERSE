import {
  LogIn,
  LogOut,
  Pencil,
  Sparkles,
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
        label: metadataName(metadata)
          ? `Created workspace “${metadataName(metadata)}”`
          : "Workspace created",
      };
    case "workspace.updated":
      return {
        icon: Building2,
        label: metadataName(metadata)
          ? `Renamed workspace to “${metadataName(metadata)}”`
          : "Workspace updated",
      };
    default:
      return { icon: Sparkles, label: action };
  }
}

function metadataName(metadata: Record<string, unknown> | null): string | null {
  const name = metadata?.name;
  return typeof name === "string" ? name : null;
}
