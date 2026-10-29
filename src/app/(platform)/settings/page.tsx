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

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  const preferences = await getAccountPreferences(user.id);
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
        <section className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <h2 className="font-semibold text-foreground">Privacy and connected services</h2>
          <p className="text-sm text-secondary">Your public player profile and discoverability are controlled from your player identity settings. The default is private.</p>
          <Link href="/profile" className="text-sm font-medium text-accent underline">Manage player identity and visibility</Link>
          <p className="text-xs text-muted">External cloud connections, two-factor authentication and account deletion are not available in this release.</p>
        </section>
      </div>
    </div>
  );
}
