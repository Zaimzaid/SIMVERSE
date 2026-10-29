import type { Metadata } from "next";
import { Settings as SettingsIcon } from "lucide-react";
import { requirePlatformContext } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { WorkspaceSettingsForm } from "@/components/platform/settings/workspace-settings-form";
import { ProfileSettingsForm } from "@/components/platform/settings/profile-settings-form";
import { AppearanceSettings } from "@/components/platform/settings/appearance-settings";
import {AccountSecuritySettings} from "@/components/platform/settings/account-security-settings";
import {WorkspaceCreateForm} from "@/components/platform/settings/workspace-create-form";
import {NotificationSettings} from "@/components/platform/settings/notification-settings";
import {getAccountPreferences} from "@/server/services/account-security-service";
import Link from "next/link";
import {AccountDataSettings} from "@/components/platform/settings/account-data-settings";
import {GoogleDriveSettings} from "@/components/platform/settings/google-drive-settings";
import {googleDriveStatus} from "@/server/services/google-drive-service";
import {TwoFactorSettings} from "@/components/platform/settings/two-factor-settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  const [preferences,cloud] = await Promise.all([getAccountPreferences(user.id),googleDriveStatus(user.id)]);
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
          initialLogoUrl={workspace.logoUrl ?? ""}
          canEdit={canEditWorkspace}
        />
        <ProfileSettingsForm
          initialDisplayName={user.displayName}
          initialAvatarUrl={user.avatarUrl ?? ""}
          email={user.email}
        />
        <WorkspaceCreateForm />
        <AppearanceSettings />
        <NotificationSettings initialEnabled={preferences.socialAlertsEnabled}/>
        <AccountSecuritySettings />
        <AccountDataSettings />
        <GoogleDriveSettings configured={cloud.configured} initialConnected={cloud.connected}/>
        <TwoFactorSettings initialEnabled={Boolean(user.twoFactorEnabledAt)}/> 
        <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Privacy and connected services</h2>
          <p className="text-sm text-secondary">Your public player profile and discoverability are controlled from your player identity settings. The default is private.</p>
          <Link href="/profile" className="text-sm font-medium text-accent underline">Manage player identity and visibility</Link>
          <p className="text-xs text-muted">Google Drive manual backup is available when the administrator configures OAuth. Other cloud providers are not connected. Account deletion requests can be submitted and cancelled above; deletion is not automatic.</p>
        </section>
      </div>
    </div>
  );
}
