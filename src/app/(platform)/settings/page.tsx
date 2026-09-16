import type { Metadata } from "next";
import { Settings as SettingsIcon } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceSettingsForm } from "@/components/platform/settings/workspace-settings-form";
import { ProfileSettingsForm } from "@/components/platform/settings/profile-settings-form";
import { AppearanceSettings } from "@/components/platform/settings/appearance-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  const canEditWorkspace = permissions.includes("workspace.edit");

  return (
    <div className="space-y-8">
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        description="Manage your workspace, profile, and appearance."
      />

      <div className="max-w-2xl space-y-6">
        <WorkspaceSettingsForm
          workspaceId={workspace.id}
          initialName={workspace.name}
          canEdit={canEditWorkspace}
        />
        <ProfileSettingsForm
          initialDisplayName={user.displayName}
          initialAvatarUrl={user.avatarUrl ?? ""}
          email={user.email}
        />
        <AppearanceSettings />
      </div>
    </div>
  );
}
